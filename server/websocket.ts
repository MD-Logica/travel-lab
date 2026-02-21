import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { URL } from "url";
import { storage } from "./storage";
import cookie from "cookie";
import { pool } from "./db";

interface ClientMeta {
  conversationId: string;
  userType: "advisor" | "client";
  userId: string;
  orgId: string;
}

interface TypingState {
  advisorTyping: boolean;
  clientTyping: boolean;
}

const rooms = new Map<string, Set<WebSocket>>();
const typingStates = new Map<string, TypingState>();
const clientMeta = new Map<WebSocket, ClientMeta>();

function getOrCreateRoom(conversationId: string): Set<WebSocket> {
  if (!rooms.has(conversationId)) rooms.set(conversationId, new Set());
  return rooms.get(conversationId)!;
}

function getTypingState(conversationId: string): TypingState {
  if (!typingStates.has(conversationId)) typingStates.set(conversationId, { advisorTyping: false, clientTyping: false });
  return typingStates.get(conversationId)!;
}

function broadcastToRoom(conversationId: string, data: any, excludeWs?: WebSocket) {
  const room = rooms.get(conversationId);
  if (!room) return;
  const payload = JSON.stringify(data);
  room.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export function broadcastNewMessage(conversationId: string, message: any) {
  broadcastToRoom(conversationId, { type: "new_message", message });
}

export function broadcastReactionUpdate(conversationId: string, messageId: string, reactions: any[]) {
  broadcastToRoom(conversationId, { type: "reaction_update", messageId, reactions });
}

export function broadcastSeen(conversationId: string, seenAt: string) {
  broadcastToRoom(conversationId, { type: "seen", seenAt });
}

async function resolveAdvisorSession(cookieHeader: string | undefined): Promise<{ userId: string; orgId: string } | null> {
  if (!cookieHeader) return null;
  const cookies = cookie.parse(cookieHeader);
  const sid = cookies["connect.sid"];
  if (!sid) return null;

  const unsignedSid = decodeURIComponent(sid);
  let sessionId: string;
  if (unsignedSid.startsWith("s:")) {
    const dotIndex = unsignedSid.indexOf(".", 2);
    sessionId = dotIndex === -1 ? unsignedSid.substring(2) : unsignedSid.substring(2, dotIndex);
  } else {
    sessionId = unsignedSid;
  }

  try {
    const result = await pool.query("SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()", [sessionId]);
    if (!result.rows.length) return null;
    const sess = result.rows[0].sess;
    const passport = sess?.passport;
    if (!passport?.user?.claims?.sub) return null;
    const userId = passport.user.claims.sub;

    const profile = await storage.getProfile(userId);
    if (!profile) return null;

    return { userId, orgId: profile.orgId };
  } catch (err) {
    console.error("[WebSocket] Session resolution error:", err);
    return null;
  }
}

async function resolveClientToken(chatToken: string): Promise<{ clientId: string; orgId: string; tripId: string } | null> {
  try {
    return await storage.validateClientChatToken(chatToken);
  } catch (err) {
    console.error("[WebSocket] Token validation error:", err);
    return null;
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/chat" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const conversationId = url.searchParams.get("conversationId");
    const userType = url.searchParams.get("userType") as "advisor" | "client";

    if (!conversationId || !userType || !["advisor", "client"].includes(userType)) {
      ws.close(1008, "Missing parameters");
      return;
    }

    let authenticatedUserId: string;
    let authenticatedOrgId: string;

    if (userType === "advisor") {
      const sessionData = await resolveAdvisorSession(req.headers.cookie);
      if (!sessionData) {
        ws.close(1008, "Unauthorized");
        return;
      }
      authenticatedUserId = sessionData.userId;
      authenticatedOrgId = sessionData.orgId;
    } else {
      const chatToken = url.searchParams.get("chatToken");
      if (!chatToken) {
        ws.close(1008, "Missing chat token");
        return;
      }
      const tokenData = await resolveClientToken(chatToken);
      if (!tokenData) {
        ws.close(1008, "Invalid or expired token");
        return;
      }
      authenticatedUserId = tokenData.clientId;
      authenticatedOrgId = tokenData.orgId;
    }

    const conversation = await storage.getConversationById(conversationId);
    if (!conversation || conversation.orgId !== authenticatedOrgId) {
      ws.close(1008, "Conversation not found");
      return;
    }

    if (userType === "client" && conversation.clientId !== authenticatedUserId) {
      ws.close(1008, "Conversation not found");
      return;
    }

    const meta: ClientMeta = {
      conversationId,
      userType,
      userId: authenticatedUserId,
      orgId: authenticatedOrgId,
    };
    clientMeta.set(ws, meta);
    const room = getOrCreateRoom(conversationId);
    room.add(ws);

    const typing = getTypingState(conversationId);
    ws.send(JSON.stringify({ type: "typing", ...typing }));

    ws.on("message", (raw) => {
      try {
        const m = clientMeta.get(ws);
        if (!m) return;

        const data = JSON.parse(raw.toString());
        if (data.type === "typing") {
          const state = getTypingState(m.conversationId);
          if (m.userType === "advisor") state.advisorTyping = !!data.isTyping;
          else state.clientTyping = !!data.isTyping;
          broadcastToRoom(m.conversationId, { type: "typing", ...state }, ws);
        } else if (data.type === "seen") {
          broadcastToRoom(m.conversationId, { type: "seen", seenAt: new Date().toISOString() }, ws);
        }
      } catch {}
    });

    const cleanup = () => {
      const m = clientMeta.get(ws);
      if (m) {
        const state = getTypingState(m.conversationId);
        if (m.userType === "advisor") state.advisorTyping = false;
        else state.clientTyping = false;
        broadcastToRoom(m.conversationId, { type: "typing", ...state }, ws);
        const r = rooms.get(m.conversationId);
        if (r) {
          r.delete(ws);
          if (r.size === 0) rooms.delete(m.conversationId);
        }
      }
      clientMeta.delete(ws);
    };

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  console.log("[WebSocket] Chat server attached at /ws/chat");
}

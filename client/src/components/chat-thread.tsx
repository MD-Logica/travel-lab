import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MessageCircle, Plane, Search } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { Link } from "wouter";
import type { Message, MessageReaction, Conversation, Trip } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

const SENT_BG = "#007AFF";
const SENT_TEXT = "#FFFFFF";
const RECEIVED_BG = "#E9E9EB";
const RECEIVED_TEXT = "#000000";

const REACTION_EMOJIS = ["\u2764\uFE0F", "\uD83D\uDC4D", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDC4E"];

interface ChatThreadProps {
  conversationId: string;
  clientName: string;
  clientAvatarUrl: string | null;
  clientId: string;
  onBack?: () => void;
  showBack?: boolean;
  showHeader?: boolean;
  showTripBanner?: boolean;
}

type LocalMessage = Message & { reactions?: MessageReaction[] };

type MessageWithGroup = LocalMessage & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function groupMessages(messages: LocalMessage[]): MessageWithGroup[] {
  if (!messages.length) return [];
  return messages.map((msg, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    const sameSenderAsPrev =
      prev &&
      prev.senderType === msg.senderType &&
      Math.abs(new Date(msg.createdAt!).getTime() - new Date(prev.createdAt!).getTime()) < 60000;
    const sameSenderAsNext =
      next &&
      next.senderType === msg.senderType &&
      Math.abs(new Date(next.createdAt!).getTime() - new Date(msg.createdAt!).getTime()) < 60000;
    return {
      ...msg,
      isFirstInGroup: !sameSenderAsPrev,
      isLastInGroup: !sameSenderAsNext,
    };
  });
}

function shouldShowTimestamp(msg: Message, prevMsg: Message | null): boolean {
  if (!prevMsg) return true;
  const curr = new Date(msg.createdAt!).getTime();
  const prev = new Date(prevMsg.createdAt!).getTime();
  return curr - prev > 5 * 60 * 1000;
}

function formatTimestamp(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "EEE MMM d, h:mm a");
}

function formatMessageTime(date: string | Date | null): string {
  if (!date) return "";
  return format(new Date(date), "h:mm a");
}

export function TripBanner({ clientId }: { clientId: string }) {
  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["/api/clients", clientId, "trips"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/trips`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeTrip = trips?.find(
    (t) => t.status === "planning" || t.status === "confirmed" || t.status === "in_progress"
  );

  if (!activeTrip) return null;

  return (
    <Link href={`/trips/${activeTrip.id}/edit`}>
      <div
        className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-border/30 text-xs hover-elevate cursor-pointer"
        data-testid="banner-active-trip"
      >
        <Plane className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />
        <span className="truncate">
          <span className="font-medium">{activeTrip.title}</span>
          {activeTrip.startDate && (
            <span className="text-muted-foreground ml-1.5">
              {format(new Date(activeTrip.startDate), "MMM d")}
              {activeTrip.endDate && ` – ${format(new Date(activeTrip.endDate), "MMM d")}`}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}

export function ChatThread({
  conversationId,
  clientName,
  clientAvatarUrl,
  clientId,
  onBack,
  showBack = false,
  showHeader = true,
  showTripBanner = true,
}: ChatThreadProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [typingState, setTypingState] = useState({ advisorTyping: false, clientTyping: false });
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: fetchedMessages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (fetchedMessages) {
      setLocalMessages((prev) => {
        const tempMsgs = prev.filter((m) => m.id.startsWith("temp-"));
        const merged: LocalMessage[] = fetchedMessages.map((m) => ({ ...m, reactions: (m as any).reactions || [] }));
        for (const temp of tempMsgs) {
          if (!merged.find((m) => m.id === temp.id)) {
            merged.push(temp);
          }
        }
        merged.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
        return merged;
      });
    }
  }, [fetchedMessages]);

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conversations/${conversationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
  });

  useEffect(() => {
    if (conversationId) markReadMutation.mutate();
  }, [conversationId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (!isLoading && localMessages.length > 0) {
      scrollToBottom("auto");
    }
  }, [isLoading]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;
  }, []);

  useEffect(() => {
    if (!user?.id || !conversationId) return;

    const connectWs = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/chat?conversationId=${conversationId}&userType=advisor&userId=${user.id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "new_message": {
              const newMsg = data.message as LocalMessage;
              if (!newMsg.reactions) newMsg.reactions = [];
              setLocalMessages((prev) => {
                if (prev.find((m) => m.id === newMsg.id)) return prev;
                const next = [...prev, newMsg];
                next.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
                return next;
              });
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
              if (isNearBottomRef.current) {
                setTimeout(() => scrollToBottom("smooth"), 50);
              }
              break;
            }
            case "typing": {
              setTypingState({
                advisorTyping: data.advisorTyping ?? false,
                clientTyping: data.clientTyping ?? false,
              });
              break;
            }
            case "seen": {
              setSeenAt(data.seenAt || null);
              break;
            }
            case "reaction_update": {
              const { messageId, reactions } = data;
              setLocalMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId ? { ...m, reactions: reactions || [] } : m
                )
              );
              break;
            }
          }
        } catch {}
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (event.code !== 1000 && reconnectAttemptsRef.current < 5) {
          const delay = Math.pow(2, reconnectAttemptsRef.current + 1) * 1000;
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connectWs, delay);
        }
      };

      ws.onerror = () => {};
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user?.id, conversationId, scrollToBottom]);

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing", isTyping }));
      }
    },
    []
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      sendTypingIndicator(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    },
    [sendTypingIndicator]
  );

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        content,
      });
      return res.json();
    },
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: LocalMessage = {
      id: tempId,
      conversationId,
      orgId: "",
      senderType: "advisor",
      senderId: user?.id || "",
      senderName: "",
      content: text,
      isRead: false,
      seenAt: null,
      attachmentUrl: null,
      attachmentType: null,
      attachmentName: null,
      createdAt: new Date(),
      reactions: [],
    };

    setLocalMessages((prev) => [...prev, tempMessage]);
    setInput("");
    sendTypingIndicator(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setTimeout(() => scrollToBottom("smooth"), 50);

    sendMutation.mutate(text, {
      onSuccess: (realMsg: Message) => {
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...realMsg, reactions: (realMsg as any).reactions || [] } : m))
        );
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      },
      onError: () => {
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(text);
      },
    });
  }, [input, conversationId, user?.id, sendMutation, scrollToBottom, sendTypingIndicator]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = localMessages.find((m) => m.id === messageId);
      if (!msg) return;

      const existingReaction = msg.reactions?.find(
        (r) => r.reactorId === user?.id
      );

      if (existingReaction && existingReaction.emoji === emoji) {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, reactions: (m.reactions || []).filter((r) => r.reactorId !== user?.id) }
              : m
          )
        );
        try {
          await apiRequest("DELETE", `/api/conversations/${conversationId}/messages/${messageId}/reactions`);
        } catch {}
      } else {
        const newReaction: MessageReaction = {
          id: `temp-reaction-${Date.now()}`,
          messageId,
          conversationId,
          orgId: "",
          reactorType: "advisor",
          reactorId: user?.id || "",
          reactorName: "",
          emoji,
          createdAt: new Date(),
        };
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: [
                    ...(m.reactions || []).filter((r) => r.reactorId !== user?.id),
                    newReaction,
                  ],
                }
              : m
          )
        );
        try {
          await apiRequest("POST", `/api/conversations/${conversationId}/messages/${messageId}/reactions`, {
            emoji,
          });
        } catch {}
      }
    },
    [localMessages, user?.id, conversationId]
  );

  const grouped = groupMessages(localMessages);
  const lastAdvisorMsg = [...localMessages].reverse().find((m) => m.senderType === "advisor");

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 shrink-0 bg-background" data-testid="chat-header">
          {showBack && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-messages">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={clientAvatarUrl || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {getInitials(clientName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" data-testid="text-thread-client-name">{clientName}</p>
          </div>
        </div>
      )}

      {showTripBanner && <TripBanner clientId={clientId} />}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
        data-testid="messages-thread"
      >
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-start" : "justify-end"}`}>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : grouped.length > 0 ? (
          <>
            {grouped.map((msg, idx) => {
              const isAdvisor = msg.senderType === "advisor";
              const prevMsg = idx > 0 ? grouped[idx - 1] : null;
              const showTs = shouldShowTimestamp(msg, prevMsg);

              return (
                <div key={msg.id} data-testid={`message-${msg.id}`}>
                  {showTs && (
                    <div className="flex justify-center my-3">
                      <span
                        className="text-[11px] text-muted-foreground px-3 py-1 rounded-full bg-muted/60"
                        data-testid={`timestamp-divider-${msg.id}`}
                      >
                        {formatTimestamp(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex ${isAdvisor ? "justify-end" : "justify-start"} ${
                      msg.isFirstInGroup && idx > 0 ? "mt-2" : "mt-0.5"
                    }`}
                  >
                    {!isAdvisor && (
                      <div className="w-7 h-7 mr-1.5 shrink-0 self-end mb-5">
                        {msg.isLastInGroup ? (
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={clientAvatarUrl || undefined} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {getInitials(clientName)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-7 h-7" style={{ visibility: "hidden" }} />
                        )}
                      </div>
                    )}

                    <div className="max-w-[75%] relative">
                      <div
                        className="relative"
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        {hoveredMsgId === msg.id && (
                          <div
                            className={`absolute -top-9 flex items-center gap-0.5 bg-white dark:bg-card rounded-full shadow-lg px-1.5 py-1`}
                            style={{
                              zIndex: 10,
                              ...(isAdvisor ? { right: 0 } : { left: 0 }),
                              visibility: "visible",
                            }}
                            data-testid={`reaction-picker-${msg.id}`}
                          >
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className="w-7 h-7 flex items-center justify-center text-sm hover-elevate rounded-full"
                                data-testid={`reaction-btn-${msg.id}-${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        <div
                          className="rounded-2xl px-4 py-2.5"
                          style={{
                            backgroundColor: isAdvisor ? SENT_BG : RECEIVED_BG,
                            color: isAdvisor ? SENT_TEXT : RECEIVED_TEXT,
                            ...(msg.isLastInGroup && isAdvisor
                              ? { borderBottomRightRadius: "4px" }
                              : {}),
                            ...(msg.isLastInGroup && !isAdvisor
                              ? { borderBottomLeftRadius: "4px" }
                              : {}),
                          }}
                          data-testid={`bubble-${msg.id}`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>

                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`flex gap-1 mt-0.5 ${isAdvisor ? "justify-end" : "justify-start"}`}>
                          {msg.reactions.map((reaction) => {
                            const isOwn = reaction.reactorId === user?.id;
                            return (
                              <button
                                key={reaction.id}
                                onClick={() => handleReaction(msg.id, reaction.emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                  isOwn
                                    ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                                    : "border-border bg-background"
                                }`}
                                data-testid={`reaction-pill-${msg.id}-${reaction.emoji}`}
                              >
                                {reaction.emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {msg.isLastInGroup && (
                        <p
                          className={`text-[10px] text-muted-foreground mt-1 ${
                            isAdvisor ? "text-right" : "text-left"
                          }`}
                          data-testid={`time-${msg.id}`}
                        >
                          {formatMessageTime(msg.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {seenAt && lastAdvisorMsg && (
              <p className="text-[10px] text-muted-foreground text-right mt-1" data-testid="text-seen-status">
                Seen {formatMessageTime(seenAt)}
              </p>
            )}

            {typingState.clientTyping && (
              <div className="flex justify-start mt-2" data-testid="typing-indicator">
                <div className="w-7 h-7 mr-1.5 shrink-0 self-end">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={clientAvatarUrl || undefined} />
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {getInitials(clientName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-1"
                  style={{
                    backgroundColor: RECEIVED_BG,
                    borderBottomLeftRadius: "4px",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground/15 mb-3" strokeWidth={1} />
            <p className="text-sm text-muted-foreground/30">
              Start a conversation with {clientName}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-border/50 px-3 py-2.5 bg-background" data-testid="message-input-area">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-muted/50 rounded-xl px-4 py-2.5 text-sm border-0 focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-32 min-h-[40px]"
            style={{ height: "auto", overflow: "hidden" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
            data-testid="textarea-message-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors"
            style={{ backgroundColor: input.trim() ? "#007AFF" : "#C7C7CC" }}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

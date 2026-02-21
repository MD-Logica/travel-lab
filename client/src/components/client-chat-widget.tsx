import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, ChevronDown, Send, X } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

const SENT_BG = "#007AFF";
const SENT_TEXT = "#FFFFFF";
const RECEIVED_BG = "#E9E9EB";
const RECEIVED_TEXT = "#000000";

interface ClientChatWidgetProps {
  tripId: string;
  shareToken: string;
  tripTitle: string;
}

interface ChatTokenData {
  chatToken: string;
  conversationId: string;
  clientId: string;
  clientName: string;
  advisorName: string;
  advisorAvatar: string | null;
  orgId: string;
}

interface WidgetMessage {
  id: string;
  conversationId: string;
  senderType: "advisor" | "client";
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date | string | null;
  isRead: boolean;
}

type MessageWithGroup = WidgetMessage & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function groupMessages(messages: WidgetMessage[]): MessageWithGroup[] {
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

function shouldShowTimestamp(msg: WidgetMessage, prevMsg: WidgetMessage | null): boolean {
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

export function ClientChatWidget({ tripId, shareToken, tripTitle }: ClientChatWidgetProps) {
  const [tokenData, setTokenData] = useState<ChatTokenData | null>(null);
  const [tokenFailed, setTokenFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [advisorTyping, setAdvisorTyping] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isOpenRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await fetch(`/api/chat-token?tripId=${tripId}&shareToken=${shareToken}`);
        if (!res.ok) {
          setTokenFailed(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setTokenData(data);
      } catch {
        if (!cancelled) setTokenFailed(true);
      }
    }
    fetchToken();
    return () => { cancelled = true; };
  }, [tripId, shareToken]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;
  }, []);

  useEffect(() => {
    if (!tokenData) return;

    const connectWs = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/chat?conversationId=${tokenData.conversationId}&userType=client&userId=${tokenData.clientId}&chatToken=${tokenData.chatToken}`;
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
              const newMsg = data.message as WidgetMessage;
              setMessages((prev) => {
                if (prev.find((m) => m.id === newMsg.id)) return prev;
                const next = [...prev, newMsg];
                next.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
                return next;
              });
              if (!isOpenRef.current) {
                setUnreadCount((c) => c + 1);
              } else if (isNearBottomRef.current) {
                setTimeout(() => scrollToBottom("smooth"), 50);
              }
              break;
            }
            case "typing": {
              setAdvisorTyping(data.advisorTyping ?? false);
              break;
            }
            case "seen": {
              setSeenAt(data.seenAt || null);
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
  }, [tokenData, scrollToBottom]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    if (tokenData) {
      fetch(`/api/conversations/${tokenData.conversationId}/read/client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatToken: tokenData.chatToken }),
      }).catch(() => {});
    }
    setTimeout(() => scrollToBottom("auto"), 100);
  }, [tokenData, scrollToBottom]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", isTyping }));
    }
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    sendTypingIndicator(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);
  }, [sendTypingIndicator]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !tokenData) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: WidgetMessage = {
      id: tempId,
      conversationId: tokenData.conversationId,
      senderType: "client",
      senderId: tokenData.clientId,
      senderName: tokenData.clientName,
      content: text,
      createdAt: new Date(),
      isRead: false,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInput("");
    sendTypingIndicator(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setTimeout(() => scrollToBottom("smooth"), 50);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    fetch(`/api/conversations/${tokenData.conversationId}/messages/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, chatToken: tokenData.chatToken }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((realMsg) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...realMsg } : m))
        );
      })
      .catch(() => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(text);
      });
  }, [input, tokenData, scrollToBottom, sendTypingIndicator]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  if (tokenFailed || !tokenData) {
    if (tokenFailed) return null;
    return null;
  }

  const grouped = groupMessages(messages);
  const lastClientMsg = [...messages].reverse().find((m) => m.senderType === "client");

  return (
    <div className="fixed bottom-6 right-6 z-50" data-testid="client-chat-widget">
      {isOpen && (
        <div
          className="mb-3 bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-100 dark:border-border flex flex-col animate-slideUp"
          style={{ width: 360, height: 480 }}
          data-testid="chat-widget-expanded"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-border shrink-0" data-testid="chat-widget-header">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={tokenData.advisorAvatar || undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {getInitials(tokenData.advisorName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-gray-900 dark:text-foreground" data-testid="text-advisor-name">
                {tokenData.advisorName}
              </p>
              <p className="text-xs text-gray-500 dark:text-muted-foreground truncate" data-testid="text-trip-subject">
                Re: {tripTitle}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover-elevate text-gray-400 dark:text-muted-foreground"
              data-testid="button-collapse-chat"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4"
            data-testid="chat-widget-messages"
          >
            {grouped.length > 0 ? (
              <>
                {grouped.map((msg, idx) => {
                  const isClient = msg.senderType === "client";
                  const prevMsg = idx > 0 ? grouped[idx - 1] : null;
                  const showTs = shouldShowTimestamp(msg, prevMsg);

                  return (
                    <div key={msg.id} data-testid={`widget-message-${msg.id}`}>
                      {showTs && (
                        <div className="flex justify-center my-3">
                          <span className="text-[11px] text-gray-500 dark:text-muted-foreground px-3 py-1 rounded-full bg-gray-100 dark:bg-muted/60">
                            {formatTimestamp(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex ${isClient ? "justify-end" : "justify-start"} ${
                          msg.isFirstInGroup && idx > 0 ? "mt-2" : "mt-0.5"
                        }`}
                      >
                        {!isClient && (
                          <div className="w-6 h-6 mr-1.5 shrink-0 self-end mb-5">
                            {msg.isLastInGroup ? (
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={tokenData.advisorAvatar || undefined} />
                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                  {getInitials(tokenData.advisorName)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="w-6 h-6" style={{ visibility: "hidden" }} />
                            )}
                          </div>
                        )}

                        <div className="max-w-[75%]">
                          <div
                            className="rounded-2xl px-3.5 py-2"
                            style={{
                              backgroundColor: isClient ? SENT_BG : RECEIVED_BG,
                              color: isClient ? SENT_TEXT : RECEIVED_TEXT,
                              ...(msg.isLastInGroup && isClient
                                ? { borderBottomRightRadius: "4px" }
                                : {}),
                              ...(msg.isLastInGroup && !isClient
                                ? { borderBottomLeftRadius: "4px" }
                                : {}),
                            }}
                            data-testid={`widget-bubble-${msg.id}`}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>

                          {msg.isLastInGroup && (
                            <p
                              className={`text-[10px] text-gray-400 dark:text-muted-foreground mt-1 ${
                                isClient ? "text-right" : "text-left"
                              }`}
                            >
                              {formatMessageTime(msg.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {seenAt && lastClientMsg && (
                  <p className="text-[10px] text-gray-400 dark:text-muted-foreground text-right mt-1" data-testid="text-widget-seen-status">
                    Seen {formatMessageTime(seenAt)}
                  </p>
                )}

                {advisorTyping && (
                  <div className="flex justify-start mt-2" data-testid="widget-typing-indicator">
                    <div className="w-6 h-6 mr-1.5 shrink-0 self-end">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={tokenData.advisorAvatar || undefined} />
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                          {getInitials(tokenData.advisorName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div
                      className="rounded-2xl px-3.5 py-2.5 flex items-center gap-1"
                      style={{
                        backgroundColor: RECEIVED_BG,
                        borderBottomLeftRadius: "4px",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center" data-testid="chat-widget-empty">
                <MessageCircle className="w-10 h-10 text-gray-300 dark:text-muted-foreground mb-3" strokeWidth={1.5} />
                <p className="text-sm text-gray-500 dark:text-muted-foreground">Send a message to your advisor</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 border-t border-gray-100 dark:border-border shrink-0" data-testid="chat-widget-input-bar">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  handleInputChange(e.target.value);
                  handleTextareaInput();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 resize-none bg-gray-100 dark:bg-muted rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground focus:outline-none"
                style={{ maxHeight: 120 }}
                data-testid="input-widget-message"
              />
              {input.trim() && (
                <button
                  onClick={handleSend}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: SENT_BG }}
                  data-testid="button-widget-send"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={isOpen ? handleClose : handleOpen}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg relative"
        style={{ backgroundColor: SENT_BG }}
        data-testid="button-chat-widget-toggle"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
        {!isOpen && unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center px-1"
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
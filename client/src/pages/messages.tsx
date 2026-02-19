import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Search,
  Send,
  MessageCircle,
  Plane,
  Bell,
  X,
} from "lucide-react";
import type { Conversation, Message, Trip } from "@shared/schema";
import { format, isToday, isYesterday } from "date-fns";

type ConversationWithClient = Conversation & {
  clientName: string;
  clientAvatarUrl: string | null;
  unreadCount: number;
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function formatMessageTime(date: string | Date | null): string {
  if (!date) return "";
  return format(new Date(date), "h:mm a");
}

function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: {
  conversations: ConversationWithClient[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = conversations.filter(
    (c) =>
      !searchQuery ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border/50 shrink-0">
        <h2 className="font-serif text-xl md:text-2xl tracking-tight mb-3" data-testid="text-messages-title">
          Messages
        </h2>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 border-border/50"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="py-1">
            {filtered.map((convo) => (
              <button
                key={convo.id}
                onClick={() => onSelect(convo.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors min-h-[64px] ${
                  selectedId === convo.id
                    ? "bg-primary/5"
                    : "hover-elevate"
                }`}
                data-testid={`conversation-${convo.id}`}
              >
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarImage src={convo.clientAvatarUrl || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(convo.clientName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{convo.clientName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(convo.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">
                      {convo.lastMessagePreview || "No messages yet"}
                    </span>
                    {convo.unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground/20 mb-4" strokeWidth={1} />
            <p className="font-serif text-lg text-muted-foreground/40 mb-1">No conversations yet</p>
            <p className="text-xs text-muted-foreground/30 max-w-[240px]">
              Start a conversation from a client's profile page.
            </p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground/40">No results for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TripBanner({ clientId }: { clientId: string }) {
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

function ChatThread({
  conversationId,
  clientName,
  clientAvatarUrl,
  clientId,
  onBack,
  showBack,
}: {
  conversationId: string;
  clientName: string;
  clientAvatarUrl: string | null;
  clientId: string;
  onBack: () => void;
  showBack: boolean;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: msgs, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conversations/${conversationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  useEffect(() => {
    if (conversationId) markReadMutation.mutate();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 shrink-0 bg-background">
        {showBack && (
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

      <TripBanner clientId={clientId} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="messages-thread">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`flex ${i % 2 ? "justify-start" : "justify-end"}`}>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : msgs && msgs.length > 0 ? (
          msgs.map((msg) => {
            const isAdvisor = msg.senderType === "advisor";
            return (
              <div
                key={msg.id}
                className={`flex ${isAdvisor ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-4 py-2.5 ${
                    isAdvisor
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isAdvisor ? "text-primary-foreground/60" : "text-muted-foreground/60"
                    }`}
                  >
                    {formatMessageTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
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
            onChange={(e) => setInput(e.target.value)}
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
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="shrink-0 rounded-full"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PushBanner() {
  const { isSupported, isSubscribed, permission, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem("push-banner-dismissed") === "1"; } catch { return false; }
  });

  if (dismissed || !isSupported || isSubscribed || permission === "denied") return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border-b border-primary/10" data-testid="push-notification-banner">
      <Bell className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
      <span className="text-xs flex-1">Get notified when clients send messages</span>
      <Button
        size="sm"
        variant="outline"
        onClick={subscribe}
        data-testid="button-enable-notifications"
      >
        Enable
      </Button>
      <button
        onClick={() => { setDismissed(true); try { sessionStorage.setItem("push-banner-dismissed", "1"); } catch {} }}
        className="text-muted-foreground p-1"
        data-testid="button-dismiss-push-banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function MessagesPage() {
  const isMobile = useIsMobile();
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations = [], isLoading } = useQuery<ConversationWithClient[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 10000,
  });

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId);

  const handleSelect = (id: string) => {
    setSelectedConvoId(id);
  };

  const handleBack = () => {
    setSelectedConvoId(null);
  };

  if (isMobile) {
    if (selectedConvoId && selectedConvo) {
      return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <ChatThread
            conversationId={selectedConvoId}
            clientName={selectedConvo.clientName}
            clientAvatarUrl={selectedConvo.clientAvatarUrl}
            clientId={selectedConvo.clientId}
            onBack={handleBack}
            showBack
          />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <PushBanner />
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          selectedId={null}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <div className="w-80 lg:w-96 border-r border-border/50 flex flex-col shrink-0">
        <PushBanner />
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          selectedId={selectedConvoId}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedConvoId && selectedConvo ? (
          <ChatThread
            conversationId={selectedConvoId}
            clientName={selectedConvo.clientName}
            clientAvatarUrl={selectedConvo.clientAvatarUrl}
            clientId={selectedConvo.clientId}
            onBack={handleBack}
            showBack={false}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground/15 mx-auto mb-4" strokeWidth={1} />
              <p className="font-serif text-lg text-muted-foreground/30">Select a conversation</p>
              <p className="text-xs text-muted-foreground/20 mt-1">
                Choose a client from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

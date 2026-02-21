import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  MessageCircle,
  Bell,
  X,
} from "lucide-react";
import type { Conversation } from "@shared/schema";
import { format, isToday, isYesterday } from "date-fns";
import { ChatThread } from "@/components/chat-thread";

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

import { useLocation, Link } from "wouter";
import { Plane, MessageCircle, Users, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface MessagesUnread {
  unreadCount: number;
}

const tabs = [
  { path: "/trips", icon: Plane, label: "Trips" },
  { path: "/dashboard/messages", icon: MessageCircle, label: "Messages" },
  { path: "/clients", icon: Users, label: "Clients" },
  { path: "more", icon: MoreHorizontal, label: "More" },
];

function MoreSheet({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();

  const items = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart2 },
    { path: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border-t rounded-t-xl w-full max-w-md animate-in slide-in-from-bottom-8 duration-300 pb-safe"
        onClick={(e) => e.stopPropagation()}
        data-testid="sheet-more"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="px-4 pb-4 space-y-1">
          {items.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={onClose}
              data-testid={`more-link-${item.label.toLowerCase()}`}
            >
              <div className="flex items-center gap-3 px-3 py-3 rounded-md hover-elevate cursor-pointer">
                <item.icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          ))}
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-md hover-elevate cursor-pointer text-destructive"
            onClick={() => { logout(); onClose(); }}
            data-testid="more-link-signout"
          >
            <LogOut className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-sm">Sign out</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);

  const { data: msgData } = useQuery<MessagesUnread>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 15000,
  });

  const unreadMessages = msgData?.unreadCount || 0;

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        data-testid="mobile-tab-bar"
      >
        <div className="flex items-center justify-around h-14">
          {tabs.map((tab) => {
            const isMore = tab.path === "more";
            const isActive = !isMore && (
              tab.path === "/trips"
                ? location === "/trips" || location.startsWith("/trips/")
                : tab.path === "/clients"
                  ? location === "/clients" || location.startsWith("/clients/")
                  : location.startsWith(tab.path)
            );

            return (
              <button
                key={tab.path}
                onClick={() => {
                  if (isMore) {
                    setShowMore(true);
                  } else {
                    window.history.pushState(null, "", tab.path);
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }
                }}
                className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`tab-${tab.label.toLowerCase()}`}
              >
                <div className="relative">
                  <tab.icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                  {tab.label === "Messages" && unreadMessages > 0 && (
                    <span
                      className="absolute -top-1 -right-2 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1"
                      data-testid="badge-messages-unread"
                    >
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {showMore && <MoreSheet onClose={() => setShowMore(false)} />}
    </>
  );
}

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Plane, AlertTriangle, MapPin, ArrowRight, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { Link } from "wouter";

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const changeTypeConfig: Record<string, { icon: typeof Plane; color: string }> = {
  flight_delayed: { icon: AlertTriangle, color: "text-amber-500" },
  flight_gate_changed: { icon: MapPin, color: "text-blue-500" },
  flight_cancelled: { icon: AlertTriangle, color: "text-red-500" },
  flight_departed: { icon: Plane, color: "text-emerald-500" },
  flight_landed: { icon: Plane, color: "text-sky-500" },
  itinerary_approved: { icon: CheckCircle, color: "text-emerald-600" },
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative"
        data-testid="button-notification-bell"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1"
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-popover border rounded-md shadow-lg z-50 max-h-[420px] flex flex-col" data-testid="panel-notifications">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-primary hover:underline"
                data-testid="button-mark-all-read"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const cfg = changeTypeConfig[notif.type] || { icon: Bell, color: "text-muted-foreground" };
                const Icon = cfg.icon;
                const notifData = notif.data as Record<string, any> | null;
                const tripId = notifData?.tripId;

                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors ${
                      !notif.isRead ? "bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      if (!notif.isRead) markReadMutation.mutate(notif.id);
                    }}
                    data-testid={`notification-item-${notif.id}`}
                  >
                    <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium">{notif.title}</span>
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          {notif.createdAt ? timeAgo(new Date(notif.createdAt)) : ""}
                        </span>
                        {tripId && (
                          <Link
                            href={`/trips/${tripId}/edit`}
                            className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                            data-testid={`link-notif-trip-${notif.id}`}
                          >
                            View trip <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

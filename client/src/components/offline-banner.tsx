import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs px-4 py-1.5 flex items-center justify-center gap-2 shrink-0"
      data-testid="banner-offline"
    >
      <WifiOff className="w-3 h-3" />
      <span>You're offline — showing your last loaded content.</span>
    </div>
  );
}

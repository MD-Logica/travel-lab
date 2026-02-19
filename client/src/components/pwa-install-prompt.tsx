import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pwa-install-dismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => setShow(true), 30000);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    setShowIOSTip(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismiss();
    } else if (isIOS) {
      setShowIOSTip(true);
    }
  };

  if (!show) return null;

  return (
    <>
      <div
        className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[60] animate-in slide-in-from-bottom-4 fade-in duration-500"
        data-testid="pwa-install-prompt"
      >
        <div className="bg-card border rounded-md px-4 py-3 flex items-center gap-3 shadow-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm">Add Travel Lab to your home screen for quick access</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleInstall} data-testid="button-install-pwa">
            {isIOS ? "How" : "Install"}
          </Button>
          <button onClick={dismiss} className="shrink-0 text-muted-foreground" data-testid="button-dismiss-install">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIOSTip && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 animate-in fade-in duration-300"
          onClick={dismiss}
        >
          <div
            className="bg-card border-t rounded-t-lg px-6 py-5 w-full max-w-md animate-in slide-in-from-bottom-8 duration-400 mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-serif text-lg mb-4">Add to Home Screen</p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-primary" />
                </div>
                <span>Tap the Share button in your browser toolbar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <span>Scroll down and tap "Add to Home Screen"</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-5" onClick={dismiss}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

interface MarketingNavProps {
  variant?: "transparent" | "solid";
}

export function MarketingNav({ variant = "transparent" }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  const isSolid = variant === "solid" || scrolled;

  useEffect(() => {
    if (variant === "solid") return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        isSolid
          ? "bg-background/90 backdrop-blur-xl border-b border-border/40 shadow-sm"
          : "bg-transparent"
      }`}
      data-testid="marketing-nav"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" data-testid="link-nav-logo">
          <span
            className={`font-serif text-xl tracking-wide uppercase transition-colors duration-300 ${
              isSolid ? "text-foreground" : "text-white"
            }`}
          >
            Travel Lab
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/pricing"
            className={`text-sm transition-colors duration-200 ${
              isSolid
                ? "text-muted-foreground hover:text-foreground"
                : "text-white/70 hover:text-white"
            }`}
            data-testid="link-nav-pricing"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className={`text-sm transition-colors duration-200 ${
              isSolid
                ? "text-muted-foreground hover:text-foreground"
                : "text-white/70 hover:text-white"
            }`}
            data-testid="link-nav-login"
          >
            Log in
          </Link>
          <Button size="sm" asChild>
            <Link href="/signup" data-testid="button-nav-trial">
              Start free trial
            </Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={`md:hidden ${isSolid ? "" : "text-white hover:bg-white/10"}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border/40 px-6 py-4 space-y-3">
          <Link
            href="/pricing"
            className="block text-sm text-muted-foreground py-2"
            data-testid="link-mobile-pricing"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="block text-sm text-muted-foreground py-2"
            data-testid="link-mobile-login"
          >
            Log in
          </Link>
          <Button className="w-full" asChild>
            <Link href="/signup" data-testid="button-mobile-trial">
              Start free trial
            </Link>
          </Button>
        </div>
      )}
    </nav>
  );
}

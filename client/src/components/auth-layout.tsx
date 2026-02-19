import { MapPin } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex" data-testid="auth-layout">
      <div className="hidden lg:flex lg:w-[40%] relative bg-[hsl(30,15%,95%)] dark:bg-[hsl(220,10%,12%)] overflow-hidden">
        <img
          src="/images/auth-panel.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

        <motion.div
          className="absolute top-0 left-0 right-0 bottom-0"
          style={{ backgroundImage: "radial-gradient(circle at 30% 70%, hsl(24 70% 45% / 0.08) 0%, transparent 60%)" }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <Link href="/" className="flex items-center gap-2 group" data-testid="link-auth-logo">
            <MapPin className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-xl tracking-tight">Travel Lab</span>
          </Link>

          <div className="space-y-3">
            <p className="font-serif text-2xl lg:text-3xl leading-snug tracking-tight max-w-xs">
              Discover travel,
              <br />
              <span className="italic text-primary/90">beautifully organized.</span>
            </p>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              The platform trusted by luxury travel advisors worldwide to craft extraordinary journeys.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Link href="/" className="flex items-center gap-2" data-testid="link-auth-logo-mobile">
              <MapPin className="w-5 h-5 text-primary" strokeWidth={1.5} />
              <span className="font-serif text-xl tracking-tight">Travel Lab</span>
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-6" data-testid="not-found-page">
        <p className="text-[120px] font-serif leading-none text-muted-foreground/15 tracking-tighter mb-2">
          404
        </p>
        <h1 className="font-serif text-2xl tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard" data-testid="link-back-home">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

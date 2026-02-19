import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, Sparkles } from "lucide-react";

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  resource: "clients" | "advisors" | "trips";
}

const resourceLabels: Record<string, string> = {
  clients: "clients",
  advisors: "advisors",
  trips: "trips",
};

export function UpgradePrompt({ open, onClose, resource }: UpgradePromptProps) {
  const label = resourceLabels[resource] || resource;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="dialog-upgrade-prompt">
        <DialogHeader>
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </div>
          <DialogTitle className="font-serif text-xl" data-testid="text-upgrade-title">
            You've reached your plan limit
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed" data-testid="text-upgrade-description">
            You've reached your plan limit for {label}. Upgrade to Pro to unlock
            more capacity and keep growing your agency.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button asChild data-testid="button-upgrade-pricing">
            <Link href="/pricing">
              See pricing
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          <Button variant="ghost" onClick={onClose} data-testid="button-upgrade-dismiss">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

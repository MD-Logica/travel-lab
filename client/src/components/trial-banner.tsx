import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@shared/schema";
import { ArrowRight } from "lucide-react";

export function TrialBanner() {
  const { data: org } = useQuery<Organization>({ queryKey: ["/api/organization"] });

  if (!org || org.plan !== "trial" || !org.trialEndsAt) return null;

  const now = new Date();
  const end = new Date(org.trialEndsAt);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  if (daysLeft <= 0) return null;

  return (
    <div
      className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center justify-center gap-2 text-sm"
      data-testid="banner-trial"
    >
      <span className="text-muted-foreground">
        Your free trial ends in{" "}
        <span className="font-medium text-foreground">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>.
      </span>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
        data-testid="link-trial-upgrade"
      >
        Upgrade to Pro
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

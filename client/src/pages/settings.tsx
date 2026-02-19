import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Crown, Users, Map, Calendar } from "lucide-react";
import type { Organization, Profile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: org, isLoading: orgLoading } = useQuery<Organization>({ queryKey: ["/api/organization"] });
  const { data: profile } = useQuery<Profile>({ queryKey: ["/api/profile"] });

  const planLimits: Record<string, { advisors: string; clients: string; trips: string }> = {
    trial: { advisors: "3", clients: "50", trips: "20" },
    pro: { advisors: "10", clients: "500", trips: "Unlimited" },
    enterprise: { advisors: "Unlimited", clients: "Unlimited", trips: "Unlimited" },
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Account</p>
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-settings-title">Settings</h1>
        </motion.div>

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Agency</p>
                {orgLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : org ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-medium" data-testid="text-settings-org-name">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider" data-testid="badge-plan">
                        <Crown className="w-3 h-3 mr-1" strokeWidth={1.5} />
                        {org.plan} plan
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider capitalize">
                        {org.planStatus.replace("_", " ")}
                      </Badge>
                    </div>
                    {org.trialEndsAt && org.plan === "trial" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" strokeWidth={1.5} />
                        Trial ends {format(new Date(org.trialEndsAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>

          {org && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Plan Limits</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Advisors", value: planLimits[org.plan]?.advisors || "?", icon: Users },
                      { label: "Clients", value: planLimits[org.plan]?.clients || "?", icon: Users },
                      { label: "Trips", value: planLimits[org.plan]?.trips || "?", icon: Map },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <item.icon className="w-3 h-3" strokeWidth={1.5} />
                          {item.label}
                        </p>
                        <p className="font-medium text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Your Profile</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm" data-testid="text-settings-name">{profile?.fullName || user?.firstName || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm">{profile?.email || user?.email || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <span className="text-sm capitalize">{profile?.role || "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  User, Building2, LogOut, Crown, Calendar, Shield,
  Bookmark, Plane, Ship, Hotel, Car, UtensilsCrossed, Activity, StickyNote,
  Trash2, Pencil, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Organization, Profile } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SettingsSection = "profile" | "organization" | "templates" | "account";

const navItems: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "templates", label: "Templates", icon: Bookmark },
  { id: "account", label: "Account", icon: LogOut },
];

function ProfileSection({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile.fullName);
  const [dirty, setDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: { fullName: string }) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setDirty(false);
      toast({ title: "Profile updated" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-section-title">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Your personal information</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setDirty(true); }}
            data-testid="input-full-name"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
          <div className="flex items-center gap-2">
            <Input value={profile.email || "—"} disabled className="opacity-60" data-testid="input-email-readonly" />
            <Badge variant="secondary" className="text-[10px] shrink-0">Read-only</Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
          <div>
            <Badge variant="outline" className="capitalize text-xs" data-testid="badge-role">
              <Shield className="w-3 h-3 mr-1" strokeWidth={1.5} />
              {profile.role}
            </Badge>
          </div>
        </div>

        <div className="border-t pt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || updateMutation.isPending}
            onClick={() => updateMutation.mutate({ fullName })}
            data-testid="button-save-profile"
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function OrganizationSection({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const { data: org, isLoading: orgLoading } = useQuery<Organization>({ queryKey: ["/api/organization"] });
  const { data: members, isLoading: membersLoading } = useQuery<Profile[]>({ queryKey: ["/api/members"] });

  const [orgName, setOrgName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [orgDirty, setOrgDirty] = useState(false);

  useEffect(() => {
    if (org) {
      setOrgName(org.name);
      setLogoUrl(org.logoUrl || "");
    }
  }, [org]);

  const isOwner = profile.role === "owner";

  const updateOrgMutation = useMutation({
    mutationFn: async (data: { name?: string; logoUrl?: string }) => {
      const res = await apiRequest("PATCH", "/api/organization", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      setOrgDirty(false);
      toast({ title: "Organization updated" });
    },
    onError: () => {
      toast({ title: "Failed to update organization", variant: "destructive" });
    },
  });

  const planLimits: Record<string, { advisors: string; clients: string; trips: string }> = {
    trial: { advisors: "3", clients: "50", trips: "20" },
    pro: { advisors: "10", clients: "500", trips: "Unlimited" },
    enterprise: { advisors: "Unlimited", clients: "Unlimited", trips: "Unlimited" },
  };

  if (orgLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!org) return null;

  const limits = planLimits[org.plan] || planLimits.trial;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-org-section-title">Organization</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your agency settings</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider" data-testid="badge-plan">
            <Crown className="w-3 h-3 mr-1" strokeWidth={1.5} />
            {org.plan} plan
          </Badge>
          {org.trialEndsAt && org.plan === "trial" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" strokeWidth={1.5} />
              Trial ends {format(new Date(org.trialEndsAt), "MMM d, yyyy")}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="orgName" className="text-xs uppercase tracking-wider text-muted-foreground">Agency Name</Label>
          <Input
            id="orgName"
            value={orgName}
            onChange={(e) => { setOrgName(e.target.value); setOrgDirty(true); }}
            disabled={!isOwner}
            className={!isOwner ? "opacity-60" : ""}
            data-testid="input-org-name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="logoUrl" className="text-xs uppercase tracking-wider text-muted-foreground">Logo URL</Label>
          <Input
            id="logoUrl"
            value={logoUrl}
            onChange={(e) => { setLogoUrl(e.target.value); setOrgDirty(true); }}
            disabled={!isOwner}
            placeholder="https://example.com/logo.png"
            className={!isOwner ? "opacity-60" : ""}
            data-testid="input-logo-url"
          />
        </div>

        {isOwner && (
          <div className="border-t pt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={!orgDirty || updateOrgMutation.isPending}
              onClick={() => updateOrgMutation.mutate({ name: orgName, logoUrl })}
              data-testid="button-save-org"
            >
              {updateOrgMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}

        <div className="border-t pt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Plan Limits</p>
          <p className="text-xs text-muted-foreground mb-4">
            {limits.advisors} advisors, {limits.clients} clients, {limits.trips} trips
          </p>
        </div>

        <div className="border-t pt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Team Members</p>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : members && members.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm" data-testid="table-team-members">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2.5 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="text-left py-2.5 px-3 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b last:border-b-0" data-testid={`row-member-${m.id}`}>
                      <td className="py-2.5 px-3">
                        <div>
                          <span className="font-medium">{m.fullName}</span>
                          {m.email && <span className="block text-xs text-muted-foreground">{m.email}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="capitalize text-[10px]">{m.role}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {m.createdAt ? format(new Date(m.createdAt), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const templateTypeIcons: Record<string, typeof Plane> = {
  flight: Plane, charter: Ship, hotel: Hotel, transport: Car,
  restaurant: UtensilsCrossed, activity: Activity, note: StickyNote,
};

const templateTypeLabels: Record<string, string> = {
  flight: "Flight", charter: "Charter", hotel: "Hotel", transport: "Transport",
  restaurant: "Restaurant", activity: "Activity", note: "Note",
};

function TemplatesSection() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ["/api/segment-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/segment-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const res = await apiRequest("PATCH", `/api/segment-templates/${id}`, { label });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segment-templates"] });
      setEditingId(null);
      toast({ title: "Template renamed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-templates-section-title">Segment Templates</h2>
        <p className="text-sm text-muted-foreground mt-1">Reusable segment templates shared across your agency</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Bookmark className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Save segments as templates when editing trips</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl: any) => {
            const TIcon = templateTypeIcons[tpl.type] || Activity;
            const isEditing = editingId === tpl.id;

            return (
              <Card key={tpl.id} data-testid={`template-card-${tpl.id}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <TIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          data-testid="input-rename-template"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editLabel.trim()) {
                              renameMutation.mutate({ id: tpl.id, label: editLabel.trim() });
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => editLabel.trim() && renameMutation.mutate({ id: tpl.id, label: editLabel.trim() })}
                          disabled={!editLabel.trim() || renameMutation.isPending}
                          data-testid="button-save-rename"
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate" data-testid={`text-template-label-${tpl.id}`}>{tpl.label}</p>
                        <p className="text-xs text-muted-foreground/60">
                          {templateTypeLabels[tpl.type] || tpl.type}
                          {tpl.creatorName && ` by ${tpl.creatorName}`}
                          {" \u00B7 "}used {tpl.useCount}x
                        </p>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-template-actions-${tpl.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => { setEditingId(tpl.id); setEditLabel(tpl.label); }}
                          data-testid={`button-rename-template-${tpl.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(tpl.id)}
                          className="text-destructive"
                          data-testid={`button-delete-template-${tpl.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function AccountSection() {
  const { logout } = useAuth();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-account-section-title">Account</h2>
        <p className="text-sm text-muted-foreground mt-1">Session and account management</p>
      </div>

      <div className="space-y-6">
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            data-testid="button-sign-out"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({ queryKey: ["/api/profile"] });

  if (profileLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="flex gap-8">
            <div className="w-44 shrink-0 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex-1 overflow-y-auto" data-testid="settings-page">
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Account</p>
          <h1 className="font-serif text-3xl tracking-tight" data-testid="text-settings-title">Settings</h1>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-8">
          <nav className="w-full md:w-44 shrink-0">
            <div className="flex md:flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full text-left cursor-pointer ${
                    activeSection === item.id
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-nav-${item.id}`}
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0">
            {activeSection === "profile" && <ProfileSection profile={profile} />}
            {activeSection === "organization" && <OrganizationSection profile={profile} />}
            {activeSection === "templates" && <TemplatesSection />}
            {activeSection === "account" && <AccountSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

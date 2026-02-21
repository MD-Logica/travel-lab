import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User, Building2, CreditCard, Lock, Shield, Crown,
  Calendar, UserPlus, MoreVertical, Trash2, Pencil,
  Bookmark, Plane, Ship, Hotel, Car, UtensilsCrossed,
  Activity, StickyNote, RefreshCw, X, Clock, Send, Eye, Loader2, Camera,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Organization, Profile, Invitation } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/phone-input";
import { format, formatDistanceToNow } from "date-fns";

type SettingsSection = "profile" | "organization" | "billing";

const navItems: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "organization", label: "Organisation", icon: Building2 },
  { id: "billing", label: "Billing", icon: CreditCard },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProfileSection({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone || "");
  const [website, setWebsite] = useState((profile as any).website || "");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">((profile as any).timeFormat || "24h");
  const [dirty, setDirty] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(profile.fullName);
    setPhone(profile.phone || "");
    setWebsite((profile as any).website || "");
    setTimeFormat((profile as any).timeFormat || "24h");
    setDirty(false);
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: { fullName: string; phone: string | null; website: string | null; timeFormat: string }) => {
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

  const avatarUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Photo updated" });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/profile", { avatarUrl: null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Photo removed" });
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-section-title">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Your personal information</p>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback className="text-lg bg-muted font-serif">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploadMutation.isPending}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              data-testid="button-upload-avatar"
            >
              {avatarUploadMutation.isPending ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) avatarUploadMutation.mutate(file);
                e.target.value = "";
              }}
              data-testid="input-avatar-file"
            />
          </div>
          <div>
            <p className="font-medium">{profile.fullName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="text-xs text-primary hover:underline"
                data-testid="button-change-photo"
              >
                {profile.avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {profile.avatarUrl && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button
                    onClick={() => removeAvatarMutation.mutate()}
                    className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                    data-testid="button-remove-avatar"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
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
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="w-3 h-3 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Email cannot be changed here. Contact support.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input value={profile.email || ""} disabled className="opacity-60" data-testid="input-email-readonly" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
            <PhoneInput
              value={phone}
              onChange={(val) => { setPhone(val); setDirty(true); }}
              testId="input-phone"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Website</Label>
            <Input
              value={website}
              onChange={(e) => { setWebsite(e.target.value); setDirty(true); }}
              placeholder="https://yourtravelagency.com"
              data-testid="input-website"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time Format</Label>
            <div className="flex items-center rounded-md border border-border overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => { setTimeFormat("24h"); setDirty(true); }}
                className={`px-4 py-1.5 text-sm transition-colors ${timeFormat === "24h" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                data-testid="button-time-format-24h"
              >
                24h
              </button>
              <button
                type="button"
                onClick={() => { setTimeFormat("12h"); setDirty(true); }}
                className={`px-4 py-1.5 text-sm transition-colors ${timeFormat === "12h" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                data-testid="button-time-format-12h"
              >
                12h AM/PM
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Applies to the client preview and PDF</p>
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
        </div>

        <AnimatePresence>
          {dirty && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-4"
            >
              <Button
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ fullName, phone: phone || null, website: website || null, timeFormat })}
                data-testid="button-save-profile"
              >
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

type InvitationWithInviter = Invitation & { inviterName: string | null };

function OrganizationSection({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const { data: org, isLoading: orgLoading } = useQuery<Organization>({ queryKey: ["/api/organization"] });
  const { data: members, isLoading: membersLoading } = useQuery<Profile[]>({ queryKey: ["/api/members"] });
  const { data: rawInvitations } = useQuery<InvitationWithInviter[]>({ queryKey: ["/api/invitations"] });
  const invitations = rawInvitations?.filter((i) => i.status === "pending") || [];

  const [orgName, setOrgName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [orgDirty, setOrgDirty] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"advisor" | "assistant">("advisor");
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);

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

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiRequest("POST", "/api/invitations", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("advisor");
      toast({ title: "Invitation sent" });
    },
    onError: (error: Error) => {
      if (error.message === "plan_limit") {
        toast({ title: "Plan limit reached", description: "Upgrade to invite more team members", variant: "destructive" });
      } else {
        toast({ title: error.message, variant: "destructive" });
      }
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/members/${memberId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Role updated" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async ({ memberId, canViewAllClients }: { memberId: string; canViewAllClients: boolean }) => {
      const res = await apiRequest("PATCH", `/api/team/${memberId}/permissions`, { canViewAllClients });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Permissions updated" });
    },
    onError: () => {
      toast({ title: "Failed to update permissions", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setRemoveTarget(null);
      toast({ title: "Member removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invitations/${id}/resend`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: "Invitation resent" });
    },
    onError: () => {
      toast({ title: "Failed to resend invitation", variant: "destructive" });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/invitations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: "Invitation cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel invitation", variant: "destructive" });
    },
  });

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

  const advisorCount = members?.filter((m) => m.role !== "client").length || 0;
  const atLimit = advisorCount >= org.maxAdvisors;

  const roleBadgeVariant = (role: string) => {
    if (role === "owner") return "default" as const;
    return "outline" as const;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-org-section-title">Organisation</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your agency and team</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
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

          {isOwner && orgDirty && (
            <Button
              size="sm"
              disabled={updateOrgMutation.isPending}
              onClick={() => updateOrgMutation.mutate({ name: orgName, logoUrl })}
              data-testid="button-save-org"
            >
              {updateOrgMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          )}
        </div>

        <div className="border-t pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-serif text-lg tracking-tight">Team Members</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {advisorCount} of {org.maxAdvisors === 999999 ? "unlimited" : org.maxAdvisors} seats used
              </p>
            </div>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteOpen(true)}
                data-testid="button-invite-member"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Invite team member
              </Button>
            )}
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-team-members">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Member</th>
                      <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Joined</th>
                      {isOwner && (
                        <th className="text-center py-3 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell w-28">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">
                                <Eye className="w-3 h-3" />
                                All Clients
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-xs">
                              Allow this advisor to view all clients, not just their assigned ones
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      )}
                      {isOwner && (
                        <th className="text-right py-3 px-4 font-medium text-xs uppercase tracking-wider text-muted-foreground w-20">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {members?.map((m) => {
                      const isMe = m.id === profile.id;
                      return (
                        <tr key={m.id} className="border-b last:border-b-0" data-testid={`row-member-${m.id}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-[10px] bg-muted font-medium">
                                  {getInitials(m.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium truncate">{m.fullName}</span>
                                  {isMe && <Badge variant="secondary" className="text-[9px]">You</Badge>}
                                </div>
                                <span className="text-xs text-muted-foreground sm:hidden">{m.email || ""}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs hidden sm:table-cell">{m.email || "—"}</td>
                          <td className="py-3 px-4">
                            {isOwner && !isMe ? (
                              <Select
                                value={m.role}
                                onValueChange={(role) => changeRoleMutation.mutate({ memberId: m.id, role })}
                              >
                                <SelectTrigger className="h-7 w-[110px] text-xs" data-testid={`select-role-${m.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="owner">Owner</SelectItem>
                                  <SelectItem value="advisor">Advisor</SelectItem>
                                  <SelectItem value="assistant">Assistant</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={roleBadgeVariant(m.role)} className="capitalize text-[10px]" data-testid={`badge-role-${m.id}`}>
                                {m.role === "owner" && <Crown className="w-2.5 h-2.5 mr-1" />}
                                {m.role}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">
                            {m.createdAt ? format(new Date(m.createdAt), "MMM d, yyyy") : "—"}
                          </td>
                          {isOwner && (
                            <td className="py-3 px-4 text-center hidden lg:table-cell">
                              {m.role === "owner" ? (
                                <Badge variant="secondary" className="text-[9px]">Always</Badge>
                              ) : !isMe ? (
                                <Switch
                                  checked={!!m.canViewAllClients}
                                  onCheckedChange={(checked) =>
                                    togglePermissionMutation.mutate({ memberId: m.id, canViewAllClients: checked })
                                  }
                                  data-testid={`switch-view-all-${m.id}`}
                                />
                              ) : (
                                <Switch
                                  checked={!!m.canViewAllClients}
                                  disabled
                                  data-testid={`switch-view-all-${m.id}`}
                                />
                              )}
                            </td>
                          )}
                          {isOwner && (
                            <td className="py-3 px-4 text-right">
                              {!isMe && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setRemoveTarget(m)}
                                  data-testid={`button-remove-member-${m.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-b-0 opacity-70" data-testid={`row-invitation-${inv.id}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-[10px] bg-muted/50 font-medium">
                                {inv.email[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <span className="text-sm truncate">{inv.email}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="secondary" className="text-[9px]">
                                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                                  Pending
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  expires {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs hidden sm:table-cell">{inv.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize text-[10px]">{inv.role}</Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">
                          Invited {inv.createdAt ? format(new Date(inv.createdAt), "MMM d") : "—"}
                        </td>
                        {isOwner && (
                          <td className="py-3 px-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-invite-actions-${inv.id}`}>
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => resendMutation.mutate(inv.id)}
                                  data-testid={`button-resend-invite-${inv.id}`}
                                >
                                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Resend
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => cancelInviteMutation.mutate(inv.id)}
                                  className="text-destructive"
                                  data-testid={`button-cancel-invite-${inv.id}`}
                                >
                                  <X className="w-3.5 h-3.5 mr-2" /> Cancel
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!membersLoading && (!members || members.length === 0) && invitations.length === 0 && (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          )}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Invite someone to your workspace</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              They'll receive an invitation link to join your agency.
            </DialogDescription>
          </DialogHeader>
          {atLimit ? (
            <div className="py-6 text-center">
              <Crown className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium mb-1">Plan limit reached</p>
              <p className="text-sm text-muted-foreground">
                You've reached your {org.plan} plan limit of {org.maxAdvisors} team members.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to add more advisors.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email address</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "advisor" | "assistant")}>
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advisor">
                        <div className="flex flex-col items-start">
                          <span>Advisor</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="assistant">
                        <div className="flex flex-col items-start">
                          <span>Assistant</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {inviteRole === "advisor"
                      ? "Can manage clients, create and edit trips"
                      : "Can view and edit trips, cannot manage billing"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  data-testid="button-send-invitation"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {inviteMutation.isPending ? "Sending..." : "Send invitation"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Remove team member</DialogTitle>
            <DialogDescription>
              Remove {removeTarget?.fullName} from your workspace? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRemoveTarget(null)} data-testid="button-cancel-remove">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeMemberMutation.mutate(removeTarget.id)}
              disabled={removeMemberMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function BillingSection({ org }: { org: Organization | undefined }) {
  if (!org) return null;

  const daysLeft = org.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const planLabel = org.plan === "trial" ? "Trial" : org.plan === "pro" ? "Pro" : "Enterprise";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <h2 className="font-serif text-2xl tracking-tight" data-testid="text-billing-section-title">Billing</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription and payments</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="text-xs uppercase tracking-wider" data-testid="badge-billing-plan">
            <Crown className="w-3 h-3 mr-1" strokeWidth={1.5} />
            {planLabel}
          </Badge>
          {org.plan === "trial" && (
            <span className="text-sm text-muted-foreground">
              Your trial ends in <span className="font-medium text-foreground">{daysLeft} days</span>
            </span>
          )}
        </div>

        <Card>
          <CardContent className="p-6 text-center">
            <CreditCard className="w-8 h-8 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium mb-1">Billing management coming soon</p>
            <p className="text-sm text-muted-foreground">
              Contact us to upgrade your plan.
            </p>
            <Button variant="outline" size="sm" className="mt-4" disabled data-testid="button-manage-billing">
              Manage billing
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

const templateTypeIcons: Record<string, typeof Plane> = {
  flight: Plane, charter: Ship, charter_flight: Plane, hotel: Hotel, transport: Car,
  restaurant: UtensilsCrossed, activity: Activity, note: StickyNote,
};

const templateTypeLabels: Record<string, string> = {
  flight: "Flight", charter: "Charter", charter_flight: "Charter Flight",
  hotel: "Hotel", transport: "Transport",
  restaurant: "Restaurant", activity: "Activity", note: "Note",
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({ queryKey: ["/api/profile"] });
  const { data: org } = useQuery<Organization>({ queryKey: ["/api/organization"] });

  if (profileLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="flex gap-8">
            <div className="w-48 shrink-0 space-y-2">
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
          <nav className="w-full md:w-48 shrink-0">
            <div className="flex md:flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors w-full text-left cursor-pointer ${
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
            {activeSection === "billing" && <BillingSection org={org} />}
          </div>
        </div>
      </div>
    </div>
  );
}

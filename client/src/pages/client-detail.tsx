import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Mail,
  Phone,
  Plane,
  Calendar,
  Pencil,
  Send,
  X,
  Check,
  Plus,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import type { Client, Trip } from "@shared/schema";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const avatarColors = [
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
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

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
  });

  const { data: clientTrips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["/api/clients", id, "trips"],
  });

  useEffect(() => {
    if (client && !isEditing) {
      setEditName(client.fullName);
      setEditEmail(client.email || "");
      setEditPhone(client.phone || "");
      setEditNotes(client.notes || "");
      setEditTags(client.tags || []);
    }
  }, [client, isEditing]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsEditing(false);
      toast({ title: "Client updated" });
    },
    onError: () => {
      toast({ title: "Failed to update client", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clients/${id}/invite`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      setShowInviteModal(false);
      toast({ title: "Invitation sent" });
    },
    onError: () => {
      toast({ title: "Failed to send invitation", variant: "destructive" });
    },
  });

  function startEditing() {
    if (!client) return;
    setEditName(client.fullName);
    setEditEmail(client.email || "");
    setEditPhone(client.phone || "");
    setEditNotes(client.notes || "");
    setEditTags(client.tags || []);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setTagInput("");
  }

  function saveEdits() {
    if (!editName.trim()) return;
    updateMutation.mutate({
      fullName: editName.trim(),
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      notes: editNotes.trim() || null,
      tags: editTags.length > 0 ? editTags : null,
    });
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,$/g, "");
      if (newTag && !editTags.includes(newTag) && editTags.length < 5) {
        setEditTags([...editTags, newTag]);
      }
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && editTags.length > 0) {
      setEditTags(editTags.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setEditTags(editTags.filter((t) => t !== tag));
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
          <Skeleton className="h-4 w-16 mb-10" />
          <div className="flex items-start gap-6 mb-12">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-24 w-full mb-8" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
          <Link href="/clients" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3" />
              Clients
            </span>
          </Link>
          <div className="py-20 text-center">
            <p className="font-serif text-2xl text-muted-foreground/40">Client not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 md:py-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <Link
            href="/clients"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 mb-10"
            data-testid="link-back-clients"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
            Clients
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <div className="flex items-start justify-between gap-4 mb-12 flex-wrap">
            <div className="flex items-start gap-5">
              <Avatar className="h-20 w-20 shrink-0" data-testid="avatar-client">
                <AvatarFallback className={`text-xl font-medium ${getAvatarColor(client.fullName)}`}>
                  {getInitials(client.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="pt-1">
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="font-serif text-2xl md:text-3xl tracking-tight border-0 border-b border-border/40 rounded-none px-0 h-auto py-1 focus-visible:ring-0 focus-visible:border-foreground/30 bg-transparent"
                    data-testid="input-edit-name"
                    autoFocus
                  />
                ) : (
                  <h1
                    className="font-serif text-2xl md:text-3xl tracking-tight"
                    data-testid="text-client-name"
                  >
                    {client.fullName}
                  </h1>
                )}
                <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                  {isEditing ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          className="h-7 text-sm border-0 border-b border-border/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground/30 bg-transparent w-48"
                          data-testid="input-edit-email"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Phone"
                          className="h-7 text-sm border-0 border-b border-border/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground/30 bg-transparent w-40"
                          data-testid="input-edit-phone"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {client.email && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-client-email">
                          <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-client-phone">
                          <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {client.phone}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {client.invited === "yes" && !isEditing && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 inline-block" data-testid="text-invited-status">
                    Portal invitation sent{client.invitedAt ? ` ${format(new Date(client.invitedAt), "MMM d")}` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="edit-actions"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEditing}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEdits}
                      disabled={updateMutation.isPending || !editName.trim()}
                      data-testid="button-save-edit"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view-actions"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={startEditing}
                      data-testid="button-edit-client"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInviteModal(true)}
                      disabled={!client.email}
                      data-testid="button-invite-portal"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Invite to Portal
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-3" data-testid="text-preferences-label">
            Preferences
          </h2>
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {editTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs font-normal gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-tag-${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={editTags.length >= 5 ? "Maximum tags reached" : "Add a preference and press Enter"}
                disabled={editTags.length >= 5}
                className="text-sm"
                data-testid="input-edit-tags"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
              {client.tags && client.tags.length > 0 ? (
                client.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs font-normal no-default-hover-elevate no-default-active-elevate"
                    data-testid={`badge-tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground/40 italic">No preferences set</span>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-3" data-testid="text-notes-label">
            Notes
          </h2>
          {isEditing ? (
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add notes about this client..."
              className="text-sm min-h-[120px] resize-none"
              data-testid="input-edit-notes"
            />
          ) : (
            <div className="min-h-[40px]">
              {client.notes ? (
                <p
                  className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-border/30"
                  data-testid="text-client-notes"
                >
                  {client.notes}
                </p>
              ) : (
                <span className="text-sm text-muted-foreground/40 italic">No notes yet</span>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Plane className="w-4 h-4 text-muted-foreground/40" strokeWidth={1.5} />
              <h2 className="font-serif text-lg tracking-tight" data-testid="text-trips-heading">
                Trips
              </h2>
              <span className="text-xs text-muted-foreground/50">({clientTrips.length})</span>
            </div>
          </div>

          {tripsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : clientTrips.length > 0 ? (
            <div className="space-y-2">
              {clientTrips.map((trip) => (
                <Link key={trip.id} href={`/trips/${trip.id}`}>
                  <Card
                    className="hover-elevate cursor-pointer border-border/30"
                    data-testid={`card-trip-${trip.id}`}
                  >
                    <CardContent className="px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-serif text-sm tracking-tight truncate">{trip.title}</h3>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{trip.destination}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {trip.startDate && trip.endDate && (
                          <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            {format(new Date(trip.startDate), "MMM d")} – {format(new Date(trip.endDate), "MMM d, yyyy")}
                          </span>
                        )}
                        {trip.startDate && !trip.endDate && (
                          <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            {format(new Date(trip.startDate), "MMM d, yyyy")}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider font-normal border-border/50 no-default-hover-elevate no-default-active-elevate"
                        >
                          {trip.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground/40">No trips yet</p>
            </div>
          )}

          <div className="mt-4">
            <Link href={`/trips?newFor=${id}`}>
              <button
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                data-testid="button-create-trip-for-client"
              >
                <Plus className="w-3 h-3" strokeWidth={1.5} />
                Create Trip for {client.fullName.split(" ")[0]}
              </button>
            </Link>
          </div>
        </motion.div>
      </div>

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-invite-portal">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl tracking-tight" data-testid="text-invite-title">
              Invite to Portal
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/70 mt-1">
              Send {client.fullName.split(" ")[0]} access to their travel portal
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-1.5 block">
                Email
              </label>
              <Input
                value={client.email || ""}
                readOnly
                className="text-sm bg-muted/30"
                data-testid="input-invite-email"
              />
            </div>
            {client.invited === "yes" && (
              <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-already-invited">
                An invitation was already sent{client.invitedAt ? ` on ${format(new Date(client.invitedAt), "MMM d, yyyy")}` : ""}. Sending again will resend the invite.
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteModal(false)}
                data-testid="button-cancel-invite"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
                data-testid="button-send-invite"
              >
                <Send className="w-3.5 h-3.5" />
                {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

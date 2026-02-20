import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, Mail, Phone, Plane, X, Users } from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Client, Profile } from "@shared/schema";

type ClientWithTripCount = Client & { tripCount: number };

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: clients, isLoading } = useQuery<ClientWithTripCount[]>({
    queryKey: ["/api/clients"],
  });

  const { data: members = [] } = useQuery<Profile[]>({
    queryKey: ["/api/members"],
  });

  const advisorMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.fullName));
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`max-w-5xl mx-auto ${isMobile ? 'px-4 py-4' : 'px-6 md:px-10 py-10 md:py-14'}`}>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={isMobile ? "mb-4" : "mb-10"}
        >
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className={`font-serif tracking-tight ${isMobile ? 'text-2xl' : 'text-4xl md:text-5xl'}`} data-testid="text-clients-title">
                Clients
              </h1>
              {!isMobile && (
                <p className="text-muted-foreground mt-2 text-base">
                  {clients ? `${clients.length} client${clients.length !== 1 ? "s" : ""}` : "Loading..."}
                </p>
              )}
            </div>
            {!isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                data-testid="button-add-client"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Client
              </Button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={isMobile ? "mb-4" : "mb-8"}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
            <Input
              placeholder={isMobile ? "Search clients..." : "Search by name, email, or tag..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`pl-10 transition-all duration-300 border-border/50 ${
                isMobile ? "w-full" : (searchFocused ? "w-full md:w-96" : "w-full md:w-64")
              }`}
              data-testid="input-search-clients"
            />
          </div>
        </motion.div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-border/30">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Card className="border-border/40 overflow-visible">
              <div className="divide-y divide-border/30">
                <div className="hidden md:grid grid-cols-[1fr_1fr_120px_100px_140px] gap-4 items-center px-5 py-3">
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Name</span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Contact</span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Advisor</span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium text-center">Trips</span>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Tags</span>
                </div>

                {filtered.map((client, i) => (
                  <motion.div key={client.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                    <Link href={`/clients/${client.id}`}>
                      <div
                        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_100px_140px] gap-3 md:gap-4 items-center px-5 py-4 hover-elevate cursor-pointer"
                        data-testid={`row-client-${client.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback
                              className={`text-xs font-medium ${getAvatarColor(client.fullName)}`}
                            >
                              {getInitials(client.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm font-medium truncate"
                            data-testid={`text-client-name-${client.id}`}
                          >
                            {client.fullName}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5 min-w-0 text-xs text-muted-foreground">
                          {client.email && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                              <span className="truncate" data-testid={`text-client-email-${client.id}`}>{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                              <span>{client.phone}</span>
                            </div>
                          )}
                          {!client.email && !client.phone && (
                            <span className="text-muted-foreground/40">No contact info</span>
                          )}
                        </div>

                        <div className="hidden md:flex items-center min-w-0">
                          {client.assignedAdvisorId && advisorMap.get(client.assignedAdvisorId) ? (
                            <span className="text-xs text-muted-foreground truncate" data-testid={`text-advisor-${client.id}`}>
                              {advisorMap.get(client.assignedAdvisorId)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">—</span>
                          )}
                        </div>

                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Plane className="w-3 h-3" strokeWidth={1.5} />
                            <span data-testid={`text-client-trips-${client.id}`}>{client.tripCount}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {client.tags && client.tags.length > 0 ? (
                            client.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[10px] font-normal border-border/50 no-default-hover-elevate no-default-active-elevate"
                              >
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground/30">-</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : searchQuery ? (
          <div className="py-20 text-center">
            <p className="font-serif text-xl text-muted-foreground/50 mb-1 tracking-tight">
              No clients match "{searchQuery}"
            </p>
            <p className="text-sm text-muted-foreground/40">Try a different search term.</p>
          </div>
        ) : (
          <div className="py-24 text-center">
            <p className="font-serif text-3xl text-muted-foreground/40 mb-2 tracking-tight" data-testid="text-empty-state">
              Your client roster lives here.
            </p>
            <p className="text-sm text-muted-foreground/35 mb-8 max-w-md mx-auto">
              Add your first client to begin building relationships and planning unforgettable trips.
            </p>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              data-testid="button-add-first-client"
            >
              <Plus className="w-4 h-4" />
              Add Your First Client
            </Button>
          </div>
        )}
      </div>

      <AddClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function AddClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clients", {
        fullName: fullName.trim(),
        email: email.trim() || "",
        phone: phone.trim() || "",
        notes: notes.trim() || "",
        tags: tags.length > 0 ? tags : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Client added", description: `${fullName} has been added to your roster.` });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add client", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setTagInput("");
    setTags([]);
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,/g, "");
      if (tag && !tags.includes(tag) && tags.length < 5) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-client">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tight">New Client</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (fullName.trim()) createMutation.mutate();
          }}
          className="space-y-5 mt-2"
        >
          <div className="space-y-2">
            <Label htmlFor="client-name" className="text-xs uppercase tracking-wider text-muted-foreground">
              Full Name
            </Label>
            <Input
              id="client-name"
              placeholder="e.g. Eleanor Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              data-testid="input-client-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="client-email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-client-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone" className="text-xs uppercase tracking-wider text-muted-foreground">
                Phone
              </Label>
              <Input
                id="client-phone"
                placeholder="+1 555 0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-client-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Preferences
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <AnimatePresence>
                {tags.map((tag) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Badge
                      variant="outline"
                      className="text-xs font-normal gap-1 pr-1 border-border/50"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 rounded-full p-0.5"
                        data-testid={`button-remove-tag-${tag}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <Input
              placeholder={tags.length >= 5 ? "Max 5 tags" : "e.g. Luxury, Beach, Adventure (press Enter)"}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              disabled={tags.length >= 5}
              data-testid="input-client-tags"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-notes" className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes
            </Label>
            <Textarea
              id="client-notes"
              placeholder="Anything helpful to remember..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="input-client-notes"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { resetForm(); onOpenChange(false); }}
              data-testid="button-cancel-client"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!fullName.trim() || createMutation.isPending}
              data-testid="button-save-client"
            >
              {createMutation.isPending ? "Saving..." : "Save Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

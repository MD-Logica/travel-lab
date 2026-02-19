import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Trash2,
  FileText,
  Heart,
  User,
  Upload,
  Download,
  Eye,
  EyeOff,
  File,
  Image,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link, useParams, useLocation } from "wouter";
import type { Client, Trip, TripDocument } from "@shared/schema";
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

type TabId = "overview" | "preferences" | "documents";

interface ClientPreferences {
  travelStyle?: {
    tier?: string;
    pace?: string;
    notes?: string;
  };
  flights?: {
    cabin?: string;
    preferredAirlines?: string[];
    seatPreference?: string;
    avoidAirlines?: string[];
    frequentFlyer?: { airline: string; number: string }[];
    notes?: string;
  };
  hotels?: {
    tier?: string;
    preferredBrands?: string[];
    roomPreferences?: string;
    avoidHotels?: string[];
    notes?: string;
  };
  dining?: {
    dietary?: string[];
    cuisinePreferences?: string[];
    avoidCuisines?: string[];
    diningStyle?: string;
    notes?: string;
  };
  interests?: {
    selected?: string[];
    avoidExperiences?: string[];
    notes?: string;
  };
  importantDates?: { label: string; date: string }[];
  loyalty?: { program: string; number: string; tier: string }[];
  generalNotes?: string;
}

const EMPTY_PREFS: ClientPreferences = {
  travelStyle: {},
  flights: { preferredAirlines: [], avoidAirlines: [], frequentFlyer: [] },
  hotels: { preferredBrands: [], avoidHotels: [] },
  dining: { dietary: [], cuisinePreferences: [], avoidCuisines: [] },
  interests: { selected: [], avoidExperiences: [] },
  importantDates: [],
  loyalty: [],
  generalNotes: "",
};

const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free",
  "Dairy-free", "Nut allergy", "Shellfish allergy", "Other",
];

const INTEREST_OPTIONS = [
  "Art & museums", "Wine & gastronomy", "Golf", "Tennis",
  "Wellness & spa", "Hiking", "Water sports", "Shopping",
  "Nightlife", "Architecture", "History & culture", "Wildlife",
  "Family activities", "Music & performance",
];

function TagInput({
  tags,
  onChange,
  placeholder,
  testId,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder: string;
  testId: string;
}) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      const val = input.trim().replace(/,$/g, "");
      if (val && !tags.includes(val)) onChange([...tags, val]);
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border border-border/50 rounded-md px-2.5 py-1.5 min-h-[38px] cursor-text bg-background"
      onClick={() => ref.current?.focus()}
    >
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="text-xs font-normal gap-1">
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(tags.filter((t) => t !== tag));
            }}
            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
        data-testid={testId}
      />
    </div>
  );
}

function RepeatableRows({
  rows,
  onChange,
  fields,
  testIdPrefix,
}: {
  rows: Record<string, string>[];
  onChange: (r: Record<string, string>[]) => void;
  fields: { key: string; label: string; type?: string }[];
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          {fields.map((f) => (
            <Input
              key={f.key}
              type={f.type || "text"}
              value={row[f.key] || ""}
              onChange={(e) => {
                const updated = [...rows];
                updated[i] = { ...updated[i], [f.key]: e.target.value };
                onChange(updated);
              }}
              placeholder={f.label}
              className="flex-1 min-w-[120px] text-sm"
              data-testid={`${testIdPrefix}-${f.key}-${i}`}
            />
          ))}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            data-testid={`${testIdPrefix}-remove-${i}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const empty: Record<string, string> = {};
          fields.forEach((f) => (empty[f.key] = ""));
          onChange([...rows, empty]);
        }}
        data-testid={`${testIdPrefix}-add`}
      >
        <Plus className="w-3.5 h-3.5" /> Add Row
      </Button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-base tracking-tight mb-3 mt-0">{children}</h3>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-1.5 block">
      {children}
    </label>
  );
}

function ViewTagList({ items, emptyText }: { items?: string[]; emptyText: string }) {
  if (!items || items.length === 0) return <span className="text-sm text-muted-foreground/40 italic">{emptyText}</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="text-xs font-normal no-default-hover-elevate no-default-active-elevate">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function PreferencesTab({
  client,
  onSaved,
}: {
  client: Client;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [prefs, setPrefs] = useState<ClientPreferences>(EMPTY_PREFS);

  const savedPrefs = (client.preferences as ClientPreferences | null) || EMPTY_PREFS;

  useEffect(() => {
    setPrefs(structuredClone(savedPrefs));
  }, [client.preferences]);

  const saveMutation = useMutation({
    mutationFn: async (data: ClientPreferences) => {
      const res = await apiRequest("PATCH", `/api/clients/${client.id}/preferences`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id] });
      setIsEditing(false);
      onSaved();
      toast({ title: "Preferences saved" });
    },
    onError: () => {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    },
  });

  function startEditing() {
    setPrefs(structuredClone(savedPrefs));
    setIsEditing(true);
  }

  function cancel() {
    setPrefs(structuredClone(savedPrefs));
    setIsEditing(false);
  }

  const update = useCallback(
    <K extends keyof ClientPreferences>(section: K, value: ClientPreferences[K]) => {
      setPrefs((p) => ({ ...p, [section]: value }));
    },
    []
  );

  const hasAnyPrefs = !!(
    savedPrefs.travelStyle?.tier ||
    savedPrefs.travelStyle?.pace ||
    savedPrefs.flights?.cabin ||
    savedPrefs.hotels?.tier ||
    (savedPrefs.dining?.dietary && savedPrefs.dining.dietary.length > 0) ||
    (savedPrefs.interests?.selected && savedPrefs.interests.selected.length > 0) ||
    (savedPrefs.importantDates && savedPrefs.importantDates.length > 0) ||
    (savedPrefs.loyalty && savedPrefs.loyalty.length > 0) ||
    savedPrefs.generalNotes
  );

  if (!isEditing && !hasAnyPrefs) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h3 className="font-serif text-lg mb-1">No preferences recorded yet</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
          Track travel style, dietary needs, hotel preferences, and more to deliver a personalised experience.
        </p>
        <Button onClick={startEditing} data-testid="button-start-preferences">
          <Pencil className="w-4 h-4" /> Add Preferences
        </Button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="font-serif text-xl tracking-tight" data-testid="text-edit-preferences-heading">
              Edit Preferences
            </h2>
            {client.preferencesUpdatedAt && (
              <p className="text-[11px] text-muted-foreground/50 mt-1">
                Last updated {format(new Date(client.preferencesUpdatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} data-testid="button-cancel-preferences">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(prefs)}
              disabled={saveMutation.isPending}
              data-testid="button-save-preferences"
            >
              <Check className="w-3.5 h-3.5" />
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Travel Style</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <FieldLabel>Preferred Tier</FieldLabel>
                  <Select
                    value={prefs.travelStyle?.tier || ""}
                    onValueChange={(v) => update("travelStyle", { ...prefs.travelStyle, tier: v })}
                  >
                    <SelectTrigger data-testid="select-travel-tier">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultra-luxury">Ultra-luxury</SelectItem>
                      <SelectItem value="luxury">Luxury</SelectItem>
                      <SelectItem value="boutique">Boutique</SelectItem>
                      <SelectItem value="adventure">Adventure</SelectItem>
                      <SelectItem value="cultural">Cultural</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Pace</FieldLabel>
                  <Select
                    value={prefs.travelStyle?.pace || ""}
                    onValueChange={(v) => update("travelStyle", { ...prefs.travelStyle, pace: v })}
                  >
                    <SelectTrigger data-testid="select-travel-pace">
                      <SelectValue placeholder="Select pace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="packed">Packed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <FieldLabel>Additional Notes</FieldLabel>
              <Textarea
                value={prefs.travelStyle?.notes || ""}
                onChange={(e) => update("travelStyle", { ...prefs.travelStyle, notes: e.target.value })}
                placeholder="Additional style notes..."
                className="text-sm min-h-[60px] resize-none"
                data-testid="textarea-travel-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>Flights</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <FieldLabel>Preferred Cabin</FieldLabel>
                  <Select
                    value={prefs.flights?.cabin || ""}
                    onValueChange={(v) => update("flights", { ...prefs.flights, cabin: v })}
                  >
                    <SelectTrigger data-testid="select-flight-cabin">
                      <SelectValue placeholder="Select cabin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">First</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="premium-economy">Premium Economy</SelectItem>
                      <SelectItem value="economy">Economy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Seat Preference</FieldLabel>
                  <Select
                    value={prefs.flights?.seatPreference || ""}
                    onValueChange={(v) => update("flights", { ...prefs.flights, seatPreference: v })}
                  >
                    <SelectTrigger data-testid="select-seat-pref">
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="window">Window</SelectItem>
                      <SelectItem value="aisle">Aisle</SelectItem>
                      <SelectItem value="no-preference">No preference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <FieldLabel>Preferred Airlines</FieldLabel>
                  <TagInput
                    tags={prefs.flights?.preferredAirlines || []}
                    onChange={(t) => update("flights", { ...prefs.flights, preferredAirlines: t })}
                    placeholder="e.g. Emirates, Singapore Airlines"
                    testId="tag-preferred-airlines"
                  />
                </div>
                <div>
                  <FieldLabel>Avoid Airlines</FieldLabel>
                  <TagInput
                    tags={prefs.flights?.avoidAirlines || []}
                    onChange={(t) => update("flights", { ...prefs.flights, avoidAirlines: t })}
                    placeholder="Airlines to avoid"
                    testId="tag-avoid-airlines"
                  />
                </div>
              </div>
              <div className="mb-4">
                <FieldLabel>Frequent Flyer Numbers</FieldLabel>
                <RepeatableRows
                  rows={prefs.flights?.frequentFlyer || []}
                  onChange={(r) => update("flights", { ...prefs.flights, frequentFlyer: r as any })}
                  fields={[
                    { key: "airline", label: "Airline" },
                    { key: "number", label: "Number" },
                  ]}
                  testIdPrefix="ff"
                />
              </div>
              <FieldLabel>Additional Notes</FieldLabel>
              <Textarea
                value={prefs.flights?.notes || ""}
                onChange={(e) => update("flights", { ...prefs.flights, notes: e.target.value })}
                placeholder="e.g. always books bulkhead, never red-eyes"
                className="text-sm min-h-[60px] resize-none"
                data-testid="textarea-flight-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>Hotels</SectionLabel>
              <div className="mb-4">
                <FieldLabel>Preferred Tier</FieldLabel>
                <Select
                  value={prefs.hotels?.tier || ""}
                  onValueChange={(v) => update("hotels", { ...prefs.hotels, tier: v })}
                >
                  <SelectTrigger data-testid="select-hotel-tier">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ultra-luxury">Ultra-luxury (7-star)</SelectItem>
                    <SelectItem value="5-star">5-star</SelectItem>
                    <SelectItem value="4-star">4-star</SelectItem>
                    <SelectItem value="boutique">Boutique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <FieldLabel>Preferred Brands / Groups</FieldLabel>
                  <TagInput
                    tags={prefs.hotels?.preferredBrands || []}
                    onChange={(t) => update("hotels", { ...prefs.hotels, preferredBrands: t })}
                    placeholder="e.g. Aman, Four Seasons, Rosewood"
                    testId="tag-hotel-brands"
                  />
                </div>
                <div>
                  <FieldLabel>Room Preferences</FieldLabel>
                  <Textarea
                    value={prefs.hotels?.roomPreferences || ""}
                    onChange={(e) => update("hotels", { ...prefs.hotels, roomPreferences: e.target.value })}
                    placeholder="e.g. High floor, away from elevator, king bed, bathtub not shower only. At Cipriani Venice: Room 207 preferred."
                    className="text-sm min-h-[100px] resize-none"
                    data-testid="textarea-room-prefs"
                  />
                </div>
                <div>
                  <FieldLabel>Avoid Hotels</FieldLabel>
                  <TagInput
                    tags={prefs.hotels?.avoidHotels || []}
                    onChange={(t) => update("hotels", { ...prefs.hotels, avoidHotels: t })}
                    placeholder="Hotels to avoid"
                    testId="tag-avoid-hotels"
                  />
                </div>
              </div>
              <FieldLabel>Additional Notes</FieldLabel>
              <Textarea
                value={prefs.hotels?.notes || ""}
                onChange={(e) => update("hotels", { ...prefs.hotels, notes: e.target.value })}
                placeholder="Additional hotel notes..."
                className="text-sm min-h-[60px] resize-none"
                data-testid="textarea-hotel-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>Dining</SectionLabel>
              <div className="mb-4">
                <FieldLabel>Dietary Requirements</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DIETARY_OPTIONS.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={(prefs.dining?.dietary || []).includes(opt)}
                        onCheckedChange={(checked) => {
                          const current = prefs.dining?.dietary || [];
                          const next = checked
                            ? [...current, opt]
                            : current.filter((d) => d !== opt);
                          update("dining", { ...prefs.dining, dietary: next });
                        }}
                        data-testid={`checkbox-dietary-${opt.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <FieldLabel>Cuisine Preferences</FieldLabel>
                  <TagInput
                    tags={prefs.dining?.cuisinePreferences || []}
                    onChange={(t) => update("dining", { ...prefs.dining, cuisinePreferences: t })}
                    placeholder="e.g. Japanese, Italian, French"
                    testId="tag-cuisine-prefs"
                  />
                </div>
                <div>
                  <FieldLabel>Avoid Cuisines</FieldLabel>
                  <TagInput
                    tags={prefs.dining?.avoidCuisines || []}
                    onChange={(t) => update("dining", { ...prefs.dining, avoidCuisines: t })}
                    placeholder="Cuisines to avoid"
                    testId="tag-avoid-cuisines"
                  />
                </div>
              </div>
              <div className="mb-4">
                <FieldLabel>Dining Style</FieldLabel>
                <Select
                  value={prefs.dining?.diningStyle || ""}
                  onValueChange={(v) => update("dining", { ...prefs.dining, diningStyle: v })}
                >
                  <SelectTrigger data-testid="select-dining-style">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fine-dining">Fine dining</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="local-authentic">Local / authentic</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FieldLabel>Additional Notes</FieldLabel>
              <Textarea
                value={prefs.dining?.notes || ""}
                onChange={(e) => update("dining", { ...prefs.dining, notes: e.target.value })}
                placeholder="e.g. always requests corner table, no sharing plates"
                className="text-sm min-h-[60px] resize-none"
                data-testid="textarea-dining-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>Interests & Experiences</SectionLabel>
              <div className="mb-4">
                <FieldLabel>Interests</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INTEREST_OPTIONS.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={(prefs.interests?.selected || []).includes(opt)}
                        onCheckedChange={(checked) => {
                          const current = prefs.interests?.selected || [];
                          const next = checked
                            ? [...current, opt]
                            : current.filter((i) => i !== opt);
                          update("interests", { ...prefs.interests, selected: next });
                        }}
                        data-testid={`checkbox-interest-${opt.toLowerCase().replace(/[&\s]+/g, "-")}`}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <FieldLabel>Avoid Experiences</FieldLabel>
                <TagInput
                  tags={prefs.interests?.avoidExperiences || []}
                  onChange={(t) => update("interests", { ...prefs.interests, avoidExperiences: t })}
                  placeholder="Experiences to avoid"
                  testId="tag-avoid-experiences"
                />
              </div>
              <FieldLabel>Additional Notes</FieldLabel>
              <Textarea
                value={prefs.interests?.notes || ""}
                onChange={(e) => update("interests", { ...prefs.interests, notes: e.target.value })}
                placeholder="Additional notes about interests..."
                className="text-sm min-h-[60px] resize-none"
                data-testid="textarea-interests-notes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>Important Dates</SectionLabel>
              <p className="text-xs text-muted-foreground/50 mb-3">
                Birthdays, anniversaries, and other dates to remember when planning trips.
              </p>
              <RepeatableRows
                rows={prefs.importantDates || []}
                onChange={(r) => update("importantDates", r as any)}
                fields={[
                  { key: "label", label: "Label (e.g. Birthday)" },
                  { key: "date", label: "Date", type: "date" },
                ]}
                testIdPrefix="dates"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>Loyalty & Memberships</SectionLabel>
              <p className="text-xs text-muted-foreground/50 mb-3">
                Airline frequent flyer, hotel loyalty, credit card concierge programs, etc.
              </p>
              <RepeatableRows
                rows={prefs.loyalty || []}
                onChange={(r) => update("loyalty", r as any)}
                fields={[
                  { key: "program", label: "Program name" },
                  { key: "number", label: "Member number" },
                  { key: "tier", label: "Tier / status" },
                ]}
                testIdPrefix="loyalty"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionLabel>General Notes</SectionLabel>
              <p className="text-xs text-muted-foreground/50 mb-3">
                Anything that doesn't fit the structured fields above.
              </p>
              <Textarea
                value={prefs.generalNotes || ""}
                onChange={(e) => update("generalNotes", e.target.value)}
                placeholder="Freeform notes..."
                className="text-sm min-h-[140px] resize-none"
                data-testid="textarea-general-notes"
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 mb-10 sticky bottom-4">
          <Button variant="ghost" size="sm" onClick={cancel} data-testid="button-cancel-preferences-bottom">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(prefs)}
            disabled={saveMutation.isPending}
            data-testid="button-save-preferences-bottom"
          >
            <Check className="w-3.5 h-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>
    );
  }

  const formatValue = (v?: string) => {
    if (!v) return null;
    return v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="font-serif text-xl tracking-tight" data-testid="text-preferences-heading">
            Preferences
          </h2>
          {client.preferencesUpdatedAt && (
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              Last updated {format(new Date(client.preferencesUpdatedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-preferences">
          <Pencil className="w-3.5 h-3.5" /> Edit Preferences
        </Button>
      </div>

      <div className="space-y-6">
        {(savedPrefs.travelStyle?.tier || savedPrefs.travelStyle?.pace || savedPrefs.travelStyle?.notes) && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Travel Style</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedPrefs.travelStyle?.tier && (
                  <div>
                    <FieldLabel>Preferred Tier</FieldLabel>
                    <p className="text-sm">{formatValue(savedPrefs.travelStyle.tier)}</p>
                  </div>
                )}
                {savedPrefs.travelStyle?.pace && (
                  <div>
                    <FieldLabel>Pace</FieldLabel>
                    <p className="text-sm">{formatValue(savedPrefs.travelStyle.pace)}</p>
                  </div>
                )}
              </div>
              {savedPrefs.travelStyle?.notes && (
                <div className="mt-3">
                  <FieldLabel>Notes</FieldLabel>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{savedPrefs.travelStyle.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(savedPrefs.flights?.cabin || savedPrefs.flights?.seatPreference ||
          (savedPrefs.flights?.preferredAirlines && savedPrefs.flights.preferredAirlines.length > 0) ||
          (savedPrefs.flights?.avoidAirlines && savedPrefs.flights.avoidAirlines.length > 0) ||
          (savedPrefs.flights?.frequentFlyer && savedPrefs.flights.frequentFlyer.length > 0) ||
          savedPrefs.flights?.notes) && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Flights</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                {savedPrefs.flights?.cabin && (
                  <div>
                    <FieldLabel>Preferred Cabin</FieldLabel>
                    <p className="text-sm">{formatValue(savedPrefs.flights.cabin)}</p>
                  </div>
                )}
                {savedPrefs.flights?.seatPreference && (
                  <div>
                    <FieldLabel>Seat Preference</FieldLabel>
                    <p className="text-sm">{formatValue(savedPrefs.flights.seatPreference)}</p>
                  </div>
                )}
              </div>
              {savedPrefs.flights?.preferredAirlines && savedPrefs.flights.preferredAirlines.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Preferred Airlines</FieldLabel>
                  <ViewTagList items={savedPrefs.flights.preferredAirlines} emptyText="" />
                </div>
              )}
              {savedPrefs.flights?.avoidAirlines && savedPrefs.flights.avoidAirlines.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Avoid Airlines</FieldLabel>
                  <ViewTagList items={savedPrefs.flights.avoidAirlines} emptyText="" />
                </div>
              )}
              {savedPrefs.flights?.frequentFlyer && savedPrefs.flights.frequentFlyer.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Frequent Flyer Numbers</FieldLabel>
                  <div className="space-y-1">
                    {savedPrefs.flights.frequentFlyer.map((ff, i) => (
                      <p key={i} className="text-sm">
                        {ff.airline}: <span className="font-mono text-xs text-muted-foreground">{ff.number}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {savedPrefs.flights?.notes && (
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{savedPrefs.flights.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(savedPrefs.hotels?.tier || (savedPrefs.hotels?.preferredBrands && savedPrefs.hotels.preferredBrands.length > 0) ||
          savedPrefs.hotels?.roomPreferences || (savedPrefs.hotels?.avoidHotels && savedPrefs.hotels.avoidHotels.length > 0) ||
          savedPrefs.hotels?.notes) && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Hotels</SectionLabel>
              {savedPrefs.hotels?.tier && (
                <div className="mb-3">
                  <FieldLabel>Preferred Tier</FieldLabel>
                  <p className="text-sm">{formatValue(savedPrefs.hotels.tier)}</p>
                </div>
              )}
              {savedPrefs.hotels?.preferredBrands && savedPrefs.hotels.preferredBrands.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Preferred Brands</FieldLabel>
                  <ViewTagList items={savedPrefs.hotels.preferredBrands} emptyText="" />
                </div>
              )}
              {savedPrefs.hotels?.roomPreferences && (
                <div className="mb-3">
                  <FieldLabel>Room Preferences</FieldLabel>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{savedPrefs.hotels.roomPreferences}</p>
                </div>
              )}
              {savedPrefs.hotels?.avoidHotels && savedPrefs.hotels.avoidHotels.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Avoid Hotels</FieldLabel>
                  <ViewTagList items={savedPrefs.hotels.avoidHotels} emptyText="" />
                </div>
              )}
              {savedPrefs.hotels?.notes && (
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{savedPrefs.hotels.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {((savedPrefs.dining?.dietary && savedPrefs.dining.dietary.length > 0) ||
          (savedPrefs.dining?.cuisinePreferences && savedPrefs.dining.cuisinePreferences.length > 0) ||
          (savedPrefs.dining?.avoidCuisines && savedPrefs.dining.avoidCuisines.length > 0) ||
          savedPrefs.dining?.diningStyle || savedPrefs.dining?.notes) && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Dining</SectionLabel>
              {savedPrefs.dining?.dietary && savedPrefs.dining.dietary.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Dietary Requirements</FieldLabel>
                  <ViewTagList items={savedPrefs.dining.dietary} emptyText="" />
                </div>
              )}
              {savedPrefs.dining?.cuisinePreferences && savedPrefs.dining.cuisinePreferences.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Cuisine Preferences</FieldLabel>
                  <ViewTagList items={savedPrefs.dining.cuisinePreferences} emptyText="" />
                </div>
              )}
              {savedPrefs.dining?.avoidCuisines && savedPrefs.dining.avoidCuisines.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Avoid Cuisines</FieldLabel>
                  <ViewTagList items={savedPrefs.dining.avoidCuisines} emptyText="" />
                </div>
              )}
              {savedPrefs.dining?.diningStyle && (
                <div className="mb-3">
                  <FieldLabel>Dining Style</FieldLabel>
                  <p className="text-sm">{formatValue(savedPrefs.dining.diningStyle)}</p>
                </div>
              )}
              {savedPrefs.dining?.notes && (
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{savedPrefs.dining.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {((savedPrefs.interests?.selected && savedPrefs.interests.selected.length > 0) ||
          (savedPrefs.interests?.avoidExperiences && savedPrefs.interests.avoidExperiences.length > 0) ||
          savedPrefs.interests?.notes) && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Interests & Experiences</SectionLabel>
              {savedPrefs.interests?.selected && savedPrefs.interests.selected.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Interests</FieldLabel>
                  <ViewTagList items={savedPrefs.interests.selected} emptyText="" />
                </div>
              )}
              {savedPrefs.interests?.avoidExperiences && savedPrefs.interests.avoidExperiences.length > 0 && (
                <div className="mb-3">
                  <FieldLabel>Avoid Experiences</FieldLabel>
                  <ViewTagList items={savedPrefs.interests.avoidExperiences} emptyText="" />
                </div>
              )}
              {savedPrefs.interests?.notes && (
                <div>
                  <FieldLabel>Notes</FieldLabel>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{savedPrefs.interests.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {savedPrefs.importantDates && savedPrefs.importantDates.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Important Dates</SectionLabel>
              <div className="space-y-1.5">
                {savedPrefs.importantDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                    <span className="font-medium">{d.label}</span>
                    <span className="text-muted-foreground">
                      {d.date ? format(new Date(d.date + "T00:00:00"), "MMMM d") : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {savedPrefs.loyalty && savedPrefs.loyalty.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>Loyalty & Memberships</SectionLabel>
              <div className="space-y-2">
                {savedPrefs.loyalty.map((l, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="font-medium">{l.program}</span>
                    <span className="font-mono text-xs text-muted-foreground">{l.number}</span>
                    {l.tier && (
                      <Badge variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">
                        {l.tier}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {savedPrefs.generalNotes && (
          <Card>
            <CardContent className="p-5">
              <SectionLabel>General Notes</SectionLabel>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {savedPrefs.generalNotes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const LABEL_SUGGESTIONS = [
  "Flight Ticket",
  "Hotel Voucher",
  "Transfer Confirmation",
  "Travel Insurance",
  "Visa Letter",
  "Passport Copy",
  "Booking Confirmation",
  "Invoice",
  "Other",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType === "application/pdf") return <File className="w-5 h-5 text-red-500" />;
  return <Image className="w-5 h-5 text-blue-500" />;
}

type DocWithMeta = TripDocument & { uploaderName: string | null; tripTitle?: string | null };

function DocumentsTab({ clientId, trips: clientTrips }: { clientId: string; trips: Trip[] }) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [label, setLabel] = useState("");
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [isVisibleToClient, setIsVisibleToClient] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading } = useQuery<DocWithMeta[]>({
    queryKey: ["/api/clients", clientId, "documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ docId, visible }: { docId: string; visible: boolean }) => {
      const res = await apiRequest("PATCH", `/api/documents/${docId}`, { isVisibleToClient: visible });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
    },
  });

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
  const MAX_SIZE = 20 * 1024 * 1024;

  const validateFile = (file: globalThis.File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Only PDF, JPG, PNG, and WebP files are accepted.";
    if (file.size > MAX_SIZE) return "File size must be under 20MB.";
    return null;
  };

  const handleFileSelect = (file: globalThis.File) => {
    const error = validateFile(file);
    if (error) {
      toast({ title: "Invalid file", description: error, variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (!selectedTripId && clientTrips.length === 1) {
      setSelectedTripId(clientTrips[0].id);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !label.trim() || !selectedTripId) return;
    setUploading(true);
    try {
      const res = await apiRequest("POST", "/api/documents/request-upload", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        tripId: selectedTripId,
        clientId,
        label: label.trim(),
        isVisibleToClient,
      });
      const { uploadURL } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      // also invalidate trip documents if trip editor has them open
      queryClient.invalidateQueries({ queryKey: ["/api/trips", selectedTripId, "documents"] });
      toast({ title: "Document uploaded" });
      setSelectedFile(null);
      setLabel("");
      setSelectedTripId("");
      setIsVisibleToClient(true);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const filteredSuggestions = LABEL_SUGGESTIONS.filter(s =>
    s.toLowerCase().includes(label.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        data-testid="dropzone-documents"
      >
        {!selectedFile ? (
          <>
            <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop a file here, or
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-browse-files"
            >
              Browse files
            </Button>
            <p className="text-xs text-muted-foreground/50 mt-2">
              PDF, JPG, PNG, WebP up to 20MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
              data-testid="input-file-upload"
            />
          </>
        ) : (
          <div className="space-y-4 text-left max-w-md mx-auto">
            <div className="flex items-center gap-3">
              {getFileIcon(selectedFile.type)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" data-testid="text-selected-filename">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} data-testid="button-clear-file">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {clientTrips.length > 0 && (
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-1.5 block">
                  Attach to trip
                </label>
                <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                  <SelectTrigger data-testid="select-trip-for-doc">
                    <SelectValue placeholder="Select a trip" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientTrips.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.title} — {t.destination}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative">
              <label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-1.5 block">
                What is this document?
              </label>
              <Input
                value={label}
                onChange={(e) => { setLabel(e.target.value); setShowLabelSuggestions(true); }}
                onFocus={() => setShowLabelSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLabelSuggestions(false), 200)}
                placeholder="e.g. Flight Ticket, Hotel Voucher..."
                data-testid="input-document-label"
              />
              {showLabelSuggestions && label.length > 0 && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                  {filteredSuggestions.map(s => (
                    <button
                      key={s}
                      className="w-full text-left px-3 py-1.5 text-sm hover-elevate"
                      onMouseDown={(e) => { e.preventDefault(); setLabel(s); setShowLabelSuggestions(false); }}
                      data-testid={`suggestion-${s.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground" htmlFor="visible-toggle">
                Visible to client
              </label>
              <Switch
                id="visible-toggle"
                checked={isVisibleToClient}
                onCheckedChange={setIsVisibleToClient}
                data-testid="switch-visible-to-client"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !label.trim() || !selectedTripId}
              className="w-full"
              data-testid="button-upload-document"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-0" data-testid={`document-row-${doc.id}`}>
              <div className="flex items-center gap-3 p-3">
                <div className="shrink-0">{getFileIcon(doc.fileType)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium" data-testid={`text-doc-label-${doc.id}`}>{doc.label}</p>
                    {doc.tripTitle && (
                      <Badge variant="secondary" className="text-[10px]">{doc.tripTitle}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>{doc.fileName}</span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                    {doc.createdAt && <span>{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>}
                    {doc.uploaderName && <span>by {doc.uploaderName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleVisibilityMutation.mutate({ docId: doc.id, visible: !doc.isVisibleToClient })}
                    title={doc.isVisibleToClient ? "Visible to client" : "Hidden from client"}
                    data-testid={`button-toggle-visibility-${doc.id}`}
                  >
                    {doc.isVisibleToClient ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" data-testid={`button-download-${doc.id}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Delete this document?")) deleteMutation.mutate(doc.id);
                    }}
                    data-testid={`button-delete-doc-${doc.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
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

  const tabs: { id: TabId; label: string; icon: typeof User }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "preferences", label: "Preferences", icon: Heart },
    { id: "documents", label: "Documents", icon: FileText },
  ];

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
          <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
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
                ) : activeTab === "overview" ? (
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
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="mb-8"
        >
          <div className="flex items-center gap-1 border-b border-border/40">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground/60 hover:text-muted-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-10">
                <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-3" data-testid="text-tags-label">
                  Tags
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
                      placeholder={editTags.length >= 5 ? "Maximum tags reached" : "Add a tag and press Enter"}
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
                      <span className="text-sm text-muted-foreground/40 italic">No tags set</span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-12">
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
              </div>

              <div>
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
              </div>
            </motion.div>
          )}

          {activeTab === "preferences" && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <PreferencesTab
                client={client}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/clients", id] })}
              />
            </motion.div>
          )}

          {activeTab === "documents" && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <DocumentsTab clientId={id!} trips={clientTrips} />
            </motion.div>
          )}
        </AnimatePresence>
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

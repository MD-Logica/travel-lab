import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer, DrawerContent, DrawerTrigger, DrawerClose,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Plane, Ship, Hotel, Car, UtensilsCrossed, Activity,
  StickyNote, Clock, DollarSign, Hash, MoreVertical, Pencil, Trash2,
  Copy, Star, MapPin, Calendar, User, ChevronRight, Heart,
  Upload, Download, Eye, EyeOff, File, Image, Loader2, FileText, X,
  ChevronDown, ChevronUp, RefreshCw, Bookmark, Check, Diamond, Share2, MoreHorizontal, Archive,
  Link2, ExternalLink, RotateCcw, Users, CheckCircle, ListChecks,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { SegmentEditor, type TemplateData } from "@/components/segment-editor";
import { DestinationInput } from "@/components/destination-input";
import { CurrencyInput } from "@/components/currency-input";
import type { Trip, TripVersion, TripSegment, Client, TripDocument, FlightTracking, DestinationEntry } from "@shared/schema";
import { formatDestinationsShort } from "@shared/schema";
import { format, addDays, differenceInDays, eachDayOfInterval, differenceInCalendarDays } from "date-fns";
import { calculateLayover, isRedEye, journeyTotalTime } from "@/lib/journey-utils";

type TripWithClient = Trip & { clientName: string | null };
type TripFull = { trip: TripWithClient; versions: TripVersion[] };

interface FlightStatusInfo {
  status: string;
  departureDelay?: number;
  departureGate?: string;
  departureTerminal?: string;
  arrivalAirport?: string;
  departureAirport?: string;
}

const flightStatusConfig: Record<string, { label: string; dotClass: string }> = {
  scheduled: { label: "Scheduled", dotClass: "bg-muted-foreground" },
  on_time: { label: "On Time", dotClass: "bg-emerald-500" },
  delayed: { label: "Delayed", dotClass: "bg-amber-500" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-500" },
  departed: { label: "Departed", dotClass: "bg-emerald-500" },
  landed: { label: "Landed", dotClass: "bg-sky-500" },
  unknown: { label: "Unknown", dotClass: "bg-muted-foreground" },
};

function checkedTimeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "Checked just now";
  if (diffMin < 60) return `Checked ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `Checked ${diffHr}h ago`;
}

const segmentTypeConfig: Record<string, { label: string; icon: typeof Plane; color: string }> = {
  flight: { label: "Flight", icon: Plane, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  charter_flight: { label: "Charter", icon: Diamond, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  charter: { label: "Charter", icon: Diamond, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  hotel: { label: "Hotel", icon: Hotel, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  transport: { label: "Transport", icon: Car, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  activity: { label: "Activity", icon: Activity, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  note: { label: "Note", icon: StickyNote, color: "text-muted-foreground bg-muted/60" },
};

const bookingClassLabels: Record<string, string> = {
  first: "First",
  business: "Business",
  premium_economy: "Premium Economy",
  economy: "Economy",
};

const tripStatusOptions = [
  { value: "draft", label: "Draft", className: "bg-muted text-muted-foreground" },
  { value: "planning", label: "Planning", className: "bg-primary/10 text-primary" },
  { value: "confirmed", label: "Confirmed", className: "bg-chart-2/10 text-chart-2" },
  { value: "in_progress", label: "In Progress", className: "bg-chart-4/10 text-chart-4" },
  { value: "completed", label: "Completed", className: "bg-chart-2/10 text-chart-2" },
  { value: "cancelled", label: "Cancelled", className: "bg-destructive/10 text-destructive" },
];

function deriveSegmentTitle(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case "flight":
      return [metadata.airline, metadata.flightNumber].filter(Boolean).join(" ") ||
        [metadata.departureAirport, metadata.arrivalAirport].filter(Boolean).join(" to ") ||
        "Flight";
    case "charter":
    case "charter_flight":
      return metadata.operator || "Private Flight";
    case "hotel":
      return metadata.hotelName || "Hotel Stay";
    case "transport":
      return metadata.provider || (metadata.transportType ? metadata.transportType.charAt(0).toUpperCase() + metadata.transportType.slice(1) : "") || "Transfer";
    case "restaurant":
      return metadata.restaurantName || "Restaurant";
    case "activity":
      return metadata.activityName || metadata.provider || "Activity";
    default:
      return "";
  }
}

function deriveSegmentSubtitle(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case "flight":
      return metadata.departureAirport && metadata.arrivalAirport
        ? `${metadata.departureAirport} to ${metadata.arrivalAirport}`
        : "";
    case "charter":
    case "charter_flight":
      return [metadata.departureLocation, metadata.arrivalLocation].filter(Boolean).join(" to ");
    case "hotel":
      return [metadata.roomType, metadata.starRating ? "\u2605".repeat(metadata.starRating) : ""].filter(Boolean).join(" \u00b7 ");
    case "transport":
      return [metadata.transportType ? metadata.transportType.charAt(0).toUpperCase() + metadata.transportType.slice(1) : "", metadata.vehicleType].filter(Boolean).join(" \u00b7 ");
    case "restaurant":
      return [metadata.cuisine, metadata.partySize ? `${metadata.partySize} guests` : ""].filter(Boolean).join(" \u00b7 ");
    case "activity":
      return [metadata.category ? metadata.category.charAt(0).toUpperCase() + metadata.category.slice(1) : "", metadata.duration].filter(Boolean).join(" \u00b7 ");
    case "note":
      return metadata.noteType ? metadata.noteType.charAt(0).toUpperCase() + metadata.noteType.slice(1) : "";
    default:
      return "";
  }
}


function SegmentCard({
  segment,
  tripId,
  onEdit,
  tracking,
  showPricing = false,
  positionInDay,
  daySegments,
  allSegments,
  currentVersionId,
}: {
  segment: TripSegment;
  tripId: string;
  onEdit: (s: TripSegment) => void;
  tracking?: FlightTracking | null;
  showPricing?: boolean;
  positionInDay?: number;
  daySegments?: TripSegment[];
  allSegments?: TripSegment[];
  currentVersionId?: string;
}) {
  const { toast } = useToast();
  const [editingPosition, setEditingPosition] = useState(false);
  const [positionValue, setPositionValue] = useState(String(positionInDay || 1));
  const posInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPosition && posInputRef.current) {
      posInputRef.current.select();
    }
  }, [editingPosition]);

  const reorderMutation = useMutation({
    mutationFn: async (segmentIds: string[]) => {
      await apiRequest("POST", `/api/trips/${tripId}/versions/${currentVersionId}/segments/reorder`, { segmentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "segments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
    },
    onError: (e: Error) => {
      toast({ title: "Reorder failed", description: e.message, variant: "destructive" });
    },
  });

  const commitPosition = () => {
    setEditingPosition(false);
    if (!daySegments || !allSegments || !currentVersionId || positionInDay == null) return;
    const newPos = Math.max(1, Math.min(daySegments.length, parseInt(positionValue) || positionInDay));
    if (newPos === positionInDay) return;

    const dayOrder = [...daySegments];
    const oldIdx = positionInDay - 1;
    const [moved] = dayOrder.splice(oldIdx, 1);
    dayOrder.splice(newPos - 1, 0, moved);
    const updatedDayIds = new Set(dayOrder.map(s => s.id));

    const rebuilt: string[] = [];
    let inserted = false;
    for (const seg of allSegments) {
      if (updatedDayIds.has(seg.id)) {
        if (!inserted) {
          dayOrder.forEach(s => rebuilt.push(s.id));
          inserted = true;
        }
      } else {
        rebuilt.push(seg.id);
      }
    }
    reorderMutation.mutate(rebuilt);
  };
  const cfg = segmentTypeConfig[segment.type] || segmentTypeConfig.activity;
  const Icon = cfg.icon;

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/flight-tracking/${segment.id}/refresh`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "flight-tracking"] });
      toast({ title: "Flight status updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not refresh", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/trips/${tripId}/segments/${segment.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      toast({ title: "Segment removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const meta = (segment.metadata || {}) as Record<string, any>;
  const confNum = meta.confirmationNumber || segment.confirmationNumber;
  const isCommercialFlight = segment.type === "flight";
  const isCharterFlight = segment.type === "charter_flight" || segment.type === "charter";

  const noteTypeLabels: Record<string, string> = { info: "Info", tip: "Tip", important: "Important", warning: "Warning" };
  const formatShortDate = (d: string | null | undefined) => {
    if (!d) return "";
    try { return format(new Date(d), "d MMM"); } catch { return d; }
  };
  const photos: string[] = (() => {
    const refs = meta.photos || meta.photoRefs || [];
    if (!Array.isArray(refs)) return [];
    const limit = segment.type === "hotel" ? 3 : 2;
    return refs.slice(0, limit).map((r: string) => {
      if (r.startsWith("/api/") || r.startsWith("http")) return r;
      return `/api/places/photo?ref=${encodeURIComponent(r)}`;
    });
  })();
  const [photosExpanded, setPhotosExpanded] = useState(false);

  let primaryText = "";
  let secondaryText = "";
  const extraLines: string[] = [];
  const badges: { label: string; variant?: "secondary" | "outline" }[] = [];

  if (isCommercialFlight) {
    primaryText = meta.flightNumber || segment.title || "Flight";
    const depIata = meta.departure?.iata || meta.departureAirport || "";
    const arrIata = meta.arrival?.iata || meta.arrivalAirport || "";
    if (depIata && arrIata) secondaryText = `${depIata} \u2192 ${arrIata}`;
    const depCity = meta.departure?.city || meta.departureAirportName || "";
    const arrCity = meta.arrival?.city || meta.arrivalAirportName || "";
    if (depCity && arrCity) extraLines.push(`${depCity} \u2192 ${arrCity}`);
    if (meta.departure?.scheduledTime) extraLines.push(`Departs: ${meta.departure.scheduledTime}`);
    else if (meta.departureTime) extraLines.push(`Departs: ${meta.departureTime}`);
    if (meta.status && meta.status !== "Scheduled") badges.push({ label: meta.status, variant: "outline" });
    if (meta.bookingClass) badges.push({ label: bookingClassLabels[meta.bookingClass] || meta.bookingClass, variant: "secondary" });
  } else if (isCharterFlight) {
    primaryText = meta.operator || "Private Charter";
    const depLoc = meta.departureLocation || "";
    const arrLoc = meta.arrivalLocation || "";
    if (depLoc && arrLoc) secondaryText = `${depLoc} \u2192 ${arrLoc}`;
    badges.push({ label: "Charter", variant: "secondary" });
  } else if (segment.type === "hotel") {
    primaryText = meta.hotelName || segment.title || "Hotel";
    const ci = formatShortDate(meta.checkIn);
    const co = formatShortDate(meta.checkOut);
    if (ci && co) secondaryText = `${ci} \u2192 ${co}`;
    if (meta.roomType) extraLines.push(`Room: ${meta.roomType}`);
    if (meta.address) extraLines.push(meta.address);
    if (meta.starRating && Number(meta.starRating) > 0) {
      extraLines.push(`${meta.starRating}-star`);
    }
  } else if (segment.type === "restaurant") {
    primaryText = meta.restaurantName || segment.title || "Restaurant";
    const timePart = segment.startTime || "";
    const partyPart = meta.partySize ? `${meta.partySize} guests` : "";
    secondaryText = [timePart, partyPart].filter(Boolean).join(" \u00b7 ");
    if (meta.address) extraLines.push(meta.address);
    if (meta.cuisine) badges.push({ label: meta.cuisine, variant: "outline" });
  } else if (segment.type === "activity") {
    primaryText = meta.activityName || segment.title || "Activity";
    const timePart = segment.startTime || "";
    const locPart = meta.location || "";
    secondaryText = [timePart, locPart].filter(Boolean).join(" \u00b7 ");
    if (meta.duration) extraLines.push(`Duration: ${meta.duration}`);
  } else if (segment.type === "transport") {
    primaryText = meta.provider || meta.transportType || segment.title || "Transport";
    const pickup = meta.pickupLocation || "";
    const dropoff = meta.dropoffLocation || "";
    if (pickup && dropoff) secondaryText = `${pickup} \u2192 ${dropoff}`;
    if (meta.driverName) extraLines.push(`Driver: ${meta.driverName}`);
  } else if (segment.type === "note") {
    primaryText = meta.noteTitle || segment.title || "Note";
    const noteLabel = noteTypeLabels[meta.noteType || ""] || "";
    if (noteLabel) badges.push({ label: noteLabel, variant: "outline" });
    if (meta.content) extraLines.push(meta.content.slice(0, 100));
  } else {
    primaryText = deriveSegmentTitle(segment.type, meta) || segment.title || cfg.label;
    secondaryText = deriveSegmentSubtitle(segment.type, meta) || segment.subtitle || "";
  }

  const depTime = isCommercialFlight
    ? (meta.departure?.scheduledTime || meta.departureTime)
    : isCharterFlight ? meta.departureTime : null;
  const arrTime = isCommercialFlight
    ? (meta.arrival?.scheduledTime || meta.arrivalTime)
    : isCharterFlight ? meta.arrivalTime : null;
  const timeDisplay = depTime && arrTime ? `${depTime} \u2192 ${arrTime}` : depTime || arrTime || null;

  return (
    <Card className="group relative hover-elevate" data-testid={`card-segment-${segment.id}`}>
      <CardContent className="p-3 flex items-start gap-3">
        {positionInDay != null && (
          editingPosition ? (
            <input
              ref={posInputRef}
              type="number"
              min={1}
              value={positionValue}
              onChange={(e) => setPositionValue(e.target.value)}
              onBlur={commitPosition}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitPosition(); }
                if (e.key === "Escape") { setEditingPosition(false); setPositionValue(String(positionInDay)); }
              }}
              className="w-6 h-6 rounded-full border border-border bg-muted/50 text-[10px] text-center font-medium text-muted-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary self-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              data-testid={`input-position-${segment.id}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setPositionValue(String(positionInDay)); setEditingPosition(true); }}
              className="w-6 h-6 rounded-full bg-muted/50 text-[10px] font-medium text-muted-foreground shrink-0 flex items-center justify-center hover:bg-muted transition-colors self-center"
              title="Click to reorder"
              data-testid={`badge-position-${segment.id}`}
            >
              {positionInDay}
            </button>
          )
        )}
        <div className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${cfg.color}`}>
          <Icon className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium truncate ${isCommercialFlight && meta.flightNumber ? "text-base" : "text-sm"}`} data-testid={`text-segment-title-${segment.id}`}>{primaryText}</p>
                {badges.map((b, i) => (
                  <Badge key={i} variant={b.variant || "secondary"} className="text-[10px] shrink-0">{b.label}</Badge>
                ))}
                {(() => {
                  const refund = meta.refundability || segment.refundability;
                  const deadline = meta.refundDeadline || (segment.refundDeadline ? format(new Date(segment.refundDeadline), "MMM d") : null);
                  if (!refund || refund === "unknown") return null;
                  if (refund === "non_refundable") return (
                    <Badge variant="outline" className="text-[10px] shrink-0 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400" data-testid={`badge-refund-${segment.id}`}>
                      Non-refundable
                    </Badge>
                  );
                  if (refund === "partially_refundable") return (
                    <Badge variant="outline" className="text-[10px] shrink-0 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400" data-testid={`badge-refund-${segment.id}`}>
                      Partial refund{deadline ? ` until ${deadline}` : ""}
                    </Badge>
                  );
                  if (refund === "fully_refundable") return (
                    <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400" data-testid={`badge-refund-${segment.id}`}>
                      Refundable{deadline ? ` until ${deadline}` : ""}
                    </Badge>
                  );
                  return null;
                })()}
                {segment.hasVariants && (
                  <Badge variant="secondary" className="text-[10px] shrink-0" data-testid={`badge-variants-${segment.id}`}>
                    Options available
                  </Badge>
                )}
              </div>
              {secondaryText && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{secondaryText}</p>
              )}
              {extraLines.map((line, i) => (
                <p key={i} className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{line}</p>
              ))}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ visibility: "visible" }}>
              <Button size="icon" variant="ghost" onClick={() => onEdit(segment)} data-testid={`button-edit-segment-${segment.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => { if (confirm("Remove this segment?")) deleteMutation.mutate(); }}
                data-testid={`button-delete-segment-${segment.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            {(isCommercialFlight || isCharterFlight) && timeDisplay ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {timeDisplay}
              </span>
            ) : (segment.startTime || segment.endTime) ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {segment.startTime}{segment.endTime ? ` - ${segment.endTime}` : ""}
              </span>
            ) : null}
            {confNum && (
              <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                <Hash className="w-3 h-3" strokeWidth={1.5} />
                {confNum}
              </span>
            )}
            {showPricing && segment.cost != null && segment.cost > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="w-3 h-3" strokeWidth={1.5} />
                {segment.currency || "USD"} {segment.cost.toLocaleString()}
              </span>
            )}
          </div>
          {photos.length > 0 && (
            <div className="mt-2 border-t border-border/30 pt-2">
              <button
                type="button"
                onClick={() => setPhotosExpanded(p => !p)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                data-testid={`button-toggle-photos-${segment.id}`}
              >
                <Image className="w-3 h-3" />
                <span>{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
                <ChevronDown className={`w-3 h-3 ml-auto transition-transform duration-200 ${photosExpanded ? "rotate-180" : ""}`} />
              </button>
              {photosExpanded && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-20 h-20 rounded-md object-cover"
                      loading="lazy"
                      data-testid={`img-segment-photo-${segment.id}-${i}`}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {segment.type !== "note" && segment.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{segment.notes}</p>
          )}
          {segment.type === "flight" && tracking && (
            <div className="flex items-center gap-2 mt-2 flex-wrap" data-testid={`flight-status-${segment.id}`}>
              {(() => {
                const ls = tracking.lastStatus as FlightStatusInfo | null;
                const statusKey = ls?.status || "scheduled";
                const statusCfg = flightStatusConfig[statusKey] || flightStatusConfig.unknown;
                return (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                      <span className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`} />
                      {statusCfg.label}
                      {statusKey === "delayed" && ls?.departureDelay ? ` (${ls.departureDelay}min)` : ""}
                    </span>
                    {ls?.departureGate && (
                      <span className="text-[10px] text-muted-foreground">Gate {ls.departureGate}</span>
                    )}
                    {tracking.lastCheckedAt && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {checkedTimeAgo(tracking.lastCheckedAt)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); refreshMutation.mutate(); }}
                      disabled={refreshMutation.isPending}
                      data-testid={`button-refresh-flight-${segment.id}`}
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type DayRenderItem =
  | { kind: "segment"; segment: TripSegment }
  | { kind: "journey"; journeyId: string; legs: TripSegment[] }
  | { kind: "propertyGroup"; propertyGroupId: string; rooms: TripSegment[] };

function buildDayRenderItems(daySegments: TripSegment[]): DayRenderItem[] {
  const items: DayRenderItem[] = [];
  const seenJourneyIds = new Set<string>();
  const journeyGroups = new Map<string, TripSegment[]>();
  const seenPropertyGroupIds = new Set<string>();
  const propertyGroups = new Map<string, TripSegment[]>();

  for (const seg of daySegments) {
    if (seg.journeyId) {
      if (!journeyGroups.has(seg.journeyId)) {
        journeyGroups.set(seg.journeyId, []);
      }
      journeyGroups.get(seg.journeyId)!.push(seg);
    }
    if (seg.propertyGroupId && seg.type === "hotel") {
      if (!propertyGroups.has(seg.propertyGroupId)) {
        propertyGroups.set(seg.propertyGroupId, []);
      }
      propertyGroups.get(seg.propertyGroupId)!.push(seg);
    }
  }

  for (const seg of daySegments) {
    if (seg.journeyId && journeyGroups.get(seg.journeyId)!.length > 1) {
      if (!seenJourneyIds.has(seg.journeyId)) {
        seenJourneyIds.add(seg.journeyId);
        const legs = journeyGroups.get(seg.journeyId)!;
        legs.sort((a, b) => {
          const aLeg = (a.metadata as any)?.legNumber || 0;
          const bLeg = (b.metadata as any)?.legNumber || 0;
          return aLeg - bLeg;
        });
        items.push({ kind: "journey", journeyId: seg.journeyId, legs });
      }
    } else if (seg.propertyGroupId && seg.type === "hotel" && propertyGroups.get(seg.propertyGroupId)!.length > 1) {
      if (!seenPropertyGroupIds.has(seg.propertyGroupId)) {
        seenPropertyGroupIds.add(seg.propertyGroupId);
        const rooms = propertyGroups.get(seg.propertyGroupId)!;
        items.push({ kind: "propertyGroup", propertyGroupId: seg.propertyGroupId, rooms });
      }
    } else {
      items.push({ kind: "segment", segment: seg });
    }
  }
  return items;
}

function JourneyCard({
  legs,
  tripId,
  onEdit,
  trackingBySegment,
  showPricing,
}: {
  legs: TripSegment[];
  tripId: string;
  onEdit: (s: TripSegment) => void;
  trackingBySegment: Map<string, FlightTracking>;
  showPricing?: boolean;
}) {
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const firstMeta = (firstLeg.metadata || {}) as Record<string, any>;
  const lastMeta = (lastLeg.metadata || {}) as Record<string, any>;

  const originIata = firstMeta.departure?.iata || firstMeta.departureAirport || "";
  const destIata = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
  const originCity = firstMeta.departure?.city || firstMeta.departureAirportName || "";
  const destCity = lastMeta.arrival?.city || lastMeta.arrivalAirportName || "";
  const stopsCount = legs.length - 1;
  const totalTime = journeyTotalTime(firstMeta, lastMeta);

  const stopIatas = legs.slice(0, -1).map(leg => {
    const m = (leg.metadata || {}) as Record<string, any>;
    return m.arrival?.iata || m.arrivalAirport || "?";
  });

  const firstDepTime = firstMeta.departure?.scheduledTime || firstMeta.departureTime || "";
  const lastArrTime = lastMeta.arrival?.scheduledTime || lastMeta.arrivalTime || "";

  const layovers: (ReturnType<typeof calculateLayover>)[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    const legAMeta = (legs[i].metadata || {}) as Record<string, any>;
    const legBMeta = (legs[i + 1].metadata || {}) as Record<string, any>;
    layovers.push(calculateLayover(legAMeta, legBMeta));
  }

  const hasRedEye = firstMeta.departureTimeLocal
    ? isRedEye(firstMeta.departureTimeLocal)
    : firstMeta.departureTime ? isRedEye(firstMeta.departureTime) : false;

  return (
    <Card className="group relative hover-elevate border-sky-200/40 dark:border-sky-800/40" data-testid={`card-journey-${firstLeg.journeyId}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-md shrink-0 text-sky-600 bg-sky-50 dark:bg-sky-950/40">
            <Plane className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-base tracking-tight" data-testid="text-journey-route">
                {originIata} <span className="text-muted-foreground mx-1">&rarr;</span> {destIata}
              </p>
              <Badge variant="outline" className="text-[10px]">
                {stopsCount} stop{stopsCount > 1 ? "s" : ""}
              </Badge>
              {hasRedEye && (
                <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400">
                  Red-eye
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {originCity && destCity && <span>{originCity} to {destCity}</span>}
              {totalTime && (
                <>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                    {totalTime} total
                  </span>
                </>
              )}
              {firstDepTime && lastArrTime && (
                <>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span>{firstDepTime} &rarr; {lastArrTime}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/60">
              <span>{originIata}</span>
              {stopIatas.map((iata, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium text-foreground/70">{iata}</span>
                </span>
              ))}
              <ChevronRight className="w-3 h-3" />
              <span>{destIata}</span>
            </div>
          </div>
        </div>

        <div className="space-y-0 pl-4 border-l-2 border-sky-200/60 dark:border-sky-800/40 ml-4">
          {legs.map((leg, i) => {
            const meta = (leg.metadata || {}) as Record<string, any>;
            const depIata = meta.departure?.iata || meta.departureAirport || "";
            const arrIata = meta.arrival?.iata || meta.arrivalAirport || "";
            const depTime = meta.departure?.scheduledTime || meta.departureTime || "";
            const arrTime = meta.arrival?.scheduledTime || meta.arrivalTime || "";
            const flightNum = meta.flightNumber || leg.title || "Flight";
            const airline = meta.airline || "";
            const tracking = trackingBySegment.get(leg.id);

            return (
              <div key={leg.id}>
                {i > 0 && layovers[i - 1] && (
                  <div className="py-1.5 flex items-center gap-2 text-[11px]" data-testid={`layover-${i}`}>
                    <div className={`w-2 h-2 rounded-full ${
                      layovers[i - 1]!.flag === "tight" ? "bg-amber-500" :
                      layovers[i - 1]!.flag === "long" ? "bg-muted-foreground/40" :
                      "bg-emerald-500"
                    }`} />
                    <span className={`font-medium ${
                      layovers[i - 1]!.flag === "tight" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    }`}>
                      {layovers[i - 1]!.display} layover
                    </span>
                    {layovers[i - 1]!.flag === "tight" && (
                      <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                        Tight connection
                      </Badge>
                    )}
                    {layovers[i - 1]!.airportChange && (
                      <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                        Airport change
                      </Badge>
                    )}
                  </div>
                )}
                {i > 0 && !layovers[i - 1] && (
                  <div className="py-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/50">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                    <span>Connection</span>
                  </div>
                )}
                <div
                  className="py-2 flex items-center gap-3 group/leg cursor-pointer hover:bg-accent/30 rounded-md px-2 -mx-2 transition-colors"
                  onClick={() => onEdit(leg)}
                  data-testid={`journey-leg-${leg.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flightNum}</span>
                      {airline && <span className="text-xs text-muted-foreground">{airline}</span>}
                      {meta.bookingClass && (
                        <Badge variant="secondary" className="text-[9px]">
                          {bookingClassLabels[meta.bookingClass] || meta.bookingClass}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {depIata && arrIata && <span>{depIata} &rarr; {arrIata}</span>}
                      {depTime && arrTime && (
                        <>
                          <span className="text-muted-foreground/40">&middot;</span>
                          <span>{depTime} &rarr; {arrTime}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover/leg:opacity-100 transition-opacity">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
                {tracking && (
                  <div className="flex items-center gap-2 ml-2 mb-1 flex-wrap" data-testid={`flight-status-journey-${leg.id}`}>
                    {(() => {
                      const ls = tracking.lastStatus as FlightStatusInfo | null;
                      const statusKey = ls?.status || "scheduled";
                      const statusCfg = flightStatusConfig[statusKey] || flightStatusConfig.unknown;
                      return (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                          <span className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`} />
                          {statusCfg.label}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showPricing && (() => {
          const totalCost = legs.reduce((sum, leg) => sum + (leg.cost || 0), 0);
          return totalCost > 0 ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border/30">
              <DollarSign className="w-3 h-3" strokeWidth={1.5} />
              {legs[0].currency || "USD"} {totalCost.toLocaleString()}
            </div>
          ) : null;
        })()}
      </CardContent>
    </Card>
  );
}

function PropertyGroupCard({
  rooms,
  tripId,
  onEdit,
  showPricing,
}: {
  rooms: TripSegment[];
  tripId: string;
  onEdit: (s: TripSegment) => void;
  showPricing?: boolean;
}) {
  const firstRoom = rooms[0];
  const firstMeta = (firstRoom.metadata || {}) as Record<string, any>;
  const hotelName = firstMeta.hotelName || firstRoom.title || "Hotel";

  const checkIn = firstMeta.checkIn;
  const lastMeta = (rooms[rooms.length - 1].metadata || {}) as Record<string, any>;
  const checkOut = lastMeta.checkOut || firstMeta.checkOut;

  let nightsDisplay = "";
  if (checkIn && checkOut) {
    try {
      const ci = new Date(checkIn);
      const co = new Date(checkOut);
      const nights = differenceInCalendarDays(co, ci);
      if (nights > 0) nightsDisplay = `${nights} night${nights > 1 ? "s" : ""}`;
    } catch {}
  }

  const formatShortDate = (d: string | null | undefined) => {
    if (!d) return "";
    try { return format(new Date(d), "d MMM"); } catch { return d; }
  };

  const refundLabel = (seg: TripSegment) => {
    const r = seg.refundability || (seg.metadata as any)?.refundability;
    if (!r || r === "unknown") return null;
    if (r === "non_refundable") return { text: "Non-refundable", cls: "text-red-600 dark:text-red-400" };
    if (r === "partially_refundable") return { text: "Partial refund", cls: "text-amber-600 dark:text-amber-400" };
    if (r === "fully_refundable") return { text: "Refundable", cls: "text-emerald-600 dark:text-emerald-400" };
    return null;
  };

  const totalCost = rooms.reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <Card className="group relative hover-elevate border-amber-200/40 dark:border-amber-800/40" data-testid={`card-property-group-${rooms[0].propertyGroupId}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-md shrink-0 text-amber-600 bg-amber-50 dark:bg-amber-950/40">
            <Hotel className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-base tracking-tight" data-testid="text-property-group-name">{hotelName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {checkIn && checkOut && (
                <span>{formatShortDate(checkIn)} &rarr; {formatShortDate(checkOut)}</span>
              )}
              {nightsDisplay && (
                <>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span>{nightsDisplay}</span>
                </>
              )}
              <Badge variant="outline" className="text-[10px]">
                {rooms.length} room{rooms.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-0 pl-4 border-l-2 border-amber-200/60 dark:border-amber-800/40 ml-4">
          {rooms.map((room) => {
            const meta = (room.metadata || {}) as Record<string, any>;
            const roomType = meta.roomType || room.title || "Room";
            const qty = room.quantity || 1;
            const refund = refundLabel(room);

            return (
              <div
                key={room.id}
                className="py-2 flex items-center gap-3 group/room cursor-pointer hover:bg-accent/30 rounded-md px-2 -mx-2 transition-colors"
                onClick={() => onEdit(room)}
                data-testid={`property-room-${room.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{roomType}</span>
                    {qty > 1 && (
                      <Badge variant="secondary" className="text-[9px]">x{qty}</Badge>
                    )}
                    {refund && (
                      <span className={`text-[10px] font-medium ${refund.cls}`}>{refund.text}</span>
                    )}
                  </div>
                  {showPricing && room.cost != null && room.cost > 0 && (
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      {room.currency || "USD"} {room.cost.toLocaleString()}
                      {room.pricePerUnit ? ` (${room.currency || "USD"} ${room.pricePerUnit.toLocaleString()}/night)` : ""}
                    </span>
                  )}
                </div>
                <div className="opacity-0 group-hover/room:opacity-100 transition-opacity">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>

        {showPricing && totalCost > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border/30">
            <DollarSign className="w-3 h-3" strokeWidth={1.5} />
            {rooms[0].currency || "USD"} {totalCost.toLocaleString()} total
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DOC_LABEL_SUGGESTIONS = [
  "Flight Ticket", "Hotel Voucher", "Transfer Confirmation", "Travel Insurance",
  "Visa Letter", "Passport Copy", "Booking Confirmation", "Invoice", "Other",
];

function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocFileIcon(fileType: string) {
  if (fileType === "application/pdf") return <File className="w-4 h-4 text-red-500" />;
  return <Image className="w-4 h-4 text-blue-500" />;
}

type TripDocWithMeta = TripDocument & { uploaderName: string | null };

function TripDocumentsSection({ tripId, clientId }: { tripId: string; clientId?: string | null }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [label, setLabel] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isVisibleToClient, setIsVisibleToClient] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: documents = [], isLoading } = useQuery<TripDocWithMeta[]>({
    queryKey: ["/api/trips", tripId, "documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ docId, visible }: { docId: string; visible: boolean }) => {
      const res = await apiRequest("PATCH", `/api/documents/${docId}`, { isVisibleToClient: visible });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "documents"] });
    },
  });

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];

  const handleFileSelect = (file: globalThis.File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: "Invalid file", description: "Only PDF, JPG, PNG, and WebP files are accepted.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 20MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !label.trim()) return;
    setUploading(true);
    try {
      const res = await apiRequest("POST", "/api/documents/request-upload", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        tripId,
        clientId: clientId || null,
        label: label.trim(),
        isVisibleToClient,
      });
      const { uploadURL } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "documents"] });
      if (clientId) queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      toast({ title: "Document uploaded" });
      setSelectedFile(null);
      setLabel("");
      setIsVisibleToClient(true);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const filteredSuggestions = DOC_LABEL_SUGGESTIONS.filter(s => s.toLowerCase().includes(label.toLowerCase()));

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left mb-3"
        data-testid="button-toggle-trip-documents"
      >
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Documents</span>
        <Badge variant="secondary" className="text-[10px] ml-1">{documents.length}</Badge>
        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="space-y-4 pl-6">
          <div
            className={`border border-dashed rounded-md p-4 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            data-testid="dropzone-trip-documents"
          >
            {!selectedFile ? (
              <>
                <Upload className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground mb-1">Drop a file or</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf,.jpg,.jpeg,.png,.webp";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleFileSelect(f);
                    };
                    input.click();
                  }}
                  data-testid="button-browse-trip-files"
                >
                  Browse
                </Button>
              </>
            ) : (
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-2">
                  {getDocFileIcon(selectedFile.type)}
                  <span className="text-xs truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDocSize(selectedFile.size)}</span>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} data-testid="button-clear-trip-file">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    value={label}
                    onChange={(e) => { setLabel(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Label (e.g. Flight Ticket)"
                    className="text-xs h-8"
                    data-testid="input-trip-doc-label"
                  />
                  {showSuggestions && label.length > 0 && filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-32 overflow-y-auto">
                      {filteredSuggestions.map(s => (
                        <button key={s} className="w-full text-left px-2 py-1 text-xs hover-elevate" onMouseDown={(e) => { e.preventDefault(); setLabel(s); setShowSuggestions(false); }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Visible to client</span>
                  <Switch checked={isVisibleToClient} onCheckedChange={setIsVisibleToClient} data-testid="switch-trip-doc-visibility" />
                </div>
                <Button size="sm" onClick={handleUpload} disabled={uploading || !label.trim()} className="w-full" data-testid="button-upload-trip-doc">
                  {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</> : <><Upload className="w-3.5 h-3.5" /> Upload</>}
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-10 rounded-md" />
          ) : documents.length > 0 && (
            <div className="space-y-1.5">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30" data-testid={`trip-doc-row-${doc.id}`}>
                  {getDocFileIcon(doc.fileType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{doc.label}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.fileName} · {formatDocSize(doc.fileSize)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleVisibility.mutate({ docId: doc.id, visible: !doc.isVisibleToClient })} data-testid={`trip-doc-visibility-${doc.id}`}>
                    {doc.isVisibleToClient ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                  <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" data-testid={`trip-doc-download-${doc.id}`}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }} data-testid={`trip-doc-delete-${doc.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ClientPrefs {
  travelStyle?: { tier?: string; pace?: string; notes?: string };
  flights?: { cabin?: string; seatPreference?: string; preferredAirlines?: string[]; notes?: string };
  hotels?: { tier?: string; preferredBrands?: string[]; roomPreferences?: string; notes?: string };
  dining?: { dietary?: string[]; cuisinePreferences?: string[]; diningStyle?: string; notes?: string };
  interests?: { selected?: string[]; notes?: string };
  generalNotes?: string;
}

function ClientPreferencesPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  const prefs = (client?.preferences as ClientPrefs | null) || null;
  if (!prefs) return null;

  const formatVal = (v?: string) => {
    if (!v) return null;
    return v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const hasContent = !!(
    prefs.travelStyle?.tier || prefs.travelStyle?.pace ||
    prefs.flights?.cabin ||
    prefs.hotels?.tier || (prefs.hotels?.preferredBrands && prefs.hotels.preferredBrands.length > 0) ||
    (prefs.dining?.dietary && prefs.dining.dietary.length > 0) ||
    prefs.dining?.diningStyle ||
    (prefs.interests?.selected && prefs.interests.selected.length > 0) ||
    prefs.generalNotes
  );

  if (!hasContent) return null;

  return (
    <div className="border-l border-border/40 bg-muted/20" data-testid="panel-client-preferences">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-sm font-medium hover:bg-muted/40 transition-colors"
        data-testid="button-toggle-preferences-panel"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={1.5} />
        <Heart className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="truncate">Client Preferences</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <p className="text-[11px] text-muted-foreground/50 font-medium">{clientName}</p>

          {prefs.travelStyle?.tier && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Travel Style</p>
              <p className="text-xs">{formatVal(prefs.travelStyle.tier)}{prefs.travelStyle.pace ? ` · ${formatVal(prefs.travelStyle.pace)}` : ""}</p>
              {prefs.travelStyle.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.travelStyle.notes}</p>}
            </div>
          )}

          {prefs.flights?.cabin && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Flights</p>
              <p className="text-xs">{formatVal(prefs.flights.cabin)}{prefs.flights.seatPreference ? ` · ${formatVal(prefs.flights.seatPreference)}` : ""}</p>
              {prefs.flights.preferredAirlines && prefs.flights.preferredAirlines.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {prefs.flights.preferredAirlines.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{a}</Badge>
                  ))}
                </div>
              )}
              {prefs.flights.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.flights.notes}</p>}
            </div>
          )}

          {prefs.hotels?.tier && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Hotels</p>
              <p className="text-xs">{formatVal(prefs.hotels.tier)}</p>
              {prefs.hotels.preferredBrands && prefs.hotels.preferredBrands.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {prefs.hotels.preferredBrands.map((b) => (
                    <Badge key={b} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{b}</Badge>
                  ))}
                </div>
              )}
              {prefs.hotels.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.hotels.notes}</p>}
            </div>
          )}

          {prefs.dining?.dietary && prefs.dining.dietary.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Dietary</p>
              <div className="flex flex-wrap gap-1">
                {prefs.dining.dietary.map((d) => (
                  <Badge key={d} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{d}</Badge>
                ))}
              </div>
              {prefs.dining.diningStyle && <p className="text-xs mt-1">{formatVal(prefs.dining.diningStyle)}</p>}
              {prefs.dining.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.dining.notes}</p>}
            </div>
          )}

          {prefs.interests?.selected && prefs.interests.selected.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Interests</p>
              <div className="flex flex-wrap gap-1">
                {prefs.interests.selected.map((i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{i}</Badge>
                ))}
              </div>
              {prefs.interests.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.interests.notes}</p>}
            </div>
          )}

          {prefs.generalNotes && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">General Notes</p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{prefs.generalNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditTripSheet({ trip, open, onOpenChange }: {
  trip: TripWithClient;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(trip.title);
  const [description, setDescription] = useState(trip.description || "");
  const [destinations, setDestinations] = useState<DestinationEntry[]>(
    (trip as any).destinations || []
  );
  const [clientId, setClientId] = useState(trip.clientId || "");
  const [startDate, setStartDate] = useState(
    trip.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    trip.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : ""
  );
  const [budget, setBudget] = useState(trip.budget != null ? String(trip.budget) : "");
  const [currency, setCurrency] = useState(trip.currency || "USD");
  const [coverImageUrl, setCoverImageUrl] = useState(trip.coverImageUrl || "");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [companionIds, setCompanionIds] = useState<string[]>((trip.additionalClientIds as string[]) || []);
  const [companionPopover, setCompanionPopover] = useState(false);
  const [companionSearch, setCompanionSearch] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(trip.title);
      setDescription(trip.description || "");
      setDestinations((trip as any).destinations || []);
      setClientId(trip.clientId || "");
      setStartDate(trip.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : "");
      setEndDate(trip.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : "");
      setBudget(trip.budget != null ? String(trip.budget) : "");
      setCurrency(trip.currency || "USD");
      setCoverImageUrl(trip.coverImageUrl || "");
      setClientSearch("");
      setCompanionIds((trip.additionalClientIds as string[]) || []);
      setCompanionSearch("");
    }
  }, [open, trip]);

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  const selectedClient = useMemo(() => {
    if (!clientId || !clients) return null;
    return clients.find((c) => c.id === clientId) || null;
  }, [clientId, clients]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c) =>
      c.fullName.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const destinationStr = destinations.map(d => d.name).join(", ") || trip.destination || "";
      const payload: any = {
        title,
        destination: destinationStr,
        destinations,
        description: description || null,
        clientId: clientId || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        budget: budget ? parseInt(budget) : null,
        currency,
        coverImageUrl: coverImageUrl || null,
        additionalClientIds: companionIds,
      };
      const res = await apiRequest("PATCH", `/api/trips/${trip.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Trip updated", description: "Details saved successfully." });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Edit Trip Details</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 pt-6">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Trip Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Amalfi Coast Honeymoon"
              data-testid="input-edit-trip-title"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" strokeWidth={1.5} />
              Destinations
            </Label>
            <DestinationInput
              value={destinations}
              onChange={setDestinations}
              placeholder="Search cities or type freely..."
              testId="input-edit-trip-destination"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this trip..."
              className="resize-none"
              rows={3}
              data-testid="input-edit-trip-description"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <User className="w-3 h-3" strokeWidth={1.5} />
              Client
            </Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                  data-testid="button-edit-select-client"
                >
                  {selectedClient ? (
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                      {selectedClient.fullName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select a client (optional)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 border-b border-border/50">
                  <div className="relative">
                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                    <Input
                      placeholder="Search clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-8 border-0 focus-visible:ring-0 shadow-none"
                      data-testid="input-edit-search-client"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {clientId && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientId("");
                        setClientPopoverOpen(false);
                        setClientSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-muted-foreground rounded-md hover:bg-muted transition-colors"
                      data-testid="button-edit-clear-client"
                    >
                      Clear selection
                    </button>
                  )}
                  {clientsLoading ? (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientId(client.id);
                          setClientPopoverOpen(false);
                          setClientSearch("");
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between gap-2"
                        data-testid={`button-edit-client-option-${client.id}`}
                      >
                        <div>
                          <p className="text-sm font-medium">{client.fullName}</p>
                          {client.email && (
                            <p className="text-xs text-muted-foreground">{client.email}</p>
                          )}
                        </div>
                        {clientId === client.id && (
                          <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={2} />
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground text-center">No clients found</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" strokeWidth={1.5} />
              Dates
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Start</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-edit-trip-start-date"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">End</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-edit-trip-end-date"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" strokeWidth={1.5} />
              Budget
            </Label>
            <div className="flex gap-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24" data-testid="select-edit-trip-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "CHF", "AUD", "CAD", "JPY"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CurrencyInput
                value={budget}
                onChange={setBudget}
                currency={currency}
                placeholder="10,000"
                testId="input-edit-trip-budget"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Image className="w-3 h-3" strokeWidth={1.5} />
              Cover Image URL
            </Label>
            <Input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              data-testid="input-edit-trip-cover-image"
            />
            {coverImageUrl && (
              <div className="mt-2 aspect-[21/9] overflow-hidden rounded-md">
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Users className="w-3 h-3" strokeWidth={1.5} />
              Travel Companions
            </Label>
            <Popover open={companionPopover} onOpenChange={setCompanionPopover}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                  data-testid="button-edit-trip-companions"
                >
                  {companionIds.length > 0 ? (
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                      {companionIds.length} companion{companionIds.length !== 1 ? "s" : ""} selected
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Add travel companions</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 border-b border-border/50">
                  <Input
                    placeholder="Search clients..."
                    value={companionSearch}
                    onChange={(e) => setCompanionSearch(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-edit-companion-search"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {clientsLoading ? (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : (clients || [])
                    .filter((c) => c.id !== clientId)
                    .filter((c) => {
                      if (!companionSearch.trim()) return true;
                      const q = companionSearch.toLowerCase();
                      return c.fullName.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
                    })
                    .slice(0, 20)
                    .map((c) => {
                      const isSelected = companionIds.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              setCompanionIds((prev) =>
                                isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            data-testid={`checkbox-edit-companion-${c.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{c.fullName}</p>
                            {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                          </div>
                        </label>
                      );
                    })}
                  {(clients || []).filter((c) => c.id !== clientId).length === 0 && (
                    <p className="px-2.5 py-2 text-sm text-muted-foreground text-center">No clients found</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {companionIds.length > 0 && clients && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {companionIds.map((cid) => {
                  const c = clients.find((cl) => cl.id === cid);
                  if (!c) return null;
                  return (
                    <Badge key={cid} variant="secondary" className="text-xs gap-1">
                      {c.fullName}
                      <button
                        type="button"
                        onClick={() => setCompanionIds((prev) => prev.filter((id) => id !== cid))}
                        className="hover:text-foreground"
                        data-testid={`button-remove-companion-${cid}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              data-testid="button-edit-trip-cancel"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => updateMutation.mutate()}
              disabled={!title.trim() || updateMutation.isPending}
              data-testid="button-edit-trip-save"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DuplicateTripDialog({ tripId, tripTitle, open, onOpenChange }: {
  tripId: string;
  tripTitle: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(`${tripTitle} (Copy)`);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/trips/${tripId}/duplicate`, {
        title,
        clientId,
        startDate: startDate || null,
      });
      return res.json();
    },
    onSuccess: (newTrip: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Trip duplicated", description: `"${newTrip.title}" created` });
      onOpenChange(false);
      navigate(`/trips/${newTrip.id}/edit`);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Duplicate Trip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm">Trip Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Italy Honeymoon (Copy)"
              data-testid="input-duplicate-title"
            />
          </div>
          <div>
            <Label className="text-sm">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger data-testid="select-duplicate-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">New Start Date (optional)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-duplicate-start-date"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">Leave blank to keep original dates</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-duplicate">
              Cancel
            </Button>
            <Button
              onClick={() => duplicateMutation.mutate()}
              disabled={!title.trim() || !clientId || duplicateMutation.isPending}
              data-testid="button-confirm-duplicate"
            >
              {duplicateMutation.isPending ? "Duplicating..." : "Duplicate Trip"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const segmentTypeIcons: Record<string, typeof Plane> = {
  flight: Plane, charter: Diamond, charter_flight: Diamond, hotel: Hotel, transport: Car,
  restaurant: UtensilsCrossed, activity: Activity, note: StickyNote,
};

const addSegmentOptions = [
  { type: "flight", label: "Commercial Flight", icon: Plane },
  { type: "charter_flight", label: "Private / Charter Flight", icon: Diamond },
  { type: "hotel", label: "Hotel", icon: Hotel },
  { type: "transport", label: "Transport", icon: Car },
  { type: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { type: "activity", label: "Activity", icon: Activity },
  { type: "note", label: "Note", icon: StickyNote },
];

function AddSegmentMenu({ day, onAddBlank, onAddFromTemplate }: {
  day: number;
  onAddBlank: (day: number, type?: string) => void;
  onAddFromTemplate: (day: number, tpl: TemplateData) => void;
}) {
  const { data: templates } = useQuery<any[]>({
    queryKey: ["/api/segment-templates"],
  });

  const hasTemplates = templates && templates.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-add-segment-day-${day}`}>
          <Plus className="w-3 h-3 mr-1" /> Add
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {addSegmentOptions.map((opt) => {
          const OptIcon = opt.icon;
          return (
            <DropdownMenuItem
              key={opt.type}
              onClick={() => onAddBlank(day, opt.type)}
              data-testid={`add-${opt.type}-day-${day}`}
            >
              <OptIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
              {opt.label}
            </DropdownMenuItem>
          );
        })}
        {hasTemplates && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-medium flex items-center gap-1">
                <Bookmark className="w-3 h-3" /> Templates
              </p>
            </div>
            {templates!.map((tpl: any) => {
              const TIcon = segmentTypeIcons[tpl.type] || Activity;
              return (
                <DropdownMenuItem
                  key={tpl.id}
                  onClick={() => onAddFromTemplate(day, {
                    type: tpl.type,
                    title: tpl.data?.title || tpl.label,
                    subtitle: tpl.data?.subtitle,
                    cost: tpl.data?.cost,
                    currency: tpl.data?.currency,
                    notes: tpl.data?.notes,
                    metadata: tpl.data?.metadata,
                    templateId: tpl.id,
                  })}
                  data-testid={`add-template-${tpl.id}`}
                >
                  <TIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
                  <span className="truncate">{tpl.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/50">{tpl.useCount}x</span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function TripEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<TripSegment | null>(null);
  const [addSegmentDay, setAddSegmentDay] = useState(1);
  const [templateForEditor, setTemplateForEditor] = useState<TemplateData | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [companionPopoverOpen, setCompanionPopoverOpen] = useState(false);
  const [companionSearch, setCompanionSearch] = useState("");
  const [propertyGroupDialog, setPropertyGroupDialog] = useState<{
    open: boolean;
    newSegmentId: string;
    existingSegmentId: string;
    hotelName: string;
  }>({ open: false, newSegmentId: "", existingSegmentId: "", hotelName: "" });
  const prevSegmentDialogOpen = useRef(false);

  const { data: tripData, isLoading: tripLoading } = useQuery<TripFull>({
    queryKey: ["/api/trips", id, "full"],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}/full`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const trip = tripData?.trip;
  const versions = tripData?.versions || [];

  const currentVersionId = activeVersionId || versions.find(v => v.isPrimary)?.id || versions[0]?.id;
  const currentVersion = versions.find(v => v.id === currentVersionId);

  const { data: segments = [], isLoading: segmentsLoading } = useQuery<TripSegment[]>({
    queryKey: ["/api/trips", id, "versions", currentVersionId, "segments"],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}/versions/${currentVersionId}/segments`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: !!currentVersionId,
  });

  const { data: submittedSelections } = useQuery({
    queryKey: ["/api/trips", id, "submitted-selections"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/trips/${id}/submitted-selections`);
      return res.json();
    },
    enabled: !!trip?.selectionsSubmittedAt,
  });

  const additionalIds = trip?.additionalClientIds as string[] | undefined;
  const { data: orgClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const companionNames = useMemo(() => {
    if (!additionalIds || additionalIds.length === 0 || !orgClients) return [];
    return additionalIds
      .map(id => orgClients.find(c => c.id === id)?.fullName)
      .filter(Boolean) as string[];
  }, [additionalIds, orgClients]);

  const { data: companionRelations } = useQuery<any[]>({
    queryKey: [`/api/clients/${trip?.clientId}/companions`],
    enabled: !!trip?.clientId,
  });

  const updateCompanionsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("PATCH", `/api/trips/${id}`, { additionalClientIds: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id] });
      toast({ title: "Companions updated" });
    },
  });

  const toggleCompanion = useCallback((companionId: string) => {
    const current = (trip?.additionalClientIds as string[] | undefined) || [];
    const next = current.includes(companionId)
      ? current.filter(cid => cid !== companionId)
      : [...current, companionId];
    updateCompanionsMutation.mutate(next);
  }, [trip?.additionalClientIds, updateCompanionsMutation]);

  const companionCandidates = useMemo(() => {
    if (!orgClients) return [];
    const q = companionSearch.toLowerCase();
    return orgClients
      .filter(c => c.id !== trip?.clientId)
      .filter(c => !q || c.fullName.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  }, [orgClients, companionSearch, trip?.clientId]);

  const suggestedCompanionIds = useMemo(() => {
    if (!companionRelations) return new Set<string>();
    return new Set(companionRelations.map((r: any) => r.companion?.id).filter(Boolean));
  }, [companionRelations]);

  const { data: flightTrackings = [] } = useQuery<FlightTracking[]>({
    queryKey: ["/api/trips", id, "flight-tracking"],
    refetchInterval: 60000,
  });

  const trackingBySegment = useMemo(() => {
    const map = new Map<string, FlightTracking>();
    for (const ft of flightTrackings) map.set(ft.segmentId, ft);
    return map;
  }, [flightTrackings]);

  const segmentsByDay = useMemo(() => {
    const groups = new Map<number, TripSegment[]>();
    for (const seg of segments) {
      if (!groups.has(seg.dayNumber)) groups.set(seg.dayNumber, []);
      groups.get(seg.dayNumber)!.push(seg);
    }
    return groups;
  }, [segments]);

  const propertyGroupMutation = useMutation({
    mutationFn: async ({ newSegmentId, existingSegmentId }: { newSegmentId: string; existingSegmentId: string }) => {
      const groupId = crypto.randomUUID();
      await apiRequest("PATCH", `/api/trips/${id}/segments/${existingSegmentId}`, { propertyGroupId: groupId });
      await apiRequest("PATCH", `/api/trips/${id}/segments/${newSegmentId}`, { propertyGroupId: groupId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id] });
      toast({ title: "Hotel rooms grouped" });
      setPropertyGroupDialog({ open: false, newSegmentId: "", existingSegmentId: "", hotelName: "" });
    },
    onError: (e: Error) => {
      toast({ title: "Error grouping", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (prevSegmentDialogOpen.current && !segmentDialogOpen && segments.length > 0) {
      const hotelSegments = segments.filter(s => s.type === "hotel" && !s.propertyGroupId);
      for (let i = hotelSegments.length - 1; i >= 0; i--) {
        const seg = hotelSegments[i];
        const segHotelName = ((seg.metadata as any)?.hotelName || "").toLowerCase().trim();
        if (!segHotelName) continue;
        const match = hotelSegments.find(other =>
          other.id !== seg.id &&
          other.dayNumber === seg.dayNumber &&
          ((other.metadata as any)?.hotelName || "").toLowerCase().trim() === segHotelName
        );
        if (match) {
          setPropertyGroupDialog({
            open: true,
            newSegmentId: seg.id,
            existingSegmentId: match.id,
            hotelName: (seg.metadata as any)?.hotelName || seg.title || "Hotel",
          });
          break;
        }
      }
    }
    prevSegmentDialogOpen.current = segmentDialogOpen;
  }, [segmentDialogOpen, segments]);

  const tripStart = trip?.startDate ? new Date(trip.startDate) : null;
  const tripEnd = trip?.endDate ? new Date(trip.endDate) : null;

  const dayList = useMemo(() => {
    if (tripStart && tripEnd) {
      return eachDayOfInterval({ start: tripStart, end: tripEnd })
        .map((date, i) => ({
          dayNumber: i + 1,
          date,
          label: `Day ${i + 1} — ${format(date, "EEEE, MMMM d")}`,
        }));
    }
    if (tripStart && !tripEnd) {
      const maxDay = segments.length > 0 ? Math.max(...segments.map(s => s.dayNumber)) : 0;
      const count = Math.max(maxDay, 1) + 1;
      return Array.from({ length: count }, (_, i) => ({
        dayNumber: i + 1,
        date: addDays(tripStart, i),
        label: `Day ${i + 1} — ${format(addDays(tripStart, i), "EEEE, MMMM d")}`,
      }));
    }
    const maxDay = segments.length > 0 ? Math.max(...segments.map(s => s.dayNumber)) : 0;
    const count = Math.max(maxDay, 1);
    return Array.from({ length: count }, (_, i) => ({
      dayNumber: i + 1,
      date: null as Date | null,
      label: null as string | null,
    }));
  }, [tripStart?.getTime(), tripEnd?.getTime(), segments]);

  const dayCount = dayList.length;

  const subtotalCost = useMemo(() => {
    return segments.reduce((sum, s) => sum + (s.cost || 0), 0);
  }, [segments]);

  const versionDiscount = currentVersion?.discount || 0;
  const versionDiscountType = (currentVersion as any)?.discountType || "fixed";
  const versionDiscountLabel = (currentVersion as any)?.discountLabel || "";

  const discountValue = useMemo(() => {
    if (versionDiscount <= 0) return 0;
    return versionDiscountType === "percent"
      ? Math.round(subtotalCost * (versionDiscount / 100))
      : versionDiscount;
  }, [subtotalCost, versionDiscount, versionDiscountType]);

  const totalCost = Math.max(0, subtotalCost - discountValue);

  const [showDiscountEditor, setShowDiscountEditor] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [discountTypeInput, setDiscountTypeInput] = useState("fixed");
  const [discountLabelInput, setDiscountLabelInput] = useState("");

  useEffect(() => {
    if (currentVersion) {
      setDiscountAmountInput(String(currentVersion.discount || 0));
      setDiscountTypeInput((currentVersion as any).discountType || "fixed");
      setDiscountLabelInput((currentVersion as any).discountLabel || "");
      setShowDiscountEditor(!!currentVersion.discount && currentVersion.discount > 0);
    }
  }, [currentVersionId, currentVersion?.discount, (currentVersion as any)?.discountType, (currentVersion as any)?.discountLabel]);

  const saveDiscountMutation = useMutation({
    mutationFn: async (data: { discount: number; discountType: string; discountLabel: string | null }) => {
      const res = await apiRequest("PATCH", `/api/trips/${id}/versions/${currentVersionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      toast({ title: "Discount saved" });
      setShowDiscountEditor(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSaveDiscount = () => {
    const amt = parseInt(discountAmountInput) || 0;
    saveDiscountMutation.mutate({
      discount: amt,
      discountType: discountTypeInput,
      discountLabel: discountLabelInput || null,
    });
  };

  const handleClearDiscount = () => {
    setDiscountAmountInput("0");
    setDiscountTypeInput("fixed");
    setDiscountLabelInput("");
    setShowDiscountEditor(false);
    saveDiscountMutation.mutate({ discount: 0, discountType: "fixed", discountLabel: null });
  };

  const addBlankVersionMutation = useMutation({
    mutationFn: async () => {
      const nextNum = versions.length + 1;
      const res = await apiRequest("POST", `/api/trips/${id}/versions`, {
        name: `Version ${nextNum}`,
      });
      return res.json();
    },
    onSuccess: (newVer: TripVersion) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      setActiveVersionId(newVer.id);
      toast({ title: "New blank version created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const duplicateVersionMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const nextNum = versions.length + 1;
      const res = await apiRequest("POST", `/api/trips/${id}/versions`, {
        sourceVersionId: sourceId,
        name: `Version ${nextNum}`,
      });
      return res.json();
    },
    onSuccess: (newVer: TripVersion) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      setActiveVersionId(newVer.id);
      toast({ title: "Version duplicated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await apiRequest("PATCH", `/api/trips/${id}/versions/${versionId}`, { isPrimary: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      toast({ title: "Primary version updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await apiRequest("DELETE", `/api/trips/${id}/versions/${versionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      setActiveVersionId(null);
      toast({ title: "Version deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/trips/${id}`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const togglePricingMutation = useMutation({
    mutationFn: async (showPricing: boolean) => {
      const res = await apiRequest("PATCH", `/api/trips/${id}/versions/${currentVersionId}`, { showPricing });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      toast({ title: currentVersion?.showPricing ? "Pricing hidden from client" : "Pricing visible to client" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const archiveTripMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/trips/${id}`, { status: "archived" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Trip archived" });
      navigate("/trips");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteTripMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/trips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Trip deleted permanently" });
      navigate("/trips");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handlePreview = () => {
    window.open(`/trip/${id}`, "_blank");
  };

  const handleDownloadPdf = () => {
    const url = `/api/export/pdf?tripId=${id}&versionId=${currentVersionId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip?.title || "Itinerary"} — Itinerary.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportCalendar = () => {
    const url = `/api/export/calendar?tripId=${id}&versionId=${currentVersionId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip?.title || "Trip"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleShare = () => setShareDialogOpen(true);

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/trips/${id}/share-token`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
    },
  });

  const toggleShareMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", `/api/trips/${id}/share`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
    },
  });

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const shareUrl = trip?.shareToken
    ? `${window.location.origin}/trip/${id}?token=${trip.shareToken}`
    : "";

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const handleToggleShare = (checked: boolean) => {
    if (checked && !trip?.shareToken) {
      generateTokenMutation.mutate();
    } else {
      toggleShareMutation.mutate(checked);
    }
  };

  const handleResetLink = () => {
    generateTokenMutation.mutate();
    setConfirmResetOpen(false);
    toast({ title: "Share link has been reset" });
  };

  const [addSegmentType, setAddSegmentType] = useState<string | null>(null);
  const [editTripOpen, setEditTripOpen] = useState(false);

  const openAddSegment = (day: number, type?: string) => {
    setEditingSegment(null);
    setTemplateForEditor(null);
    setAddSegmentDay(day);
    setAddSegmentType(type || null);
    setSegmentDialogOpen(true);
  };

  const openAddFromTemplate = (day: number, tpl: TemplateData) => {
    setEditingSegment(null);
    setTemplateForEditor(tpl);
    setAddSegmentDay(day);
    setSegmentDialogOpen(true);
  };

  const openEditSegment = (segment: TripSegment) => {
    setEditingSegment(segment);
    setTemplateForEditor(null);
    setAddSegmentDay(segment.dayNumber);
    setSegmentDialogOpen(true);
  };

  if (tripLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto w-full">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl mb-2">Trip not found</h2>
          <Button variant="outline" onClick={() => navigate("/trips")} data-testid="button-back-trips">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Trips
          </Button>
        </div>
      </div>
    );
  }

  const dateRange = trip.startDate
    ? `${format(new Date(trip.startDate), "MMM d")}${trip.endDate ? ` - ${format(new Date(trip.endDate), "MMM d, yyyy")}` : ""}`
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/trips")} data-testid="button-back-trips">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-0.5">
                <h1 className="font-serif text-lg md:text-xl tracking-tight truncate" data-testid="text-editor-trip-title">
                  {trip.title}
                </h1>
                <button
                  onClick={() => setEditTripOpen(true)}
                  className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-1 shrink-0"
                  data-testid="button-edit-trip-details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {trip.clientName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" strokeWidth={1.5} />
                    {trip.clientName}
                  </span>
                )}
                {dateRange && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" strokeWidth={1.5} />
                    {dateRange}
                  </span>
                )}
                {(trip.destination || (trip as any).destinations) && (
                  <span>{formatDestinationsShort((trip as any).destinations, trip.destination)}</span>
                )}
                <Popover open={companionPopoverOpen} onOpenChange={setCompanionPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors group" data-testid="button-edit-companions">
                      <Users className="w-3 h-3" strokeWidth={1.5} />
                      {companionNames.length > 0
                        ? <>
                            <span>Traveling with: {companionNames.join(", ")}</span>
                            <Pencil className="w-2.5 h-2.5 opacity-40 ml-0.5" />
                          </>
                        : <span className="text-muted-foreground underline underline-offset-2 decoration-dotted">Add travel companions</span>
                      }
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <div className="p-2 border-b border-border/50">
                      <Input
                        placeholder="Search clients..."
                        value={companionSearch}
                        onChange={(e) => setCompanionSearch(e.target.value)}
                        className="h-8 text-sm"
                        data-testid="input-companion-search"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {companionRelations && companionRelations.length > 0 && (
                        <>
                          <p className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Suggested</p>
                          {companionRelations
                            .filter((r: any) => {
                              if (!companionSearch) return true;
                              const q = companionSearch.toLowerCase();
                              return r.companion?.fullName?.toLowerCase().includes(q);
                            })
                            .map((rel: any) => {
                              const cId = rel.companion?.id;
                              if (!cId) return null;
                              const isSelected = ((trip?.additionalClientIds as string[]) || []).includes(cId);
                              return (
                                <label key={cId} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleCompanion(cId)}
                                    data-testid={`checkbox-companion-${cId}`}
                                  />
                                  <span className="text-sm flex-1 truncate">{rel.companion.fullName}</span>
                                  {rel.relationshipLabel && (
                                    <Badge variant="secondary" className="text-[10px] shrink-0">{rel.relationshipLabel}</Badge>
                                  )}
                                </label>
                              );
                            })}
                          <Separator className="my-1" />
                        </>
                      )}
                      <p className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">All Clients</p>
                      {companionCandidates
                        .filter(c => !suggestedCompanionIds.has(c.id))
                        .slice(0, 20)
                        .map((c) => {
                          const isSelected = ((trip?.additionalClientIds as string[]) || []).includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleCompanion(c.id)}
                                data-testid={`checkbox-client-${c.id}`}
                              />
                              <span className="text-sm flex-1 truncate">{c.fullName}</span>
                            </label>
                          );
                        })}
                      {companionCandidates.filter(c => !suggestedCompanionIds.has(c.id)).length === 0 && (
                        <p className="px-2.5 py-2 text-sm text-muted-foreground text-center">No clients found</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <button data-testid="button-status-popover">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase tracking-wider cursor-pointer ${
                      (tripStatusOptions.find(s => s.value === trip.status) || tripStatusOptions[0]).className
                    }`}
                  >
                    {(tripStatusOptions.find(s => s.value === trip.status) || tripStatusOptions[0]).label}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                {tripStatusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateStatusMutation.mutate(opt.value)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover-elevate flex items-center justify-between gap-2 text-sm"
                    data-testid={`button-set-status-${opt.value}`}
                  >
                    <span>{opt.label}</span>
                    {trip.status === opt.value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {totalCost > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-total-cost">
                <DollarSign className="w-3 h-3 mr-0.5" />
                {(trip.currency || "USD")} {totalCost.toLocaleString()}
              </Badge>
            )}

            {!isMobile && (
              <>
                <Button variant="ghost" size="sm" onClick={handlePreview} data-testid="button-preview-trip">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownloadPdf} data-testid="button-download-pdf">
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={handleExportCalendar} data-testid="button-export-calendar">
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Calendar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare} data-testid="button-share-trip">
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                </Button>
              </>
            )}

            {isMobile && (
              <Drawer open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
                <DrawerTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-trip-actions-overflow">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <div className="p-4 space-y-1">
                    <DrawerClose asChild>
                      <button
                        onClick={handlePreview}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-md hover-elevate text-sm"
                        data-testid="button-preview-trip-mobile"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        Preview
                      </button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <button
                        onClick={handleDownloadPdf}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-md hover-elevate text-sm"
                        data-testid="button-download-pdf-mobile"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                        Download PDF
                      </button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <button
                        onClick={handleExportCalendar}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-md hover-elevate text-sm"
                        data-testid="button-export-calendar-mobile"
                      >
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Export to Calendar
                      </button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-md hover-elevate text-sm"
                        data-testid="button-share-trip-mobile"
                      >
                        <Share2 className="w-4 h-4 text-muted-foreground" />
                        Share Link
                      </button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setDuplicateDialogOpen(true)}
              data-testid="button-duplicate-trip"
            >
              <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-trip-danger-menu">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => archiveTripMutation.mutate()}
                  data-testid="button-archive-trip"
                >
                  <Archive className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Archive trip
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                  data-testid="button-delete-trip"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {trip.approvedVersionId && (
          <div className="mx-4 md:mx-6 mb-2 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2" data-testid="banner-approved">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-800 dark:text-emerald-300">
              Client approved <strong>{versions.find(v => v.id === trip.approvedVersionId)?.name || "a version"}</strong>
              {trip.approvedAt && <> on {new Date(trip.approvedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
            </span>
          </div>
        )}

        {trip.selectionsSubmittedAt && submittedSelections?.length > 0 && (
          <div className="mx-4 md:mx-6 mb-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3" data-testid="submitted-selections-panel">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Client Selections
                <span className="font-normal ml-1 opacity-70">
                  submitted {new Date(trip.selectionsSubmittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </span>
            </div>
            <div className="space-y-1">
              {(submittedSelections as any[]).map((sel: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-amber-600 mt-0.5">•</span>
                  <div className="min-w-0">
                    <span className="font-medium text-amber-900 dark:text-amber-200">{sel.segmentTitle}</span>
                    <span className="text-amber-700 dark:text-amber-300 ml-1">→ {sel.selectedLabel || sel.variantLabel || "Selected"}</span>
                    {sel.variantType === "upgrade" && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded text-[10px] font-medium">
                        Upgrade
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-4 pb-2 md:px-6 overflow-x-auto">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-0.5 shrink-0">
              <Button
                variant={v.id === currentVersionId ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveVersionId(v.id)}
                data-testid={`button-version-tab-${v.id}`}
              >
                {v.name}
                {trip.approvedVersionId === v.id && (
                  <CheckCircle className="w-3 h-3 ml-1 text-emerald-500" />
                )}
                {v.isPrimary && (
                  <Star className="w-3 h-3 ml-1 fill-current" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-version-menu-${v.id}`}>
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => duplicateVersionMutation.mutate(v.id)}
                    data-testid={`button-duplicate-version-${v.id}`}
                  >
                    <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  {!v.isPrimary && (
                    <DropdownMenuItem
                      onClick={() => setPrimaryMutation.mutate(v.id)}
                      data-testid={`button-set-primary-${v.id}`}
                    >
                      <Star className="w-3.5 h-3.5 mr-2" /> Set as Primary
                    </DropdownMenuItem>
                  )}
                  {!v.isPrimary && versions.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Delete this version? All its segments will be removed.")) {
                            deleteVersionMutation.mutate(v.id);
                          }
                        }}
                        data-testid={`button-delete-version-${v.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addBlankVersionMutation.mutate()}
            disabled={addBlankVersionMutation.isPending}
            data-testid="button-add-blank-version"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> New version
          </Button>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Show pricing to client</span>
            <Switch
              checked={!!currentVersion?.showPricing}
              onCheckedChange={(checked) => togglePricingMutation.mutate(checked)}
              disabled={togglePricingMutation.isPending}
              data-testid="switch-show-pricing"
            />
          </div>
        </div>
      </div>

      {trip.selectionsSubmittedAt && (
        <div className="mx-4 md:mx-6 mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-start gap-3" data-testid="banner-client-selections">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Client submitted their selections
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              Received {format(new Date(trip.selectionsSubmittedAt), "d MMM yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
      )}

      {(() => {
        const budgetAmount = Number(trip.budget || 0);
        const budgetCurrency = trip.currency || "USD";
        const fmtBudget = (amount: number) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: budgetCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amount);

        const percentage = budgetAmount > 0 ? (totalCost / budgetAmount) * 100 : 0;
        const isOverBudget = budgetAmount > 0 && totalCost > budgetAmount;
        const isWarning = budgetAmount > 0 && percentage >= 80 && !isOverBudget;
        const remaining = budgetAmount - totalCost;

        return (
          <div className="mx-4 mb-2">
            <div className="flex items-center gap-3 px-4 py-1.5 text-[11px] text-muted-foreground" data-testid="budget-progress-bar">
              {budgetAmount > 0 && (
                <>
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <span className="whitespace-nowrap">{fmtBudget(totalCost)} of {fmtBudget(budgetAmount)}</span>
                  <span className={`whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-full ${isOverBudget ? "bg-red-50 text-red-600" : "bg-muted"}`}>
                    {isOverBudget ? `${fmtBudget(Math.abs(remaining))} over` : `${fmtBudget(remaining)} left`}
                  </span>
                </>
              )}
              {subtotalCost > 0 && budgetAmount === 0 && (
                <span className="whitespace-nowrap" data-testid="cost-summary">{fmtBudget(subtotalCost)}</span>
              )}
              {discountValue > 0 && (
                <>
                  <span className="whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600" data-testid="discount-line">
                    -{fmtBudget(discountValue)} {versionDiscountLabel || "Discount"}{versionDiscountType === "percent" ? ` (${versionDiscount}%)` : ""}
                  </span>
                  <span className="whitespace-nowrap font-medium text-foreground">= {fmtBudget(totalCost)}</span>
                </>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setShowDiscountEditor(!showDiscountEditor)}
                className="whitespace-nowrap hover:text-foreground transition-colors flex-shrink-0 flex items-center gap-1 text-[11px]"
                data-testid="button-add-discount"
              >
                {discountValue > 0 ? (
                  showDiscountEditor
                    ? <><ChevronUp className="h-3 w-3" /> Close</>
                    : <><Pencil className="h-3 w-3" /> Edit discount</>
                ) : (
                  "+ Discount"
                )}
              </button>
            </div>
            {showDiscountEditor && (
              <div className="flex items-center gap-2 flex-wrap px-4 py-1.5" data-testid="discount-editor">
                <Select value={discountTypeInput} onValueChange={setDiscountTypeInput}>
                  <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">$ Fixed</SelectItem>
                    <SelectItem value="percent">% Percent</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={discountAmountInput}
                  onChange={e => setDiscountAmountInput(e.target.value)}
                  className="h-7 w-24 text-xs"
                  placeholder={discountTypeInput === "percent" ? "10" : "500"}
                  min={0}
                  data-testid="input-discount-amount"
                />
                <Input
                  value={discountLabelInput}
                  onChange={e => setDiscountLabelInput(e.target.value)}
                  className="h-7 flex-1 text-xs"
                  placeholder='Label e.g. "Loyalty credit"'
                  data-testid="input-discount-label"
                />
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSaveDiscount} data-testid="button-save-discount">
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleClearDiscount} data-testid="button-remove-discount">
                  Remove
                </Button>
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 md:px-6">
          {segmentsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              {dayList.map((dayInfo) => {
                const dayNum = dayInfo.dayNumber;
                const daySegments = segmentsByDay.get(dayNum) || [];
                const dayDate = dayInfo.date;
                const showPricing = true;

                return (
                  <motion.div
                    key={dayNum}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: dayNum * 0.02, duration: 0.3 }}
                    data-testid={`day-card-${dayNum}`}
                  >
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif text-base font-medium tracking-tight">
                          Day {dayNum}
                        </span>
                        {dayDate && (
                          <span className="text-xs text-muted-foreground">
                            {format(dayDate, "EEEE, MMM d")}
                          </span>
                        )}
                      </div>
                      <Separator className="flex-1" />
                      <AddSegmentMenu
                        day={dayNum}
                        onAddBlank={openAddSegment}
                        onAddFromTemplate={openAddFromTemplate}
                      />
                    </div>
                    {daySegments.length > 0 ? (
                      <div className="space-y-2 pl-0 md:pl-4">
                        {buildDayRenderItems(daySegments).map((item) => {
                          if (item.kind === "journey") {
                            return (
                              <JourneyCard
                                key={`journey-${item.journeyId}`}
                                legs={item.legs}
                                tripId={id!}
                                onEdit={openEditSegment}
                                trackingBySegment={trackingBySegment}
                                showPricing={showPricing}
                              />
                            );
                          }
                          if (item.kind === "propertyGroup") {
                            return (
                              <PropertyGroupCard
                                key={`property-${item.propertyGroupId}`}
                                rooms={item.rooms}
                                tripId={id!}
                                onEdit={openEditSegment}
                                showPricing={showPricing}
                              />
                            );
                          }
                          const segIdx = daySegments.indexOf(item.segment);
                          return (
                            <SegmentCard
                              key={item.segment.id}
                              segment={item.segment}
                              tripId={id!}
                              onEdit={openEditSegment}
                              tracking={item.segment.type === "flight" ? trackingBySegment.get(item.segment.id) : null}
                              showPricing={showPricing}
                              positionInDay={segIdx + 1}
                              daySegments={daySegments}
                              allSegments={segments}
                              currentVersionId={currentVersionId}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="pl-0 md:pl-4">
                        <div
                          className="border border-dashed border-border/40 rounded-md py-6 text-center cursor-pointer hover:border-border/70 transition-colors"
                          onClick={() => openAddSegment(dayNum)}
                          data-testid={`empty-day-${dayNum}`}
                        >
                          <p className="text-xs text-muted-foreground/50">
                            No segments yet
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {!(tripStart && tripEnd) && (
                <div className="flex items-center gap-3 pt-2">
                  <Separator className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddSegment(dayCount + 1)}
                    data-testid="button-add-new-day"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Day {dayCount + 1}
                  </Button>
                  <Separator className="flex-1" />
                </div>
              )}
            </div>
          )}

          <TripDocumentsSection tripId={id!} clientId={trip.clientId} />
          </div>
        </div>

        {trip.clientId && trip.clientName && (
          <div className="hidden lg:block w-64 shrink-0 overflow-y-auto">
            <ClientPreferencesPanel clientId={trip.clientId} clientName={trip.clientName} />
          </div>
        )}
      </div>

      {currentVersionId && (
        <SegmentEditor
          key={editingSegment?.id || `new-${addSegmentDay}-${addSegmentType || ''}-${templateForEditor?.templateId || ''}`}
          open={segmentDialogOpen}
          onOpenChange={setSegmentDialogOpen}
          tripId={id!}
          versionId={currentVersionId}
          existingSegment={editingSegment}
          defaultDay={addSegmentDay}
          templateData={templateForEditor}
          defaultType={addSegmentType}
        />
      )}

      <DuplicateTripDialog
        tripId={id!}
        tripTitle={trip.title}
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

      <EditTripSheet
        trip={trip}
        open={editTripOpen}
        onOpenChange={setEditTripOpen}
      />

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Delete trip permanently?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-medium text-foreground">{trip.title}</span> and all its
            versions, segments, and documents. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTripMutation.mutate()}
              disabled={deleteTripMutation.isPending}
              data-testid="button-confirm-delete-trip"
            >
              {deleteTripMutation.isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={propertyGroupDialog.open} onOpenChange={(o) => setPropertyGroupDialog(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-sm" data-testid="dialog-property-group">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Group hotel rooms?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This looks like another room at <span className="font-medium text-foreground">{propertyGroupDialog.hotelName}</span>. Group with the existing booking?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPropertyGroupDialog({ open: false, newSegmentId: "", existingSegmentId: "", hotelName: "" })}
              data-testid="button-keep-separate"
            >
              Keep separate
            </Button>
            <Button
              size="sm"
              onClick={() => propertyGroupMutation.mutate({
                newSegmentId: propertyGroupDialog.newSegmentId,
                existingSegmentId: propertyGroupDialog.existingSegmentId,
              })}
              disabled={propertyGroupMutation.isPending}
              data-testid="button-group-them"
            >
              {propertyGroupMutation.isPending ? "Grouping..." : "Group them"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-share-trip">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl tracking-tight">Share itinerary</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Public preview link</Label>
                </div>
                <Switch
                  checked={trip.shareEnabled || false}
                  onCheckedChange={handleToggleShare}
                  disabled={generateTokenMutation.isPending || toggleShareMutation.isPending}
                  data-testid="switch-share-enabled"
                />
              </div>

              {!trip.shareEnabled ? (
                <p className="text-xs text-muted-foreground" data-testid="text-share-disabled">
                  Link sharing is disabled. Enable to generate a shareable link.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareUrl}
                      className="text-xs font-mono"
                      data-testid="input-share-url"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyShareLink}
                      className="shrink-0"
                      data-testid="button-copy-share-link"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7"
                      onClick={() => setConfirmResetOpen(true)}
                      data-testid="button-reset-share-link"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset link
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(trip.shareEnabled && shareUrl ? shareUrl : `/trip/${id}`, "_blank")}
                data-testid="button-open-preview"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-confirm-reset-link">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Reset share link?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will invalidate the current link. Anyone with the old link will lose access.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(false)} data-testid="button-cancel-reset">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResetLink}
              disabled={generateTokenMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {generateTokenMutation.isPending ? "Resetting..." : "Reset link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

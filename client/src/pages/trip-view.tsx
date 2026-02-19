import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plane, Ship, Hotel, Car, UtensilsCrossed, Activity, StickyNote,
  Clock, MapPin, Hash, ChevronDown, Calendar, Download, Star,
  Info, Lightbulb, AlertTriangle, ShieldAlert, Users,
  ArrowRight, FileDown, CalendarPlus,
} from "lucide-react";
import type { Trip, TripVersion, TripSegment } from "@shared/schema";
import { format, differenceInDays, isWithinInterval, isAfter, isBefore } from "date-fns";

const segmentIcons: Record<string, typeof Plane> = {
  flight: Plane, charter: Ship, hotel: Hotel, transport: Car,
  restaurant: UtensilsCrossed, activity: Activity, note: StickyNote,
};

const segmentColors: Record<string, string> = {
  flight: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
  charter: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
  hotel: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  transport: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  restaurant: "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
  activity: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  note: "text-muted-foreground bg-muted/60",
};

const noteTypeIcons: Record<string, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "text-sky-600 border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800" },
  tip: { icon: Lightbulb, color: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" },
  important: { icon: AlertTriangle, color: "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800" },
  warning: { icon: ShieldAlert, color: "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800" },
};

interface TripViewData {
  trip: Trip;
  organization: { id: string; name: string; logoUrl: string | null };
  advisor: { fullName: string; email: string | null; avatarUrl: string | null } | null;
  client: { fullName: string; email: string | null } | null;
  versions: (TripVersion & { segments: TripSegment[] })[];
}

function formatDateRange(start: string | Date | null, end: string | Date | null) {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  if (e) {
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return `${format(s, "d")} - ${format(e, "d MMMM yyyy")}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${format(s, "d MMM")} - ${format(e, "d MMM yyyy")}`;
    }
    return `${format(s, "d MMM yyyy")} - ${format(e, "d MMM yyyy")}`;
  }
  return format(s, "d MMMM yyyy");
}

function getActiveDayInfo(start: string | Date | null, end: string | Date | null) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const now = new Date();
  if (isWithinInterval(now, { start: s, end: e })) {
    const day = differenceInDays(now, s) + 1;
    const total = differenceInDays(e, s) + 1;
    return { day, total };
  }
  return null;
}

function getDayDate(startDate: string | Date | null, dayNumber: number) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayNumber - 1);
  return d;
}

function FlightCard({ segment }: { segment: TripSegment }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const depAirport = meta.departureAirport || "";
  const arrAirport = meta.arrivalAirport || "";

  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-sky-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-sky-50 dark:bg-sky-950/40">
              <Plane className="w-3.5 h-3.5 text-sky-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Flight</span>
            {meta.bookingClass && <Badge variant="secondary" className="text-[10px]">{meta.bookingClass}</Badge>}
          </div>
          {depAirport && arrAirport ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="text-center">
                <p className="text-2xl font-serif font-semibold tracking-tight">{depAirport}</p>
                {meta.departureDateTime && <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(meta.departureDateTime), "HH:mm")}</p>}
              </div>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                <Plane className="w-4 h-4 text-muted-foreground/50" />
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif font-semibold tracking-tight">{arrAirport}</p>
                {meta.arrivalDateTime && <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(meta.arrivalDateTime), "HH:mm")}</p>}
              </div>
            </div>
          ) : (
            <p className="text-base font-serif font-medium mb-1">{segment.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {meta.flightNumber && <span>{meta.flightNumber}</span>}
            {meta.airline && <span>{meta.airline}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelCard({ segment }: { segment: TripSegment }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-amber-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-950/40">
              <Hotel className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hotel</span>
            {meta.starRating > 0 && (
              <div className="flex items-center gap-0.5 ml-1">
                {Array.from({ length: meta.starRating }, (_, i) => (
                  <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />
                ))}
              </div>
            )}
          </div>
          <p className="text-lg font-serif font-semibold">{meta.hotelName || segment.title}</p>
          {(segment.subtitle || meta.roomType) && (
            <p className="text-sm text-muted-foreground mt-0.5">{segment.subtitle || meta.roomType}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
            {meta.checkInDateTime && (
              <span>Check-in: {format(new Date(meta.checkInDateTime), "d MMM, HH:mm")}</span>
            )}
            {meta.checkOutDateTime && (
              <span>Check-out: {format(new Date(meta.checkOutDateTime), "d MMM, HH:mm")}</span>
            )}
            {meta.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meta.address}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RestaurantCard({ segment }: { segment: TripSegment }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-rose-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-50 dark:bg-rose-950/40">
              <UtensilsCrossed className="w-3.5 h-3.5 text-rose-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Restaurant</span>
            {meta.cuisine && <Badge variant="secondary" className="text-[10px]">{meta.cuisine}</Badge>}
          </div>
          <p className="text-lg font-serif font-semibold">{meta.restaurantName || segment.title}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {meta.reservationDateTime && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(meta.reservationDateTime), "HH:mm")}</span>
            )}
            {meta.partySize && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{meta.partySize} guests</span>}
            {meta.guestName && <span>{meta.guestName}</span>}
            {meta.dressCode && <span>{meta.dressCode}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ segment }: { segment: TripSegment }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-violet-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-violet-50 dark:bg-violet-950/40">
              <Activity className="w-3.5 h-3.5 text-violet-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activity</span>
            {meta.category && <Badge variant="secondary" className="text-[10px] capitalize">{meta.category}</Badge>}
          </div>
          <p className="text-lg font-serif font-semibold">{meta.activityName || segment.title}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {meta.startDateTime && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(meta.startDateTime), "HH:mm")}</span>
            )}
            {meta.duration && <span>{meta.duration}</span>}
            {meta.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meta.location}</span>}
            {meta.meetingPoint && <span>Meet: {meta.meetingPoint}</span>}
            {meta.provider && <span>{meta.provider}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ segment }: { segment: TripSegment }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const noteType = meta.noteType || "info";
  const ntCfg = noteTypeIcons[noteType] || noteTypeIcons.info;
  const NIcon = ntCfg.icon;

  return (
    <div className={`rounded-md border p-4 ${ntCfg.color}`} data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-start gap-3">
        <NIcon className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{segment.title}</p>
          {meta.content && (
            <p className="text-sm mt-1 leading-relaxed opacity-90">{meta.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GenericCard({ segment }: { segment: TripSegment }) {
  const Icon = segmentIcons[segment.type] || StickyNote;
  const color = segmentColors[segment.type] || segmentColors.note;
  const meta = (segment.metadata || {}) as Record<string, any>;
  const confNum = segment.confirmationNumber || meta.confirmationNumber;
  const barColors: Record<string, string> = {
    charter: "bg-indigo-500", transport: "bg-emerald-500",
  };

  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className={`w-1.5 ${barColors[segment.type] || "bg-muted-foreground"} shrink-0`} />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-md ${color}`}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground capitalize">{segment.type}</span>
          </div>
          <p className="text-base font-serif font-medium">{segment.title}</p>
          {segment.subtitle && <p className="text-sm text-muted-foreground mt-0.5">{segment.subtitle}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {segment.startTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{segment.startTime}</span>}
            {confNum && <span className="font-mono tracking-wider">{confNum}</span>}
          </div>
          {segment.notes && <p className="text-xs text-muted-foreground mt-2">{segment.notes}</p>}
        </div>
      </div>
    </div>
  );
}

function SegmentView({ segment }: { segment: TripSegment }) {
  switch (segment.type) {
    case "flight": return <FlightCard segment={segment} />;
    case "hotel": return <HotelCard segment={segment} />;
    case "restaurant": return <RestaurantCard segment={segment} />;
    case "activity": return <ActivityCard segment={segment} />;
    case "note": return <NoteCard segment={segment} />;
    default: return <GenericCard segment={segment} />;
  }
}

function DayAccordion({
  dayNumber,
  segments,
  dayDate,
  defaultOpen,
}: {
  dayNumber: number;
  segments: TripSegment[];
  dayDate: Date | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/40 last:border-b-0" data-testid={`view-day-${dayNumber}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`button-toggle-day-${dayNumber}`}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-serif font-semibold tracking-tight">Day {dayNumber}</span>
          {dayDate && (
            <span className="text-sm text-muted-foreground">{format(dayDate, "EEEE, d MMMM")}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-6 space-y-3">
              {segments.map((seg) => (
                <SegmentView key={seg.id} segment={seg} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TripViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<TripViewData>({
    queryKey: ["/api/trip-view", id],
  });

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        setShowFloatingBar(heroBottom < 0);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const activeVersion = useMemo(() => {
    if (!data) return null;
    if (selectedVersionId) return data.versions.find(v => v.id === selectedVersionId) || null;
    return data.versions.find(v => v.isPrimary) || data.versions[0] || null;
  }, [data, selectedVersionId]);

  const dayGroups = useMemo(() => {
    if (!activeVersion) return [];
    const groups: Record<number, TripSegment[]> = {};
    activeVersion.segments.forEach(seg => {
      if (!groups[seg.dayNumber]) groups[seg.dayNumber] = [];
      groups[seg.dayNumber].push(seg);
    });
    return Object.entries(groups)
      .map(([day, segs]) => ({ dayNumber: parseInt(day), segments: segs }))
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [activeVersion]);

  const stats = useMemo(() => {
    if (!activeVersion) return { days: 0, flights: 0, hotels: 0, experiences: 0 };
    const segs = activeVersion.segments;
    const days = Math.max(0, ...segs.map(s => s.dayNumber));
    return {
      days,
      flights: segs.filter(s => s.type === "flight" || s.type === "charter").length,
      hotels: segs.filter(s => s.type === "hotel").length,
      experiences: segs.filter(s => s.type === "restaurant" || s.type === "activity").length,
    };
  }, [activeVersion]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 p-8">
          <p className="text-lg font-serif">Unable to view this trip</p>
          <p className="text-sm text-muted-foreground">You may not have access, or the trip may not exist.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")} data-testid="button-back-dashboard">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full h-[70vh]" />
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const { trip, organization, advisor, client } = data;
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const activeDayInfo = getActiveDayInfo(trip.startDate, trip.endDate);
  const heroImage = trip.coverImageUrl || "/images/default-trip-hero.jpg";
  const totalDays = trip.startDate && trip.endDate
    ? differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1
    : stats.days;

  return (
    <div className="min-h-screen bg-background" data-testid="trip-view-page">
      <div
        ref={heroRef}
        className="relative w-full h-[75vh] min-h-[480px] overflow-hidden"
        data-testid="trip-view-hero"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundAttachment: "fixed",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

        <div className="relative z-10 h-full flex flex-col justify-end p-8 sm:p-12 max-w-4xl">
          {client && (
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/70 mb-3" data-testid="text-client-name">
              Prepared for {client.fullName}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-3" data-testid="text-trip-title">
            {trip.title}
          </h1>
          {trip.destination && (
            <p className="text-lg sm:text-xl text-white/80 font-light flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4" strokeWidth={1.5} />
              {trip.destination}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {dateRange && (
              <span className="text-sm text-white/70 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                {dateRange}
              </span>
            )}
            {activeDayInfo && (
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm no-default-hover-elevate no-default-active-elevate">
                Day {activeDayInfo.day} of {activeDayInfo.total}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFloatingBar && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
            data-testid="floating-action-bar"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-background/80 backdrop-blur-xl shadow-lg">
              <span className="text-sm font-serif font-medium truncate max-w-[200px]">{trip.title}</span>
              <Separator orientation="vertical" className="h-5" />
              {data.versions.length > 1 && (
                <Select value={selectedVersionId || activeVersion?.id || ""} onValueChange={setSelectedVersionId}>
                  <SelectTrigger className="w-auto border-0 h-auto py-1 px-2 text-xs" data-testid="select-floating-version">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.versions.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Separator orientation="vertical" className="h-5" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => window.open(`/api/export/pdf?tripId=${trip.id}&versionId=${activeVersion?.id || ""}`, "_blank")}
                data-testid="button-floating-pdf"
              >
                <FileDown className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => window.open(`/api/export/calendar?tripId=${trip.id}&versionId=${activeVersion?.id || ""}`, "_blank")}
                data-testid="button-floating-calendar"
              >
                <CalendarPlus className="w-3 h-3 mr-1" /> Cal
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-6">
        <div className="py-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12" data-testid="trip-stats-row">
          {[
            { label: "Days", value: totalDays || stats.days, icon: Calendar },
            { label: "Flights", value: stats.flights, icon: Plane },
            { label: "Hotels", value: stats.hotels, icon: Hotel },
            { label: "Experiences", value: stats.experiences, icon: Activity },
          ].filter(s => s.value > 0).map((stat) => {
            const SIcon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center gap-1.5" data-testid={`stat-${stat.label.toLowerCase()}`}>
                <SIcon className="w-5 h-5 text-muted-foreground/60" strokeWidth={1.2} />
                <span className="text-2xl font-serif font-semibold">{stat.value}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              </div>
            );
          })}
        </div>

        <Separator className="opacity-50" />

        {data.versions.length > 1 && (
          <div className="py-4 flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Version:</span>
            <Select value={selectedVersionId || activeVersion?.id || ""} onValueChange={setSelectedVersionId}>
              <SelectTrigger className="w-auto" data-testid="select-version">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}{v.isPrimary ? " (Primary)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="py-4" data-testid="trip-itinerary">
          {dayGroups.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-serif text-muted-foreground">Your itinerary is being prepared</p>
              <p className="text-sm text-muted-foreground/60 mt-2">Check back soon for your complete travel plan.</p>
            </div>
          ) : (
            dayGroups.map(({ dayNumber, segments }) => (
              <DayAccordion
                key={dayNumber}
                dayNumber={dayNumber}
                segments={segments}
                dayDate={getDayDate(trip.startDate, dayNumber)}
                defaultOpen={dayNumber <= 2}
              />
            ))
          )}
        </div>

        {trip.description && (
          <>
            <Separator className="opacity-50" />
            <div className="py-8">
              <h3 className="text-lg font-serif font-semibold mb-3">Trip Notes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{trip.description}</p>
            </div>
          </>
        )}

        <Separator className="opacity-50" />
        <footer className="py-12 text-center space-y-3" data-testid="trip-view-footer">
          {advisor && (
            <p className="text-sm text-muted-foreground">
              Curated by <span className="font-medium text-foreground">{advisor.fullName}</span>
              <span className="text-muted-foreground/60"> at </span>
              <span className="font-medium text-foreground">{organization.name}</span>
            </p>
          )}
          {!advisor && (
            <p className="text-sm text-muted-foreground">
              Prepared by <span className="font-medium text-foreground">{organization.name}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground/50 tracking-wider uppercase">Travel Lab</p>
        </footer>
      </div>
    </div>
  );
}

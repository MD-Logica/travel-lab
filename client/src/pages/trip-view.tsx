import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { formatDestinations } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plane, Ship, Hotel, Car, UtensilsCrossed, Activity, StickyNote,
  Clock, MapPin, Hash, ChevronDown, Calendar, Download, Star,
  Info, Lightbulb, AlertTriangle, ShieldAlert, Users,
  ArrowRight, FileDown, CalendarPlus, Diamond, CheckCircle, Send, Lock,
  Train, Bus, Anchor, Truck, Phone, User,
} from "lucide-react";
import type { Trip, TripVersion, TripSegment } from "@shared/schema";
import { format, differenceInDays, isWithinInterval, isAfter, isBefore } from "date-fns";
import { calculateLayover, isRedEye, journeyTotalTime } from "@/lib/journey-utils";
import { formatTime, timeFormatString } from "@/lib/time-utils";
import { AdvisorContactCard } from "@/components/advisor-contact-card";
import { ClientChatWidget } from "@/components/client-chat-widget";

const segmentIcons: Record<string, typeof Plane> = {
  flight: Plane, charter: Diamond, charter_flight: Diamond, hotel: Hotel, transport: Car,
  restaurant: UtensilsCrossed, activity: Activity, note: StickyNote,
};

const segmentColors: Record<string, string> = {
  flight: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
  charter: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
  charter_flight: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
  hotel: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  transport: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  restaurant: "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
  activity: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  note: "text-muted-foreground bg-muted/60",
};

const bookingClassLabels: Record<string, string> = {
  first: "First Class",
  business: "Business",
  premium_economy: "Premium Economy",
  economy: "Economy",
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
  advisor: { fullName: string; email: string | null; avatarUrl: string | null; phone: string | null; website: string | null; timeFormat: string } | null;
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

function FlightCard({ segment, timeFormat = "24h" }: { segment: TripSegment; timeFormat?: "12h" | "24h" }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const depAirport = meta.departureAirport || "";
  const arrAirport = meta.arrivalAirport || "";
  const currency = segment.currency || "USD";

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
            {meta.bookingClass && <Badge variant="secondary" className="text-[10px]">{bookingClassLabels[meta.bookingClass] || meta.bookingClass}</Badge>}
          </div>
          {depAirport && arrAirport ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="text-center">
                <p className="text-2xl font-serif font-semibold tracking-tight">{depAirport}</p>
                {meta.departureTime && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(meta.departureTime, timeFormat)}<span className="text-xs text-muted-foreground/50 ml-1">local</span></p>}
              </div>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                <Plane className="w-4 h-4 text-muted-foreground/50" />
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif font-semibold tracking-tight">{arrAirport}</p>
                {meta.arrivalTime && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(meta.arrivalTime, timeFormat)}<span className="text-xs text-muted-foreground/50 ml-1">local</span></p>}
              </div>
            </div>
          ) : (
            <p className="text-base font-serif font-medium mb-1">{segment.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {meta.airline && <span>{meta.airline}</span>}
            {meta.flightNumber && <span className="font-mono">{meta.flightNumber}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
            {meta.refundability && meta.refundability !== "unknown" && (
              meta.refundability === "non_refundable" ? (
                <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 dark:text-red-400" data-testid={`flight-refund-${segment.id}`}>Non-refundable</Badge>
              ) : meta.refundability === "fully_refundable" ? (
                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600 dark:text-emerald-400" data-testid={`flight-refund-${segment.id}`}>
                  Refundable{meta.refundDeadline ? ` until ${format(new Date(meta.refundDeadline), "d MMM")}` : ""}
                </Badge>
              ) : meta.refundability === "partially_refundable" ? (
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400" data-testid={`flight-refund-${segment.id}`}>
                  Partial refund{meta.refundDeadline ? ` until ${format(new Date(meta.refundDeadline), "d MMM")}` : ""}
                </Badge>
              ) : null
            )}
            {meta.quantity > 1 && (
              <span className="text-muted-foreground/70" data-testid={`flight-passengers-${segment.id}`}>{meta.quantity} passengers</span>
            )}
            {meta.pricePerUnit > 0 && (
              <span className="text-muted-foreground/70" data-testid={`flight-price-per-unit-${segment.id}`}>{formatViewCurrency(meta.pricePerUnit, currency)} / person</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CharterFlightCard({ segment, timeFormat = "24h" }: { segment: TripSegment; timeFormat?: "12h" | "24h" }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const depLoc = meta.departureLocation || "";
  const arrLoc = meta.arrivalLocation || "";

  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-indigo-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-50 dark:bg-indigo-950/40">
              <Diamond className="w-3.5 h-3.5 text-indigo-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Private Flight</span>
            <Badge variant="secondary" className="text-[10px]">
              <Diamond className="w-2.5 h-2.5 mr-0.5" />
              Charter
            </Badge>
          </div>
          <p className="text-lg font-serif font-semibold">{meta.operator || "Private Flight"}</p>
          {meta.aircraftType && <p className="text-sm text-muted-foreground mt-0.5">{meta.aircraftType}</p>}
          {depLoc && arrLoc && (
            <div className="flex items-center gap-3 mt-3 mb-1">
              <div className="text-center">
                <p className="text-base font-medium">{depLoc}</p>
                {meta.departureTime && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(meta.departureTime, timeFormat)}<span className="text-xs text-muted-foreground/50 ml-1">local</span></p>}
              </div>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                <Diamond className="w-3.5 h-3.5 text-muted-foreground/50" />
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium">{arrLoc}</p>
                {meta.arrivalTime && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(meta.arrivalTime, timeFormat)}<span className="text-xs text-muted-foreground/50 ml-1">local</span></p>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {meta.tailNumber && <span className="font-mono">{meta.tailNumber}</span>}
            {meta.fboHandler && <span>{meta.fboHandler}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelCard({ segment, timeFormat = "24h" }: { segment: TripSegment; timeFormat?: "12h" | "24h" }) {
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
              <span>Check-in: {format(new Date(meta.checkInDateTime), `d MMM, ${timeFormatString(timeFormat)}`)}</span>
            )}
            {meta.checkOutDateTime && (
              <span>Check-out: {format(new Date(meta.checkOutDateTime), `d MMM, ${timeFormatString(timeFormat)}`)}</span>
            )}
            {meta.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meta.address}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
            {(meta.quantity || 1) > 1 && (
              <span className="flex items-center gap-1"><Hotel className="w-3 h-3" />{meta.quantity} rooms</span>
            )}
            {meta.pricePerUnit > 0 && (meta.quantity || 1) > 1 && (
              <span>{formatViewCurrency(meta.pricePerUnit, segment.currency || "USD")} / room / night</span>
            )}
          </div>
          {(() => {
            const refs: string[] = meta.photos || meta.photoRefs || [];
            const photoUrls = refs.slice(0, 4).map((r: string) => {
              if (r.startsWith("/api/") || r.startsWith("http")) return r;
              return `/api/places/photo?ref=${encodeURIComponent(r)}`;
            });
            if (photoUrls.length === 0) return null;
            return (
              <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-4 px-4">
                {photoUrls.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-36 h-24 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function RestaurantCard({ segment, timeFormat = "24h" }: { segment: TripSegment; timeFormat?: "12h" | "24h" }) {
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
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(meta.reservationDateTime), timeFormatString(timeFormat))}</span>
            )}
            {meta.partySize && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{meta.partySize} guests</span>}
            {meta.guestName && <span>{meta.guestName}</span>}
            {meta.dressCode && <span>{meta.dressCode}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
          {(() => {
            const refs: string[] = meta.photos || meta.photoRefs || [];
            const photoUrls = refs.slice(0, 3).map((r: string) => {
              if (r.startsWith("/api/") || r.startsWith("http")) return r;
              return `/api/places/photo?ref=${encodeURIComponent(r)}`;
            });
            if (photoUrls.length === 0) return null;
            return (
              <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-4 px-4">
                {photoUrls.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-36 h-24 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ segment, timeFormat = "24h" }: { segment: TripSegment; timeFormat?: "12h" | "24h" }) {
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
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(meta.startDateTime), timeFormatString(timeFormat))}</span>
            )}
            {meta.duration && <span>{meta.duration}</span>}
            {meta.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meta.location}</span>}
            {meta.meetingPoint && <span>Meet: {meta.meetingPoint}</span>}
            {meta.provider && <span>{meta.provider}</span>}
            {(segment.confirmationNumber || meta.confirmationNumber) && (
              <span className="font-mono tracking-wider">{segment.confirmationNumber || meta.confirmationNumber}</span>
            )}
          </div>
          {(() => {
            const refs: string[] = meta.photos || meta.photoRefs || [];
            const photoUrls = refs.slice(0, 3).map((r: string) => {
              if (r.startsWith("/api/") || r.startsWith("http")) return r;
              return `/api/places/photo?ref=${encodeURIComponent(r)}`;
            });
            if (photoUrls.length === 0) return null;
            return (
              <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-4 px-4">
                {photoUrls.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-36 h-24 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </div>
            );
          })()}
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

function TransportViewCard({ segment, timeFormat = "24h" }: { segment: TripSegment; timeFormat?: "12h" | "24h" }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const tType = meta.transportType || "car";
  const timeFmt = timeFormatString(timeFormat);

  const transportIcons: Record<string, typeof Car> = { car: Car, transfer: Truck, train: Train, bus: Bus, ferry: Anchor, other: Car };
  const transportLabels: Record<string, string> = { car: "Car", transfer: "Transfer", train: "Train", bus: "Bus", ferry: "Ferry", other: "Transport" };
  const TIcon = transportIcons[tType] || Car;

  const fmtDt = (val: string | undefined) => {
    if (!val) return null;
    try { return format(new Date(val), `d MMM · ${timeFmt}`); } catch { return val; }
  };
  const fmtTime = (val: string | undefined) => {
    if (!val) return null;
    try { return format(new Date(val), timeFmt); } catch { return val; }
  };

  const confNum = meta.confirmationNumber || segment.confirmationNumber;

  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-segment-${segment.id}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-emerald-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">
              <TIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{transportLabels[tType]}</span>
            {meta.provider && <span className="text-xs text-muted-foreground">· {meta.provider}</span>}
          </div>

          <p className="text-base font-serif font-medium">{segment.title}</p>
          {segment.subtitle && <p className="text-sm text-muted-foreground mt-0.5">{segment.subtitle}</p>}

          {(tType === "car" || tType === "transfer" || tType === "other") && (
            <div className="mt-3 space-y-2">
              {(meta.pickupLocation || meta.dropoffLocation) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{meta.pickupLocation || "—"}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{meta.dropoffLocation || "—"}</span>
                </div>
              )}
              {meta.pickupTime && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Pickup: {fmtDt(meta.pickupTime)}</span>
                </div>
              )}
              {(meta.driverName || meta.driverPhone) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {meta.driverName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{meta.driverName}</span>}
                  {meta.driverPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{meta.driverPhone}</span>}
                </div>
              )}
              {meta.vehicleDetails && <p className="text-xs text-muted-foreground">{meta.vehicleDetails}</p>}
            </div>
          )}

          {tType === "train" && (
            <div className="mt-3 space-y-2">
              {(meta.departureStation || meta.arrivalStation) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{meta.departureStation || "—"}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{meta.arrivalStation || "—"}</span>
                </div>
              )}
              {meta.trainNumber && <p className="text-xs text-muted-foreground">Train {meta.trainNumber}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meta.departureTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Dep: {fmtDt(meta.departureTime)}</span>}
                {meta.arrivalTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Arr: {fmtTime(meta.arrivalTime)}</span>}
              </div>
              {(meta.coachNumber || meta.seatNumber) && (
                <p className="text-xs text-muted-foreground">
                  {[meta.coachNumber && `Coach ${meta.coachNumber}`, meta.seatNumber && `Seat ${meta.seatNumber}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}

          {tType === "bus" && (
            <div className="mt-3 space-y-2">
              {(meta.departureStop || meta.arrivalStop) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{meta.departureStop || "—"}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{meta.arrivalStop || "—"}</span>
                </div>
              )}
              {meta.routeNumber && <p className="text-xs text-muted-foreground">Route {meta.routeNumber}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meta.departureTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Dep: {fmtDt(meta.departureTime)}</span>}
                {meta.arrivalTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Arr: {fmtTime(meta.arrivalTime)}</span>}
              </div>
              {meta.seatNumber && <p className="text-xs text-muted-foreground">Seat {meta.seatNumber}</p>}
            </div>
          )}

          {tType === "ferry" && (
            <div className="mt-3 space-y-2">
              {(meta.departurePort || meta.arrivalPort) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{meta.departurePort || "—"}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{meta.arrivalPort || "—"}</span>
                </div>
              )}
              {meta.vesselName && <p className="text-xs text-muted-foreground">{meta.vesselName}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meta.departureTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Dep: {fmtDt(meta.departureTime)}</span>}
                {meta.arrivalTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Arr: {fmtTime(meta.arrivalTime)}</span>}
              </div>
              {meta.cabinClass && <p className="text-xs text-muted-foreground">{meta.cabinClass}</p>}
            </div>
          )}

          {confNum && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Hash className="w-3 h-3" />
              <span className="font-mono tracking-wider">{confNum}</span>
            </div>
          )}
          {segment.notes && <p className="text-xs text-muted-foreground mt-2">{segment.notes}</p>}
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

function JourneyViewCard({ legs, showPricing, timeFormat = "24h", variantMap, localSelections, onSelectVariant, lockedSegments, token }: { legs: TripSegment[]; showPricing?: boolean; timeFormat?: "12h" | "24h"; variantMap?: Record<string, any[]>; localSelections?: Record<string, string>; onSelectVariant?: (segmentId: string, variantId: string) => void; lockedSegments?: Set<string>; token?: string | null }) {
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const firstMeta = (firstLeg.metadata || {}) as Record<string, any>;
  const lastMeta = (lastLeg.metadata || {}) as Record<string, any>;

  const originIata = firstMeta.departure?.iata || firstMeta.departureAirport || "";
  const destIata = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
  const stopsCount = legs.length - 1;
  const totalTime = journeyTotalTime(firstMeta, lastMeta);

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
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-journey-${firstLeg.journeyId}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-sky-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-sky-50 dark:bg-sky-950/40">
              <Plane className="w-3.5 h-3.5 text-sky-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Connecting Flight</span>
            <Badge variant="outline" className="text-[10px]">
              {stopsCount} stop{stopsCount > 1 ? "s" : ""}
            </Badge>
            {hasRedEye && (
              <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400">
                Red-eye
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="text-center">
              <p className="text-2xl font-serif font-semibold tracking-tight">{originIata}</p>
              {firstDepTime && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(firstDepTime, timeFormat)}<span className="text-xs text-muted-foreground/50 ml-1">local</span></p>}
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-center w-full gap-1">
                <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                {legs.slice(0, -1).map((leg, i) => {
                  const m = (leg.metadata || {}) as Record<string, any>;
                  const stopIata = m.arrival?.iata || m.arrivalAirport || "?";
                  return (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/80 rounded px-1.5 py-0.5">{stopIata}</span>
                      <div className="w-4 border-t border-dashed border-muted-foreground/30" />
                    </span>
                  );
                })}
                <Plane className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </div>
              {totalTime && (
                <span className="text-[10px] text-muted-foreground/60">{totalTime} total</span>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-serif font-semibold tracking-tight">{destIata}</p>
              {lastArrTime && <p className="text-xs text-muted-foreground mt-0.5">{formatTime(lastArrTime, timeFormat)}<span className="text-xs text-muted-foreground/50 ml-1">local</span></p>}
            </div>
          </div>

          <div className="space-y-0 border-l-2 border-sky-200/60 dark:border-sky-800/40 ml-3 pl-3">
            {legs.map((leg, i) => {
              const meta = (leg.metadata || {}) as Record<string, any>;
              const depIata = meta.departure?.iata || meta.departureAirport || "";
              const arrIata = meta.arrival?.iata || meta.arrivalAirport || "";
              const depTime = meta.departure?.scheduledTime || meta.departureTime || "";
              const arrTime = meta.arrival?.scheduledTime || meta.arrivalTime || "";
              const flightNum = meta.flightNumber || leg.title || "Flight";
              const airline = meta.airline || "";
              return (
                <div key={leg.id}>
                  {i > 0 && layovers[i - 1] && (
                    <div className="py-1.5 space-y-1">
                      <div className="flex items-center gap-2 text-[11px]">
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
                          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600">Tight</Badge>
                        )}
                      </div>
                      {layovers[i - 1]!.airportChange && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-3 py-2 space-y-0.5" data-testid={`warning-airport-change-${i}`}>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">Airport change required</span>
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400/80">
                              {layovers[i - 1]!.leg1ArrivalIata} → {layovers[i - 1]!.leg2DepartureIata}
                            </span>
                          </div>
                          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 pl-6">Allow extra time for transfer between terminals</p>
                        </div>
                      )}
                    </div>
                  )}
                  {i > 0 && !layovers[i - 1] && (
                    <div className="py-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/50">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                      <span>Connection</span>
                    </div>
                  )}
                  <div className="py-2" data-testid={`view-journey-leg-${leg.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{flightNum}</span>
                      {airline && <span className="text-xs text-muted-foreground">{airline}</span>}
                      {meta.bookingClass && (
                        <Badge variant="secondary" className="text-[9px]">{bookingClassLabels[meta.bookingClass] || meta.bookingClass}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {depIata && arrIata && <span>{depIata} &rarr; {arrIata}</span>}
                      {depTime && arrTime && (
                        <>
                          <span className="text-muted-foreground/40">&middot;</span>
                          <span>{formatTime(depTime, timeFormat)} &rarr; {formatTime(arrTime, timeFormat)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {showPricing && (() => {
            const totalCost = legs.reduce((sum, leg) => sum + (leg.cost || 0), 0);
            return totalCost > 0 ? (
              <div className="flex justify-end mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground" data-testid={`view-journey-cost-${firstLeg.journeyId}`}>
                  {formatViewCurrency(totalCost, legs[0].currency || "USD")}
                </span>
              </div>
            ) : null;
          })()}
        </div>
      </div>
      {(() => {
        const primaryLeg = legs[0];
        const variants = primaryLeg.hasVariants ? variantMap?.[primaryLeg.id] : undefined;
        if (variants && variants.length > 0 && onSelectVariant) {
          return (
            <div className="mt-2">
              <VariantCards
                segment={primaryLeg}
                variants={variants}
                selectedVariantId={localSelections?.[primaryLeg.id]}
                onSelect={onSelectVariant}
                locked={lockedSegments?.has(primaryLeg.id)}
                journeyLegs={legs}
                hasActiveSelection={token ? (!!localSelections?.[primaryLeg.id] || !!lockedSegments?.has(primaryLeg.id)) : true}
              />
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

type ViewDayRenderItem =
  | { kind: "segment"; segment: TripSegment }
  | { kind: "journey"; journeyId: string; legs: TripSegment[] }
  | { kind: "propertyGroup"; propertyGroupId: string; rooms: TripSegment[] };

function buildViewDayRenderItems(daySegments: TripSegment[]): ViewDayRenderItem[] {
  const items: ViewDayRenderItem[] = [];
  const seenJourneyIds = new Set<string>();
  const seenPropertyGroupIds = new Set<string>();
  const journeyGroups = new Map<string, TripSegment[]>();
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

function formatViewCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function RefundabilityLabel({ segment }: { segment: TripSegment }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const refundability = meta.refundability;
  const refundDeadline = meta.refundDeadline;
  if (!refundability || refundability === "unknown") return null;

  if (refundability === "non_refundable") {
    return <span className="text-[11px] text-red-600 dark:text-red-400" data-testid={`refund-status-${segment.id}`}>Non-refundable</span>;
  }
  if (refundability === "fully_refundable") {
    return (
      <span className="text-[11px] text-emerald-600 dark:text-emerald-400" data-testid={`refund-status-${segment.id}`}>
        Refundable{refundDeadline ? ` until ${format(new Date(refundDeadline), "d MMM yyyy")}` : ""}
      </span>
    );
  }
  if (refundability === "partially_refundable") {
    return (
      <span className="text-[11px] text-amber-600 dark:text-amber-400" data-testid={`refund-status-${segment.id}`}>
        Partial refund{refundDeadline ? ` until ${format(new Date(refundDeadline), "d MMM yyyy")}` : ""}
      </span>
    );
  }
  return null;
}

function PropertyGroupViewCard({ rooms, showPricing, timeFormat = "24h" }: { rooms: TripSegment[]; showPricing?: boolean; timeFormat?: "12h" | "24h" }) {
  const firstRoom = rooms[0];
  const firstMeta = (firstRoom.metadata || {}) as Record<string, any>;
  const hotelName = firstMeta.hotelName || firstRoom.title || "Hotel";

  const checkInDateTime = firstMeta.checkInDateTime;
  const lastMeta = (rooms[rooms.length - 1].metadata || {}) as Record<string, any>;
  const checkOutDateTime = lastMeta.checkOutDateTime || firstMeta.checkOutDateTime;

  const totalCost = rooms.reduce((sum, r) => sum + (r.cost || 0), 0);
  const currency = rooms.find(r => r.currency)?.currency || "USD";

  return (
    <div className="rounded-md border border-border/60 overflow-hidden" data-testid={`view-property-group-${firstRoom.propertyGroupId}`}>
      <div className="flex items-stretch">
        <div className="w-1.5 bg-amber-500 shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-950/40">
              <Hotel className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hotel</span>
            <Badge variant="outline" className="text-[10px]">
              {rooms.length} room{rooms.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-lg font-serif font-semibold">{hotelName}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            {checkInDateTime && (
              <span>Check-in: {format(new Date(checkInDateTime), `d MMM, ${timeFormatString(timeFormat)}`)}</span>
            )}
            {checkOutDateTime && (
              <span>Check-out: {format(new Date(checkOutDateTime), `d MMM, ${timeFormatString(timeFormat)}`)}</span>
            )}
          </div>
          <div className="space-y-0 border-l-2 border-amber-200/60 dark:border-amber-800/40 ml-3 pl-3 mt-3">
            {rooms.map((room) => {
              const meta = (room.metadata || {}) as Record<string, any>;
              const roomType = meta.roomType || room.title || "Room";
              const qty = room.quantity || 1;
              return (
                <div key={room.id} className="py-2" data-testid={`view-property-room-${room.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{roomType}</span>
                      {qty > 1 && <span className="text-xs text-muted-foreground ml-1.5">x{qty}</span>}
                    </div>
                    {showPricing && room.cost != null && room.cost > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">{formatViewCurrency(room.cost, room.currency || currency)}</span>
                    )}
                  </div>
                  {meta.pricePerUnit != null && meta.pricePerUnit > 0 && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatViewCurrency(meta.pricePerUnit, room.currency || currency)} / night</p>
                  )}
                  <RefundabilityLabel segment={room} />
                </div>
              );
            })}
          </div>
          {showPricing && totalCost > 0 && (
            <div className="flex justify-end mt-2 pt-2 border-t border-border/30">
              <span className="text-xs text-muted-foreground" data-testid={`view-property-group-cost-${firstRoom.propertyGroupId}`}>
                {formatViewCurrency(totalCost, currency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentView({ segment, showPricing, timeFormat = "24h" }: { segment: TripSegment; showPricing?: boolean; timeFormat?: "12h" | "24h" }) {
  const card = (() => {
    switch (segment.type) {
      case "flight": return <FlightCard segment={segment} timeFormat={timeFormat} />;
      case "charter":
      case "charter_flight": return <CharterFlightCard segment={segment} timeFormat={timeFormat} />;
      case "hotel": return <HotelCard segment={segment} timeFormat={timeFormat} />;
      case "restaurant": return <RestaurantCard segment={segment} timeFormat={timeFormat} />;
      case "activity": return <ActivityCard segment={segment} timeFormat={timeFormat} />;
      case "transport": return <TransportViewCard segment={segment} timeFormat={timeFormat} />;
      case "note": return <NoteCard segment={segment} />;
      default: return <GenericCard segment={segment} />;
    }
  })();

  const hasCost = showPricing && segment.cost != null && segment.cost > 0;
  const meta = (segment.metadata || {}) as Record<string, any>;
  const hasRefundInfo = meta.refundability && meta.refundability !== "unknown";

  if (!hasCost && !hasRefundInfo) return card;

  return (
    <div>
      {card}
      <div className="flex items-center justify-between mt-1 mx-1 gap-2 flex-wrap">
        <RefundabilityLabel segment={segment} />
        {hasCost && (
          <span className="text-xs text-muted-foreground ml-auto" data-testid={`view-segment-cost-${segment.id}`}>
            {formatViewCurrency(segment.cost!, segment.currency || "USD")}
          </span>
        )}
      </div>
    </div>
  );
}

function buildPrimaryLabel(segment: TripSegment, journeyLegs?: TripSegment[]): string {
  const meta = (segment.metadata || {}) as Record<string, any>;
  if (segment.type === "flight" || segment.type === "charter_flight") {
    if (journeyLegs && journeyLegs.length > 1) {
      const firstMeta = (journeyLegs[0].metadata || {}) as Record<string, any>;
      const lastMeta = (journeyLegs[journeyLegs.length - 1].metadata || {}) as Record<string, any>;
      const dep = firstMeta.departure?.iata || firstMeta.departureAirport || "";
      const arr = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
      const airline = firstMeta.airline || "";
      return dep && arr ? `${dep} → ${arr}` : (airline || "Flight");
    }
    const dep = meta.departure?.iata || meta.departureAirport || "";
    const arr = meta.arrival?.iata || meta.arrivalAirport || "";
    const flight = meta.flightNumber || "";
    if (dep && arr && flight) return `${flight}: ${dep} → ${arr}`;
    if (dep && arr) return `${dep} → ${arr}`;
    return segment.title || "Primary flight";
  }
  if (segment.type === "hotel") {
    return meta.hotelName || meta.roomType || segment.title || "Primary room";
  }
  return segment.title || "Primary option";
}

function VariantCards({
  segment,
  variants,
  selectedVariantId,
  onSelect,
  locked,
  journeyLegs,
  hasActiveSelection,
}: {
  segment: TripSegment;
  variants: any[];
  selectedVariantId?: string;
  onSelect: (segmentId: string, variantId: string) => void;
  locked?: boolean;
  journeyLegs?: TripSegment[];
  hasActiveSelection?: boolean;
}) {
  const isPrimarySelected = !selectedVariantId || selectedVariantId === "" || selectedVariantId === "primary";
  const segMeta = (segment.metadata || {}) as Record<string, any>;
  const primaryQty = segMeta.quantity || 1;
  const primaryPpu = segMeta.pricePerUnit;
  const primaryCost = segment.cost || 0;
  const primaryLabel = buildPrimaryLabel(segment, journeyLegs);
  const unitLabel = segment.type === "flight" || segment.type === "charter_flight" ? "passengers" : "rooms";

  return (
    <div className="mt-3 space-y-2" data-testid={`variant-list-${segment.id}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {locked ? "Selected option" : "Choose an option"}
      </p>

      {(!locked || isPrimarySelected) && (
        <button
          type="button"
          onClick={locked ? undefined : () => onSelect(segment.id, "")}
          className={`w-full text-left rounded-md border p-3 transition-all relative ${
            isPrimarySelected && hasActiveSelection
              ? "bg-primary/5 ring-1 ring-primary border-primary/30"
              : "bg-card border-border/60 hover:border-primary/40"
          } ${locked ? "cursor-default" : ""}`}
          data-testid={`variant-card-primary-${segment.id}`}
        >
          {isPrimarySelected && hasActiveSelection && (
            <div className="absolute top-2 right-2">
              {locked ? <Lock className="w-4 h-4 text-muted-foreground" /> : <CheckCircle className="w-4 h-4 text-primary" />}
            </div>
          )}
          <p className="text-sm font-medium pr-6">
            {(() => {
              const meta = (segment.metadata || {}) as Record<string, any>;
              if (segment.type === "flight" || segment.type === "charter_flight") {
                const fn = meta.flightNumber || "";
                const cabin = bookingClassLabels[meta.bookingClass] || "";
                const qty = meta.quantity || 1;

                if (journeyLegs && journeyLegs.length > 1) {
                  const firstMeta = (journeyLegs[0].metadata || {}) as Record<string, any>;
                  const lastMeta = (journeyLegs[journeyLegs.length - 1].metadata || {}) as Record<string, any>;
                  const dep = firstMeta.departure?.iata || firstMeta.departureAirport || "";
                  const arr = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
                  const airline = firstMeta.airline || "";
                  const stops = journeyLegs.length - 1;
                  const routePart = dep && arr ? `${dep} → ${arr}` : (airline || "Flight");
                  const stopsPart = stops === 1 ? "1 stop" : `${stops} stops`;
                  const extras: string[] = [stopsPart];
                  if (cabin) extras.push(cabin);
                  if (qty > 1) extras.push(`${qty} passengers`);
                  return `${routePart} (${extras.join(", ")})`;
                }

                const dep = meta.departure?.iata || meta.departureAirport || "";
                const arr = meta.arrival?.iata || meta.arrivalAirport || "";
                const parts: string[] = [];
                if (fn) parts.push(fn);
                if (dep && arr) parts.push(`${dep} → ${arr}`);
                const extras: string[] = [];
                if (cabin) extras.push(cabin);
                if (qty > 1) extras.push(`${qty} passengers`);
                return parts.length > 0
                  ? `${parts.join(" / ")}${extras.length > 0 ? ` (${extras.join(", ")})` : ""}`
                  : primaryLabel;
              }
              if (segment.type === "hotel") {
                const hotelName = meta.hotelName || segment.title || "";
                const roomType = meta.roomType || segment.subtitle || "";
                const qty = meta.quantity || 1;
                const parts = [hotelName, roomType].filter(Boolean);
                if (qty > 1) parts.push(`${qty} rooms`);
                return parts.length > 0 ? parts.join(" — ") : primaryLabel;
              }
              return primaryLabel;
            })()}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {primaryCost > 0 && (
              <span className="text-xs font-medium">
                {formatViewCurrency(primaryCost, segment.currency || "USD")}
              </span>
            )}
            {primaryQty > 1 && (
              <span className="text-[11px] text-muted-foreground">
                {(() => {
                  const effectivePpu = primaryPpu && primaryPpu > 0 ? primaryPpu : (primaryCost > 0 ? primaryCost / primaryQty : null);
                  return effectivePpu
                    ? `${formatViewCurrency(effectivePpu, segment.currency || "USD")} × ${primaryQty} ${unitLabel}`
                    : `${primaryQty} ${unitLabel}`;
                })()}
              </span>
            )}
            {segMeta.refundability === "non_refundable" && (
              <span className="text-[11px] text-red-600 dark:text-red-400">Non-refundable</span>
            )}
            {segMeta.refundability === "fully_refundable" && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Refundable</span>
            )}
            {segMeta.refundability === "partially_refundable" && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">Partial refund</span>
            )}
          </div>
        </button>
      )}

      {variants.map((v: any) => {
        const isSelected = selectedVariantId === v.id;
        if (locked && !isSelected) return null;
        const vQty = v.quantity || segMeta.quantity || 1;
        const vPpu = v.pricePerUnit;
        const vCost = v.cost || 0;
        const vCurrency = v.currency || segment.currency || "USD";
        return (
          <button
            key={v.id}
            type="button"
            onClick={locked ? undefined : () => onSelect(segment.id, v.id)}
            className={`w-full text-left rounded-md border p-3 transition-all relative ${
              isSelected
                ? "bg-primary/5 ring-1 ring-primary border-primary/30"
                : "bg-card border-border/60 hover:border-primary/40"
            } ${locked ? "cursor-default" : ""}`}
            data-testid={`variant-card-${v.id}`}
          >
            {isSelected && (
              <div className="absolute top-2 right-2">
                {locked ? <Lock className="w-4 h-4 text-muted-foreground" /> : <CheckCircle className="w-4 h-4 text-primary" />}
              </div>
            )}
            <p className="text-sm font-medium pr-6">
              {(() => {
                const isUpgrade = !v.variantType || v.variantType === "upgrade";
                if (isUpgrade) {
                  if (segment.type === "flight" || segment.type === "charter_flight") {
                    const meta = (segment.metadata || {}) as Record<string, any>;
                    const variantCabin = v.cabin || bookingClassLabels[v.bookingClass] || v.label || "";

                    if (journeyLegs && journeyLegs.length > 1) {
                      const firstMeta = (journeyLegs[0].metadata || {}) as Record<string, any>;
                      const lastMeta = (journeyLegs[journeyLegs.length - 1].metadata || {}) as Record<string, any>;
                      const dep = firstMeta.departure?.iata || firstMeta.departureAirport || "";
                      const arr = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
                      const stops = journeyLegs.length - 1;
                      const routePart = dep && arr ? `${dep} → ${arr}` : buildPrimaryLabel(segment, journeyLegs);
                      const stopsPart = stops === 1 ? "1 stop" : `${stops} stops`;
                      const extras: string[] = [stopsPart];
                      if (variantCabin) extras.push(variantCabin);
                      const vQtyLocal = v.quantity || segMeta.quantity || 1;
                      if (vQtyLocal > 1) extras.push(`${vQtyLocal} passengers`);
                      return `${routePart} (${extras.join(", ")})`;
                    }

                    const dep = meta.departure?.iata || meta.departureAirport || "";
                    const arr = meta.arrival?.iata || meta.arrivalAirport || "";
                    const routePart = dep && arr ? `${dep} → ${arr}` : buildPrimaryLabel(segment);
                    const extras: string[] = [];
                    if (variantCabin) extras.push(variantCabin);
                    const vQtyLocal = v.quantity || segMeta.quantity || 1;
                    if (vQtyLocal > 1) extras.push(`${vQtyLocal} passengers`);
                    return extras.length > 0 ? `${routePart} (${extras.join(", ")})` : routePart;
                  }

                  if (segment.type === "hotel") {
                    const hotelName = (segment.metadata as any)?.hotelName || segment.title || "";
                    const vQtyLocal = v.quantity || segMeta.quantity || 1;
                    const parts = [hotelName, v.label].filter(Boolean);
                    if (vQtyLocal > 1) parts.push(`${vQtyLocal} rooms`);
                    return parts.join(" — ");
                  }

                  const ctx = buildPrimaryLabel(segment, journeyLegs);
                  return ctx ? <>{ctx} — {v.label}</> : v.label;
                }
                return v.label;
              })()}
            </p>
            {v.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {vCost > 0 && (
                <span className="text-xs font-medium">
                  {formatViewCurrency(vCost, vCurrency)}
                </span>
              )}
              {vQty > 1 && (
                <span className="text-[11px] text-muted-foreground">
                  {(() => {
                    const effectivePpu = vPpu && vPpu > 0 ? vPpu : (vCost > 0 ? vCost / vQty : null);
                    return effectivePpu
                      ? `${formatViewCurrency(effectivePpu, vCurrency)} × ${vQty} ${unitLabel}`
                      : `${vQty} ${unitLabel}`;
                  })()}
                </span>
              )}
              {v.refundability === "non_refundable" && (
                <span className="text-[11px] text-red-600 dark:text-red-400">Non-refundable</span>
              )}
              {v.refundability === "fully_refundable" && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Refundable{v.refundDeadline ? ` until ${format(new Date(v.refundDeadline), "d MMM yyyy")}` : ""}
                </span>
              )}
              {v.refundability === "partially_refundable" && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                  Partial refund{v.refundDeadline ? ` until ${format(new Date(v.refundDeadline), "d MMM yyyy")}` : ""}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayAccordion({
  dayNumber,
  segments,
  dayDate,
  defaultOpen,
  showPricing,
  timeFormat = "24h",
  token,
  variantMap,
  localSelections,
  onSelectVariant,
  lockedSegments,
}: {
  dayNumber: number;
  segments: TripSegment[];
  dayDate: Date | null;
  defaultOpen: boolean;
  showPricing?: boolean;
  timeFormat?: "12h" | "24h";
  token?: string;
  variantMap?: Record<string, any[]>;
  localSelections?: Record<string, string>;
  onSelectVariant?: (segmentId: string, variantId: string) => void;
  lockedSegments?: Set<string>;
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
              {buildViewDayRenderItems(segments).map((item) => {
                if (item.kind === "journey") {
                  return <JourneyViewCard key={`journey-${item.journeyId}`} legs={item.legs} showPricing={showPricing} timeFormat={timeFormat} variantMap={variantMap} localSelections={localSelections} onSelectVariant={onSelectVariant} lockedSegments={lockedSegments} token={token} />;
                }
                if (item.kind === "propertyGroup") {
                  return <PropertyGroupViewCard key={`property-${item.propertyGroupId}`} rooms={item.rooms} showPricing={showPricing} timeFormat={timeFormat} />;
                }
                const seg = item.segment;
                const variants = seg.hasVariants ? variantMap?.[seg.id] : undefined;
                return (
                  <div key={seg.id}>
                    <SegmentView segment={seg} showPricing={showPricing} timeFormat={timeFormat} />
                    {variants && variants.length > 0 && onSelectVariant && (
                      <div className="mt-2">
                        <VariantCards
                          segment={seg}
                          variants={variants}
                          selectedVariantId={localSelections?.[seg.id]}
                          onSelect={onSelectVariant}
                          locked={lockedSegments?.has(seg.id)}
                          hasActiveSelection={token ? (!!localSelections?.[seg.id] || !!lockedSegments?.has(seg.id)) : true}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
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

  const [variantMap, setVariantMap] = useState<Record<string, any[]>>({});
  const [localSelections, setLocalSelections] = useState<Record<string, string>>({});
  const [submitSheetOpen, setSubmitSheetOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [approveSheetOpen, setApproveSheetOpen] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  const { data, isLoading, error } = useQuery<TripViewData>({
    queryKey: ["/api/trip-view", id, token],
    queryFn: async () => {
      const url = `/api/trip-view/${id}${token ? `?token=${token}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.message || "Failed to load trip") as any;
        err.status = res.status;
        err.requiresToken = body.requiresToken;
        throw err;
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) return;
    const allSegments = data.versions.flatMap(v => v.segments);
    const variantSegments = allSegments.filter(s => s.hasVariants);
    if (variantSegments.length === 0) return;

    const fetchVariants = async () => {
      const newMap: Record<string, any[]> = {};
      const newSelections: Record<string, string> = {};
      await Promise.all(
        variantSegments.map(async (seg) => {
          try {
            const url = token
              ? `/api/segments/${seg.id}/variants?token=${token}`
              : `/api/segments/${seg.id}/variants`;
            const res = await fetch(url, { credentials: "include" });
            if (res.ok) {
              const variants = await res.json();
              newMap[seg.id] = variants;
              if (!token) {
                const selected = variants.find((v: any) => v.isSelected);
                if (selected) newSelections[seg.id] = selected.id;
              } else if (variants.some((v: any) => v.isSubmitted)) {
                const selected = variants.find((v: any) => v.isSelected);
                if (selected) newSelections[seg.id] = selected.id;
              }
            }
          } catch {}
        })
      );
      setVariantMap(newMap);
      setLocalSelections(prev => ({ ...prev, ...newSelections }));
    };
    fetchVariants();
  }, [data, token]);

  const selectVariant = useCallback(async (segmentId: string, variantId: string) => {
    setLocalSelections(prev => {
      const next = { ...prev };
      if (variantId) {
        next[segmentId] = variantId;
      } else {
        next[segmentId] = "primary";
      }
      return next;
    });
    try {
      const vid = variantId || "none";
      const url = token
        ? `/api/segments/${segmentId}/variants/${vid}/select?token=${token}`
        : `/api/segments/${segmentId}/variants/${vid}/select`;
      await fetch(url, { method: "POST", credentials: "include" });
    } catch {}
  }, [token]);

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

  const lockedSegments = useMemo(() => {
    const locked = new Set<string>();
    if (submitSuccess) {
      Object.keys(localSelections).forEach(segId => locked.add(segId));
    }
    Object.entries(variantMap).forEach(([segId, variants]) => {
      if (variants.some((v: any) => v.isSubmitted)) {
        locked.add(segId);
      }
    });
    return locked;
  }, [variantMap, submitSuccess, localSelections]);

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
    const err = error as any;
    const isAccessDenied = err.status === 403 || err.requiresToken;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8 max-w-md" data-testid="trip-view-access-denied">
          {isAccessDenied ? (
            <>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-lg font-serif">This itinerary link is no longer active</p>
              <p className="text-sm text-muted-foreground">
                Please contact your travel advisor for a new link.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-serif">Unable to view this trip</p>
              <p className="text-sm text-muted-foreground">You may not have access, or the trip may not exist.</p>
              <Button variant="outline" onClick={() => navigate("/dashboard")} data-testid="button-back-dashboard">
                Go to Dashboard
              </Button>
            </>
          )}
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

  const { trip, organization, advisor, client, companions } = data;
  const timeFormat = (advisor?.timeFormat === "12h" ? "12h" : "24h") as "12h" | "24h";
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
          {companions && companions.length > 0 && (
            <p className="text-[11px] text-white/60 flex items-center gap-1.5 -mt-1 mb-3" data-testid="text-companions">
              <Users className="w-3 h-3" strokeWidth={1.5} />
              Traveling with: {companions.map((c: any) => c.fullName).join(", ")}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-3" data-testid="text-trip-title">
            {trip.title}
          </h1>
          {(trip.destination || (trip as any).destinations) && (
            <p className="text-lg sm:text-xl text-white/80 font-light flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4" strokeWidth={1.5} />
              {formatDestinations((trip as any).destinations, trip.destination)}
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
              {token && !(trip.approvedVersionId || approvalSuccess) && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-primary"
                    onClick={() => setApproveSheetOpen(true)}
                    data-testid="button-floating-approve"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                </>
              )}
              {token && !!(trip.approvedVersionId || approvalSuccess) && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Approved
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {token && (() => {
        if (!activeVersion) return null;
        const variantSegs = activeVersion.segments.filter(s => s.hasVariants);
        if (variantSegs.length === 0 && !!(trip.approvedVersionId || approvalSuccess)) return null;
        const allLocked = variantSegs.length > 0 && variantSegs.every(s => lockedSegments.has(s.id));
        const isApproved = !!(trip.approvedVersionId || approvalSuccess);
        if (allLocked && isApproved) return null;

        return (
          <div className="mx-auto max-w-3xl px-6 mb-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4" data-testid="client-action-banner">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <p className="text-xs text-foreground/80">
                  {!allLocked && !isApproved
                    ? "Review your options and approve this itinerary — scroll to the bottom to complete"
                    : !allLocked
                    ? "You have options to review — scroll down to select your preferences"
                    : "Review and approve this itinerary — scroll to the bottom"
                  }
                </p>
              </div>
              <button
                className="text-xs text-primary font-medium shrink-0 hover:underline"
                onClick={() => {
                  document.querySelector("[data-testid='bottom-action-section']")?.scrollIntoView({ behavior: "smooth" });
                }}
                data-testid="button-scroll-to-bottom"
              >
                Go to bottom ↓
              </button>
            </div>
          </div>
        );
      })()}

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
                showPricing={!!activeVersion?.showPricing}
                timeFormat={timeFormat}
                token={token}
                variantMap={variantMap}
                localSelections={localSelections}
                onSelectVariant={selectVariant}
                lockedSegments={lockedSegments}
              />
            ))
          )}
        </div>

        {activeVersion?.showPricing && (() => {
          const allSegments = activeVersion.segments || [];
          const subtotal = allSegments.reduce((sum, s) => sum + (s.cost || 0), 0);
          if (subtotal <= 0) return null;
          const currency = allSegments.find(s => s.currency)?.currency || trip.currency || "USD";
          const vDiscount = (activeVersion as any).discount || 0;
          const vDiscountType = (activeVersion as any).discountType || "fixed";
          const vDiscountLabel = (activeVersion as any).discountLabel || "";
          const discountVal = vDiscount > 0
            ? (vDiscountType === "percent" ? Math.round(subtotal * (vDiscount / 100)) : vDiscount)
            : 0;
          const finalTotal = Math.max(0, subtotal - discountVal);
          return (
            <>
              <Separator className="opacity-50" />
              <div className="py-6" data-testid="view-total-cost">
                {discountVal > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Subtotal</span>
                      <span className="text-sm text-muted-foreground">{formatViewCurrency(subtotal, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between" data-testid="view-discount-line">
                      <span className="text-sm text-emerald-600">
                        {vDiscountLabel || "Discount"}{vDiscountType === "percent" ? ` (${vDiscount}%)` : ""}
                      </span>
                      <span className="text-sm text-emerald-600">-{formatViewCurrency(discountVal, currency)}</span>
                    </div>
                    <Separator className="opacity-30" />
                    <div className="flex items-center justify-between">
                      <span className="text-base font-serif font-semibold">Total</span>
                      <span className="text-base font-serif font-semibold">{formatViewCurrency(finalTotal, currency)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-base font-serif font-semibold">Total</span>
                    <span className="text-base font-serif font-semibold">{formatViewCurrency(subtotal, currency)}</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}

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
        <footer className="py-12" data-testid="trip-view-footer">
          {advisor ? (
            <AdvisorContactCard
              advisor={advisor}
              organization={organization}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Prepared by{" "}
              <span className="font-medium text-foreground">{organization.name}</span>
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground/40 tracking-wider uppercase mt-6">Travel Lab</p>
        </footer>

        {token && activeVersion && (() => {
          const allSegments = activeVersion.segments || [];
          const variantSegments = allSegments.filter(s => s.hasVariants);
          const totalVariantSegments = variantSegments.length;
          const selectedCount = variantSegments.filter(s => localSelections[s.id]).length;
          const allLocked = variantSegments.length > 0 && variantSegments.every(s => lockedSegments.has(s.id));
          const isAlreadyApproved = !!(trip.approvedVersionId || approvalSuccess);

          return (
            <div className="border-t border-border/40 py-10 space-y-6" data-testid="bottom-action-section">
              {totalVariantSegments > 0 && (
                <div className="text-center space-y-3">
                  {allLocked || submitSuccess ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Options submitted</span>
                      {trip.selectionsSubmittedAt && (
                        <span className="text-xs opacity-70">· {format(new Date(trip.selectionsSubmittedAt), "d MMM")}</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        {selectedCount > 0
                          ? `${selectedCount} of ${totalVariantSegments} options selected`
                          : "You have options to review above"
                        }
                      </p>
                      <Button
                        variant="outline"
                        className="rounded-full px-8"
                        disabled={selectedCount === 0}
                        onClick={() => { setSubmitSuccess(false); setSubmitSheetOpen(true); }}
                        data-testid="button-review-submit-bottom"
                      >
                        <Send className="w-3.5 h-3.5 mr-2" />
                        Review & Submit Options
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="text-center space-y-3">
                {isAlreadyApproved ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {activeVersion?.name} approved
                    </span>
                    {trip.approvedAt && (
                      <span className="text-xs opacity-70">· {format(new Date(trip.approvedAt), "d MMM")}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">Ready to proceed with {activeVersion?.name}?</p>
                    <p className="text-xs text-muted-foreground">
                      This confirms you'd like to move forward. Your advisor will be notified.
                    </p>
                    <Button
                      className="rounded-full px-8"
                      onClick={() => { setApprovalSuccess(false); setApproveSheetOpen(true); }}
                      data-testid="button-approve-bottom"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve {activeVersion?.name}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {(() => {
        if (!activeVersion) return null;
        const allSegments = activeVersion.segments || [];
        const variantSegments = allSegments.filter(s => s.hasVariants);
        const totalVariantSegments = variantSegments.length;
        if (totalVariantSegments === 0) return null;
        const selectedCount = variantSegments.filter(s => localSelections[s.id]).length;

        return (
          <Sheet open={submitSheetOpen} onOpenChange={setSubmitSheetOpen}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle>Your Selections</SheetTitle>
                <SheetDescription>Review and submit your choices to your advisor</SheetDescription>
              </SheetHeader>

              {submitSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="submit-success">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                  <p className="text-base font-medium">Selections submitted!</p>
                  <p className="text-sm text-muted-foreground">Your advisor has been notified.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {variantSegments.map((seg) => {
                    const selectedId = localSelections[seg.id];
                    const variants = variantMap[seg.id] || [];
                    const selectedVariant = variants.find((v: any) => v.id === selectedId);
                    const isPrimary = selectedId === "primary";
                    const hasSelection = !!selectedId;
                    return (
                      <div key={seg.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0" data-testid={`sheet-segment-${seg.id}`}>
                        <div>
                          <p className="text-sm font-medium">{seg.title}</p>
                          {selectedVariant ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {selectedVariant.label}
                              {selectedVariant.cost > 0 && ` · ${formatViewCurrency(selectedVariant.cost, selectedVariant.currency || "USD")}`}
                            </p>
                          ) : isPrimary ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {buildPrimaryLabel(seg)}
                              {seg.cost != null && seg.cost > 0 && ` · ${formatViewCurrency(seg.cost, seg.currency || "USD")}`}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/60 mt-0.5 italic">Not yet selected</p>
                          )}
                        </div>
                        {hasSelection && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    );
                  })}

                  <div className="pt-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedCount} of {totalVariantSegments} options selected
                    </p>
                    {selectedCount < totalVariantSegments && (
                      <p className="text-xs text-muted-foreground/70">
                        You can submit now and return to select the remaining options later.
                      </p>
                    )}
                    <Button
                      className="w-full"
                      disabled={selectedCount === 0}
                      onClick={async () => {
                        try {
                          await fetch(`/api/trips/${trip.id}/submit-selections?token=${token}`, { method: "POST" });
                          setSubmitSuccess(true);
                          setTimeout(() => {
                            setSubmitSheetOpen(false);
                          }, 2000);
                        } catch {}
                      }}
                      data-testid="button-submit-selections"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit {selectedCount} selection{selectedCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        );
      })()}
      {(() => {
        if (!token || !activeVersion) return null;
        const isAlreadyApproved = !!(trip.approvedVersionId || approvalSuccess);

        return (
          <Sheet open={approveSheetOpen} onOpenChange={setApproveSheetOpen}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle>Approve Itinerary</SheetTitle>
                <SheetDescription>
                  Confirm that you're happy with {activeVersion.name} of "{trip.title}"
                </SheetDescription>
              </SheetHeader>

              {approvalSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="approval-success">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                  <p className="text-base font-medium">Itinerary approved!</p>
                  <p className="text-sm text-muted-foreground">Your advisor has been notified and will begin finalising arrangements.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border/30">
                    <p className="text-sm font-medium">{activeVersion.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{trip.title}</p>
                    {trip.startDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateRange(trip.startDate, trip.endDate)}
                      </p>
                    )}
                  </div>

                  {(() => {
                    const variantSegs = (activeVersion?.segments || []).filter((s: any) => s.hasVariants);
                    if (variantSegs.length === 0) return null;

                    const selectedCount = variantSegs.filter((s: any) => localSelections[s.id]).length;
                    const totalCount = variantSegs.length;
                    const allSelected = selectedCount === totalCount;

                    return (
                      <div className={`rounded-lg border p-3 space-y-2 ${
                        allSelected
                          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                          : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                      }`}>
                        <div className="flex items-center gap-2">
                          {allSelected
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          }
                          <p className={`text-xs font-medium ${
                            allSelected
                              ? "text-emerald-800 dark:text-emerald-300"
                              : "text-amber-800 dark:text-amber-300"
                          }`}>
                            {allSelected
                              ? `All ${totalCount} option${totalCount !== 1 ? "s" : ""} selected`
                              : `${selectedCount} of ${totalCount} options selected`
                            }
                          </p>
                        </div>

                        <div className="space-y-1">
                          {variantSegs.map((seg: any) => {
                            const hasSelection = !!localSelections[seg.id];
                            const selectedVariant = (variantMap[seg.id] || []).find((v: any) => v.id === localSelections[seg.id]);
                            return (
                              <div key={seg.id} className="flex items-center gap-2 text-xs">
                                {hasSelection
                                  ? <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                  : <div className="w-3 h-3 rounded-full border-2 border-amber-400 shrink-0" />
                                }
                                <span className="text-foreground/70">{seg.title}</span>
                                {hasSelection && selectedVariant && (
                                  <span className="text-muted-foreground">· {selectedVariant.label}</span>
                                )}
                                {!hasSelection && (
                                  <span className="text-amber-600 dark:text-amber-400 text-[10px]">Not yet selected</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {!allSelected && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed mt-1">
                            You can still approve now and return to submit your remaining preferences — your advisor will be notified either way.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <p className="text-sm text-muted-foreground">
                    By approving, you confirm this itinerary meets your expectations. Your advisor will begin finalising arrangements.
                  </p>

                  {(() => {
                    const variantSegs = (activeVersion?.segments || []).filter((s: any) => s.hasVariants);
                    const selectedCount = variantSegs.filter((s: any) => localSelections[s.id]).length;
                    const allSelected = variantSegs.length === 0 || selectedCount === variantSegs.length;

                    return (
                      <Button
                        className="w-full"
                        disabled={approvalPending}
                        variant={allSelected ? "default" : "outline"}
                        onClick={async () => {
                          setApprovalPending(true);
                          try {
                            const res = await fetch(
                              `/api/trips/${trip.id}/approve-version?token=${token}`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ versionId: activeVersion.id }),
                              }
                            );
                            if (res.ok) {
                              setApprovalSuccess(true);
                              setTimeout(() => setApproveSheetOpen(false), 2500);
                            }
                          } catch {} finally {
                            setApprovalPending(false);
                          }
                        }}
                        data-testid="button-confirm-approve"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        {approvalPending
                          ? "Approving..."
                          : allSelected
                          ? `Approve ${activeVersion.name}`
                          : `Approve ${activeVersion.name} anyway`
                        }
                      </Button>
                    );
                  })()}

                  {(() => {
                    const variantSegs = (activeVersion?.segments || []).filter((s: any) => s.hasVariants);
                    const selectedCount = variantSegs.filter((s: any) => localSelections[s.id]).length;
                    if (variantSegs.length === 0 || selectedCount === variantSegs.length) return null;

                    return (
                      <button
                        type="button"
                        className="w-full text-center text-xs text-primary hover:underline"
                        onClick={() => {
                          setApproveSheetOpen(false);
                          const firstUnselected = variantSegs.find((s: any) => !localSelections[s.id]);
                          if (firstUnselected) {
                            document.querySelector(`[data-testid="variant-list-${firstUnselected.id}"]`)
                              ?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                        data-testid="link-select-remaining"
                      >
                        Select remaining options first →
                      </button>
                    );
                  })()}
                </div>
              )}
            </SheetContent>
          </Sheet>
        );
      })()}
      {token && data?.trip?.clientId && (
        <ClientChatWidget
          tripId={id}
          shareToken={token}
          tripTitle={data.trip.title || "Your Trip"}
        />
      )}
    </div>
  );
}

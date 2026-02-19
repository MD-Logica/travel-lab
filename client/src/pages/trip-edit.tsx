import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, Plane, Ship, Hotel, Car, UtensilsCrossed, Activity,
  StickyNote, Clock, DollarSign, Hash, MoreVertical, Pencil, Trash2,
  Copy, Star, MapPin, Calendar,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SegmentEditor } from "@/components/segment-editor";
import type { Trip, TripVersion, TripSegment } from "@shared/schema";
import { format } from "date-fns";

type TripWithClient = Trip & { clientName: string | null };
type TripFull = { trip: TripWithClient; versions: TripVersion[] };

const segmentTypeConfig: Record<string, { label: string; icon: typeof Plane; color: string }> = {
  flight: { label: "Flight", icon: Plane, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  charter: { label: "Charter", icon: Ship, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  hotel: { label: "Hotel", icon: Hotel, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  transport: { label: "Transport", icon: Car, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  activity: { label: "Activity", icon: Activity, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  note: { label: "Note", icon: StickyNote, color: "text-muted-foreground bg-muted/60" },
};


function SegmentCard({
  segment,
  tripId,
  onEdit,
}: {
  segment: TripSegment;
  tripId: string;
  onEdit: (s: TripSegment) => void;
}) {
  const { toast } = useToast();
  const cfg = segmentTypeConfig[segment.type] || segmentTypeConfig.activity;
  const Icon = cfg.icon;

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

  const metaDetails: string[] = [];
  if (segment.type === "flight") {
    if (meta.flightNumber) metaDetails.push(meta.flightNumber);
    if (meta.airline) metaDetails.push(meta.airline);
    if (meta.departureAirport && meta.arrivalAirport) metaDetails.push(`${meta.departureAirport} → ${meta.arrivalAirport}`);
  } else if (segment.type === "charter") {
    if (meta.operator) metaDetails.push(meta.operator);
    if (meta.aircraftType) metaDetails.push(meta.aircraftType);
  } else if (segment.type === "hotel") {
    if (meta.roomType) metaDetails.push(meta.roomType);
    if (meta.starRating) metaDetails.push(`${"★".repeat(meta.starRating)}`);
  } else if (segment.type === "transport") {
    if (meta.transportType) metaDetails.push(meta.transportType.charAt(0).toUpperCase() + meta.transportType.slice(1));
    if (meta.provider) metaDetails.push(meta.provider);
  } else if (segment.type === "restaurant") {
    if (meta.cuisine) metaDetails.push(meta.cuisine);
    if (meta.dressCode) metaDetails.push(meta.dressCode);
  } else if (segment.type === "activity") {
    if (meta.provider) metaDetails.push(meta.provider);
    if (meta.duration) metaDetails.push(meta.duration);
  }

  const confNum = meta.confirmationNumber || segment.confirmationNumber;

  return (
    <Card className="group relative hover-elevate" data-testid={`card-segment-${segment.id}`}>
      <CardContent className="p-3 flex items-start gap-3">
        <div className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${cfg.color}`}>
          <Icon className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" data-testid={`text-segment-title-${segment.id}`}>{segment.title}</p>
              {(segment.subtitle || metaDetails.length > 0) && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {segment.subtitle || metaDetails.join(" · ")}
                </p>
              )}
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
            {(segment.startTime || segment.endTime) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {segment.startTime}{segment.endTime ? ` - ${segment.endTime}` : ""}
              </span>
            )}
            {confNum && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="w-3 h-3" strokeWidth={1.5} />
                {confNum}
              </span>
            )}
            {segment.cost != null && segment.cost > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="w-3 h-3" strokeWidth={1.5} />
                {segment.currency || "USD"} {segment.cost.toLocaleString()}
              </span>
            )}
          </div>
          {segment.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{segment.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TripEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<TripSegment | null>(null);
  const [addSegmentDay, setAddSegmentDay] = useState(1);

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

  const dayGroups = useMemo(() => {
    const groups = new Map<number, TripSegment[]>();
    for (const seg of segments) {
      if (!groups.has(seg.dayNumber)) groups.set(seg.dayNumber, []);
      groups.get(seg.dayNumber)!.push(seg);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [segments]);

  const maxDay = dayGroups.length > 0 ? Math.max(...dayGroups.map(([d]) => d)) : 0;

  const totalCost = useMemo(() => {
    return segments.reduce((sum, s) => sum + (s.cost || 0), 0);
  }, [segments]);

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

  const openAddSegment = (day: number) => {
    setEditingSegment(null);
    setAddSegmentDay(day);
    setSegmentDialogOpen(true);
  };

  const openEditSegment = (segment: TripSegment) => {
    setEditingSegment(segment);
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
            <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${id}`)} data-testid="button-back-trip-detail">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-serif text-lg md:text-xl tracking-tight truncate" data-testid="text-editor-trip-title">
                {trip.title}
              </h1>
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
                {trip.destination && (
                  <span>{trip.destination}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalCost > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-total-cost">
                <DollarSign className="w-3 h-3 mr-0.5" />
                {(trip.currency || "USD")} {totalCost.toLocaleString()}
              </Badge>
            )}
          </div>
        </div>

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
            onClick={() => {
              if (currentVersionId) duplicateVersionMutation.mutate(currentVersionId);
            }}
            disabled={duplicateVersionMutation.isPending}
            data-testid="button-add-version"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Version
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-6">
          {segmentsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : segments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-lg mb-1">Start building the itinerary</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                Add flights, hotels, activities, and more to create a day-by-day plan for your client.
              </p>
              <Button onClick={() => openAddSegment(1)} data-testid="button-add-first-segment">
                <Plus className="w-4 h-4 mr-1" /> Add First Segment
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {dayGroups.map(([dayNum, daySegments]) => (
                  <motion.div
                    key={dayNum}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    layout
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Day {dayNum}
                        </span>
                        {trip.startDate && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(new Date(trip.startDate).getTime() + (dayNum - 1) * 86400000), "EEE, MMM d")}
                          </span>
                        )}
                      </div>
                      <Separator className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => openAddSegment(dayNum)}
                        data-testid={`button-add-segment-day-${dayNum}`}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="space-y-2 pl-0 md:pl-4">
                      {daySegments.map((seg) => (
                        <SegmentCard
                          key={seg.id}
                          segment={seg}
                          tripId={id!}
                          onEdit={openEditSegment}
                        />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="flex items-center gap-3 pt-2">
                <Separator className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddSegment(maxDay + 1)}
                  data-testid="button-add-new-day"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Day {maxDay + 1}
                </Button>
                <Separator className="flex-1" />
              </div>
            </div>
          )}
        </div>
      </div>

      {currentVersionId && (
        <SegmentEditor
          key={editingSegment?.id || `new-${addSegmentDay}`}
          open={segmentDialogOpen}
          onOpenChange={setSegmentDialogOpen}
          tripId={id!}
          versionId={currentVersionId}
          existingSegment={editingSegment}
          defaultDay={addSegmentDay}
        />
      )}
    </div>
  );
}

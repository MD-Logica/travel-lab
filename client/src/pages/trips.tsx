import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, MapPin, Calendar, User,
  DollarSign, Clock, Plane,
} from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Trip } from "@shared/schema";
import { formatDestinationsShort } from "@shared/schema";
import { format, differenceInDays } from "date-fns";

type TripWithClient = Trip & { clientName: string | null };

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  planning: { label: "Planning", className: "bg-primary/10 text-primary" },
  confirmed: { label: "Confirmed", className: "bg-chart-2/10 text-chart-2" },
  in_progress: { label: "In Progress", className: "bg-chart-4/10 text-chart-4" },
  completed: { label: "Completed", className: "bg-chart-2/10 text-chart-2" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

const filterTabs = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const gradientClasses = [
  "from-amber-600/80 to-orange-400/60",
  "from-sky-600/80 to-cyan-400/60",
  "from-emerald-600/80 to-teal-400/60",
  "from-rose-600/80 to-pink-400/60",
  "from-violet-600/80 to-purple-400/60",
  "from-slate-600/80 to-zinc-400/60",
];

function getGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return gradientClasses[Math.abs(hash) % gradientClasses.length];
}

function getDuration(start: string | Date | null, end: string | Date | null): string | null {
  if (!start || !end) return null;
  const days = differenceInDays(new Date(end), new Date(start));
  if (days <= 0) return null;
  const nights = days;
  return `${nights} night${nights !== 1 ? "s" : ""}`;
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

type FlightStatusMap = Record<string, { count: number; hasActive: boolean }>;

function MobileTripRow({ trip, flightStatus }: { trip: TripWithClient; flightStatus?: { count: number; hasActive: boolean } }) {
  const cfg = statusConfig[trip.status] || statusConfig.draft;
  return (
    <Link href={`/trips/${trip.id}/edit`}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer border-b border-border/30 last:border-b-0"
        data-testid={`mobile-trip-${trip.id}`}
      >
        <div className="w-[72px] h-[72px] rounded-md overflow-hidden shrink-0">
          {trip.coverImageUrl ? (
            <img src={trip.coverImageUrl} alt={trip.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getGradient(trip.title)}`} />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-serif text-sm font-medium truncate flex-1">{trip.title}</h3>
            <Badge
              variant="secondary"
              className={`text-[9px] uppercase tracking-wider shrink-0 ${cfg.className} no-default-hover-elevate no-default-active-elevate`}
            >
              {cfg.label}
            </Badge>
          </div>
          {trip.clientName && (
            <p className="text-xs text-muted-foreground truncate">{trip.clientName}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {trip.startDate && (
              <span className="text-[11px] text-muted-foreground">
                {format(new Date(trip.startDate), "MMM d")}
                {trip.endDate && ` – ${format(new Date(trip.endDate), "MMM d")}`}
              </span>
            )}
            {flightStatus && flightStatus.hasActive && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {flightStatus.count} flight{flightStatus.count !== 1 ? "s" : ""} active
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TripsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const isMobile = useIsMobile();

  const { data: trips, isLoading } = useQuery<TripWithClient[]>({ queryKey: ["/api/trips"] });
  const { data: flightStatusMap } = useQuery<FlightStatusMap>({
    queryKey: ["/api/trips/flight-status"],
    refetchInterval: 60000,
  });

  const filtered = useMemo(() => {
    if (!trips) return [];
    return trips.filter((trip) => {
      const destStr = formatDestinationsShort((trip as any).destinations, trip.destination);
      const matchesSearch = !searchQuery ||
        trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        destStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = activeFilter === "all" || trip.status === activeFilter;
      return matchesSearch && matchesStatus;
    });
  }, [trips, searchQuery, activeFilter]);

  const statusCounts = useMemo(() => {
    if (!trips) return {};
    const counts: Record<string, number> = { all: trips.length };
    for (const trip of trips) {
      counts[trip.status] = (counts[trip.status] || 0) + 1;
    }
    return counts;
  }, [trips]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`max-w-6xl mx-auto ${isMobile ? 'px-4 py-4' : 'px-6 md:px-10 py-10 md:py-14'}`}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={isMobile ? "mb-4" : "mb-10"}
        >
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className={`font-serif tracking-tight ${isMobile ? 'text-2xl' : 'text-4xl md:text-5xl'}`} data-testid="text-trips-title">
                Trips
              </h1>
              {!isMobile && (
                <p className="text-muted-foreground mt-2 text-base">
                  {trips ? `${trips.length} trip${trips.length !== 1 ? "s" : ""}` : "Loading..."}
                </p>
              )}
            </div>
            {!isMobile && (
              <Link href="/trips/new">
                <Button variant="outline" size="sm" data-testid="button-new-trip">
                  <Plus className="w-3.5 h-3.5" />
                  New Trip
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={`flex flex-col gap-4 ${isMobile ? 'mb-4' : 'gap-5 mb-8'}`}
        >
          <div className={`relative ${isMobile ? 'w-full' : 'max-w-sm'}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
            <Input
              placeholder="Search trips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-border/50"
              data-testid="input-search-trips"
            />
          </div>

          <div className={`flex items-center gap-2 ${isMobile ? 'overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar' : 'flex-wrap'}`}>
            {filterTabs.map((tab) => {
              const count = statusCounts[tab.value] || 0;
              const isActive = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0
                    ${isActive
                      ? "bg-foreground text-background"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }
                  `}
                  data-testid={`button-filter-${tab.value}`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 ${isActive ? "opacity-70" : "opacity-50"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {isLoading ? (
          isMobile ? (
            <div className="space-y-0">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                  <Skeleton className="w-[72px] h-[72px] rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <Skeleton className="aspect-[16/10] rounded-t-md" />
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : filtered.length > 0 ? (
          isMobile ? (
            <Card className="overflow-visible">
              {filtered.map((trip) => (
                <MobileTripRow
                  key={trip.id}
                  trip={trip}
                  flightStatus={flightStatusMap?.[trip.id]}
                />
              ))}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((trip, i) => {
                const duration = getDuration(trip.startDate, trip.endDate);
                const cfg = statusConfig[trip.status] || statusConfig.draft;

                return (
                  <motion.div
                    key={trip.id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                  >
                    <Link href={`/trips/${trip.id}/edit`}>
                      <Card className="hover-elevate cursor-pointer h-full overflow-visible" data-testid={`card-trip-${trip.id}`}>
                        <div className="relative aspect-[16/10] overflow-hidden rounded-t-md">
                          {trip.coverImageUrl ? (
                            <img
                              src={trip.coverImageUrl}
                              alt={trip.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${getGradient(trip.title)}`} />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          <div className="absolute bottom-3 left-4 right-4">
                            <h3 className="text-white text-base font-medium line-clamp-1 drop-shadow-sm" data-testid={`text-trip-card-title-${trip.id}`}>
                              {trip.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <MapPin className="w-3 h-3 text-white/80 shrink-0" strokeWidth={1.5} />
                              <span className="text-white/80 text-xs truncate">{formatDestinationsShort((trip as any).destinations, trip.destination)}</span>
                            </div>
                          </div>
                          <div className="absolute top-3 right-3">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] uppercase tracking-wider ${cfg.className} no-default-hover-elevate no-default-active-elevate`}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>

                        <CardContent className="p-4 space-y-2.5">
                          {trip.clientName && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                              <span className="truncate" data-testid={`text-trip-client-${trip.id}`}>{trip.clientName}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-4 flex-wrap">
                            {trip.startDate && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                                <span>
                                  {format(new Date(trip.startDate), "MMM d")}
                                  {trip.endDate && ` - ${format(new Date(trip.endDate), "MMM d, yyyy")}`}
                                </span>
                              </div>
                            )}
                            {duration && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                                <span>{duration}</span>
                              </div>
                            )}
                          </div>

                          {trip.budget && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <DollarSign className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                              <span>{trip.currency} {trip.budget.toLocaleString()}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : searchQuery || activeFilter !== "all" ? (
          <div className="py-20 text-center">
            <p className="font-serif text-xl text-muted-foreground/50 mb-1 tracking-tight">
              No matching trips
            </p>
            <p className="text-sm text-muted-foreground/40">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="py-24 text-center">
            <p className="font-serif text-3xl text-muted-foreground/40 mb-2 tracking-tight" data-testid="text-empty-state">
              Your journeys begin here.
            </p>
            <p className="text-sm text-muted-foreground/35 mb-8 max-w-md mx-auto">
              Create your first trip to start planning extraordinary travel experiences.
            </p>
            <Link href="/trips/new">
              <Button variant="outline" data-testid="button-create-first-trip-empty">
                <Plus className="w-4 h-4" />
                Create Your First Trip
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plane, CircleCheck, Plus, Calendar, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Trip, Profile } from "@shared/schema";
import { format } from "date-fns";

type RecentTrip = Trip & { clientName: string | null };
type DashboardStats = {
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  totalClients: number;
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  planning: "Planning",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const destinationGradients = [
  "from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20",
  "from-sky-100 to-cyan-50 dark:from-sky-900/30 dark:to-cyan-900/20",
  "from-emerald-100 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20",
  "from-rose-100 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/20",
  "from-violet-100 to-indigo-50 dark:from-violet-900/30 dark:to-indigo-900/20",
  "from-lime-100 to-green-50 dark:from-lime-900/30 dark:to-green-900/20",
];

function getGradientForDestination(dest: string): string {
  let hash = 0;
  for (let i = 0; i < dest.length; i++) {
    hash = dest.charCodeAt(i) + ((hash << 5) - hash);
  }
  return destinationGradients[Math.abs(hash) % destinationGradients.length];
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery<Profile>({ queryKey: ["/api/profile"] });
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });
  const { data: recentTrips, isLoading: tripsLoading } = useQuery<RecentTrip[]>({
    queryKey: ["/api/recent-trips"],
  });

  const firstName = profile?.fullName?.split(" ")[0] || user?.firstName || "there";
  const greeting = getGreeting();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 md:py-14">

        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="mb-12">
          <h1
            className="font-serif text-4xl md:text-5xl tracking-tight leading-tight"
            data-testid="text-dashboard-greeting"
          >
            {greeting}, {firstName}.
          </h1>
          <p className="text-muted-foreground mt-2 text-base" data-testid="text-dashboard-subtitle">
            Here's what's happening across your trips today.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-14">
          {[
            {
              label: "Clients",
              value: stats?.totalClients ?? 0,
              icon: Users,
            },
            {
              label: "Active Trips",
              value: stats?.activeTrips ?? 0,
              icon: Plane,
            },
            {
              label: "Completed",
              value: stats?.completedTrips ?? 0,
              icon: CircleCheck,
            },
          ].map((stat, i) => (
            <motion.div key={stat.label} custom={i + 1} initial="hidden" animate="visible" variants={fadeUp}>
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                      {stat.label}
                    </span>
                    <stat.icon className="w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-10 w-14" />
                  ) : (
                    <p
                      className="font-serif text-4xl tracking-tight"
                      data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      {stat.value}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="font-serif text-2xl tracking-tight" data-testid="text-recent-trips-title">
                Recent Trips
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Your latest travel plans</p>
            </div>
            <Button variant="outline" size="sm" asChild data-testid="button-new-trip-dashboard">
              <Link href="/trips?new=true">
                <Plus className="w-3.5 h-3.5" />
                New Trip
              </Link>
            </Button>
          </div>

          {tripsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="border-border/40 overflow-visible">
                  <Skeleton className="h-[180px] w-full rounded-t-md" />
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-3" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentTrips && recentTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentTrips.map((trip, i) => (
                <motion.div key={trip.id} custom={i + 5} initial="hidden" animate="visible" variants={fadeUp}>
                  <Link href={`/trips/${trip.id}/edit`}>
                    <Card
                      className="hover-elevate cursor-pointer border-border/40 overflow-visible group"
                      data-testid={`card-trip-${trip.id}`}
                    >
                      <div className="relative h-[180px] overflow-hidden rounded-t-md">
                        {trip.coverImageUrl ? (
                          <img
                            src={trip.coverImageUrl}
                            alt={trip.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div
                            className={`w-full h-full bg-gradient-to-br ${getGradientForDestination(trip.destination)} flex items-end p-5`}
                          >
                            <span className="font-serif text-lg text-foreground/40 tracking-tight">
                              {trip.destination}
                            </span>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-5">
                        <h3
                          className="font-serif text-base tracking-tight truncate mb-1"
                          data-testid={`text-trip-title-${trip.id}`}
                        >
                          {trip.title}
                        </h3>
                        {trip.clientName && (
                          <p className="text-xs text-muted-foreground mb-2 truncate" data-testid={`text-trip-client-${trip.id}`}>
                            {trip.clientName}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-3 mt-3">
                          {trip.startDate ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <Calendar className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                              <span className="truncate">
                                {format(new Date(trip.startDate), "MMM d")}
                                {trip.endDate && ` – ${format(new Date(trip.endDate), "MMM d, yyyy")}`}
                              </span>
                            </div>
                          ) : (
                            <span />
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wider shrink-0 font-normal border-border/60"
                            data-testid={`badge-trip-status-${trip.id}`}
                          >
                            {statusLabels[trip.status] || trip.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="font-serif text-2xl text-muted-foreground/60 mb-2 tracking-tight">
                No trips yet
              </p>
              <p className="text-sm text-muted-foreground/50 mb-6 max-w-sm mx-auto">
                Create your first trip to start building beautiful itineraries for your clients.
              </p>
              <Button variant="outline" asChild data-testid="button-create-first-trip">
                <Link href="/trips?new=true">
                  <Plus className="w-4 h-4" />
                  Create a Trip
                </Link>
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

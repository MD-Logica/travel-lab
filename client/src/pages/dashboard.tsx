import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, Users, TrendingUp, Plus, Calendar, ArrowRight, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Trip, Organization, Profile } from "@shared/schema";
import { format } from "date-fns";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  planning: "bg-primary/10 text-primary",
  confirmed: "bg-chart-2/10 text-chart-2",
  in_progress: "bg-chart-4/10 text-chart-4",
  completed: "bg-chart-2/10 text-chart-2",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery<Profile>({ queryKey: ["/api/profile"] });
  const { data: org } = useQuery<Organization>({ queryKey: ["/api/organization"] });
  const { data: trips, isLoading: tripsLoading } = useQuery<Trip[]>({ queryKey: ["/api/trips"] });
  const { data: stats } = useQuery<{ totalTrips: number; activeTrips: number; totalClients: number }>({
    queryKey: ["/api/stats"],
  });

  const recentTrips = trips?.slice(0, 4) || [];
  const greeting = getGreeting();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{greeting}</p>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight" data-testid="text-dashboard-welcome">
            {profile?.fullName || user?.firstName || "Welcome back"}
          </h1>
          {org && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-dashboard-org">
              {org.name}
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Trips", value: stats?.totalTrips ?? 0, icon: Map, color: "text-primary" },
            { label: "Active Trips", value: stats?.activeTrips ?? 0, icon: TrendingUp, color: "text-chart-2" },
            { label: "Clients", value: stats?.totalClients ?? 0, icon: Users, color: "text-chart-3" },
          ].map((stat, i) => (
            <motion.div key={stat.label} custom={i + 1} initial="hidden" animate="visible" variants={fadeUp}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} strokeWidth={1.5} />
                  </div>
                  {stats ? (
                    <p className="font-serif text-3xl" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
                      {stat.value}
                    </p>
                  ) : (
                    <Skeleton className="h-9 w-16" />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-serif text-xl" data-testid="text-recent-trips-title">Recent Trips</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your latest travel plans</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/trips" data-testid="link-view-all-trips">
                  View All
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/trips?new=true" data-testid="button-new-trip-dashboard">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Trip
                </Link>
              </Button>
            </div>
          </div>

          {tripsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentTrips.map((trip, i) => (
                <motion.div key={trip.id} custom={i + 5} initial="hidden" animate="visible" variants={fadeUp}>
                  <Link href={`/trips/${trip.id}`}>
                    <Card className="hover-elevate cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm truncate" data-testid={`text-trip-title-${trip.id}`}>
                              {trip.title}
                            </h3>
                            <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                              <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                              <span className="text-xs truncate">{trip.destination}</span>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] uppercase tracking-wider shrink-0 ${statusColors[trip.status] || ''}`}
                            data-testid={`badge-trip-status-${trip.id}`}
                          >
                            {trip.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {trip.startDate && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            <span>
                              {format(new Date(trip.startDate), "MMM d, yyyy")}
                              {trip.endDate && ` — ${format(new Date(trip.endDate), "MMM d, yyyy")}`}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Map className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-lg mb-2">No trips yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first trip to get started.</p>
                <Button asChild>
                  <Link href="/trips?new=true" data-testid="button-create-first-trip">
                    <Plus className="w-4 h-4 mr-1" />
                    Create Trip
                  </Link>
                </Button>
              </CardContent>
            </Card>
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

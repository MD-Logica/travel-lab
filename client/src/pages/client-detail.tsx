import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Mail, Phone, Plane, Calendar, FileText } from "lucide-react";
import { Link, useParams } from "wouter";
import type { Client, Trip } from "@shared/schema";
import { format } from "date-fns";

const avatarColors = [
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
  });

  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  const clientTrips = trips?.filter((t) => t.clientId === id) || [];

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-10">
          <Skeleton className="h-5 w-24 mb-8" />
          <div className="flex items-center gap-5 mb-10">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-10">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clients">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Clients
            </Link>
          </Button>
          <div className="py-20 text-center">
            <p className="font-serif text-2xl text-muted-foreground/50">Client not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Button variant="ghost" size="sm" asChild className="mb-8" data-testid="button-back-clients">
            <Link href="/clients">
              <ArrowLeft className="w-3.5 h-3.5" />
              Clients
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="flex items-start gap-5 mb-10"
        >
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className={`text-lg font-medium ${getAvatarColor(client.fullName)}`}>
              {getInitials(client.fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight" data-testid="text-client-detail-name">
              {client.fullName}
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {client.email && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span data-testid="text-client-detail-email">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span data-testid="text-client-detail-phone">{client.phone}</span>
                </div>
              )}
            </div>
            {client.tags && client.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {client.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] font-normal border-border/50 no-default-hover-elevate no-default-active-elevate"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {client.notes && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-10"
          >
            <Card className="border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Notes</span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap" data-testid="text-client-detail-notes">
                  {client.notes}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Plane className="w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
            <h2 className="font-serif text-xl tracking-tight" data-testid="text-client-trips-title">
              Trips
            </h2>
            <span className="text-xs text-muted-foreground ml-1">({clientTrips.length})</span>
          </div>

          {clientTrips.length > 0 ? (
            <div className="space-y-3">
              {clientTrips.map((trip) => (
                <Link key={trip.id} href={`/trips/${trip.id}`}>
                  <Card className="hover-elevate cursor-pointer border-border/40" data-testid={`card-client-trip-${trip.id}`}>
                    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <h3 className="font-serif text-sm tracking-tight truncate">{trip.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{trip.destination}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {trip.startDate && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            <span>{format(new Date(trip.startDate), "MMM d, yyyy")}</span>
                          </div>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider font-normal border-border/60"
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
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground/50">No trips for this client yet.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Plus, Search, MapPin, Calendar, Filter,
  ArrowRight, DollarSign, X,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Trip } from "@shared/schema";
import { format } from "date-fns";

const tripFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  destination: z.string().min(1, "Destination is required"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.string().optional(),
  currency: z.string().default("USD"),
  status: z.string().default("draft"),
});

type TripFormData = z.infer<typeof tripFormSchema>;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  planning: "bg-primary/10 text-primary",
  confirmed: "bg-chart-2/10 text-chart-2",
  in_progress: "bg-chart-4/10 text-chart-4",
  completed: "bg-chart-2/10 text-chart-2",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function TripsPage() {
  const { toast } = useToast();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [showNewTrip, setShowNewTrip] = useState(params.get("new") === "true");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: trips, isLoading } = useQuery<Trip[]>({ queryKey: ["/api/trips"] });

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: "",
      destination: "",
      description: "",
      startDate: "",
      endDate: "",
      budget: "",
      currency: "USD",
      status: "draft",
    },
  });

  const createTripMutation = useMutation({
    mutationFn: async (data: TripFormData) => {
      const payload: any = {
        title: data.title,
        destination: data.destination,
        description: data.description || null,
        status: data.status,
        currency: data.currency,
        budget: data.budget ? parseInt(data.budget) : null,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };
      const res = await apiRequest("POST", "/api/trips", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setShowNewTrip(false);
      form.reset();
      toast({ title: "Trip created", description: "Your new trip has been added." });
    },
    onError: (error: Error) => {
      try {
        const parsed = JSON.parse(error.message.split(": ").slice(1).join(": "));
        if (parsed.upgrade) {
          toast({
            title: "Plan limit reached",
            description: `You've reached the maximum of ${parsed.limit} trips on your current plan. Upgrade to create more.`,
            variant: "destructive",
          });
          return;
        }
      } catch {}
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredTrips = (trips || []).filter((trip) => {
    const matchesSearch = !searchQuery ||
      trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || trip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-4 mb-6"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Manage</p>
            <h1 className="font-serif text-3xl tracking-tight" data-testid="text-trips-title">Trips</h1>
          </div>
          <Button onClick={() => setShowNewTrip(true)} data-testid="button-new-trip">
            <Plus className="w-4 h-4 mr-1" />
            New Trip
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="Search trips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-trips"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <Filter className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTrips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTrips.map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Link href={`/trips/${trip.id}`}>
                  <Card className="hover-elevate cursor-pointer h-full">
                    {trip.coverImageUrl && (
                      <div className="aspect-[16/9] overflow-hidden rounded-t-md">
                        <img src={trip.coverImageUrl} alt={trip.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-medium text-sm line-clamp-1" data-testid={`text-trip-card-title-${trip.id}`}>
                          {trip.title}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] uppercase tracking-wider shrink-0 ${statusColors[trip.status] || ''}`}
                        >
                          {trip.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                        <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                        <span className="text-xs truncate">{trip.destination}</span>
                      </div>
                      {trip.startDate && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          <Calendar className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                          <span>
                            {format(new Date(trip.startDate), "MMM d")}
                            {trip.endDate && ` — ${format(new Date(trip.endDate), "MMM d, yyyy")}`}
                          </span>
                        </div>
                      )}
                      {trip.budget && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <DollarSign className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                          <span>{trip.currency} {trip.budget.toLocaleString()}</span>
                        </div>
                      )}
                      {trip.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{trip.description}</p>
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
                <MapPin className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-lg mb-2">
                {searchQuery || statusFilter !== "all" ? "No matching trips" : "No trips yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Create your first trip to begin planning."}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setShowNewTrip(true)} data-testid="button-create-first-trip-empty">
                  <Plus className="w-4 h-4 mr-1" />
                  Create Trip
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={showNewTrip} onOpenChange={setShowNewTrip}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">New Trip</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createTripMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trip Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Amalfi Coast Honeymoon" data-testid="input-trip-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Italy" data-testid="input-trip-destination" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this trip..."
                          className="resize-none"
                          rows={3}
                          data-testid="input-trip-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-trip-start-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-trip-end-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5000" data-testid="input-trip-budget" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-trip-status">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewTrip(false)} data-testid="button-cancel-trip">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTripMutation.isPending} data-testid="button-submit-trip">
                    {createTripMutation.isPending ? "Creating..." : "Create Trip"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

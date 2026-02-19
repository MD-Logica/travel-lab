import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  ArrowLeft, MapPin, Calendar, DollarSign, Edit2, Save, X, Trash2, Layers,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Trip } from "@shared/schema";
import { format } from "date-fns";

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

const editSchema = z.object({
  title: z.string().min(1),
  destination: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.string().optional(),
  currency: z.string().default("USD"),
  status: z.string(),
  notes: z.string().optional(),
});

type EditData = z.infer<typeof editSchema>;

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const { data: trip, isLoading } = useQuery<Trip>({
    queryKey: ["/api/trips", id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const form = useForm<EditData>({
    resolver: zodResolver(editSchema),
    values: trip ? {
      title: trip.title,
      destination: trip.destination,
      description: trip.description || "",
      startDate: trip.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : "",
      endDate: trip.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : "",
      budget: trip.budget?.toString() || "",
      currency: trip.currency || "USD",
      status: trip.status,
      notes: trip.notes || "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditData) => {
      const payload: any = {
        title: data.title,
        destination: data.destination,
        description: data.description || null,
        status: data.status,
        currency: data.currency,
        budget: data.budget ? parseInt(data.budget) : null,
        notes: data.notes || null,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };
      const res = await apiRequest("PATCH", `/api/trips/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      setEditing(false);
      toast({ title: "Trip updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/trips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      navigate("/trips");
      toast({ title: "Trip deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-6 w-64 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl mb-2">Trip not found</h2>
          <Button variant="outline" onClick={() => navigate("/trips")} data-testid="button-back-trips">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Trips
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/trips")} data-testid="button-back-to-trips">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Trips
            </Button>
          </div>

          {editing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input data-testid="input-edit-title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="destination" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <FormControl><Input data-testid="input-edit-destination" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea className="resize-none" rows={3} data-testid="input-edit-description" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="budget" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {statusOptions.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea className="resize-none" rows={4} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-trip">
                    <Save className="w-4 h-4 mr-1" />
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="font-serif text-3xl tracking-tight" data-testid="text-trip-detail-title">{trip.title}</h1>
                    <Badge variant="secondary" className={`text-[10px] uppercase tracking-wider ${statusColors[trip.status] || ''}`}>
                      {trip.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {trip.destination}
                    </span>
                    {trip.startDate && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {format(new Date(trip.startDate), "MMM d, yyyy")}
                        {trip.endDate && ` — ${format(new Date(trip.endDate), "MMM d, yyyy")}`}
                      </span>
                    )}
                    {trip.budget && (
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {trip.currency} {trip.budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => navigate(`/trips/${id}/edit`)} data-testid="button-design-itinerary">
                    <Layers className="w-3.5 h-3.5 mr-1" /> Design Itinerary
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-trip">
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { if (confirm("Delete this trip?")) deleteMutation.mutate(); }}
                    data-testid="button-delete-trip"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>

              {trip.description && (
                <Card className="mb-4">
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Description</p>
                    <p className="text-sm leading-relaxed">{trip.description}</p>
                  </CardContent>
                </Card>
              )}

              {trip.notes && (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{trip.notes}</p>
                  </CardContent>
                </Card>
              )}

              {!trip.description && !trip.notes && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">No description or notes yet.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Add details
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

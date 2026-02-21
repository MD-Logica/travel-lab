import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/currency-input";
import { DestinationInput } from "@/components/destination-input";
import type { DestinationEntry } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, MapPin, Calendar, DollarSign, Image,
  User, Search, Check,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

const tripFormSchema = z.object({
  title: z.string().min(1, "Trip title is required"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.string().optional(),
  currency: z.string().default("USD"),
  status: z.string().default("draft"),
  coverImageUrl: z.string().optional(),
  clientId: z.string().optional(),
});

type TripFormData = z.infer<typeof tripFormSchema>;

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
];

const currencyOptions = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CHF", label: "CHF" },
  { value: "AUD", label: "AUD" },
  { value: "CAD", label: "CAD" },
  { value: "JPY", label: "JPY" },
];

export default function TripNewPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedClientId = params.get("clientId") || "";

  const [clientSearch, setClientSearch] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [destinations, setDestinations] = useState<DestinationEntry[]>([]);
  const [destinationError, setDestinationError] = useState("");
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);
  const [photoSearchQuery, setPhotoSearchQuery] = useState("luxury travel");
  const [photoSearchInput, setPhotoSearchInput] = useState("");
  const [coverTab, setCoverTab] = useState("suggest");
  const [storedPhotoCredit, setStoredPhotoCredit] = useState<{ name: string; url: string } | null>(null);

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      budget: "",
      currency: "USD",
      status: "draft",
      coverImageUrl: "",
      clientId: preselectedClientId,
    },
  });

  const selectedClientId = form.watch("clientId");
  const coverImageUrl = form.watch("coverImageUrl");

  const selectedClient = useMemo(() => {
    if (!selectedClientId || !clients) return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [selectedClientId, clients]);

  const { data: companions } = useQuery<any[]>({
    queryKey: [`/api/clients/${selectedClientId}/companions`],
    enabled: !!selectedClientId,
  });

  useEffect(() => {
    setSelectedCompanions([]);
  }, [selectedClientId]);

  useEffect(() => {
    const query = destinations[0]?.name || "luxury travel";
    setPhotoSearchQuery(query);
  }, [destinations.length > 0 ? destinations[0]?.name : ""]);

  const photoSearchUrl = `/api/photos/search?q=${encodeURIComponent(photoSearchQuery)}&count=6`;
  const { data: photoData, isLoading: photoLoading } = useQuery<{ photos: any[] }>({
    queryKey: [photoSearchUrl],
  });
  const photoResults = photoData?.photos || [];

  const photoCredit = useMemo(() => {
    if (!coverImageUrl) return null;
    const match = photoResults.find((p: any) => p.full === coverImageUrl);
    if (match) return { name: match.credit, url: match.creditUrl };
    if (storedPhotoCredit && coverImageUrl.includes("unsplash.com")) return storedPhotoCredit;
    return null;
  }, [coverImageUrl, photoResults, storedPhotoCredit]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c) =>
      c.fullName.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  const createTripMutation = useMutation({
    mutationFn: async (data: TripFormData) => {
      const destinationStr = destinations.map(d => d.name).join(", ") || "TBD";
      const payload: any = {
        title: data.title,
        destination: destinationStr,
        destinations,
        description: data.description || null,
        status: data.status,
        currency: data.currency,
        budget: data.budget ? parseInt(data.budget) : null,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        coverImageUrl: data.coverImageUrl || null,
        clientId: data.clientId || null,
        additionalClientIds: selectedCompanions.length > 0 ? selectedCompanions : undefined,
      };
      const res = await apiRequest("POST", "/api/trips", payload);
      return res.json();
    },
    onSuccess: (trip: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Trip created", description: "Your new trip has been added." });
      navigate(`/trips/${trip.id}/edit`);
    },
    onError: (error: Error) => {
      try {
        const parsed = JSON.parse(error.message.split(": ").slice(1).join(": "));
        if (parsed.upgrade) {
          toast({
            title: "Plan limit reached",
            description: `You've reached the maximum trips on your current plan. Upgrade to create more.`,
            variant: "destructive",
          });
          return;
        }
      } catch {}
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <Link href="/trips">
            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 transition-colors hover:text-foreground"
              data-testid="button-back-to-trips"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              Back to Trips
            </button>
          </Link>

          <h1 className="font-serif text-3xl md:text-4xl tracking-tight" data-testid="text-new-trip-title">
            New Trip
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Plan an extraordinary travel experience.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Card>
            <CardContent className="p-6 md:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => {
                  if (destinations.length === 0) {
                    setDestinationError("At least one destination is required");
                    return;
                  }
                  setDestinationError("");
                  createTripMutation.mutate(d);
                })} className="space-y-8">

                  {coverImageUrl && (
                    <div className="relative aspect-[21/9] overflow-hidden rounded-md">
                      <img
                        src={coverImageUrl}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
                        Essentials
                      </p>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Trip Title</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g. Amalfi Coast Honeymoon"
                                  data-testid="input-trip-title"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div>
                          <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2 font-medium">
                            <MapPin className="w-3 h-3" strokeWidth={1.5} />
                            Destinations
                          </label>
                          <DestinationInput
                            value={destinations}
                            onChange={(d) => { setDestinations(d); if (d.length > 0) setDestinationError(""); }}
                            placeholder="Search cities or type freely..."
                            testId="input-trip-destination"
                          />
                          {destinationError && (
                            <p className="text-xs text-destructive mt-1.5">{destinationError}</p>
                          )}
                        </div>

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Description</FormLabel>
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
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4 flex items-center gap-1.5">
                        <User className="w-3 h-3" strokeWidth={1.5} />
                        Client
                      </p>
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start font-normal"
                                    data-testid="button-select-client"
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
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="start">
                                <div className="p-2 border-b border-border/50">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                                    <Input
                                      placeholder="Search clients..."
                                      value={clientSearch}
                                      onChange={(e) => setClientSearch(e.target.value)}
                                      className="pl-8 border-0 focus-visible:ring-0 shadow-none"
                                      data-testid="input-search-client-dropdown"
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto p-1">
                                  {field.value && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        field.onChange("");
                                        setClientPopoverOpen(false);
                                        setClientSearch("");
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs text-muted-foreground rounded-md hover-elevate"
                                      data-testid="button-clear-client"
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
                                          field.onChange(client.id);
                                          setClientPopoverOpen(false);
                                          setClientSearch("");
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-md hover-elevate flex items-center justify-between gap-2"
                                        data-testid={`button-client-option-${client.id}`}
                                      >
                                        <div>
                                          <p className="text-sm font-medium">{client.fullName}</p>
                                          {client.email && (
                                            <p className="text-xs text-muted-foreground">{client.email}</p>
                                          )}
                                        </div>
                                        {field.value === client.id && (
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {companions && companions.length > 0 && (
                        <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2" data-testid="companion-suggestions">
                          <p className="text-xs text-muted-foreground">
                            {selectedClient?.fullName} often travels with:
                          </p>
                          {companions.map((rel: any) => (
                            <label key={rel.id} className="flex items-center gap-2.5 cursor-pointer py-0.5">
                              <Checkbox
                                checked={selectedCompanions.includes(rel.companion.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedCompanions(prev =>
                                    checked
                                      ? [...prev, rel.companion.id]
                                      : prev.filter(id => id !== rel.companion.id)
                                  );
                                }}
                                data-testid={`checkbox-companion-${rel.companion.id}`}
                              />
                              <span className="text-sm">{rel.companion.fullName}</span>
                              {rel.relationshipLabel && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {rel.relationshipLabel}
                                </Badge>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" strokeWidth={1.5} />
                        Dates
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Start</FormLabel>
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
                              <FormLabel className="text-xs text-muted-foreground">End</FormLabel>
                              <FormControl>
                                <Input type="date" data-testid="input-trip-end-date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4 flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3" strokeWidth={1.5} />
                        Budget & Status
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="budget"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Budget</FormLabel>
                              <FormControl>
                                <CurrencyInput
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  currency={form.getValues("currency") || "USD"}
                                  placeholder="10,000"
                                  testId="input-trip-budget"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Currency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-trip-currency">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {currencyOptions.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-trip-status">
                                    <SelectValue />
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
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4 flex items-center gap-1.5">
                        <Image className="w-3 h-3" strokeWidth={1.5} />
                        Cover Image
                      </p>
                      <Tabs value={coverTab} onValueChange={setCoverTab}>
                        <TabsList className="w-full mb-3">
                          <TabsTrigger value="suggest" className="flex-1 text-xs" data-testid="tab-suggest-photos">Suggest photos</TabsTrigger>
                          <TabsTrigger value="custom" className="flex-1 text-xs" data-testid="tab-custom-url">Custom URL</TabsTrigger>
                        </TabsList>

                        <TabsContent value="suggest" className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search photos (e.g. 'Amalfi Coast sunset')"
                              className="pl-8 text-sm"
                              value={photoSearchInput}
                              onChange={(e) => setPhotoSearchInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (photoSearchInput.trim()) setPhotoSearchQuery(photoSearchInput.trim());
                                }
                              }}
                              data-testid="input-photo-search"
                            />
                          </div>

                          {photoLoading ? (
                            <div className="grid grid-cols-3 gap-2">
                              {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-[16/10] rounded-md" />
                              ))}
                            </div>
                          ) : photoResults.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2" data-testid="photo-grid">
                              {photoResults.map((photo) => {
                                const isSelected = coverImageUrl === photo.full;
                                return (
                                  <button
                                    key={photo.id}
                                    type="button"
                                    className={`relative aspect-[16/10] rounded-md overflow-hidden border-2 transition-all cursor-pointer group ${
                                      isSelected
                                        ? "border-primary ring-2 ring-primary/30"
                                        : "border-transparent hover:border-muted-foreground/20"
                                    }`}
                                    onClick={() => {
                                      form.setValue("coverImageUrl", photo.full);
                                      setStoredPhotoCredit({ name: photo.credit, url: photo.creditUrl });
                                    }}
                                    data-testid={`photo-option-${photo.id}`}
                                  >
                                    <img
                                      src={photo.thumb}
                                      alt={photo.altDescription || "Cover option"}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                          <Check className="w-3.5 h-3.5 text-white" />
                                        </div>
                                      </div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <p className="text-[9px] text-white truncate">{photo.credit}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-sm text-muted-foreground" data-testid="text-no-photos">
                              No photos found. Try a different search term.
                            </div>
                          )}

                          {photoCredit && coverImageUrl && (
                            <p className="text-[10px] text-muted-foreground" data-testid="text-photo-attribution">
                              Photo by{" "}
                              <a href={photoCredit.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground" data-testid="link-photo-credit">
                                {photoCredit.name}
                              </a>
                              {" "}on{" "}
                              <a href="https://unsplash.com?utm_source=travel_lab&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground" data-testid="link-unsplash">
                                Unsplash
                              </a>
                            </p>
                          )}
                        </TabsContent>

                        <TabsContent value="custom">
                          <FormField
                            control={form.control}
                            name="coverImageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-muted-foreground">Image URL</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://images.unsplash.com/..."
                                    data-testid="input-trip-cover-image"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {coverImageUrl && coverTab === "custom" && (
                            <div className="mt-3 aspect-[16/10] overflow-hidden rounded-md border">
                              <img
                                src={coverImageUrl}
                                alt="Custom cover preview"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                data-testid="img-custom-cover-preview"
                              />
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/30">
                    <Link href="/trips">
                      <Button type="button" variant="ghost" data-testid="button-cancel-trip">
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      disabled={createTripMutation.isPending}
                      data-testid="button-submit-trip"
                    >
                      {createTripMutation.isPending ? "Creating..." : "Create Trip"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

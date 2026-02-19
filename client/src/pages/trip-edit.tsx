import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Plane, Ship, Hotel, Car, UtensilsCrossed, Activity,
  StickyNote, Clock, DollarSign, Hash, MoreVertical, Pencil, Trash2,
  Copy, Star, MapPin, Calendar, User, ChevronRight, Heart,
  Upload, Download, Eye, EyeOff, File, Image, Loader2, FileText, X,
  ChevronDown, RefreshCw, Bookmark, Check,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SegmentEditor, type TemplateData } from "@/components/segment-editor";
import type { Trip, TripVersion, TripSegment, Client, TripDocument, FlightTracking } from "@shared/schema";
import { format, addDays, differenceInDays } from "date-fns";

type TripWithClient = Trip & { clientName: string | null };
type TripFull = { trip: TripWithClient; versions: TripVersion[] };

interface FlightStatusInfo {
  status: string;
  departureDelay?: number;
  departureGate?: string;
  departureTerminal?: string;
  arrivalAirport?: string;
  departureAirport?: string;
}

const flightStatusConfig: Record<string, { label: string; dotClass: string }> = {
  scheduled: { label: "Scheduled", dotClass: "bg-muted-foreground" },
  on_time: { label: "On Time", dotClass: "bg-emerald-500" },
  delayed: { label: "Delayed", dotClass: "bg-amber-500" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-500" },
  departed: { label: "Departed", dotClass: "bg-emerald-500" },
  landed: { label: "Landed", dotClass: "bg-sky-500" },
  unknown: { label: "Unknown", dotClass: "bg-muted-foreground" },
};

function checkedTimeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "Checked just now";
  if (diffMin < 60) return `Checked ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `Checked ${diffHr}h ago`;
}

const segmentTypeConfig: Record<string, { label: string; icon: typeof Plane; color: string }> = {
  flight: { label: "Flight", icon: Plane, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  charter: { label: "Charter", icon: Ship, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  hotel: { label: "Hotel", icon: Hotel, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  transport: { label: "Transport", icon: Car, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  activity: { label: "Activity", icon: Activity, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  note: { label: "Note", icon: StickyNote, color: "text-muted-foreground bg-muted/60" },
};

const tripStatusOptions = [
  { value: "draft", label: "Draft", className: "bg-muted text-muted-foreground" },
  { value: "planning", label: "Planning", className: "bg-primary/10 text-primary" },
  { value: "confirmed", label: "Confirmed", className: "bg-chart-2/10 text-chart-2" },
  { value: "in_progress", label: "In Progress", className: "bg-chart-4/10 text-chart-4" },
  { value: "completed", label: "Completed", className: "bg-chart-2/10 text-chart-2" },
  { value: "cancelled", label: "Cancelled", className: "bg-destructive/10 text-destructive" },
];

function deriveSegmentTitle(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case "flight":
      return [metadata.airline, metadata.flightNumber].filter(Boolean).join(" ") ||
        [metadata.departureAirport, metadata.arrivalAirport].filter(Boolean).join(" to ") ||
        "Flight";
    case "charter":
      return metadata.operator || metadata.aircraftType || "Charter";
    case "hotel":
      return metadata.hotelName || "Hotel Stay";
    case "transport":
      return metadata.provider || (metadata.transportType ? metadata.transportType.charAt(0).toUpperCase() + metadata.transportType.slice(1) : "") || "Transfer";
    case "restaurant":
      return metadata.restaurantName || "Restaurant";
    case "activity":
      return metadata.activityName || metadata.provider || "Activity";
    default:
      return "";
  }
}

function deriveSegmentSubtitle(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case "flight":
      return metadata.departureAirport && metadata.arrivalAirport
        ? `${metadata.departureAirport} to ${metadata.arrivalAirport}`
        : "";
    case "charter":
      return [metadata.departureLocation, metadata.arrivalLocation].filter(Boolean).join(" to ");
    case "hotel":
      return [metadata.roomType, metadata.starRating ? "\u2605".repeat(metadata.starRating) : ""].filter(Boolean).join(" \u00b7 ");
    case "transport":
      return [metadata.transportType ? metadata.transportType.charAt(0).toUpperCase() + metadata.transportType.slice(1) : "", metadata.vehicleType].filter(Boolean).join(" \u00b7 ");
    case "restaurant":
      return [metadata.cuisine, metadata.partySize ? `${metadata.partySize} guests` : ""].filter(Boolean).join(" \u00b7 ");
    case "activity":
      return [metadata.category ? metadata.category.charAt(0).toUpperCase() + metadata.category.slice(1) : "", metadata.duration].filter(Boolean).join(" \u00b7 ");
    case "note":
      return metadata.noteType ? metadata.noteType.charAt(0).toUpperCase() + metadata.noteType.slice(1) : "";
    default:
      return "";
  }
}


function SegmentCard({
  segment,
  tripId,
  onEdit,
  tracking,
  showPricing = false,
}: {
  segment: TripSegment;
  tripId: string;
  onEdit: (s: TripSegment) => void;
  tracking?: FlightTracking | null;
  showPricing?: boolean;
}) {
  const { toast } = useToast();
  const cfg = segmentTypeConfig[segment.type] || segmentTypeConfig.activity;
  const Icon = cfg.icon;

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/flight-tracking/${segment.id}/refresh`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "flight-tracking"] });
      toast({ title: "Flight status updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not refresh", description: e.message, variant: "destructive" });
    },
  });

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
  const confNum = meta.confirmationNumber || segment.confirmationNumber;
  const displayTitle = segment.type === "note"
    ? (segment.title || "Note")
    : (deriveSegmentTitle(segment.type, meta) || segment.title || cfg.label);
  const displaySubtitle = segment.type === "note"
    ? ""
    : (deriveSegmentSubtitle(segment.type, meta) || segment.subtitle || "");

  return (
    <Card className="group relative hover-elevate" data-testid={`card-segment-${segment.id}`}>
      <CardContent className="p-3 flex items-start gap-3">
        <div className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${cfg.color}`}>
          <Icon className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" data-testid={`text-segment-title-${segment.id}`}>{displayTitle}</p>
              {displaySubtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {displaySubtitle}
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
            {showPricing && segment.cost != null && segment.cost > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="w-3 h-3" strokeWidth={1.5} />
                {segment.currency || "USD"} {segment.cost.toLocaleString()}
              </span>
            )}
          </div>
          {(segment.notes || (segment.type === "note" && meta.content)) && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              {segment.type === "note" && meta.content ? meta.content : segment.notes}
            </p>
          )}
          {segment.type === "flight" && tracking && (
            <div className="flex items-center gap-2 mt-2 flex-wrap" data-testid={`flight-status-${segment.id}`}>
              {(() => {
                const ls = tracking.lastStatus as FlightStatusInfo | null;
                const statusKey = ls?.status || "scheduled";
                const statusCfg = flightStatusConfig[statusKey] || flightStatusConfig.unknown;
                return (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                      <span className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`} />
                      {statusCfg.label}
                      {statusKey === "delayed" && ls?.departureDelay ? ` (${ls.departureDelay}min)` : ""}
                    </span>
                    {ls?.departureGate && (
                      <span className="text-[10px] text-muted-foreground">Gate {ls.departureGate}</span>
                    )}
                    {tracking.lastCheckedAt && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {checkedTimeAgo(tracking.lastCheckedAt)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); refreshMutation.mutate(); }}
                      disabled={refreshMutation.isPending}
                      data-testid={`button-refresh-flight-${segment.id}`}
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const DOC_LABEL_SUGGESTIONS = [
  "Flight Ticket", "Hotel Voucher", "Transfer Confirmation", "Travel Insurance",
  "Visa Letter", "Passport Copy", "Booking Confirmation", "Invoice", "Other",
];

function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocFileIcon(fileType: string) {
  if (fileType === "application/pdf") return <File className="w-4 h-4 text-red-500" />;
  return <Image className="w-4 h-4 text-blue-500" />;
}

type TripDocWithMeta = TripDocument & { uploaderName: string | null };

function TripDocumentsSection({ tripId, clientId }: { tripId: string; clientId?: string | null }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [label, setLabel] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isVisibleToClient, setIsVisibleToClient] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: documents = [], isLoading } = useQuery<TripDocWithMeta[]>({
    queryKey: ["/api/trips", tripId, "documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ docId, visible }: { docId: string; visible: boolean }) => {
      const res = await apiRequest("PATCH", `/api/documents/${docId}`, { isVisibleToClient: visible });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "documents"] });
    },
  });

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];

  const handleFileSelect = (file: globalThis.File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: "Invalid file", description: "Only PDF, JPG, PNG, and WebP files are accepted.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 20MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !label.trim()) return;
    setUploading(true);
    try {
      const res = await apiRequest("POST", "/api/documents/request-upload", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        tripId,
        clientId: clientId || null,
        label: label.trim(),
        isVisibleToClient,
      });
      const { uploadURL } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "documents"] });
      if (clientId) queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      toast({ title: "Document uploaded" });
      setSelectedFile(null);
      setLabel("");
      setIsVisibleToClient(true);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const filteredSuggestions = DOC_LABEL_SUGGESTIONS.filter(s => s.toLowerCase().includes(label.toLowerCase()));

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left mb-3"
        data-testid="button-toggle-trip-documents"
      >
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Documents</span>
        <Badge variant="secondary" className="text-[10px] ml-1">{documents.length}</Badge>
        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="space-y-4 pl-6">
          <div
            className={`border border-dashed rounded-md p-4 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
            data-testid="dropzone-trip-documents"
          >
            {!selectedFile ? (
              <>
                <Upload className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground mb-1">Drop a file or</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf,.jpg,.jpeg,.png,.webp";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleFileSelect(f);
                    };
                    input.click();
                  }}
                  data-testid="button-browse-trip-files"
                >
                  Browse
                </Button>
              </>
            ) : (
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-2">
                  {getDocFileIcon(selectedFile.type)}
                  <span className="text-xs truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDocSize(selectedFile.size)}</span>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} data-testid="button-clear-trip-file">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    value={label}
                    onChange={(e) => { setLabel(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Label (e.g. Flight Ticket)"
                    className="text-xs h-8"
                    data-testid="input-trip-doc-label"
                  />
                  {showSuggestions && label.length > 0 && filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-32 overflow-y-auto">
                      {filteredSuggestions.map(s => (
                        <button key={s} className="w-full text-left px-2 py-1 text-xs hover-elevate" onMouseDown={(e) => { e.preventDefault(); setLabel(s); setShowSuggestions(false); }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Visible to client</span>
                  <Switch checked={isVisibleToClient} onCheckedChange={setIsVisibleToClient} data-testid="switch-trip-doc-visibility" />
                </div>
                <Button size="sm" onClick={handleUpload} disabled={uploading || !label.trim()} className="w-full" data-testid="button-upload-trip-doc">
                  {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</> : <><Upload className="w-3.5 h-3.5" /> Upload</>}
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-10 rounded-md" />
          ) : documents.length > 0 && (
            <div className="space-y-1.5">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30" data-testid={`trip-doc-row-${doc.id}`}>
                  {getDocFileIcon(doc.fileType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{doc.label}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.fileName} · {formatDocSize(doc.fileSize)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleVisibility.mutate({ docId: doc.id, visible: !doc.isVisibleToClient })} data-testid={`trip-doc-visibility-${doc.id}`}>
                    {doc.isVisibleToClient ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                  <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" data-testid={`trip-doc-download-${doc.id}`}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }} data-testid={`trip-doc-delete-${doc.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ClientPrefs {
  travelStyle?: { tier?: string; pace?: string; notes?: string };
  flights?: { cabin?: string; seatPreference?: string; preferredAirlines?: string[]; notes?: string };
  hotels?: { tier?: string; preferredBrands?: string[]; roomPreferences?: string; notes?: string };
  dining?: { dietary?: string[]; cuisinePreferences?: string[]; diningStyle?: string; notes?: string };
  interests?: { selected?: string[]; notes?: string };
  generalNotes?: string;
}

function ClientPreferencesPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  const prefs = (client?.preferences as ClientPrefs | null) || null;
  if (!prefs) return null;

  const formatVal = (v?: string) => {
    if (!v) return null;
    return v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const hasContent = !!(
    prefs.travelStyle?.tier || prefs.travelStyle?.pace ||
    prefs.flights?.cabin ||
    prefs.hotels?.tier || (prefs.hotels?.preferredBrands && prefs.hotels.preferredBrands.length > 0) ||
    (prefs.dining?.dietary && prefs.dining.dietary.length > 0) ||
    prefs.dining?.diningStyle ||
    (prefs.interests?.selected && prefs.interests.selected.length > 0) ||
    prefs.generalNotes
  );

  if (!hasContent) return null;

  return (
    <div className="border-l border-border/40 bg-muted/20" data-testid="panel-client-preferences">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-sm font-medium hover:bg-muted/40 transition-colors"
        data-testid="button-toggle-preferences-panel"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={1.5} />
        <Heart className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="truncate">Client Preferences</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <p className="text-[11px] text-muted-foreground/50 font-medium">{clientName}</p>

          {prefs.travelStyle?.tier && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Travel Style</p>
              <p className="text-xs">{formatVal(prefs.travelStyle.tier)}{prefs.travelStyle.pace ? ` · ${formatVal(prefs.travelStyle.pace)}` : ""}</p>
              {prefs.travelStyle.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.travelStyle.notes}</p>}
            </div>
          )}

          {prefs.flights?.cabin && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Flights</p>
              <p className="text-xs">{formatVal(prefs.flights.cabin)}{prefs.flights.seatPreference ? ` · ${formatVal(prefs.flights.seatPreference)}` : ""}</p>
              {prefs.flights.preferredAirlines && prefs.flights.preferredAirlines.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {prefs.flights.preferredAirlines.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{a}</Badge>
                  ))}
                </div>
              )}
              {prefs.flights.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.flights.notes}</p>}
            </div>
          )}

          {prefs.hotels?.tier && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Hotels</p>
              <p className="text-xs">{formatVal(prefs.hotels.tier)}</p>
              {prefs.hotels.preferredBrands && prefs.hotels.preferredBrands.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {prefs.hotels.preferredBrands.map((b) => (
                    <Badge key={b} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{b}</Badge>
                  ))}
                </div>
              )}
              {prefs.hotels.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.hotels.notes}</p>}
            </div>
          )}

          {prefs.dining?.dietary && prefs.dining.dietary.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Dietary</p>
              <div className="flex flex-wrap gap-1">
                {prefs.dining.dietary.map((d) => (
                  <Badge key={d} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{d}</Badge>
                ))}
              </div>
              {prefs.dining.diningStyle && <p className="text-xs mt-1">{formatVal(prefs.dining.diningStyle)}</p>}
              {prefs.dining.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.dining.notes}</p>}
            </div>
          )}

          {prefs.interests?.selected && prefs.interests.selected.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Interests</p>
              <div className="flex flex-wrap gap-1">
                {prefs.interests.selected.map((i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal no-default-hover-elevate no-default-active-elevate">{i}</Badge>
                ))}
              </div>
              {prefs.interests.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{prefs.interests.notes}</p>}
            </div>
          )}

          {prefs.generalNotes && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">General Notes</p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{prefs.generalNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DuplicateTripDialog({ tripId, tripTitle, open, onOpenChange }: {
  tripId: string;
  tripTitle: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(`${tripTitle} (Copy)`);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/trips/${tripId}/duplicate`, {
        title,
        clientId,
        startDate: startDate || null,
      });
      return res.json();
    },
    onSuccess: (newTrip: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Trip duplicated", description: `"${newTrip.title}" created` });
      onOpenChange(false);
      navigate(`/trips/${newTrip.id}/edit`);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Duplicate Trip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm">Trip Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Italy Honeymoon (Copy)"
              data-testid="input-duplicate-title"
            />
          </div>
          <div>
            <Label className="text-sm">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger data-testid="select-duplicate-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">New Start Date (optional)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-duplicate-start-date"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">Leave blank to keep original dates</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-duplicate">
              Cancel
            </Button>
            <Button
              onClick={() => duplicateMutation.mutate()}
              disabled={!title.trim() || !clientId || duplicateMutation.isPending}
              data-testid="button-confirm-duplicate"
            >
              {duplicateMutation.isPending ? "Duplicating..." : "Duplicate Trip"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const segmentTypeIcons: Record<string, typeof Plane> = {
  flight: Plane, charter: Ship, hotel: Hotel, transport: Car,
  restaurant: UtensilsCrossed, activity: Activity, note: StickyNote,
};

function AddSegmentMenu({ day, onAddBlank, onAddFromTemplate }: {
  day: number;
  onAddBlank: (day: number) => void;
  onAddFromTemplate: (day: number, tpl: TemplateData) => void;
}) {
  const { data: templates } = useQuery<any[]>({
    queryKey: ["/api/segment-templates"],
  });

  const hasTemplates = templates && templates.length > 0;

  if (!hasTemplates) {
    return (
      <Button variant="ghost" size="sm" className="text-xs" onClick={() => onAddBlank(day)} data-testid={`button-add-segment-day-${day}`}>
        <Plus className="w-3 h-3 mr-1" /> Add
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-add-segment-day-${day}`}>
          <Plus className="w-3 h-3 mr-1" /> Add
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => onAddBlank(day)} data-testid={`add-blank-segment-day-${day}`}>
          <Plus className="w-3.5 h-3.5 mr-2" />
          Blank segment
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-medium flex items-center gap-1">
            <Bookmark className="w-3 h-3" /> Templates
          </p>
        </div>
        {templates.map((tpl: any) => {
          const TIcon = segmentTypeIcons[tpl.type] || Activity;
          return (
            <DropdownMenuItem
              key={tpl.id}
              onClick={() => onAddFromTemplate(day, {
                type: tpl.type,
                title: tpl.data?.title || tpl.label,
                subtitle: tpl.data?.subtitle,
                cost: tpl.data?.cost,
                currency: tpl.data?.currency,
                notes: tpl.data?.notes,
                metadata: tpl.data?.metadata,
                templateId: tpl.id,
              })}
              data-testid={`add-template-${tpl.id}`}
            >
              <TIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
              <span className="truncate">{tpl.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50">{tpl.useCount}x</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [templateForEditor, setTemplateForEditor] = useState<TemplateData | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

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

  const { data: flightTrackings = [] } = useQuery<FlightTracking[]>({
    queryKey: ["/api/trips", id, "flight-tracking"],
    refetchInterval: 60000,
  });

  const trackingBySegment = useMemo(() => {
    const map = new Map<string, FlightTracking>();
    for (const ft of flightTrackings) map.set(ft.segmentId, ft);
    return map;
  }, [flightTrackings]);

  const segmentsByDay = useMemo(() => {
    const groups = new Map<number, TripSegment[]>();
    for (const seg of segments) {
      if (!groups.has(seg.dayNumber)) groups.set(seg.dayNumber, []);
      groups.get(seg.dayNumber)!.push(seg);
    }
    return groups;
  }, [segments]);

  const dayCount = useMemo(() => {
    if (trip?.startDate && trip?.endDate) {
      const days = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1;
      return Math.max(days, 1);
    }
    const maxDay = segments.length > 0 ? Math.max(...segments.map(s => s.dayNumber)) : 0;
    return Math.max(maxDay, 1);
  }, [trip, segments]);

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

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/trips/${id}`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const togglePricingMutation = useMutation({
    mutationFn: async (showPricing: boolean) => {
      const res = await apiRequest("PATCH", `/api/trips/${id}/versions/${currentVersionId}`, { showPricing });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", id, "full"] });
      toast({ title: currentVersion?.showPricing ? "Pricing hidden" : "Pricing visible" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const openAddSegment = (day: number) => {
    setEditingSegment(null);
    setTemplateForEditor(null);
    setAddSegmentDay(day);
    setSegmentDialogOpen(true);
  };

  const openAddFromTemplate = (day: number, tpl: TemplateData) => {
    setEditingSegment(null);
    setTemplateForEditor(tpl);
    setAddSegmentDay(day);
    setSegmentDialogOpen(true);
  };

  const openEditSegment = (segment: TripSegment) => {
    setEditingSegment(segment);
    setTemplateForEditor(null);
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/trips")} data-testid="button-back-trips">
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
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <button data-testid="button-status-popover">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase tracking-wider cursor-pointer ${
                      (tripStatusOptions.find(s => s.value === trip.status) || tripStatusOptions[0]).className
                    }`}
                  >
                    {(tripStatusOptions.find(s => s.value === trip.status) || tripStatusOptions[0]).label}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                {tripStatusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateStatusMutation.mutate(opt.value)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover-elevate flex items-center justify-between gap-2 text-sm"
                    data-testid={`button-set-status-${opt.value}`}
                  >
                    <span>{opt.label}</span>
                    {trip.status === opt.value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {totalCost > 0 && currentVersion?.showPricing && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-total-cost">
                <DollarSign className="w-3 h-3 mr-0.5" />
                {(trip.currency || "USD")} {totalCost.toLocaleString()}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDuplicateDialogOpen(true)}
              data-testid="button-duplicate-trip"
            >
              <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
            </Button>
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
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Show Pricing</span>
            <Switch
              checked={!!currentVersion?.showPricing}
              onCheckedChange={(checked) => togglePricingMutation.mutate(checked)}
              disabled={togglePricingMutation.isPending}
              data-testid="switch-show-pricing"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 md:px-6">
          {segmentsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((dayNum) => {
                const daySegments = segmentsByDay.get(dayNum) || [];
                const dayDate = trip.startDate
                  ? addDays(new Date(trip.startDate), dayNum - 1)
                  : null;
                const showPricing = !!currentVersion?.showPricing;

                return (
                  <motion.div
                    key={dayNum}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: dayNum * 0.02, duration: 0.3 }}
                    data-testid={`day-card-${dayNum}`}
                  >
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif text-base font-medium tracking-tight">
                          Day {dayNum}
                        </span>
                        {dayDate && (
                          <span className="text-xs text-muted-foreground">
                            {format(dayDate, "EEEE, MMM d")}
                          </span>
                        )}
                      </div>
                      <Separator className="flex-1" />
                      <AddSegmentMenu
                        day={dayNum}
                        onAddBlank={openAddSegment}
                        onAddFromTemplate={openAddFromTemplate}
                      />
                    </div>
                    {daySegments.length > 0 ? (
                      <div className="space-y-2 pl-0 md:pl-4">
                        {daySegments.map((seg) => (
                          <SegmentCard
                            key={seg.id}
                            segment={seg}
                            tripId={id!}
                            onEdit={openEditSegment}
                            tracking={seg.type === "flight" ? trackingBySegment.get(seg.id) : null}
                            showPricing={showPricing}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="pl-0 md:pl-4">
                        <div
                          className="border border-dashed border-border/40 rounded-md py-6 text-center cursor-pointer hover:border-border/70 transition-colors"
                          onClick={() => openAddSegment(dayNum)}
                          data-testid={`empty-day-${dayNum}`}
                        >
                          <p className="text-xs text-muted-foreground/50">
                            No segments yet
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {!trip.startDate && (
                <div className="flex items-center gap-3 pt-2">
                  <Separator className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddSegment(dayCount + 1)}
                    data-testid="button-add-new-day"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Day {dayCount + 1}
                  </Button>
                  <Separator className="flex-1" />
                </div>
              )}
            </div>
          )}

          <TripDocumentsSection tripId={id!} clientId={trip.clientId} />
          </div>
        </div>

        {trip.clientId && trip.clientName && (
          <div className="hidden lg:block w-64 shrink-0 overflow-y-auto">
            <ClientPreferencesPanel clientId={trip.clientId} clientName={trip.clientName} />
          </div>
        )}
      </div>

      {currentVersionId && (
        <SegmentEditor
          key={editingSegment?.id || `new-${addSegmentDay}-${templateForEditor?.templateId || ''}`}
          open={segmentDialogOpen}
          onOpenChange={setSegmentDialogOpen}
          tripId={id!}
          versionId={currentVersionId}
          existingSegment={editingSegment}
          defaultDay={addSegmentDay}
          templateData={templateForEditor}
        />
      )}

      <DuplicateTripDialog
        tripId={id!}
        tripTitle={trip.title}
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />
    </div>
  );
}

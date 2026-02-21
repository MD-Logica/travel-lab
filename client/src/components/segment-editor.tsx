import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plane, Ship, Hotel, Car, UtensilsCrossed, Activity, StickyNote,
  X, Plus, ImageIcon, DollarSign, Star, Clock, MapPin, Phone,
  Globe, Hash, User, Truck, Train, Bus, Anchor,
  Info, Lightbulb, AlertTriangle, ShieldAlert, Landmark, Palette,
  Dumbbell, Sparkles, Ticket, Search, Bookmark, Loader2, Check, Diamond,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlacesAutocomplete, getPhotoUrl } from "@/components/places-autocomplete";
import { PhoneInput } from "@/components/phone-input";
import { CurrencyInput } from "@/components/currency-input";
import type { TripSegment } from "@shared/schema";

function deriveTitle(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case "flight":
      return [metadata.airline, metadata.flightNumber].filter(Boolean).join(" ") ||
        [metadata.departureAirport, metadata.arrivalAirport].filter(Boolean).join(" to ") || "";
    case "charter":
    case "charter_flight":
      return metadata.operator || "Private Flight";
    case "hotel":
      return metadata.hotelName || "";
    case "transport":
      return metadata.provider || (metadata.transportType ? metadata.transportType.charAt(0).toUpperCase() + metadata.transportType.slice(1) : "") || "";
    case "restaurant":
      return metadata.restaurantName || "";
    case "activity":
      return metadata.activityName || metadata.provider || "";
    default:
      return "";
  }
}

function deriveSubtitle(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case "flight":
      return metadata.departureAirport && metadata.arrivalAirport
        ? `${metadata.departureAirport} to ${metadata.arrivalAirport}` : "";
    case "charter":
    case "charter_flight":
      return [metadata.departureLocation, metadata.arrivalLocation].filter(Boolean).join(" to ");
    case "hotel":
      return [metadata.roomType, metadata.starRating ? "\u2605".repeat(metadata.starRating) : ""].filter(Boolean).join(" \u00b7 ");
    case "transport":
      return [metadata.transportType ? metadata.transportType.charAt(0).toUpperCase() + metadata.transportType.slice(1) : "", metadata.vehicleType].filter(Boolean).join(" \u00b7 ");
    case "restaurant":
      return [metadata.cuisine, metadata.partySize ? `${metadata.partySize} guests` : ""].filter(Boolean).join(" \u00b7 ");
    case "activity":
      return [metadata.category ? metadata.category.charAt(0).toUpperCase() + metadata.category.slice(1) : "", metadata.duration].filter(Boolean).join(" \u00b7 ");
    default:
      return "";
  }
}

const segmentTypeConfig: Record<string, { label: string; icon: typeof Plane; color: string }> = {
  flight: { label: "Commercial Flight", icon: Plane, color: "text-sky-600 bg-sky-100 dark:bg-sky-950/50" },
  charter_flight: { label: "Private / Charter", icon: Diamond, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950/50" },
  charter: { label: "Private / Charter", icon: Diamond, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950/50" },
  hotel: { label: "Hotel", icon: Hotel, color: "text-amber-600 bg-amber-100 dark:bg-amber-950/50" },
  transport: { label: "Transport", icon: Car, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, color: "text-rose-600 bg-rose-100 dark:bg-rose-950/50" },
  activity: { label: "Activity", icon: Activity, color: "text-violet-600 bg-violet-100 dark:bg-violet-950/50" },
  note: { label: "Note", icon: StickyNote, color: "text-muted-foreground bg-muted" },
};

const editorTypeOptions = ["flight", "charter_flight", "hotel", "transport", "restaurant", "activity", "note"];

const currencies = ["USD", "EUR", "GBP", "CHF", "AUD", "CAD", "JPY", "AED", "SGD", "HKD", "THB", "INR", "BRL", "MXN"];

const transportSubTypes = [
  { value: "car", label: "Car", icon: Car },
  { value: "train", label: "Train", icon: Train },
  { value: "bus", label: "Bus", icon: Bus },
  { value: "ferry", label: "Ferry", icon: Anchor },
  { value: "transfer", label: "Transfer", icon: Truck },
  { value: "other", label: "Other", icon: Car },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{children}</label>;
}

function FieldRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid gap-3 ${cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>{children}</div>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          className="p-0.5 focus:outline-none"
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= value ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const bookingClasses = [
  { value: "first", label: "First" },
  { value: "business", label: "Business" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "economy", label: "Economy" },
];

interface ConnectionLeg {
  metadata: Record<string, any>;
}

function FlightSearchPanel({
  legLabel,
  defaultDate,
  defaultDepartureHint,
  metadata,
  onChange,
  testIdSuffix,
}: {
  legLabel?: string;
  defaultDate?: string;
  defaultDepartureHint?: string;
  metadata: Record<string, any>;
  onChange: (m: Record<string, any>) => void;
  testIdSuffix?: string;
}) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  const suffix = testIdSuffix || "";
  const [searchNumber, setSearchNumber] = useState(metadata.flightNumber || "");
  const [searchDate, setSearchDate] = useState(defaultDate || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async () => {
    if (!searchNumber.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setCurrentResultIndex(0);
    setSearchError("");
    try {
      const params = new URLSearchParams({ flightNumber: searchNumber.trim() });
      if (searchDate) params.set("date", searchDate);
      const res = await fetch(`/api/flights/search?${params}`, { credentials: "include" });
      const data = await res.json();
      if (data.flights && data.flights.length > 0) {
        setSearchResults(data.flights);
        setCurrentResultIndex(0);
      } else {
        setSearchError(data.error || "Flight not found - you can enter the details manually below.");
      }
    } catch {
      setSearchError("Flight not found - you can enter the details manually below.");
    } finally {
      setIsSearching(false);
    }
  };

  const applyFlightData = () => {
    if (searchResults.length === 0) return;
    const f = searchResults[currentResultIndex];
    onChange({
      ...metadata,
      flightNumber: f.flightNumber || metadata.flightNumber,
      airline: f.airline || metadata.airline,
      aircraft: f.aircraft || metadata.aircraft,
      status: f.status || "",
      departureAirport: f.departure?.iata || metadata.departureAirport,
      departureAirportName: f.departure?.airport || "",
      departureDate: f.departure?.scheduledDate || searchDate || "",
      departureTime: f.departure?.scheduledTime || "",
      departureTimeUtc: f.departure?.scheduledUtc || "",
      departureTimeLocal: f.departure?.scheduledLocal || "",
      arrivalAirport: f.arrival?.iata || metadata.arrivalAirport,
      arrivalAirportName: f.arrival?.airport || "",
      arrivalDate: f.arrival?.scheduledDate || searchDate || "",
      arrivalTime: f.arrival?.scheduledTime || "",
      arrivalTimeUtc: f.arrival?.scheduledUtc || "",
      arrivalTimeLocal: f.arrival?.scheduledLocal || "",
      departure: f.departure,
      arrival: f.arrival,
    });
    setSearchResults([]);
  };

  return (
    <div className="space-y-3">
      {legLabel && (
        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className="text-xs">{legLabel}</Badge>
          {defaultDepartureHint && (
            <span className="text-xs text-muted-foreground">{defaultDepartureHint}</span>
          )}
        </div>
      )}
      <SectionHeading>Search Flight</SectionHeading>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <FieldLabel>Flight Number</FieldLabel>
          <Input value={searchNumber} onChange={(e) => setSearchNumber(e.target.value)} placeholder="BA560" data-testid={`input-flight-search-number${suffix}`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }} />
        </div>
        <div className="flex-1 min-w-[120px]">
          <FieldLabel>Date (optional)</FieldLabel>
          <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} data-testid={`input-flight-search-date${suffix}`} />
        </div>
        <Button variant="default" size="default" onClick={handleSearch} disabled={isSearching || !searchNumber.trim()} data-testid={`button-search-flight${suffix}`}>
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
          Search
        </Button>
      </div>

      {searchResults.length > 0 && (() => {
        const sr = searchResults[currentResultIndex];
        return (
        <div className="border border-border rounded-md p-3 space-y-2 bg-accent/20" data-testid={`card-flight-result${suffix}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{sr.flightNumber}</span>
            {sr.airline && <span className="text-sm text-muted-foreground">{sr.airline}</span>}
            {sr.status && <Badge variant="outline" className="text-xs">{sr.status}</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            {sr.departure?.iata || ""} {"\u2192"} {sr.arrival?.iata || ""}
          </div>
          {(sr.departure?.airport || sr.arrival?.airport) && (
            <div className="text-xs text-muted-foreground/60">
              {sr.departure?.airport || ""} {"\u2192"} {sr.arrival?.airport || ""}
            </div>
          )}
          {(sr.departure?.scheduledTime || sr.arrival?.scheduledTime) && (
            <div className="text-xs text-muted-foreground/60">
              {sr.departure?.scheduledTime && <span>Departs: {sr.departure.scheduledTime}</span>}
              {sr.departure?.scheduledTime && sr.arrival?.scheduledTime && <span className="mx-2">|</span>}
              {sr.arrival?.scheduledTime && <span>Arrives: {sr.arrival.scheduledTime}</span>}
            </div>
          )}
          {sr.aircraft && <div className="text-xs text-muted-foreground/40">Aircraft: {sr.aircraft}</div>}
          <div className="flex items-center justify-between pt-1">
            <Button size="sm" onClick={applyFlightData} data-testid={`button-use-flight${suffix}`}>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Use this flight
            </Button>
            {searchResults.length > 1 && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentResultIndex((currentResultIndex - 1 + searchResults.length) % searchResults.length)}
                    data-testid={`button-prev-flight${suffix}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums" data-testid={`text-flight-index${suffix}`}>
                    {currentResultIndex + 1} / {searchResults.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentResultIndex((currentResultIndex + 1) % searchResults.length)}
                    data-testid={`button-next-flight${suffix}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <span className="text-[10px] text-muted-foreground/50">See other options</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {searchError && (
        <p className="text-sm text-muted-foreground/60 italic" data-testid={`text-flight-not-found${suffix}`}>{searchError}</p>
      )}

      <SectionHeading>Flight Details</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Airline</FieldLabel>
          <Input value={metadata.airline || ""} onChange={(e) => set("airline", e.target.value)} placeholder="British Airways" data-testid={`input-airline${suffix}`} />
        </div>
        <div>
          <FieldLabel>Flight Number</FieldLabel>
          <Input value={metadata.flightNumber || ""} onChange={(e) => set("flightNumber", e.target.value)} placeholder="BA 560" data-testid={`input-flight-number${suffix}`} />
        </div>
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel>Booking Class</FieldLabel>
          <Select value={metadata.bookingClass || ""} onValueChange={(v) => set("bookingClass", v)}>
            <SelectTrigger data-testid={`select-booking-class${suffix}`}>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {bookingClasses.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Confirmation Number</FieldLabel>
          <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} placeholder="ABC123" data-testid={`input-flight-confirmation${suffix}`} />
        </div>
      </FieldRow>

      <SectionHeading>Departure</SectionHeading>
      <div>
        <FieldLabel>Airport</FieldLabel>
        <Input value={metadata.departureAirport || ""} onChange={(e) => set("departureAirport", e.target.value)} placeholder="JFK - John F. Kennedy" data-testid={`input-departure-airport${suffix}`} />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" value={metadata.departureDate || ""} onChange={(e) => set("departureDate", e.target.value)} data-testid={`input-departure-date${suffix}`} />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" value={metadata.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} data-testid={`input-departure-time${suffix}`} />
        </div>
      </FieldRow>

      <SectionHeading>Arrival</SectionHeading>
      <div>
        <FieldLabel>Airport</FieldLabel>
        <Input value={metadata.arrivalAirport || ""} onChange={(e) => set("arrivalAirport", e.target.value)} placeholder="LHR - Heathrow" data-testid={`input-arrival-airport${suffix}`} />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" value={metadata.arrivalDate || ""} onChange={(e) => set("arrivalDate", e.target.value)} data-testid={`input-arrival-date${suffix}`} />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" value={metadata.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} data-testid={`input-arrival-time${suffix}`} />
        </div>
      </FieldRow>
    </div>
  );
}

function FlightFields({ metadata, onChange, connectionLegs, onConnectionLegsChange }: {
  metadata: Record<string, any>;
  onChange: (m: Record<string, any>) => void;
  connectionLegs: ConnectionLeg[];
  onConnectionLegsChange: (legs: ConnectionLeg[]) => void;
}) {
  const [connectionMode, setConnectionMode] = useState(connectionLegs.length > 0);
  const [journeyId, setJourneyId] = useState<string | null>(metadata.journeyId || null);

  const addConnectionLeg = () => {
    const id = journeyId || crypto.randomUUID();
    if (!journeyId) {
      setJourneyId(id);
      onChange({ ...metadata, journeyId: id, legNumber: 1 });
    }
    const legNum = connectionLegs.length + 2;
    const prevMeta = connectionLegs.length > 0
      ? connectionLegs[connectionLegs.length - 1].metadata
      : metadata;
    onConnectionLegsChange([
      ...connectionLegs,
      { metadata: { journeyId: id, legNumber: legNum, departureDate: prevMeta.arrivalDate || "" } },
    ]);
    setConnectionMode(true);
  };

  const updateConnectionLeg = (index: number, legMeta: Record<string, any>) => {
    const updated = [...connectionLegs];
    updated[index] = { metadata: legMeta };
    onConnectionLegsChange(updated);
  };

  const removeConnectionLeg = (index: number) => {
    const updated = connectionLegs.filter((_, i) => i !== index);
    onConnectionLegsChange(updated);
    if (updated.length === 0) {
      setConnectionMode(false);
      const { journeyId: _, legNumber: __, ...rest } = metadata;
      onChange(rest);
      setJourneyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <FlightSearchPanel
        metadata={metadata}
        onChange={onChange}
        legLabel={connectionMode ? "Leg 1" : undefined}
      />

      {metadata.flightNumber && !connectionMode && connectionLegs.length === 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={addConnectionLeg}
          data-testid="button-add-connecting-flight"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add connecting flight
        </Button>
      )}

      {connectionLegs.map((leg, i) => {
        const prevMeta = i === 0 ? metadata : connectionLegs[i - 1].metadata;
        const depHint = prevMeta.arrivalAirport
          ? `Departing from ${prevMeta.arrivalAirport}`
          : undefined;
        return (
          <div key={i} className="border-t border-border/50 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-xs">Connecting Flight (Leg {i + 2})</Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeConnectionLeg(i)}
                className="h-6 px-2 text-xs text-muted-foreground"
                data-testid={`button-remove-connection-${i + 2}`}
              >
                <X className="w-3 h-3 mr-1" /> Remove
              </Button>
            </div>
            <FlightSearchPanel
              metadata={leg.metadata}
              onChange={(m) => updateConnectionLeg(i, m)}
              defaultDate={prevMeta.arrivalDate || ""}
              defaultDepartureHint={depHint}
              testIdSuffix={`-leg${i + 2}`}
            />
          </div>
        );
      })}

      {connectionMode && connectionLegs.length < 2 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={addConnectionLeg}
          data-testid="button-add-another-connection"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add another connection
        </Button>
      )}
    </div>
  );
}

function CharterFlightFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  return (
    <div className="space-y-3">
      <SectionHeading>Charter Details</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Operator / Charter Company</FieldLabel>
          <Input value={metadata.operator || ""} onChange={(e) => set("operator", e.target.value)} placeholder="NetJets, VistaJet" data-testid="input-charter-operator" />
        </div>
        <div>
          <FieldLabel>Aircraft Type</FieldLabel>
          <Input value={metadata.aircraftType || ""} onChange={(e) => set("aircraftType", e.target.value)} placeholder="Gulfstream G650" data-testid="input-aircraft-type" />
        </div>
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel>Tail Number</FieldLabel>
          <Input value={metadata.tailNumber || ""} onChange={(e) => set("tailNumber", e.target.value)} placeholder="N123AB" data-testid="input-tail-number" />
        </div>
        <div>
          <FieldLabel>Confirmation / Charter Reference</FieldLabel>
          <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} placeholder="CHR-2026-001" data-testid="input-charter-confirmation" />
        </div>
      </FieldRow>

      <SectionHeading>Departure</SectionHeading>
      <div>
        <FieldLabel>Location</FieldLabel>
        <Input value={metadata.departureLocation || ""} onChange={(e) => set("departureLocation", e.target.value)} placeholder="Teterboro Airport (TEB), NJ" data-testid="input-charter-departure-location" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" value={metadata.departureDate || ""} onChange={(e) => set("departureDate", e.target.value)} data-testid="input-charter-departure-date" />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" value={metadata.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} data-testid="input-charter-departure-time" />
        </div>
      </FieldRow>

      <SectionHeading>Arrival</SectionHeading>
      <div>
        <FieldLabel>Location</FieldLabel>
        <Input value={metadata.arrivalLocation || ""} onChange={(e) => set("arrivalLocation", e.target.value)} placeholder="Nice Cote d'Azur (NCE)" data-testid="input-charter-arrival-location" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" value={metadata.arrivalDate || ""} onChange={(e) => set("arrivalDate", e.target.value)} data-testid="input-charter-arrival-date" />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" value={metadata.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} data-testid="input-charter-arrival-time" />
        </div>
      </FieldRow>

      <div>
        <FieldLabel>FBO / Handler</FieldLabel>
        <Input value={metadata.fboHandler || ""} onChange={(e) => set("fboHandler", e.target.value)} placeholder="Signature Aviation, Jet Aviation" data-testid="input-fbo-handler" />
      </div>

      <div>
        <FieldLabel>Catering Notes</FieldLabel>
        <Textarea
          value={metadata.cateringNotes || ""}
          onChange={(e) => set("cateringNotes", e.target.value)}
          placeholder="Dietary requirements, preferences, special requests..."
          className="resize-none"
          rows={3}
          data-testid="input-catering-notes"
        />
      </div>
    </div>
  );
}

function HotelFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  const handlePlaceSelect = (details: any) => {
    onChange({
      ...metadata,
      hotelName: details.name || metadata.hotelName,
      address: details.address || metadata.address,
      phone: details.phone || metadata.phone,
      website: details.website || metadata.website,
      mapsUrl: details.mapsUrl || metadata.mapsUrl,
      starRating: details.rating ? Math.round(details.rating) : metadata.starRating,
      photos: details.photoRefs?.length ? details.photoRefs : metadata.photos,
      placeDescription: details.editorialSummary || details.firstReview || metadata.placeDescription,
    });
  };
  return (
    <div className="space-y-3">
      <SectionHeading>Search Hotel</SectionHeading>
      <PlacesAutocomplete
        value={metadata.hotelName || ""}
        onValueChange={(v) => set("hotelName", v)}
        onPlaceSelect={handlePlaceSelect}
        placeholder="Search hotels..."
        types="lodging"
        testId="input-hotel-search"
      />

      <SectionHeading>Hotel Details</SectionHeading>
      <div>
        <FieldLabel>Star Rating</FieldLabel>
        <StarRating value={metadata.starRating || 0} onChange={(v) => set("starRating", v)} />
      </div>
      <div>
        <FieldLabel>Address</FieldLabel>
        <Input value={metadata.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="Palazzo Papadopoli, Venice" data-testid="input-hotel-address" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <PhoneInput value={metadata.phone || ""} onChange={(v) => set("phone", v)} placeholder="Hotel phone" testId="input-hotel-phone" />
        </div>
        <div>
          <FieldLabel>Website</FieldLabel>
          <Input value={metadata.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://aman.com" data-testid="input-hotel-website" />
        </div>
      </FieldRow>
      {metadata.mapsUrl && (
        <div>
          <a href={metadata.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-hotel-maps">
            <MapPin className="w-3 h-3" /> View on Google Maps
          </a>
        </div>
      )}

      {metadata.photos && metadata.photos.length > 0 && (
        <div>
          <FieldLabel>Photos from Google</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {(metadata.photos as string[]).slice(0, 4).map((url: string, i: number) => (
              <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {metadata.placeDescription && (
        <div>
          <FieldLabel>Description</FieldLabel>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">{metadata.placeDescription}</p>
        </div>
      )}

      <SectionHeading>Stay</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Check-in Date + Time</FieldLabel>
          <Input type="datetime-local" value={metadata.checkInDateTime || ""} onChange={(e) => set("checkInDateTime", e.target.value)} data-testid="input-checkin-datetime" />
        </div>
        <div>
          <FieldLabel>Check-out Date + Time</FieldLabel>
          <Input type="datetime-local" value={metadata.checkOutDateTime || ""} onChange={(e) => set("checkOutDateTime", e.target.value)} data-testid="input-checkout-datetime" />
        </div>
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel>Room Type</FieldLabel>
          <Input value={metadata.roomType || ""} onChange={(e) => set("roomType", e.target.value)} placeholder="Suite with canal view" data-testid="input-room-type" />
        </div>
        <div>
          <FieldLabel>Confirmation Number</FieldLabel>
          <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} data-testid="input-hotel-confirmation" />
        </div>
      </FieldRow>
    </div>
  );
}

function TransportFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  const tType = metadata.transportType || "car";

  const handleTypeChange = (newType: string) => {
    const typeSpecificKeys: Record<string, string[]> = {
      car: ["vehicleDetails", "pickupLocation", "pickupTime", "dropoffLocation", "dropoffTime", "driverName", "driverPhone"],
      transfer: ["vehicleDetails", "pickupLocation", "pickupTime", "dropoffLocation", "dropoffTime", "driverName", "driverPhone"],
      other: ["vehicleDetails", "pickupLocation", "pickupTime", "dropoffLocation", "dropoffTime", "driverName", "driverPhone"],
      train: ["trainNumber", "departureStation", "departureTime", "arrivalStation", "arrivalTime", "coachNumber", "seatNumber"],
      bus: ["routeNumber", "departureStop", "departureTime", "arrivalStop", "arrivalTime", "seatNumber"],
      ferry: ["vesselName", "departurePort", "departureTime", "arrivalPort", "arrivalTime", "cabinClass"],
    };
    const allKeys = new Set(Object.values(typeSpecificKeys).flat());
    const keepKeys = new Set(typeSpecificKeys[newType] || []);
    const cleared: Record<string, any> = {};
    allKeys.forEach(k => { if (!keepKeys.has(k)) cleared[k] = ""; });
    onChange({ ...metadata, ...cleared, transportType: newType });
  };

  return (
    <div className="space-y-3">
      <SectionHeading>Transport Details</SectionHeading>
      <div>
        <FieldLabel>Type</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {transportSubTypes.map((t) => {
            const TIcon = t.icon;
            const selected = tType === t.value;
            return (
              <Button
                key={t.value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange(t.value)}
                data-testid={`button-transport-type-${t.value}`}
              >
                <TIcon className="w-3.5 h-3.5 mr-1" />
                {t.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>{tType === "train" ? "Operator" : tType === "bus" ? "Operator" : tType === "ferry" ? "Operator" : "Provider"}</FieldLabel>
        <Input value={metadata.provider || ""} onChange={(e) => set("provider", e.target.value)} placeholder={tType === "train" ? "Trenitalia, Eurostar" : tType === "bus" ? "FlixBus, Greyhound" : tType === "ferry" ? "Corsica Ferries" : "Blacklane"} data-testid="input-transport-provider" />
      </div>

      {(tType === "car" || tType === "transfer" || tType === "other") && (
        <>
          <div>
            <FieldLabel>Vehicle Details</FieldLabel>
            <Input value={metadata.vehicleDetails || ""} onChange={(e) => set("vehicleDetails", e.target.value)} placeholder="Mercedes S-Class" data-testid="input-vehicle-details" />
          </div>
          <SectionHeading>Pickup</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Location</FieldLabel>
              <Input value={metadata.pickupLocation || ""} onChange={(e) => set("pickupLocation", e.target.value)} placeholder="Hotel lobby" data-testid="input-pickup-location" />
            </div>
            <div>
              <FieldLabel>Date / Time</FieldLabel>
              <Input type="datetime-local" value={metadata.pickupTime || ""} onChange={(e) => set("pickupTime", e.target.value)} data-testid="input-pickup-time" />
            </div>
          </FieldRow>
          <SectionHeading>Drop-off</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Location</FieldLabel>
              <Input value={metadata.dropoffLocation || ""} onChange={(e) => set("dropoffLocation", e.target.value)} placeholder="Airport Terminal 2" data-testid="input-dropoff-location" />
            </div>
            <div>
              <FieldLabel>Date / Time</FieldLabel>
              <Input type="datetime-local" value={metadata.dropoffTime || ""} onChange={(e) => set("dropoffTime", e.target.value)} data-testid="input-dropoff-time" />
            </div>
          </FieldRow>
          <FieldRow>
            <div>
              <FieldLabel>Driver Name</FieldLabel>
              <Input value={metadata.driverName || ""} onChange={(e) => set("driverName", e.target.value)} data-testid="input-driver-name" />
            </div>
            <div>
              <FieldLabel>Driver Phone</FieldLabel>
              <PhoneInput value={metadata.driverPhone || ""} onChange={(v) => set("driverPhone", v)} placeholder="Driver phone" testId="input-driver-phone" />
            </div>
          </FieldRow>
        </>
      )}

      {tType === "train" && (
        <>
          <div>
            <FieldLabel>Train / Service Number</FieldLabel>
            <Input value={metadata.trainNumber || ""} onChange={(e) => set("trainNumber", e.target.value)} placeholder="FR 9626" data-testid="input-train-number" />
          </div>
          <SectionHeading>Departure</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Station</FieldLabel>
              <Input value={metadata.departureStation || ""} onChange={(e) => set("departureStation", e.target.value)} placeholder="Roma Termini" data-testid="input-departure-station" />
            </div>
            <div>
              <FieldLabel>Date / Time</FieldLabel>
              <Input type="datetime-local" value={metadata.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} data-testid="input-departure-time" />
            </div>
          </FieldRow>
          <SectionHeading>Arrival</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Station</FieldLabel>
              <Input value={metadata.arrivalStation || ""} onChange={(e) => set("arrivalStation", e.target.value)} placeholder="Firenze S.M.N." data-testid="input-arrival-station" />
            </div>
            <div>
              <FieldLabel>Arrival Time</FieldLabel>
              <Input type="datetime-local" value={metadata.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} data-testid="input-arrival-time" />
            </div>
          </FieldRow>
          <FieldRow>
            <div>
              <FieldLabel>Coach / Car</FieldLabel>
              <Input value={metadata.coachNumber || ""} onChange={(e) => set("coachNumber", e.target.value)} placeholder="Car 6" data-testid="input-coach-number" />
            </div>
            <div>
              <FieldLabel>Seat Number</FieldLabel>
              <Input value={metadata.seatNumber || ""} onChange={(e) => set("seatNumber", e.target.value)} placeholder="14A" data-testid="input-seat-number" />
            </div>
          </FieldRow>
        </>
      )}

      {tType === "bus" && (
        <>
          <div>
            <FieldLabel>Route Number / Name</FieldLabel>
            <Input value={metadata.routeNumber || ""} onChange={(e) => set("routeNumber", e.target.value)} placeholder="Route 42" data-testid="input-route-number" />
          </div>
          <SectionHeading>Departure</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Terminal / Stop</FieldLabel>
              <Input value={metadata.departureStop || ""} onChange={(e) => set("departureStop", e.target.value)} placeholder="Central Bus Station" data-testid="input-departure-stop" />
            </div>
            <div>
              <FieldLabel>Date / Time</FieldLabel>
              <Input type="datetime-local" value={metadata.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} data-testid="input-departure-time" />
            </div>
          </FieldRow>
          <SectionHeading>Arrival</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Terminal / Stop</FieldLabel>
              <Input value={metadata.arrivalStop || ""} onChange={(e) => set("arrivalStop", e.target.value)} placeholder="Downtown Terminal" data-testid="input-arrival-stop" />
            </div>
            <div>
              <FieldLabel>Arrival Time</FieldLabel>
              <Input type="datetime-local" value={metadata.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} data-testid="input-arrival-time" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Seat Number</FieldLabel>
            <Input value={metadata.seatNumber || ""} onChange={(e) => set("seatNumber", e.target.value)} placeholder="12B" data-testid="input-seat-number" />
          </div>
        </>
      )}

      {tType === "ferry" && (
        <>
          <div>
            <FieldLabel>Vessel / Ferry Name</FieldLabel>
            <Input value={metadata.vesselName || ""} onChange={(e) => set("vesselName", e.target.value)} placeholder="MV Blue Star" data-testid="input-vessel-name" />
          </div>
          <SectionHeading>Departure</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Port</FieldLabel>
              <Input value={metadata.departurePort || ""} onChange={(e) => set("departurePort", e.target.value)} placeholder="Piraeus Port" data-testid="input-departure-port" />
            </div>
            <div>
              <FieldLabel>Date / Time</FieldLabel>
              <Input type="datetime-local" value={metadata.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} data-testid="input-departure-time" />
            </div>
          </FieldRow>
          <SectionHeading>Arrival</SectionHeading>
          <FieldRow>
            <div>
              <FieldLabel>Port</FieldLabel>
              <Input value={metadata.arrivalPort || ""} onChange={(e) => set("arrivalPort", e.target.value)} placeholder="Santorini (Athinios)" data-testid="input-arrival-port" />
            </div>
            <div>
              <FieldLabel>Arrival Time</FieldLabel>
              <Input type="datetime-local" value={metadata.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} data-testid="input-arrival-time" />
            </div>
          </FieldRow>
          <div>
            <FieldLabel>Cabin / Deck Class</FieldLabel>
            <Input value={metadata.cabinClass || ""} onChange={(e) => set("cabinClass", e.target.value)} placeholder="Business Class" data-testid="input-cabin-class" />
          </div>
        </>
      )}

      <div>
        <FieldLabel>{tType === "train" || tType === "bus" || tType === "ferry" ? "Booking Reference" : "Confirmation Number"}</FieldLabel>
        <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} data-testid="input-transport-confirmation" />
      </div>
    </div>
  );
}

function RestaurantFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  const priceLevelLabels = ["", "$", "$$", "$$$", "$$$$"];
  const handlePlaceSelect = (details: any) => {
    const cuisineType = (details.types || []).find((t: string) =>
      ["restaurant", "cafe", "bar", "bakery", "meal_delivery", "meal_takeaway"].includes(t) === false
      && !["point_of_interest", "establishment", "food"].includes(t)
    );
    onChange({
      ...metadata,
      restaurantName: details.name || metadata.restaurantName,
      address: details.address || metadata.address,
      phone: details.phone || metadata.phone,
      website: details.website || metadata.website,
      mapsUrl: details.mapsUrl || metadata.mapsUrl,
      cuisine: cuisineType ? cuisineType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : metadata.cuisine,
      priceLevel: details.priceLevel != null ? priceLevelLabels[details.priceLevel] || "" : metadata.priceLevel,
      photos: details.photoRefs?.length ? details.photoRefs.slice(0, 3) : metadata.photos,
    });
  };
  return (
    <div className="space-y-3">
      <SectionHeading>Search Restaurant</SectionHeading>
      <PlacesAutocomplete
        value={metadata.restaurantName || ""}
        onValueChange={(v) => set("restaurantName", v)}
        onPlaceSelect={handlePlaceSelect}
        placeholder="Search restaurants..."
        types="restaurant"
        testId="input-restaurant-search"
      />

      <SectionHeading>Restaurant Details</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Cuisine</FieldLabel>
          <Input value={metadata.cuisine || ""} onChange={(e) => set("cuisine", e.target.value)} placeholder="New Nordic" data-testid="input-cuisine" />
        </div>
        <div>
          <FieldLabel>Price Level</FieldLabel>
          <Input value={metadata.priceLevel || ""} onChange={(e) => set("priceLevel", e.target.value)} placeholder="$$$" data-testid="input-price-level" />
        </div>
      </FieldRow>
      <div>
        <FieldLabel>Address</FieldLabel>
        <Input value={metadata.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="Refshalevej 96, Copenhagen" data-testid="input-restaurant-address" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <PhoneInput value={metadata.phone || ""} onChange={(v) => set("phone", v)} placeholder="Restaurant phone" testId="input-restaurant-phone" />
        </div>
        <div>
          <FieldLabel>Website</FieldLabel>
          <Input value={metadata.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://noma.dk" data-testid="input-restaurant-website" />
        </div>
      </FieldRow>
      {metadata.mapsUrl && (
        <div>
          <a href={metadata.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-restaurant-maps">
            <MapPin className="w-3 h-3" /> View on Google Maps
          </a>
        </div>
      )}

      {metadata.photos && metadata.photos.length > 0 && (
        <div>
          <FieldLabel>Photos from Google</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {(metadata.photos as string[]).slice(0, 3).map((url: string, i: number) => (
              <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionHeading>Reservation</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Date + Time</FieldLabel>
          <Input type="datetime-local" value={metadata.reservationDateTime || ""} onChange={(e) => set("reservationDateTime", e.target.value)} data-testid="input-reservation-datetime" />
        </div>
        <div>
          <FieldLabel>Party Size</FieldLabel>
          <Input type="number" min={1} value={metadata.partySize || ""} onChange={(e) => set("partySize", e.target.value)} placeholder="2" data-testid="input-party-size" />
        </div>
      </FieldRow>
      <div>
        <FieldLabel>Guest Name</FieldLabel>
        <Input value={metadata.guestName || ""} onChange={(e) => set("guestName", e.target.value)} placeholder="Mr & Mrs Johnson" data-testid="input-guest-name" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Dress Code</FieldLabel>
          <Input value={metadata.dressCode || ""} onChange={(e) => set("dressCode", e.target.value)} placeholder="Smart casual" data-testid="input-dress-code" />
        </div>
        <div>
          <FieldLabel>Confirmation Number</FieldLabel>
          <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} data-testid="input-restaurant-confirmation" />
        </div>
      </FieldRow>
    </div>
  );
}

const activityCategories = [
  { value: "tour", label: "Tour", icon: MapPin },
  { value: "museum", label: "Museum", icon: Landmark },
  { value: "sport", label: "Sport", icon: Dumbbell },
  { value: "wellness", label: "Wellness", icon: Sparkles },
  { value: "entertainment", label: "Entertainment", icon: Ticket },
  { value: "other", label: "Other", icon: Palette },
];

function ActivityFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  const handlePlaceSelect = (details: any) => {
    const placeCategory = (details.types || []).find((t: string) =>
      !["point_of_interest", "establishment"].includes(t)
    );
    onChange({
      ...metadata,
      activityName: details.name || metadata.activityName,
      location: details.address || metadata.location,
      phone: details.phone || metadata.phone,
      website: details.website || metadata.website,
      mapsUrl: details.mapsUrl || metadata.mapsUrl,
      category: placeCategory ? (activityCategories.find(c => placeCategory.includes(c.value))?.value || metadata.category) : metadata.category,
      photos: details.photoRefs?.length ? details.photoRefs.slice(0, 3) : metadata.photos,
    });
  };
  return (
    <div className="space-y-3">
      <SectionHeading>Search Activity / Place</SectionHeading>
      <PlacesAutocomplete
        value={metadata.activityName || ""}
        onValueChange={(v) => set("activityName", v)}
        onPlaceSelect={handlePlaceSelect}
        placeholder="Search places, attractions..."
        testId="input-activity-search"
      />

      <SectionHeading>Activity Details</SectionHeading>
      <div>
        <FieldLabel>Category</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {activityCategories.map((c) => {
            const CIcon = c.icon;
            const selected = metadata.category === c.value;
            return (
              <Button
                key={c.value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => set("category", c.value)}
                data-testid={`button-activity-category-${c.value}`}
              >
                <CIcon className="w-3.5 h-3.5 mr-1" />
                {c.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div>
        <FieldLabel>Location</FieldLabel>
        <Input value={metadata.location || ""} onChange={(e) => set("location", e.target.value)} placeholder="Piazza San Marco" data-testid="input-activity-location" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <PhoneInput value={metadata.phone || ""} onChange={(v) => set("phone", v)} placeholder="Contact phone" testId="input-activity-phone" />
        </div>
        <div>
          <FieldLabel>Website</FieldLabel>
          <Input value={metadata.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://..." data-testid="input-activity-website" />
        </div>
      </FieldRow>
      {metadata.mapsUrl && (
        <div>
          <a href={metadata.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-activity-maps">
            <MapPin className="w-3 h-3" /> View on Google Maps
          </a>
        </div>
      )}

      {metadata.photos && metadata.photos.length > 0 && (
        <div>
          <FieldLabel>Photos from Google</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {(metadata.photos as string[]).slice(0, 3).map((url: string, i: number) => (
              <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <FieldRow>
        <div>
          <FieldLabel>Date + Time</FieldLabel>
          <Input type="datetime-local" value={metadata.startDateTime || ""} onChange={(e) => set("startDateTime", e.target.value)} data-testid="input-activity-start" />
        </div>
        <div>
          <FieldLabel>Duration</FieldLabel>
          <Input value={metadata.duration || ""} onChange={(e) => set("duration", e.target.value)} placeholder="2 hours" data-testid="input-activity-duration" />
        </div>
      </FieldRow>
      <div>
        <FieldLabel>Meeting Point</FieldLabel>
        <Input value={metadata.meetingPoint || ""} onChange={(e) => set("meetingPoint", e.target.value)} placeholder="Hotel lobby, dock 3..." data-testid="input-meeting-point" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Operator / Guide</FieldLabel>
          <Input value={metadata.provider || ""} onChange={(e) => set("provider", e.target.value)} placeholder="Walks of Italy" data-testid="input-activity-provider" />
        </div>
        <div>
          <FieldLabel>Confirmation Number</FieldLabel>
          <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} data-testid="input-activity-confirmation" />
        </div>
      </FieldRow>
    </div>
  );
}

const noteTypes = [
  { value: "info", label: "Info", icon: Info, color: "text-sky-600" },
  { value: "tip", label: "Tip", icon: Lightbulb, color: "text-amber-600" },
  { value: "important", label: "Important", icon: AlertTriangle, color: "text-orange-600" },
  { value: "warning", label: "Warning", icon: ShieldAlert, color: "text-rose-600" },
];

function NoteFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  return (
    <div className="space-y-3">
      <SectionHeading>Note</SectionHeading>
      <div>
        <FieldLabel>Note Type</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {noteTypes.map((n) => {
            const NIcon = n.icon;
            const selected = metadata.noteType === n.value;
            return (
              <Button
                key={n.value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => set("noteType", n.value)}
                data-testid={`button-note-type-${n.value}`}
              >
                <NIcon className={`w-3.5 h-3.5 mr-1 ${selected ? "" : n.color}`} />
                {n.label}
              </Button>
            );
          })}
        </div>
      </div>
      <div>
        <FieldLabel>Content</FieldLabel>
        <Textarea
          value={metadata.content || ""}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Write your note here..."
          className="resize-none min-h-[160px]"
          rows={7}
          data-testid="input-note-content"
        />
      </div>
    </div>
  );
}

function PhotosField({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const [newUrl, setNewUrl] = useState("");

  const addPhoto = () => {
    if (newUrl.trim()) {
      onChange([...photos, newUrl.trim()]);
      setNewUrl("");
    }
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Photos</FieldLabel>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group w-16 h-16 rounded-md overflow-hidden bg-muted">
              <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ visibility: "visible" }}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="Paste image URL..."
          className="flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhoto(); } }}
          data-testid="input-photo-url"
        />
        <Button variant="outline" size="sm" onClick={addPhoto} disabled={!newUrl.trim()} data-testid="button-add-photo">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

const typeFieldComponents: Record<string, (props: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) => JSX.Element> = {
  charter: CharterFlightFields,
  charter_flight: CharterFlightFields,
  hotel: HotelFields,
  transport: TransportFields,
  restaurant: RestaurantFields,
  activity: ActivityFields,
  note: NoteFields,
};

export interface TemplateData {
  type: string;
  title: string;
  subtitle?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  metadata?: Record<string, any>;
  templateId?: string;
}

interface SegmentEditorProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tripId: string;
  versionId: string;
  existingSegment: TripSegment | null;
  defaultDay: number;
  templateData?: TemplateData | null;
  defaultType?: string | null;
}

export function SegmentEditor({
  open,
  onOpenChange,
  tripId,
  versionId,
  existingSegment,
  defaultDay,
  templateData,
  defaultType,
}: SegmentEditorProps) {
  const { toast } = useToast();
  const isEdit = !!existingSegment;

  const [type, setType] = useState<string>(existingSegment?.type || "activity");
  const [title, setTitle] = useState(existingSegment?.title || "");
  const [subtitle, setSubtitle] = useState(existingSegment?.subtitle || "");
  const [dayNumber, setDayNumber] = useState(existingSegment?.dayNumber || defaultDay);
  const [startTime, setStartTime] = useState(existingSegment?.startTime || "");
  const [endTime, setEndTime] = useState(existingSegment?.endTime || "");
  const [confirmationNumber, setConfirmationNumber] = useState(existingSegment?.confirmationNumber || "");
  const [cost, setCost] = useState(existingSegment?.cost?.toString() || "");
  const [currency, setCurrency] = useState(existingSegment?.currency || "USD");
  const [notes, setNotes] = useState(existingSegment?.notes || "");
  const [photos, setPhotos] = useState<string[]>((existingSegment?.photos as string[]) || []);
  const [metadata, setMetadata] = useState<Record<string, any>>((existingSegment?.metadata as Record<string, any>) || {});
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateLabel, setTemplateLabel] = useState("");
  const [connectionLegs, setConnectionLegs] = useState<ConnectionLeg[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [existingVariantIds, setExistingVariantIds] = useState<string[]>([]);

  const addVariant = () => {
    setVariants([...variants, { label: "", description: "", cost: 0, quantity: 1, refundability: "unknown" }]);
  };

  const updateVariant = (index: number, updates: Record<string, any>) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], ...updates };
    setVariants(updated);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const resetForm = useCallback(() => {
    setType("activity");
    setTitle("");
    setSubtitle("");
    setDayNumber(defaultDay);
    setStartTime("");
    setEndTime("");
    setConfirmationNumber("");
    setCost("");
    setCurrency("USD");
    setNotes("");
    setPhotos([]);
    setMetadata({});
    setSaveAsTemplate(false);
    setTemplateLabel("");
    setConnectionLegs([]);
    setVariants([]);
    setExistingVariantIds([]);
  }, [defaultDay]);

  useEffect(() => {
    if (open) {
      if (existingSegment) {
        setType(existingSegment.type);
        setTitle(existingSegment.title);
        setSubtitle(existingSegment.subtitle || "");
        setDayNumber(existingSegment.dayNumber);
        setStartTime(existingSegment.startTime || "");
        setEndTime(existingSegment.endTime || "");
        setConfirmationNumber(existingSegment.confirmationNumber || "");
        setCost(existingSegment.cost?.toString() || "");
        setCurrency(existingSegment.currency || "USD");
        setNotes(existingSegment.notes || "");
        setPhotos((existingSegment.photos as string[]) || []);
        setMetadata((existingSegment.metadata as Record<string, any>) || {});
        if (existingSegment.hasVariants) {
          fetch(`/api/segments/${existingSegment.id}/variants`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data)) {
                setVariants(data);
                setExistingVariantIds(data.map((v: any) => v.id));
              }
            })
            .catch(() => {});
        } else {
          setVariants([]);
          setExistingVariantIds([]);
        }
      } else if (templateData) {
        setType(templateData.type);
        setTitle(templateData.title);
        setSubtitle(templateData.subtitle || "");
        setDayNumber(defaultDay);
        setStartTime("");
        setEndTime("");
        setConfirmationNumber("");
        setCost(templateData.cost?.toString() || "");
        setCurrency(templateData.currency || "USD");
        setNotes(templateData.notes || "");
        setPhotos([]);
        setMetadata(templateData.metadata || {});
      } else {
        resetForm();
        if (defaultType) {
          setType(defaultType);
        }
      }
      setSaveAsTemplate(false);
      setTemplateLabel("");
    }
  }, [open, existingSegment, templateData, resetForm, defaultDay, defaultType]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const derivedTitle = type === "note" ? title : deriveTitle(type, metadata);
      const derivedSubtitle = type === "note" ? "" : deriveSubtitle(type, metadata);
      const payload: Record<string, any> = {
        dayNumber,
        sortOrder: existingSegment?.sortOrder || 0,
        type,
        title: derivedTitle || title || segmentTypeConfig[type]?.label || "Segment",
        subtitle: derivedSubtitle || subtitle || null,
        startTime: startTime || null,
        endTime: endTime || null,
        confirmationNumber: confirmationNumber || null,
        cost: cost ? parseInt(cost) : null,
        currency,
        notes: notes || null,
        photos: photos.length > 0 ? photos : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      };
      if (metadata.journeyId) {
        payload.journeyId = metadata.journeyId;
      }
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/trips/${tripId}/segments/${existingSegment.id}`, payload);
        const result = await res.json();
        return result;
      } else {
        const res = await apiRequest("POST", `/api/trips/${tripId}/versions/${versionId}/segments`, payload);
        const result = await res.json();

        for (const leg of connectionLegs) {
          const legMeta = leg.metadata;
          if (!legMeta.flightNumber && !legMeta.departureAirport) continue;
          const legTitle = deriveTitle(type, legMeta);
          const legSubtitle = deriveSubtitle(type, legMeta);
          const legPayload: Record<string, any> = {
            dayNumber,
            sortOrder: 0,
            type,
            title: legTitle || "Connection",
            subtitle: legSubtitle || null,
            startTime: null,
            endTime: null,
            confirmationNumber: legMeta.confirmationNumber || null,
            cost: null,
            currency,
            notes: null,
            photos: null,
            metadata: legMeta,
          };
          if (legMeta.journeyId) {
            legPayload.journeyId = legMeta.journeyId;
          }
          await apiRequest("POST", `/api/trips/${tripId}/versions/${versionId}/segments`, legPayload);
        }
        return result;
      }
    },
    onSuccess: async (savedSegment: any) => {
      const segmentId = savedSegment?.id || existingSegment?.id;
      if (segmentId && (type === "hotel" || type === "flight" || type === "charter_flight") && (variants.length > 0 || existingVariantIds.length > 0)) {
        try {
          const currentIds = variants.filter((v) => v.id).map((v) => v.id);
          const deletedIds = existingVariantIds.filter((id) => !currentIds.includes(id));
          for (const id of deletedIds) {
            await apiRequest("DELETE", `/api/segments/${segmentId}/variants/${id}`);
          }
          for (const v of variants) {
            if (v.id && existingVariantIds.includes(v.id)) {
              await apiRequest("PATCH", `/api/segments/${segmentId}/variants/${v.id}`, {
                label: v.label,
                description: v.description || null,
                cost: v.cost || null,
                quantity: v.quantity || 1,
                refundability: v.refundability || "unknown",
              });
            } else if (!v.id) {
              await apiRequest("POST", `/api/segments/${segmentId}/variants`, {
                label: v.label || "Option",
                description: v.description || null,
                cost: v.cost || null,
                quantity: v.quantity || 1,
                refundability: v.refundability || "unknown",
                segmentId,
              });
            }
          }
        } catch {
        }
      }
      if (saveAsTemplate && templateLabel.trim()) {
        try {
          await apiRequest("POST", "/api/segment-templates", {
            type,
            label: templateLabel.trim(),
            data: {
              title,
              subtitle: subtitle || undefined,
              cost: cost ? parseInt(cost) : undefined,
              currency,
              notes: notes || undefined,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            },
          });
          toast({ title: "Template saved", description: `"${templateLabel}" saved for reuse` });
        } catch {
          toast({ title: "Segment saved but template failed", variant: "destructive" });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/segment-templates"] });
      }
      if (templateData?.templateId) {
        apiRequest("POST", `/api/segment-templates/${templateData.templateId}/use`).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["/api/segment-templates"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      toast({ title: isEdit ? "Segment updated" : "Segment added" });
      resetForm();
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const cfg = segmentTypeConfig[type] || segmentTypeConfig.activity;
  const Icon = cfg.icon;
  const TypeFields = typeFieldComponents[type] || NoteFields;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[540px] p-0 flex flex-col overflow-hidden"
        data-testid="sheet-segment-editor"
      >
        <div className="shrink-0 border-b border-border/50 p-4 pb-3">
          <SheetHeader className="space-y-0">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${cfg.color}`}>
                <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
              </div>
              <SheetTitle className="font-serif text-lg">
                {isEdit ? `Edit ${cfg.label}` : `New ${cfg.label}`}
              </SheetTitle>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <FieldLabel>Segment Type</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {editorTypeOptions.map((value) => {
                const c = segmentTypeConfig[value];
                if (!c) return null;
                const TIcon = c.icon;
                const selected = type === value || (value === "charter_flight" && type === "charter");
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setType(value);
                      setMetadata({});
                    }}
                    data-testid={`button-type-${value}`}
                  >
                    <TIcon className="w-3.5 h-3.5 mr-1" />
                    {c.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {type === "note" && (
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                data-testid="input-segment-title"
              />
            </div>
          )}

          {type === "flight" ? (
            <FlightFields
              metadata={metadata}
              onChange={setMetadata}
              connectionLegs={connectionLegs}
              onConnectionLegsChange={setConnectionLegs}
            />
          ) : (
            <TypeFields metadata={metadata} onChange={setMetadata} />
          )}

          <SectionHeading>Shared Details</SectionHeading>

          <div>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information, special requests..."
              className="resize-none"
              rows={3}
              data-testid="input-segment-notes"
            />
          </div>

          <FieldRow>
            <div>
              <FieldLabel>Cost</FieldLabel>
              <CurrencyInput
                value={cost}
                onChange={setCost}
                currency={currency}
                placeholder="0"
                testId="input-segment-cost"
              />
            </div>
            <div>
              <FieldLabel>Currency</FieldLabel>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger data-testid="select-segment-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FieldRow>

          {(type === "hotel" || type === "flight" || type === "activity") && (
            <>
              <SectionHeading>Cancellation Policy</SectionHeading>
              <div>
                <FieldLabel>Refundability</FieldLabel>
                <Select
                  value={metadata.refundability || "unknown"}
                  onValueChange={(v) => setMetadata({ ...metadata, refundability: v })}
                >
                  <SelectTrigger data-testid="select-refundability">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Not specified</SelectItem>
                    <SelectItem value="fully_refundable">Fully refundable</SelectItem>
                    <SelectItem value="partially_refundable">Partially refundable</SelectItem>
                    <SelectItem value="non_refundable">Non-refundable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(metadata.refundability === "fully_refundable" || metadata.refundability === "partially_refundable") && (
                <div>
                  <FieldLabel>Refund Deadline</FieldLabel>
                  <Input
                    type="date"
                    value={metadata.refundDeadline || ""}
                    onChange={(e) => setMetadata({ ...metadata, refundDeadline: e.target.value })}
                    data-testid="input-refund-deadline"
                  />
                </div>
              )}
            </>
          )}

          {(type === "hotel" || type === "flight" || type === "charter_flight") && (
            <>
              <FieldRow>
                <div>
                  <FieldLabel>{type === "hotel" ? "Rooms" : "Passengers"}</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={metadata.quantity || 1}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 1;
                      const ppu = metadata.pricePerUnit || 0;
                      setMetadata({ ...metadata, quantity: qty });
                      if (ppu > 0) setCost(String(qty * ppu));
                    }}
                    data-testid="input-quantity"
                  />
                </div>
                <div>
                  <FieldLabel>Price per unit</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={metadata.pricePerUnit || ""}
                    onChange={(e) => {
                      const ppu = parseInt(e.target.value) || 0;
                      const qty = metadata.quantity || 1;
                      setMetadata({ ...metadata, pricePerUnit: ppu });
                      if (ppu > 0) setCost(String(qty * ppu));
                    }}
                    placeholder="0"
                    data-testid="input-price-per-unit"
                  />
                </div>
              </FieldRow>
              {(metadata.quantity || 1) > 1 && metadata.pricePerUnit > 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-total-cost">
                  Total: {currency === "USD" ? "$" : currency === "EUR" ? "\u20ac" : currency === "GBP" ? "\u00a3" : currency + " "}
                  {((metadata.quantity || 1) * metadata.pricePerUnit).toLocaleString()}
                </p>
              )}
            </>
          )}

          {(type === "hotel" || type === "flight" || type === "charter_flight") && (
            <>
              <SectionHeading>Options / Variants</SectionHeading>
              {variants.map((v, i) => (
                <div key={v.id || `new-${i}`} className="border border-border rounded-md p-3 space-y-2" data-testid={`card-variant-${i}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={v.label}
                      onChange={(e) => updateVariant(i, { label: e.target.value })}
                      placeholder="Option label"
                      className="flex-1"
                      data-testid={`input-variant-label-${i}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(i)}
                      data-testid={`button-remove-variant-${i}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    value={v.description || ""}
                    onChange={(e) => updateVariant(i, { description: e.target.value })}
                    placeholder="Description (optional)"
                    data-testid={`input-variant-description-${i}`}
                  />
                  <FieldRow cols={3}>
                    <div>
                      <FieldLabel>Price</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        value={v.cost || ""}
                        onChange={(e) => updateVariant(i, { cost: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        data-testid={`input-variant-price-${i}`}
                      />
                    </div>
                    <div>
                      <FieldLabel>Qty</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        value={v.quantity || 1}
                        onChange={(e) => updateVariant(i, { quantity: parseInt(e.target.value) || 1 })}
                        data-testid={`input-variant-qty-${i}`}
                      />
                    </div>
                    <div>
                      <FieldLabel>Policy</FieldLabel>
                      <Select
                        value={v.refundability || "unknown"}
                        onValueChange={(val) => updateVariant(i, { refundability: val })}
                      >
                        <SelectTrigger data-testid={`select-variant-policy-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unknown">Not specified</SelectItem>
                          <SelectItem value="fully_refundable">Fully refundable</SelectItem>
                          <SelectItem value="partially_refundable">Partially refundable</SelectItem>
                          <SelectItem value="non_refundable">Non-refundable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </FieldRow>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addVariant}
                data-testid="button-add-variant"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add option
              </Button>
            </>
          )}

          <PhotosField photos={photos} onChange={setPhotos} />
        </div>

        <div className="shrink-0 border-t border-border/50 p-4 space-y-3">
          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-template"
                  checked={saveAsTemplate}
                  onCheckedChange={(v) => setSaveAsTemplate(!!v)}
                  data-testid="checkbox-save-template"
                />
                <label htmlFor="save-template" className="text-sm text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  <Bookmark className="w-3.5 h-3.5" />
                  Save as reusable template
                </label>
              </div>
              {saveAsTemplate && (
                <Input
                  value={templateLabel}
                  onChange={(e) => setTemplateLabel(e.target.value)}
                  placeholder="Template name, e.g. 'Aman Tokyo Standard Suite'"
                  className="text-sm"
                  data-testid="input-template-label"
                />
              )}
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={(type === "note" && !title.trim()) || saveMutation.isPending || (saveAsTemplate && !templateLabel.trim())}
            data-testid="button-save-segment"
          >
            {saveMutation.isPending ? "Saving..." : isEdit ? `Update ${cfg.label}` : `Save ${cfg.label}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

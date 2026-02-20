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

function FlightFields({ metadata, onChange }: { metadata: Record<string, any>; onChange: (m: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...metadata, [key]: val });
  const [searchNumber, setSearchNumber] = useState(metadata.flightNumber || "");
  const [searchDate, setSearchDate] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async () => {
    if (!searchNumber.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    setSearchError("");
    try {
      const params = new URLSearchParams({ flightNumber: searchNumber.trim() });
      if (searchDate) params.set("date", searchDate);
      const res = await fetch(`/api/flights/search?${params}`, { credentials: "include" });
      const data = await res.json();
      if (data.flight) {
        setSearchResult(data.flight);
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
    if (!searchResult) return;
    const f = searchResult;

    const depTime = f.departureDateTime || f.departure?.scheduledTime || "";
    const arrTime = f.arrivalDateTime || f.arrival?.scheduledTime || "";
    const depDate = f.departureDate || searchDate || "";
    const arrDate = f.departureDate || searchDate || "";

    onChange({
      ...metadata,
      flightNumber: f.flightNumber || metadata.flightNumber,
      airline: f.airline || metadata.airline,
      aircraft: f.aircraft || metadata.aircraft,
      status: f.status || "",
      departureAirport: f.departure?.iata || metadata.departureAirport,
      departureAirportName: f.departure?.city || metadata.departureAirportName || "",
      departureDate: depDate,
      departureTime: depTime.includes("T") ? depTime.split("T")[1].slice(0, 5) : depTime,
      arrivalAirport: f.arrival?.iata || metadata.arrivalAirport,
      arrivalAirportName: f.arrival?.city || metadata.arrivalAirportName || "",
      arrivalDate: arrDate,
      arrivalTime: arrTime.includes("T") ? arrTime.split("T")[1].slice(0, 5) : arrTime,
      departure: f.departure,
      arrival: f.arrival,
    });
    setSearchResult(null);
  };

  return (
    <div className="space-y-3">
      <SectionHeading>Search Flight</SectionHeading>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <FieldLabel>Flight Number</FieldLabel>
          <Input value={searchNumber} onChange={(e) => setSearchNumber(e.target.value)} placeholder="BA560" data-testid="input-flight-search-number"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }} />
        </div>
        <div className="flex-1 min-w-[120px]">
          <FieldLabel>Date (optional)</FieldLabel>
          <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} data-testid="input-flight-search-date" />
        </div>
        <Button variant="default" size="default" onClick={handleSearch} disabled={isSearching || !searchNumber.trim()} data-testid="button-search-flight">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
          Search
        </Button>
      </div>

      {searchResult && (
        <div className="border border-border rounded-md p-3 space-y-2 bg-accent/20" data-testid="card-flight-result">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{searchResult.flightNumber}</span>
            {searchResult.status && <Badge variant="outline" className="text-xs">{searchResult.status}</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            {searchResult.departure?.iata || searchResult.departure?.city || ""} {"\u2192"} {searchResult.arrival?.iata || searchResult.arrival?.city || ""}
          </div>
          {searchResult.departure?.city && searchResult.arrival?.city && (
            <div className="text-xs text-muted-foreground/60">
              {searchResult.departure.city} {"\u2192"} {searchResult.arrival.city}
            </div>
          )}
          {(searchResult.departure?.scheduledTime || searchResult.arrival?.scheduledTime) && (
            <div className="text-xs text-muted-foreground/60">
              {searchResult.departure?.scheduledTime && <span>Departs: {searchResult.departure.scheduledTime}</span>}
              {searchResult.departure?.scheduledTime && searchResult.arrival?.scheduledTime && <span className="mx-2">|</span>}
              {searchResult.arrival?.scheduledTime && <span>Arrives: {searchResult.arrival.scheduledTime}</span>}
            </div>
          )}
          {searchResult.aircraft && <div className="text-xs text-muted-foreground/40">Aircraft: {searchResult.aircraft}</div>}
          {searchResult.date && <div className="text-xs text-muted-foreground/40">Date: {searchResult.date}</div>}
          <Button size="sm" onClick={applyFlightData} data-testid="button-use-flight">
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Use this flight
          </Button>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Route and times auto-filled. Please enter airline name manually.
          </p>
        </div>
      )}

      {searchError && (
        <p className="text-sm text-muted-foreground/60 italic" data-testid="text-flight-not-found">{searchError}</p>
      )}

      <SectionHeading>Flight Details</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Airline</FieldLabel>
          <Input value={metadata.airline || ""} onChange={(e) => set("airline", e.target.value)} placeholder="British Airways" data-testid="input-airline" />
        </div>
        <div>
          <FieldLabel>Flight Number</FieldLabel>
          <Input value={metadata.flightNumber || ""} onChange={(e) => set("flightNumber", e.target.value)} placeholder="BA 560" data-testid="input-flight-number" />
        </div>
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel>Booking Class</FieldLabel>
          <Select value={metadata.bookingClass || ""} onValueChange={(v) => set("bookingClass", v)}>
            <SelectTrigger data-testid="select-booking-class">
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
          <Input value={metadata.confirmationNumber || ""} onChange={(e) => set("confirmationNumber", e.target.value)} placeholder="ABC123" data-testid="input-flight-confirmation" />
        </div>
      </FieldRow>

      <SectionHeading>Departure</SectionHeading>
      <div>
        <FieldLabel>Airport</FieldLabel>
        <Input value={metadata.departureAirport || ""} onChange={(e) => set("departureAirport", e.target.value)} placeholder="JFK - John F. Kennedy" data-testid="input-departure-airport" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" value={metadata.departureDate || ""} onChange={(e) => set("departureDate", e.target.value)} data-testid="input-departure-date" />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" value={metadata.departureTime || ""} onChange={(e) => set("departureTime", e.target.value)} data-testid="input-departure-time" />
        </div>
      </FieldRow>

      <SectionHeading>Arrival</SectionHeading>
      <div>
        <FieldLabel>Airport</FieldLabel>
        <Input value={metadata.arrivalAirport || ""} onChange={(e) => set("arrivalAirport", e.target.value)} placeholder="LHR - Heathrow" data-testid="input-arrival-airport" />
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" value={metadata.arrivalDate || ""} onChange={(e) => set("arrivalDate", e.target.value)} data-testid="input-arrival-date" />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" value={metadata.arrivalTime || ""} onChange={(e) => set("arrivalTime", e.target.value)} data-testid="input-arrival-time" />
        </div>
      </FieldRow>
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
      photos: details.photoRefs?.length ? details.photoRefs.map((r: string) => getPhotoUrl(r)) : metadata.photos,
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
  return (
    <div className="space-y-3">
      <SectionHeading>Transport Details</SectionHeading>
      <div>
        <FieldLabel>Type</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {transportSubTypes.map((t) => {
            const TIcon = t.icon;
            const selected = metadata.transportType === t.value;
            return (
              <Button
                key={t.value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => set("transportType", t.value)}
                data-testid={`button-transport-type-${t.value}`}
              >
                <TIcon className="w-3.5 h-3.5 mr-1" />
                {t.label}
              </Button>
            );
          })}
        </div>
      </div>
      <FieldRow>
        <div>
          <FieldLabel>Provider</FieldLabel>
          <Input value={metadata.provider || ""} onChange={(e) => set("provider", e.target.value)} placeholder="Blacklane, Trenitalia" data-testid="input-transport-provider" />
        </div>
        <div>
          <FieldLabel>Vehicle Details</FieldLabel>
          <Input value={metadata.vehicleDetails || ""} onChange={(e) => set("vehicleDetails", e.target.value)} placeholder="Mercedes S-Class" data-testid="input-vehicle-details" />
        </div>
      </FieldRow>

      <SectionHeading>Pickup</SectionHeading>
      <FieldRow>
        <div>
          <FieldLabel>Location</FieldLabel>
          <Input value={metadata.pickupLocation || ""} onChange={(e) => set("pickupLocation", e.target.value)} placeholder="Hotel lobby" data-testid="input-pickup-location" />
        </div>
        <div>
          <FieldLabel>Time</FieldLabel>
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
          <FieldLabel>Time</FieldLabel>
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
      <div>
        <FieldLabel>Confirmation Number</FieldLabel>
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
      photos: details.photoRefs?.length ? details.photoRefs.slice(0, 3).map((r: string) => getPhotoUrl(r)) : metadata.photos,
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
      photos: details.photoRefs?.length ? details.photoRefs.slice(0, 3).map((r: string) => getPhotoUrl(r)) : metadata.photos,
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

const typeFieldComponents: Record<string, typeof FlightFields> = {
  flight: FlightFields,
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
      const payload = {
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
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/trips/${tripId}/segments/${existingSegment.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/trips/${tripId}/versions/${versionId}/segments`, payload);
        return res.json();
      }
    },
    onSuccess: async () => {
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

          <TypeFields metadata={metadata} onChange={setMetadata} />

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

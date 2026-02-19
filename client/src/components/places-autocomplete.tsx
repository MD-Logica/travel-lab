import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUrl: string;
  rating: number;
  priceLevel: number;
  types: string[];
  editorialSummary: string;
  firstReview: string;
  photoRefs: string[];
  lat: number;
  lng: number;
}

interface PlacesAutocompleteProps {
  value: string;
  onValueChange: (val: string) => void;
  onPlaceSelect: (details: PlaceDetails) => void;
  placeholder?: string;
  types?: string;
  testId?: string;
}

export function PlacesAutocomplete({
  value,
  onValueChange,
  onPlaceSelect,
  placeholder = "Search...",
  types,
  testId = "input-places-search",
}: PlacesAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSearchRef = useRef(false);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ input });
      if (types) params.set("types", types);
      const res = await fetch(`/api/places/autocomplete?${params}`, { credentials: "include" });
      const data = await res.json();
      setPredictions(data.predictions || []);
      setIsOpen((data.predictions || []).length > 0);
    } catch {
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, [types]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onValueChange(val);
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    suppressSearchRef.current = true;
    onValueChange(prediction.structured_formatting?.main_text || prediction.description);
    setIsOpen(false);
    setPredictions([]);
    setIsFetchingDetails(true);
    try {
      const params = new URLSearchParams({ placeId: prediction.place_id });
      const res = await fetch(`/api/places/details?${params}`, { credentials: "include" });
      if (res.ok) {
        const details: PlaceDetails = await res.json();
        onPlaceSelect(details);
      }
    } catch {
    } finally {
      setIsFetchingDetails(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (predictions.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className="pl-8"
          data-testid={testId}
        />
        {(isLoading || isFetchingDetails) && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 animate-spin" />
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden" data-testid="dropdown-places-results">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover-elevate cursor-pointer flex items-start gap-2.5 border-b border-border/20 last:border-0"
              onClick={() => handleSelect(p)}
              data-testid={`option-place-${p.place_id}`}
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {p.structured_formatting?.main_text || p.description}
                </div>
                {p.structured_formatting?.secondary_text && (
                  <div className="text-xs text-muted-foreground/60 truncate">
                    {p.structured_formatting.secondary_text}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 text-right">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}

export function getPhotoUrl(ref: string, maxwidth = 400): string {
  return `/api/places/photo?ref=${encodeURIComponent(ref)}&maxwidth=${maxwidth}`;
}

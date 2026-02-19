import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, MapPin, Loader2 } from "lucide-react";
import type { DestinationEntry } from "@shared/schema";

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface DestinationInputProps {
  value: DestinationEntry[];
  onChange: (destinations: DestinationEntry[]) => void;
  placeholder?: string;
  testId?: string;
}

export function DestinationInput({
  value,
  onChange,
  placeholder = "Search cities or type freely...",
  testId = "input-destination",
}: DestinationInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ input, types: "(cities)" });
      const res = await fetch(`/api/places/autocomplete?${params}`, { credentials: "include" });
      const data = await res.json();
      setPredictions(data.predictions || []);
      setIsOpen((data.predictions || []).length > 0);
    } catch {
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setHighlightIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val.trim()), 300);
  };

  const addPlaceDestination = async (prediction: Prediction) => {
    setIsOpen(false);
    setPredictions([]);
    setInputValue("");
    const alreadyExists = value.some(d => d.placeId === prediction.place_id || d.name.toLowerCase() === (prediction.structured_formatting?.main_text || prediction.description.split(",")[0]).toLowerCase());
    if (alreadyExists) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/places/details?placeId=${prediction.place_id}`, { credentials: "include" });
      const details = await res.json();
      const mainText = prediction.structured_formatting?.main_text || prediction.description.split(",")[0];
      const secondaryText = prediction.structured_formatting?.secondary_text || "";
      const country = secondaryText.split(",").pop()?.trim() || "";
      const entry: DestinationEntry = {
        name: mainText,
        country,
        placeId: prediction.place_id,
        lat: details.lat,
        lng: details.lng,
      };
      onChange([...value, entry]);
    } catch {
      const mainText = prediction.structured_formatting?.main_text || prediction.description.split(",")[0];
      const secondaryText = prediction.structured_formatting?.secondary_text || "";
      const country = secondaryText.split(",").pop()?.trim() || "";
      onChange([...value, { name: mainText, country, placeId: prediction.place_id }]);
    } finally {
      setIsLoading(false);
    }
  };

  const addFreeTextDestination = (text: string) => {
    const trimmed = text.trim().replace(/,+$/, "").trim();
    if (!trimmed) return;
    const alreadyExists = value.some(d => d.name.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) return;
    onChange([...value, { name: trimmed, freeText: true }]);
    setInputValue("");
    setPredictions([]);
    setIsOpen(false);
  };

  const removeDestination = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlightIndex >= 0 && highlightIndex < predictions.length) {
        addPlaceDestination(predictions[highlightIndex]);
      } else if (inputValue.trim()) {
        addFreeTextDestination(inputValue);
      }
    } else if (e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addFreeTextDestination(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeDestination(value.length - 1);
    } else if (e.key === "ArrowDown" && isOpen) {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        if (inputValue.trim()) {
          addFreeTextDestination(inputValue);
        }
        setIsOpen(false);
      }
    }, 150);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (inputValue.trim()) {
          addFreeTextDestination(inputValue);
        }
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  return (
    <div ref={containerRef} className="relative" data-testid={`${testId}-container`}>
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((dest, idx) => (
          <Badge
            key={idx}
            variant="secondary"
            className="gap-1 shrink-0 text-xs font-normal"
            data-testid={`chip-destination-${idx}`}
          >
            <MapPin className="w-3 h-3 shrink-0 opacity-50" strokeWidth={1.5} />
            {dest.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeDestination(idx); }}
              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
              data-testid={`button-remove-destination-${idx}`}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : "Add another city..."}
            className="border-0 shadow-none h-6 px-0 py-0 focus-visible:ring-0 text-sm"
            data-testid={testId}
          />
          {isLoading && (
            <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden" data-testid="dropdown-destination-predictions">
          {predictions.map((pred, idx) => (
            <button
              key={pred.place_id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 transition-colors ${idx === highlightIndex ? "bg-accent" : "hover-elevate"}`}
              onClick={() => addPlaceDestination(pred)}
              onMouseEnter={() => setHighlightIndex(idx)}
              data-testid={`option-destination-${idx}`}
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <div>
                <p className="font-medium text-sm leading-tight">
                  {pred.structured_formatting?.main_text || pred.description}
                </p>
                {pred.structured_formatting?.secondary_text && (
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {pred.structured_formatting.secondary_text}
                  </p>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground/50 border-t border-border/30">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}

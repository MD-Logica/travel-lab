import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Search } from "lucide-react";
import {
  parsePhoneNumberFromString,
  AsYouType,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

interface CountryData {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function getFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

const PRIORITY_COUNTRIES: CountryCode[] = ["US", "GB", "CA", "AU", "FR", "DE", "IT", "ES", "JP", "AE", "SG", "CH", "NL", "BR", "MX", "IN"];

const allCountries: CountryData[] = (() => {
  const codes = getCountries();
  const list: CountryData[] = codes.map((code) => ({
    code,
    name: regionNames.of(code) || code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: getFlag(code),
  }));
  list.sort((a, b) => a.name.localeCompare(b.name));
  const priority = PRIORITY_COUNTRIES.map((c) => list.find((l) => l.code === c)!).filter(Boolean);
  const rest = list.filter((l) => !PRIORITY_COUNTRIES.includes(l.code));
  return [...priority, ...rest];
})();

function detectDefaultCountry(): CountryCode {
  try {
    const locale = navigator.language || "en-US";
    const parts = locale.split("-");
    const region = (parts[1] || parts[0]).toUpperCase() as CountryCode;
    if (getCountries().includes(region)) return region;
  } catch {}
  return "US";
}

interface PhoneInputProps {
  value: string;
  onChange: (formatted: string) => void;
  placeholder?: string;
  testId?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "Phone number",
  testId = "input-phone",
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(() => {
    if (value) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.country) return parsed.country;
    }
    return detectDefaultCountry();
  });
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const countryData = useMemo(() => allCountries.find((c) => c.code === selectedCountry), [selectedCountry]);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return allCountries;
    const q = search.toLowerCase();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.trim()) {
      onChange("");
      return;
    }
    const formatter = new AsYouType(selectedCountry);
    const formatted = formatter.input(raw);
    const phoneNumber = formatter.getNumber();
    if (phoneNumber) {
      onChange(phoneNumber.formatInternational());
    } else {
      onChange(formatted);
    }
  };

  const handleCountrySelect = (country: CountryData) => {
    setSelectedCountry(country.code);
    setIsOpen(false);
    setSearch("");
    if (value) {
      const parsed = parsePhoneNumberFromString(value, selectedCountry);
      if (parsed) {
        const national = parsed.nationalNumber;
        const newParsed = parsePhoneNumberFromString(national as string, country.code);
        if (newParsed) {
          onChange(newParsed.formatInternational());
          return;
        }
      }
      if (!value.startsWith("+")) {
        const newFormatted = new AsYouType(country.code).input(value);
        const newParsed = parsePhoneNumberFromString(newFormatted, country.code);
        if (newParsed) {
          onChange(newParsed.formatInternational());
          return;
        }
      }
    }
  };

  const isValid = useMemo(() => {
    if (!value || value.length < 5) return null;
    const parsed = parsePhoneNumberFromString(value, selectedCountry);
    return parsed?.isValid() || false;
  }, [value, selectedCountry]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = useMemo(() => {
    if (!value) return "";
    if (value.startsWith("+")) {
      const dialCode = countryData?.dialCode || "";
      if (value.startsWith(dialCode)) {
        return value.slice(dialCode.length).trim();
      }
    }
    return value;
  }, [value, countryData]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-0">
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-r-none border-r-0 px-2 shrink-0 min-w-[72px] justify-between gap-1"
          data-testid={`${testId}-country`}
        >
          <span className="text-sm">{countryData?.flag}</span>
          <span className="text-xs text-muted-foreground">{countryData?.dialCode}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
        </Button>
        <div className="relative flex-1">
          <Input
            value={displayValue}
            onChange={handlePhoneChange}
            placeholder={placeholder}
            className="rounded-l-none"
            data-testid={testId}
          />
          {isValid !== null && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {isValid ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden" data-testid={`${testId}-dropdown`}>
          <div className="p-2 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="pl-7 h-8 text-sm"
                data-testid={`${testId}-search`}
              />
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {filteredCountries.map((c, i) => {
              const isPriority = PRIORITY_COUNTRIES.includes(c.code);
              const isLastPriority = isPriority && (i === PRIORITY_COUNTRIES.length - 1 || !PRIORITY_COUNTRIES.includes(filteredCountries[i + 1]?.code));
              return (
                <div key={c.code}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 hover-elevate cursor-pointer flex items-center gap-2.5 text-sm ${selectedCountry === c.code ? "bg-accent/50" : ""}`}
                    onClick={() => handleCountrySelect(c)}
                    data-testid={`option-country-${c.code}`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground/50 shrink-0">{c.dialCode}</span>
                    {selectedCountry === c.code && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                  {isLastPriority && !search.trim() && (
                    <div className="h-px bg-border/30 mx-3" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

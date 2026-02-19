import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "\u20AC", GBP: "\u00A3", CHF: "CHF", AUD: "A$", CAD: "C$",
  JPY: "\u00A5", AED: "AED", SGD: "S$", HKD: "HK$", THB: "\u0E3F", INR: "\u20B9",
  BRL: "R$", MXN: "MX$",
};

function formatNumber(val: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  } catch {
    return val.toString();
  }
}

function parseNumericValue(display: string): string {
  return display.replace(/[^0-9.]/g, "");
}

interface CurrencyInputProps {
  value: string;
  onChange: (rawValue: string) => void;
  currency: string;
  placeholder?: string;
  testId?: string;
}

export function CurrencyInput({
  value,
  onChange,
  currency,
  placeholder = "0",
  testId = "input-currency",
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const symbol = useMemo(() => CURRENCY_SYMBOLS[currency] || currency, [currency]);

  useEffect(() => {
    if (!isFocused) {
      if (value && !isNaN(Number(value))) {
        setDisplayValue(formatNumber(Number(value), currency));
      } else {
        setDisplayValue(value || "");
      }
    }
  }, [value, currency, isFocused]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = parseNumericValue(raw);
    const parts = cleaned.split(".");
    let sanitized = parts[0];
    if (parts.length > 1) {
      sanitized += "." + parts[1].slice(0, 2);
    }
    setDisplayValue(raw.replace(/[^0-9.,]/g, ""));
    onChange(sanitized);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (value && !isNaN(Number(value))) {
      setDisplayValue(value);
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (value && !isNaN(Number(value))) {
      setDisplayValue(formatNumber(Number(value), currency));
    }
  }, [value, currency]);

  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none font-medium">
        {symbol}
      </span>
      <Input
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="pl-9"
        inputMode="decimal"
        data-testid={testId}
      />
    </div>
  );
}

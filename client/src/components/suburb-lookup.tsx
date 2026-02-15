import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface SuburbResult {
  suburb: string;
  postcode: string;
  state: string;
}

interface SuburbLookupProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: SuburbResult) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
  disabled?: boolean;
}

export function SuburbLookup({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing suburb or postcode...",
  className,
  "data-testid": testId,
  disabled,
}: SuburbLookupProps) {
  const [results, setResults] = useState<SuburbResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/address-lookup?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: SuburbResult[] = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
        setHighlightIndex(-1);
      }
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  const handleSelect = (result: SuburbResult) => {
    onChange(result.suburb);
    onSelect(result);
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className ? "" : ""}`}>
      <div className="relative">
        {!className && <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />}
        {className ? (
          // Custom styling mode (e.g., mobile form)
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            placeholder={placeholder}
            className={`${className} relative`}
            data-testid={testId}
            disabled={disabled}
            autoComplete="off"
          />
        ) : (
          // Default shadcn Input mode
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            placeholder={placeholder}
            className={`pl-8`}
            data-testid={testId}
            disabled={disabled}
            autoComplete="off"
          />
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
          data-testid="suburb-lookup-results"
        >
          <div className="max-h-[200px] overflow-y-auto">
            {results.map((r, idx) => (
              <button
                key={`${r.suburb}-${r.postcode}-${r.state}`}
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer ${
                  idx === highlightIndex ? "bg-accent text-accent-foreground" : "hover-elevate"
                }`}
                onClick={() => handleSelect(r)}
                data-testid={`suburb-result-${idx}`}
              >
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium">{r.suburb}</span>
                <span className="text-muted-foreground ml-auto">{r.state} {r.postcode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

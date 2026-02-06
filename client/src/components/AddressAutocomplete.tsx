import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { MapPin, Loader2 } from "lucide-react";

interface AddressResult {
  placeId: number;
  displayName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  }) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address...",
  id,
  className,
}: AddressAutocompleteProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    if (value.length < 3) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(value), 400);
    return () => clearTimeout(timer);
  }, [value]);

  const { data: results, isLoading } = trpc.vendors.searchAddress.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 3, staleTime: 60000 }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: AddressResult) => {
    onSelect({
      address: result.street,
      city: result.city,
      state: result.state,
      country: result.country,
      postalCode: result.postalCode,
    });
    onChange(result.street || result.displayName.split(",")[0]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (debouncedQuery.length >= 3) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className={className}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {showDropdown && results && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((result) => (
            <button
              key={result.placeId}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-slate-100 flex items-start gap-2 text-sm border-b last:border-b-0"
              onClick={() => handleSelect(result)}
            >
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{result.displayName.split(",")[0]}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[result.city, result.state, result.country].filter(Boolean).join(", ")}
                  {result.postalCode && ` ${result.postalCode}`}
                </p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t bg-slate-50">
            Powered by OpenStreetMap Nominatim
          </div>
        </div>
      )}
    </div>
  );
}

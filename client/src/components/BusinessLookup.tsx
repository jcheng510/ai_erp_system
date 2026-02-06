import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Building2, Loader2, Globe, Phone, MapPin } from "lucide-react";

interface BusinessResult {
  placeId: number;
  displayName: string;
  type: string;
  category: string;
  lat: string;
  lon: string;
  address: {
    road: string;
    houseNumber: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    county: string;
  } | null;
  extras: {
    phone: string;
    website: string;
    email: string;
    openingHours: string;
    description: string;
  } | null;
}

interface BusinessLookupProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (business: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    website?: string;
  }) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function BusinessLookup({
  value,
  onChange,
  onSelect,
  placeholder = "Search for a business...",
  id,
  className,
}: BusinessLookupProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    if (value.length < 3) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(value), 500);
    return () => clearTimeout(timer);
  }, [value]);

  const { data: results, isLoading } = trpc.vendors.searchBusiness.useQuery(
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

  const handleSelect = (result: BusinessResult) => {
    const street = result.address
      ? [result.address.houseNumber, result.address.road].filter(Boolean).join(" ")
      : "";
    const name = result.displayName.split(",")[0].trim();

    onSelect({
      name,
      address: street || undefined,
      city: result.address?.city || undefined,
      state: result.address?.state || undefined,
      country: result.address?.country || undefined,
      postalCode: result.address?.postalCode || undefined,
      phone: result.extras?.phone || undefined,
      email: result.extras?.email || undefined,
      website: result.extras?.website || undefined,
    });
    onChange(name);
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
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-72 overflow-auto">
          {results.map((result) => {
            const name = result.displayName.split(",")[0].trim();
            const location = [
              result.address?.city,
              result.address?.state,
              result.address?.country,
            ].filter(Boolean).join(", ");

            return (
              <button
                key={result.placeId}
                type="button"
                className="w-full px-3 py-2.5 text-left hover:bg-slate-100 border-b last:border-b-0"
                onClick={() => handleSelect(result)}
              >
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{name}</p>
                    {location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {location}
                        {result.address?.postalCode && ` ${result.address.postalCode}`}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      {result.extras?.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {result.extras.phone}
                        </span>
                      )}
                      {result.extras?.website && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {result.extras.website.replace(/^https?:\/\//, "").split("/")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t bg-slate-50">
            Powered by OpenStreetMap Nominatim
          </div>
        </div>
      )}
    </div>
  );
}

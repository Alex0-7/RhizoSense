import React from "react";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search fields by name or crop...",
  className = "",
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={15} className="absolute left-3 text-mutedText pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-9 pr-8 py-2 bg-surface border border-borderDefault rounded-btn text-xs text-primaryText placeholder:text-mutedText focus:outline-none focus:border-borderStrong transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 p-1 text-mutedText hover:text-primaryText rounded-full"
          aria-label="Clear search input"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

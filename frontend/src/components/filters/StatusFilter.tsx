import React from "react";
import { Status } from "../../types";

interface StatusFilterProps {
  selectedStatus: Status | "all";
  onChange: (status: Status | "all") => void;
  className?: string;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  selectedStatus,
  onChange,
  className = "",
}) => {
  const options: { id: Status | "all"; label: string }[] = [
    { id: "all", label: "All Statuses" },
    { id: "normal", label: "Normal" },
    { id: "advisory", label: "Advisory" },
    { id: "warning", label: "Warning" },
    { id: "critical", label: "Critical" },
  ];

  return (
    <div className={`inline-flex items-center gap-1 p-1 bg-surface-secondary/70 border border-borderDefault/70 rounded-btn flex-wrap ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors ${
            selectedStatus === opt.id
              ? "bg-surface text-primaryText font-semibold shadow-sm"
              : "text-secondaryText hover:text-primaryText hover:bg-surface/50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

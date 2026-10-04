import React from "react";
import { NotificationSeverity, NotificationState } from "../../types";

interface NotificationFiltersProps {
  selectedSeverity: NotificationSeverity | "all";
  onSeverityChange: (sev: NotificationSeverity | "all") => void;
  selectedState: NotificationState | "all";
  onStateChange: (state: NotificationState | "all") => void;
  counts: {
    all: number;
    critical: number;
    warning: number;
    advisory: number;
    resolved: number;
  };
}

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedSeverity,
  onSeverityChange,
  selectedState,
  onStateChange,
  counts,
}) => {
  const tabs: { id: NotificationSeverity | "all"; label: string; count: number }[] = [
    { id: "all", label: "All Alerts", count: counts.all },
    { id: "critical", label: "Critical", count: counts.critical },
    { id: "warning", label: "Warning", count: counts.warning },
    { id: "advisory", label: "Advisory", count: counts.advisory },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-surface border border-borderDefault rounded-card">
      {/* Severity filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              onSeverityChange(tab.id);
              if (selectedState === "resolved") onStateChange("all");
            }}
            className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              selectedSeverity === tab.id && selectedState !== "resolved"
                ? "bg-surface-secondary text-primaryText font-semibold shadow-sm"
                : "text-secondaryText hover:text-primaryText"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/5 font-semibold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* State filter: Active vs Resolved */}
      <div className="flex items-center gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-borderDefault/50">
        <button
          onClick={() => onStateChange(selectedState === "resolved" ? "all" : "resolved")}
          className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors flex items-center gap-1.5 ${
            selectedState === "resolved"
              ? "bg-primaryText text-white font-semibold shadow-sm"
              : "text-secondaryText hover:text-primaryText"
          }`}
        >
          <span>Resolved History</span>
          {counts.resolved > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-semibold">
              {counts.resolved}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

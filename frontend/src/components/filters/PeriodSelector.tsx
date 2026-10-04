import React from "react";
import { AnalyticsPeriod } from "../../types";

interface PeriodSelectorProps {
  selectedPeriod: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onChange,
  className = "",
}) => {
  const periods: { id: AnalyticsPeriod; label: string }[] = [
    { id: "24h", label: "24H" },
    { id: "7d", label: "7D" },
    { id: "30d", label: "30D" },
  ];

  return (
    <div className={`inline-flex items-center gap-1 p-1 bg-surface-secondary/70 border border-borderDefault/70 rounded-btn ${className}`}>
      {periods.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1 rounded-btn text-xs font-medium transition-colors ${
            selectedPeriod === p.id
              ? "bg-surface text-primaryText font-semibold shadow-sm"
              : "text-secondaryText hover:text-primaryText hover:bg-surface/50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

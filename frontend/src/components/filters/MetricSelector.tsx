import React from "react";
import { MetricType } from "../../types";

interface MetricSelectorProps {
  selectedMetrics: MetricType[];
  onChange: (metrics: MetricType[]) => void;
  maxMetrics?: number;
  className?: string;
}

const ALL_METRICS: { id: MetricType; label: string }[] = [
  { id: "soil_moisture", label: "Soil Moisture" },
  { id: "temperature", label: "Temperature" },
  { id: "humidity", label: "Humidity" },
  { id: "crop_health", label: "Crop Health" },
  { id: "pest_activity", label: "Pest Activity" },
  { id: "disease_risk", label: "Disease Risk" },
  { id: "water_consumption", label: "Water Consumption" },
];

export const MetricSelector: React.FC<MetricSelectorProps> = ({
  selectedMetrics,
  onChange,
  maxMetrics = 3,
  className = "",
}) => {
  const toggleMetric = (metricId: MetricType) => {
    if (selectedMetrics.includes(metricId)) {
      // Cannot deselect if it's the only one left
      if (selectedMetrics.length === 1) return;
      onChange(selectedMetrics.filter((m) => m !== metricId));
    } else {
      if (selectedMetrics.length >= maxMetrics) return;
      onChange([...selectedMetrics, metricId]);
    }
  };

  const isAtMax = selectedMetrics.length >= maxMetrics;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs text-secondaryText mb-1">
        <span className="font-semibold uppercase tracking-wider">Metrics (Max {maxMetrics})</span>
        <span className="text-[11px] text-mutedText">
          {selectedMetrics.length} of {maxMetrics} selected
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ALL_METRICS.map((m) => {
          const isSelected = selectedMetrics.includes(m.id);
          const isDisabled = !isSelected && isAtMax;

          return (
            <button
              key={m.id}
              onClick={() => toggleMetric(m.id)}
              disabled={isDisabled}
              className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primaryText text-white shadow-sm font-semibold"
                  : isDisabled
                  ? "bg-surface-secondary/40 text-mutedText/50 border border-borderDefault/40 cursor-not-allowed"
                  : "bg-surface text-secondaryText hover:text-primaryText border border-borderDefault hover:border-borderStrong"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

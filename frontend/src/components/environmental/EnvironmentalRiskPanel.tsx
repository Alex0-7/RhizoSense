import React from "react";
import { Sun, Droplets, Waves, Bug } from "lucide-react";
import { EnvironmentalSummary } from "../../types";
import { StatusBadge } from "../status/StatusBadge";

interface EnvironmentalRiskPanelProps {
  environmental: EnvironmentalSummary;
  className?: string;
}

export const EnvironmentalRiskPanel: React.FC<EnvironmentalRiskPanelProps> = ({
  environmental,
  className = "",
}) => {
  const items = [
    {
      label: "Heat Stress",
      icon: Sun,
      risk: environmental.heatStress,
    },
    {
      label: "Drought Risk",
      icon: Droplets,
      risk: environmental.droughtRisk,
    },
    {
      label: "Flood & Surface Water",
      icon: Waves,
      risk: environmental.floodRisk,
    },
    {
      label: "Disease Weather",
      icon: Bug,
      risk: environmental.diseaseWeather,
    },
  ];

  return (
    <div className={`rounded-card border border-borderDefault bg-surface p-5 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-primaryText uppercase tracking-wider">
          Environmental Conditions
        </h3>
        <span className="text-[11px] text-mutedText">
          Updated {new Date(environmental.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isElevated = item.risk.status !== "normal";

          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                isElevated
                  ? item.risk.status === "critical"
                    ? "bg-status-critical-bg/60 border-status-critical-border/70"
                    : "bg-status-warning-bg/60 border-status-warning-border/70"
                  : "bg-surface-secondary/50 border-borderDefault/50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white border border-borderDefault/80 flex items-center justify-center shrink-0">
                  <Icon size={14} className={isElevated ? "text-primaryText" : "text-secondaryText"} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-primaryText block">{item.label}</span>
                  <span className="text-[11px] text-secondaryText block">{item.risk.label}</span>
                </div>
              </div>

              <StatusBadge status={item.risk.status} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

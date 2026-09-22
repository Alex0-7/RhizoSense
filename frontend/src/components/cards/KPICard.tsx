import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Status } from "../../types";
import { StatusBadge } from "../status/StatusBadge";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  status: Status;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  subtext?: string;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  unit,
  status,
  icon: Icon,
  trend,
  subtext,
  className = "",
}) => {
  const isCritical = status === "critical";
  const isWarning = status === "warning";

  return (
    <div
      className={`rounded-card border transition-colors duration-200 p-4 flex flex-col justify-between shadow-card ${
        isCritical
          ? "bg-status-critical-bg border-status-critical-border"
          : isWarning
          ? "bg-surface border-status-warning-border"
          : "bg-surface border-borderDefault"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-secondaryText uppercase tracking-wider flex items-center gap-1.5">
          <Icon size={15} className={isCritical ? "text-status-critical" : "text-secondaryText"} />
          {label}
        </span>
        <StatusBadge status={status} size="sm" />
      </div>

      <div className="my-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-semibold text-primaryText tracking-tight">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-secondaryText">{unit}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-secondaryText mt-1 pt-2 border-t border-borderDefault/50">
        {trend ? (
          <div className="flex items-center gap-1">
            {trend.direction === "up" && <TrendingUp size={13} className="text-status-normal" />}
            {trend.direction === "down" && <TrendingDown size={13} className="text-status-warning" />}
            {trend.direction === "neutral" && <Minus size={13} className="text-mutedText" />}
            <span className="font-medium text-primaryText">
              {trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : ""}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-mutedText">{trend.label || "vs baseline"}</span>
          </div>
        ) : (
          <span className="text-mutedText">{subtext || "Real-time telemetry"}</span>
        )}
      </div>
    </div>
  );
};

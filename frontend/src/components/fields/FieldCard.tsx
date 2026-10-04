import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplet, Thermometer, Activity } from "lucide-react";
import { FieldSummary } from "../../types";
import { StatusBadge } from "../status/StatusBadge";

interface FieldCardProps {
  field: FieldSummary;
  className?: string;
}

export const FieldCard: React.FC<FieldCardProps> = ({ field, className = "" }) => {
  const isCritical = field.status === "critical";
  const isWarning = field.status === "warning";

  return (
    <div
      className={`rounded-card border p-4 sm:p-5 flex flex-col justify-between shadow-card transition-all duration-200 hover:shadow-md ${
        isCritical
          ? "bg-status-critical-bg border-status-critical-border"
          : isWarning
          ? "bg-surface border-status-warning-border"
          : "bg-surface border-borderDefault hover:border-borderStrong"
      } ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-primaryText">{field.name}</h4>
            <p className="text-xs text-secondaryText mt-0.5">
              {field.crop} · {field.areaAcres} acres
            </p>
          </div>
          <StatusBadge status={field.status} size="sm" />
        </div>

        {field.issue && field.status !== "normal" && (
          <div className="mt-2.5 px-2.5 py-1 rounded bg-black/5 text-xs font-medium text-primaryText">
            {field.issue}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-borderDefault/60">
          <div>
            <span className="text-[11px] font-medium text-secondaryText flex items-center gap-1">
              <Activity size={12} className="text-secondaryText" />
              Health
            </span>
            <span className="text-sm font-semibold text-primaryText mt-0.5 block">
              {field.healthPercent}%
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-secondaryText flex items-center gap-1">
              <Droplet size={12} className={isCritical ? "text-status-critical" : "text-secondaryText"} />
              Moisture
            </span>
            <span
              className={`text-sm font-semibold mt-0.5 block ${
                isCritical ? "text-status-critical" : "text-primaryText"
              }`}
            >
              {field.soilMoisturePercent}%
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-secondaryText flex items-center gap-1">
              <Thermometer size={12} className="text-secondaryText" />
              Temp
            </span>
            <span className="text-sm font-semibold text-primaryText mt-0.5 block">
              {field.temperatureC}°C
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-borderDefault/60 flex items-center justify-between">
        <span className="text-[11px] text-mutedText">
          Last updated {new Date(field.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <Link
          to={`/fields/${field.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primaryText hover:text-black transition-colors"
        >
          <span>View Details</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};

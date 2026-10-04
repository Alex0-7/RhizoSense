import React from "react";
import { Zone, RiskLevel } from "../../types/canonical";
import { ShieldCheck, AlertCircle, AlertTriangle, XCircle } from "lucide-react";

interface ZoneGridMapProps {
  zones: Zone[];
  activeZoneId: string;
  onSelectZone: (zoneId: string) => void;
}

const RISK_CONFIG: Record<
  RiskLevel,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  HEALTHY: {
    label: "Healthy",
    bg: "bg-emerald-50 hover:bg-emerald-100/80",
    border: "border-emerald-300",
    text: "text-emerald-950",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    icon: ShieldCheck,
  },
  MONITOR: {
    label: "Monitor",
    bg: "bg-amber-50 hover:bg-amber-100/80",
    border: "border-amber-300",
    text: "text-amber-950",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    icon: AlertCircle,
  },
  ATTENTION: {
    label: "Attention",
    bg: "bg-orange-50 hover:bg-orange-100/80",
    border: "border-orange-300",
    text: "text-orange-950",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-800",
    icon: AlertTriangle,
  },
  ACTION_REQUIRED: {
    label: "Action Required",
    bg: "bg-rose-50 hover:bg-rose-100/80",
    border: "border-rose-400",
    text: "text-rose-950",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-800",
    icon: XCircle,
  },
};

export const ZoneGridMap: React.FC<ZoneGridMapProps> = ({
  zones,
  activeZoneId,
  onSelectZone,
}) => {
  // Sort zones by row (1..5) then column (1..5)
  const sortedZones = [...zones].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.column - b.column;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Farm Spatial Field Map (5 m × 5 m Zones)
          </h3>
          <p className="text-xs text-slate-500">
            Interactive micro-zone grid. Tap any zone cell to view diagnosis, sensor telemetry, and advisory.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(["HEALTHY", "MONITOR", "ATTENTION", "ACTION_REQUIRED"] as RiskLevel[]).map(
            (risk) => {
              const cfg = RISK_CONFIG[risk];
              return (
                <div
                  key={risk}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      risk === "HEALTHY"
                        ? "bg-emerald-500"
                        : risk === "MONITOR"
                        ? "bg-amber-400"
                        : risk === "ATTENTION"
                        ? "bg-orange-500"
                        : "bg-rose-600"
                    }`}
                  />
                  <span className="font-medium text-slate-700">{cfg.label}</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* 5x5 Grid */}
      <div className="grid grid-cols-5 gap-2.5 sm:gap-3.5 max-w-4xl mx-auto my-2">
        {sortedZones.map((zone) => {
          const risk = zone.current_risk || "HEALTHY";
          const cfg = RISK_CONFIG[risk];
          const Icon = cfg.icon;
          const isSelected = zone.zone_id.toUpperCase() === activeZoneId.toUpperCase();

          return (
            <button
              key={zone.zone_id}
              type="button"
              onClick={() => onSelectZone(zone.zone_id)}
              aria-label={`Zone ${zone.zone_id}, Status: ${cfg.label}`}
              className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-xl border-2 transition-all cursor-pointer text-center select-none ${
                cfg.bg
              } ${cfg.border} ${
                isSelected
                  ? "ring-3 ring-emerald-600 ring-offset-2 scale-102 shadow-md z-10 font-bold"
                  : "hover:scale-101 hover:shadow-xs"
              }`}
            >
              {/* Active selection dot indicator */}
              {isSelected && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-600"></span>
                </span>
              )}

              <span className="text-sm sm:text-base font-bold font-mono tracking-tight text-slate-900">
                {zone.zone_id}
              </span>

              <div className="mt-1 sm:mt-1.5 flex items-center justify-center">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    risk === "HEALTHY"
                      ? "text-emerald-600"
                      : risk === "MONITOR"
                      ? "text-amber-500"
                      : risk === "ATTENTION"
                      ? "text-orange-500"
                      : "text-rose-600 animate-bounce"
                  }`}
                />
              </div>

              <span
                className={`mt-1.5 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold rounded-md ${cfg.badgeBg} ${cfg.badgeText}`}
              >
                {cfg.label}
              </span>

              <span className="mt-1 text-[9px] text-slate-500 hidden sm:block">
                5m × 5m • {zone.crop || "Tomato"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Target Selected Zone: <strong className="font-mono text-emerald-800">{activeZoneId}</strong></span>
        <span>Grid Size: 5m × 5m • Total: 25 micro-zones</span>
      </div>
    </div>
  );
};

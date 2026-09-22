import React from "react";
import { Activity, Droplet, Thermometer, Waves, RefreshCw } from "lucide-react";
import { useFarm } from "../state/FarmContext";
import { KPICard } from "../components/cards/KPICard";
import { AttentionPanel } from "../components/cards/AttentionPanel";
import { FieldStatusGrid } from "../components/fields/FieldStatusGrid";
import { EnvironmentalRiskPanel } from "../components/environmental/EnvironmentalRiskPanel";
import { EdgeSystemPanel } from "../components/environmental/EdgeSystemPanel";

export const OverviewPage: React.FC = () => {
  const { farmSummary, fields, loading, error, refresh } = useFarm();

  if (loading && !farmSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primaryText border-t-transparent animate-spin" />
        <p className="text-xs text-secondaryText">Loading farm telemetry...</p>
      </div>
    );
  }

  if (error && !farmSummary) {
    return (
      <div className="p-8 text-center bg-surface border border-borderDefault rounded-card max-w-lg mx-auto mt-12 shadow-card">
        <h3 className="text-sm font-semibold text-primaryText">Unable to connect to RhizoSense service</h3>
        <p className="text-xs text-secondaryText mt-1.5">{error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 rounded-btn bg-primaryText text-white text-xs font-medium hover:bg-black transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const farm = farmSummary?.farm;
  const environmental = farmSummary?.environmental;
  const edgeSystem = farmSummary?.edgeSystem;

  // Calculate average farm KPIs from active fields
  const avgHealth = fields.length
    ? Math.round(fields.reduce((acc, f) => acc + f.healthPercent, 0) / fields.length)
    : 88;
  const avgMoisture = fields.length
    ? Math.round(fields.reduce((acc, f) => acc + f.soilMoisturePercent, 0) / fields.length)
    : 47;
  const avgTemp = fields.length
    ? (fields.reduce((acc, f) => acc + f.temperatureC, 0) / fields.length).toFixed(1)
    : "29.8";

  // Rely on backend domain statuses
  const hasCriticalField = fields.some((f) => f.status === "critical");
  const hasWarningField = fields.some((f) => f.status === "warning");
  const cropHealthStatus = hasCriticalField ? "critical" : hasWarningField ? "warning" : "normal";

  const moistureStatus = environmental?.droughtRisk.status || (hasCriticalField ? "critical" : "normal");
  const tempStatus = environmental?.heatStress.status || "normal";
  const waterStatusLevel = environmental?.waterStatus?.status || (hasCriticalField ? "critical" : "normal");
  const waterStatusLabel = environmental?.waterStatus?.label || "Adequate";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Farm Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-borderDefault">
        <div>
          <div className="text-xs font-semibold text-secondaryText uppercase tracking-wider mb-1">
            Operational Overview
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primaryText tracking-tight">
            {farm?.name || "Demo Farm"}
          </h1>
          <p className="text-xs text-secondaryText mt-1 flex items-center gap-2 flex-wrap">
            <span>Primary Crop: <strong className="text-primaryText font-medium">{farm?.primaryCrop || "Tomato"}</strong></span>
            <span>·</span>
            <span>Total Area: <strong className="text-primaryText font-medium">{farm?.areaAcres || 12.4} acres</strong></span>
            <span>·</span>
            <span>Monitored Fields: <strong className="text-primaryText font-medium">{farm?.fieldCount || 6} zones</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-mutedText block">Last Telemetry Refresh</span>
            <span className="text-xs font-mono font-medium text-primaryText">
              {farmSummary?.lastUpdated
                ? new Date(farmSummary.lastUpdated).toLocaleTimeString()
                : "Active"}
            </span>
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-btn border border-borderDefault bg-surface hover:bg-surface-secondary text-secondaryText hover:text-primaryText transition-colors shadow-sm"
            title="Refresh state from backend"
            aria-label="Refresh farm state"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (4 Key Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Crop Health"
          value={avgHealth}
          unit="%"
          status={cropHealthStatus}
          icon={Activity}
          trend={{ value: 2.4, direction: "up", label: "vs baseline" }}
        />
        <KPICard
          label="Soil Moisture"
          value={avgMoisture}
          unit="%"
          status={moistureStatus}
          icon={Droplet}
          subtext="Canopy average"
        />
        <KPICard
          label="Air Temperature"
          value={avgTemp}
          unit="°C"
          status={tempStatus}
          icon={Thermometer}
          subtext="Canopy ambient"
        />
        <KPICard
          label="Water Status"
          value={waterStatusLabel}
          status={waterStatusLevel}
          icon={Waves}
          subtext="Irrigation demand"
        />
      </div>

      {/* Attention Required Panel */}
      <AttentionPanel fields={fields} />

      {/* Monitored Fields Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-semibold text-primaryText uppercase tracking-wider">
            Monitored Field Zones
          </h2>
          <span className="text-xs text-secondaryText">
            {fields.filter((f) => f.status === "normal").length} of {fields.length} nominal
          </span>
        </div>
        <FieldStatusGrid fields={fields} />
      </div>

      {/* Bottom Row: Environmental Conditions & Edge System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {environmental && <EnvironmentalRiskPanel environmental={environmental} />}
        {edgeSystem && <EdgeSystemPanel edgeSystem={edgeSystem} />}
      </div>
    </div>
  );
};

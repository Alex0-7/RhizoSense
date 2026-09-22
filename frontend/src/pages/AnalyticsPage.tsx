import React, { useState, useEffect, useCallback } from "react";
import { useFarm } from "../state/FarmContext";
import { MetricType, AnalyticsPeriod, MetricSeries } from "../types";
import { fetchAnalytics } from "../services/api";
import { ChartContainer } from "../components/charts/ChartContainer";
import { ComparisonChart } from "../components/charts/ComparisonChart";
import { MetricSelector } from "../components/filters/MetricSelector";
import { PeriodSelector } from "../components/filters/PeriodSelector";

export const AnalyticsPage: React.FC = () => {
  const { fields } = useFarm();

  const [selectedFieldId, setSelectedFieldId] = useState<string>("field-c");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>([
    "soil_moisture",
    "temperature",
    "crop_health",
  ]);
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>("24h");
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAnalytics(selectedFieldId, selectedMetrics, selectedPeriod);
      setSeries(res.series);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedFieldId, selectedMetrics, selectedPeriod]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const selectedFieldName =
    fields.find((f) => f.id === selectedFieldId)?.name || selectedFieldId.replace("-", " ").toUpperCase();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-borderDefault">
        <div className="text-xs font-semibold text-secondaryText uppercase tracking-wider mb-1">
          Agronomic Exploration
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primaryText tracking-tight">
          Field Telemetry Analytics
        </h1>
        <p className="text-xs text-secondaryText mt-1">
          Inspect temporal correlations between soil moisture, canopy climate, and crop health indices.
        </p>
      </div>

      {/* Analytics Controls Bar */}
      <div className="p-4 sm:p-5 bg-surface rounded-card border border-borderDefault shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Field Selection */}
          <div>
            <label className="text-xs font-semibold text-secondaryText uppercase tracking-wider block mb-1.5">
              Select Field Zone
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors ${
                    selectedFieldId === f.id
                      ? "bg-primaryText text-white font-semibold shadow-sm"
                      : "bg-surface-secondary text-secondaryText hover:text-primaryText"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Period Selector */}
          <div>
            <label className="text-xs font-semibold text-secondaryText uppercase tracking-wider block mb-1.5">
              Time Period
            </label>
            <PeriodSelector selectedPeriod={selectedPeriod} onChange={setSelectedPeriod} />
          </div>
        </div>

        {/* Metric Selector (enforces max 3) */}
        <div className="pt-3 border-t border-borderDefault/60">
          <MetricSelector
            selectedMetrics={selectedMetrics}
            onChange={setSelectedMetrics}
            maxMetrics={3}
          />
        </div>
      </div>

      {/* Main Multi-Metric Comparison Chart */}
      <ChartContainer
        title={`${selectedFieldName} — Multi-Metric Time Series`}
        description={`Displaying ${selectedMetrics.length} series across ${selectedPeriod.toUpperCase()} window with interactive point inspection`}
        controls={
          loading ? (
            <span className="text-xs text-mutedText flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Loading series...
            </span>
          ) : undefined
        }
      >
        <ComparisonChart series={series} />
      </ChartContainer>

      {/* Agronomic Context Footer */}
      <div className="p-4 rounded-card bg-surface border border-borderDefault shadow-card text-xs text-secondaryText flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <span className="font-medium text-primaryText">
          RhizoSense Automated Sensor Validation
        </span>
        <span className="text-mutedText">
          Calibrated using Qualcomm Edge AI on-device spectral model v1.2
        </span>
      </div>
    </div>
  );
};

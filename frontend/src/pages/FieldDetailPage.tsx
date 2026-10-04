import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Activity, Droplet, Thermometer, CloudRain, Clock } from "lucide-react";
import { Field, MetricSeries } from "../types";
import { fetchFieldDetail, fetchAnalytics } from "../services/api";
import { useFarm } from "../state/FarmContext";
import { StatusBadge } from "../components/status/StatusBadge";
import { KPICard } from "../components/cards/KPICard";
import { AIAssessmentCard } from "../components/cards/AIAssessmentCard";
import { RecommendationCard } from "../components/cards/RecommendationCard";
import { ChartContainer } from "../components/charts/ChartContainer";
import { TrendChart } from "../components/charts/TrendChart";
import { EdgeVisionPanel } from "../components/vision/EdgeVisionPanel";

export const FieldDetailPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();
  const { markRecommendationReviewed, fields } = useFarm();

  const [field, setField] = useState<Field | null>(null);
  const [trendSeries, setTrendSeries] = useState<MetricSeries | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadFieldData = useCallback(async () => {
    if (!fieldId) return;
    try {
      setLoading(true);
      setError(null);
      const [fieldData, analyticsData] = await Promise.all([
        fetchFieldDetail(fieldId),
        fetchAnalytics(fieldId, ["soil_moisture"], "24h"),
      ]);
      setField(fieldData);
      if (analyticsData.series.length) {
        setTrendSeries(analyticsData.series[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load field details");
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    loadFieldData();
  }, [loadFieldData]);

  // When live field summary in context updates, refresh detail data
  const summaryField = fields.find((f) => f.id === fieldId);
  useEffect(() => {
    if (summaryField && field && summaryField.lastUpdated !== field.lastUpdated) {
      loadFieldData();
    }
  }, [summaryField, field, loadFieldData]);

  if (loading && !field) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primaryText border-t-transparent animate-spin" />
        <p className="text-xs text-secondaryText">Loading field telemetry and AI assessments...</p>
      </div>
    );
  }

  if (error || !field) {
    return (
      <div className="p-8 text-center bg-surface border border-borderDefault rounded-card max-w-lg mx-auto mt-12 shadow-card">
        <h3 className="text-sm font-semibold text-primaryText">Field Not Found</h3>
        <p className="text-xs text-secondaryText mt-1.5">{error || `Field '${fieldId}' could not be located.`}</p>
        <Link
          to="/fields"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-primaryText text-white text-xs font-medium hover:bg-black transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Return to Fields</span>
        </Link>
      </div>
    );
  }

  const isCritical = field.status === "critical";

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          to="/fields"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-secondaryText hover:text-primaryText mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Fields</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-borderDefault">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-primaryText tracking-tight">
                {field.name}
              </h1>
              <StatusBadge status={field.status} />
            </div>
            <p className="text-xs text-secondaryText mt-1">
              Crop: <strong className="text-primaryText font-medium">{field.crop}</strong> · Area:{" "}
              <strong className="text-primaryText font-medium">{field.areaAcres} acres</strong>
              {field.risk.title && field.status !== "normal" && (
                <span> · Issue: <strong className={isCritical ? "text-status-critical" : "text-status-warning"}>{field.risk.title}</strong></span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-mutedText">
            <Clock size={13} />
            <span>Updated {new Date(field.lastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Crop Health"
          value={field.cropHealth.score}
          unit="%"
          status={field.cropHealth.status}
          icon={Activity}
          subtext={`Condition: ${field.cropHealth.condition.replace("_", " ")}`}
        />
        <KPICard
          label="Soil Moisture"
          value={field.water.soilMoisturePercent}
          unit="%"
          status={field.environmental.droughtRisk.status}
          icon={Droplet}
          subtext={field.water.irrigationNeeded ? "Irrigation needed" : field.environmental.droughtRisk.label}
        />
        <KPICard
          label="Temperature"
          value={field.environmental.temperatureC}
          unit="°C"
          status={field.environmental.heatStress.status}
          icon={Thermometer}
          subtext={field.environmental.heatStress.label}
        />
        <KPICard
          label="Humidity"
          value={field.environmental.humidityPercent}
          unit="%"
          status={field.environmental.diseaseWeather.status}
          icon={CloudRain}
          subtext={field.environmental.diseaseWeather.label}
        />
      </div>

      {/* Edge Vision — Plant Pathology & Camera Stream */}
      <EdgeVisionPanel fieldId={field.id} fieldName={field.name} />

      {/* AI Assessment & Actionable Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {field.aiAssessment && <AIAssessmentCard assessment={field.aiAssessment} />}
        {field.recommendation && (
          <RecommendationCard
            recommendation={field.recommendation}
            onMarkReviewed={markRecommendationReviewed}
          />
        )}
      </div>

      {/* Trend Chart (24H Soil Moisture) */}
      {trendSeries && (
        <ChartContainer
          title={`${field.name} — 24-Hour Soil Moisture Trend`}
          description="High-frequency calibrated volumetric moisture readings across the root rhizosphere zone"
        >
          <TrendChart
            data={trendSeries.points}
            metricLabel="Soil Moisture"
            unit={trendSeries.unit}
            color={isCritical ? "#C94A4A" : "#2563EB"}
          />
        </ChartContainer>
      )}
    </div>
  );
};

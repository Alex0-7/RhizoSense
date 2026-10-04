import React from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import {
  HelpCircle,
  Eye,
  Activity,
  CloudSun,
  Cpu,
  ArrowDown,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const WhyPage: React.FC = () => {
  const { activeZoneId, activeDiagnosis } = useFarm();
  const navigate = useNavigate();

  if (!activeDiagnosis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto space-y-4">
        <h2 className="text-lg font-bold text-slate-900">No Assessment to Explain</h2>
        <p className="text-sm text-slate-500">Select a zone from the map to view its evidence chain.</p>
        <button
          type="button"
          onClick={() => navigate("/farmer/map")}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold"
        >
          Open Field Map
        </button>
      </div>
    );
  }

  const { diagnosis, visual_evidence, sensor_evidence, environmental_match, recommendation } = activeDiagnosis;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase mb-2">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
          Explainability Engine • Zone {activeZoneId}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
          Why did RhizoSense reach this assessment?
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Full transparent audit trail connecting raw canopy vision, root telemetry, and microclimate rules.
        </p>
      </div>

      {/* Causal Evidence Chain Pipeline */}
      <div className="space-y-4">
        {/* Step 1: Input Evidence (Visual + Sensor + Environment) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Step 1: Raw Observations & Microclimate Context
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Visual Box */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-2">
                <Eye className="w-4 h-4 text-emerald-700" />
                Visual Symptoms
              </div>
              {visual_evidence.length === 0 ? (
                <p className="text-xs text-slate-500">No abnormal symptoms observed.</p>
              ) : (
                visual_evidence.map((v, i) => (
                  <div key={i} className="text-xs text-slate-700">
                    • <strong className="capitalize">{v.type.replace(/_/g, " ")}</strong> (
                    {Math.round(v.confidence * 100)}% conf)
                  </div>
                ))
              )}
            </div>

            {/* Sensor Box */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                Root & Soil Telemetry
              </div>
              <div className="space-y-1">
                {sensor_evidence.slice(0, 3).map((s, i) => (
                  <div key={i} className="text-xs text-slate-700 flex justify-between">
                    <span className="capitalize">{s.metric.replace(/_/g, " ")}:</span>
                    <strong className="font-mono">{s.value.toFixed(1)}{s.unit}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Environment Box */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-2">
                <CloudSun className="w-4 h-4 text-emerald-700" />
                Pathogen Weather Window
              </div>
              <p className="text-xs text-slate-700">
                {environmental_match.matched ? "Matched risk threshold:" : "Optimal bounds:"}{" "}
                <span className="italic text-slate-600">{environmental_match.reason}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Down Arrow Connector */}
        <div className="flex justify-center my-1">
          <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        {/* Step 2: Multimodal Fusion & Risk Assessment */}
        <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-700" />
            Step 2: Multimodal Fusion Engine (Deterministic Agronomic Logic)
          </div>

          <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Synthesized Condition:</span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 uppercase">
                {diagnosis.condition.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Risk Classification:</span>
              <strong className="text-rose-700">{diagnosis.risk_level.replace(/_/g, " ")}</strong>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Confidence Tier:</span>
              <strong className="text-slate-900 font-mono">{diagnosis.confidence} (Corroborated)</strong>
            </div>

            <p className="text-xs text-slate-700 pt-2 border-t border-slate-100 leading-relaxed">
              <strong>Causal Rationale:</strong> {recommendation.reason}
            </p>
          </div>
        </div>

        {/* Down Arrow Connector */}
        <div className="flex justify-center my-1">
          <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        {/* Step 3: Actionable Recommendation */}
        <div className="bg-white border-2 border-emerald-600 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Step 3: Actionable Farmer Directive
          </div>

          <h3 className="text-lg font-black text-slate-900">
            {recommendation.action}
          </h3>

          {recommendation.secondary_action && (
            <p className="text-xs text-slate-600 mt-1">
              Secondary: {recommendation.secondary_action}
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/farmer/advisory")}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Open Voice Advisory
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

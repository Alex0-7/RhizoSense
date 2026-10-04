import React from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Activity,
  CloudSun,
  HelpCircle,
  ArrowRight,
  Camera,
} from "lucide-react";

export const DiagnosisPage: React.FC = () => {
  const { activeZoneId, activeDiagnosis, activeZone } = useFarm();
  const navigate = useNavigate();

  if (!activeDiagnosis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto space-y-4">
        <FileText className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">No Diagnosis Available for Zone {activeZoneId}</h2>
        <p className="text-sm text-slate-500">Run a crop scan or ingest telemetry to trigger multimodal fusion.</p>
        <button
          type="button"
          onClick={() => navigate("/farmer/scan")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-semibold"
        >
          <Camera className="w-4 h-4" /> Go to Crop Scan
        </button>
      </div>
    );
  }

  const { diagnosis, visual_evidence, sensor_evidence, environmental_match, recommendation } = activeDiagnosis;
  const isCritical = diagnosis.risk_level === "ACTION_REQUIRED";
  const isWarning = diagnosis.risk_level === "ATTENTION";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Condition Banner */}
      <div
        className={`rounded-2xl border p-6 shadow-xs ${
          isCritical
            ? "bg-rose-50 border-rose-300"
            : isWarning
            ? "bg-amber-50 border-amber-300"
            : "bg-emerald-50 border-emerald-300"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-slate-300 text-slate-800">
                Zone {activeZoneId}
              </span>
              <span
                className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md ${
                  isCritical
                    ? "bg-rose-600 text-white"
                    : isWarning
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {diagnosis.risk_level.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-bold text-slate-600">
                Confidence Tier: <strong className="text-slate-900 font-mono">{diagnosis.confidence}</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 capitalize">
              {diagnosis.condition.replace(/_/g, " ")}
            </h1>
            <p className="text-sm text-slate-700 mt-1 max-w-xl">
              {recommendation.reason || "Multimodal inference indicates physiological stress condition."}
            </p>
          </div>

          {/* Action Button to Advisory */}
          <button
            type="button"
            onClick={() => navigate("/farmer/advisory")}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm rounded-xl shadow-md transition-colors self-start sm:self-center shrink-0"
          >
            View Advisory
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tri-Fold Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Visual Evidence */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-3">
              <Eye className="w-4 h-4 text-emerald-700" />
              Visual Evidence ({visual_evidence.length})
            </div>

            {visual_evidence.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No visual symptoms observed in canopy frame.</p>
            ) : (
              <div className="space-y-2">
                {visual_evidence.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 capitalize">
                      <span>{v.type.replace(/_/g, " ")}</span>
                      <span className="font-mono text-emerald-700">{Math.round(v.confidence * 100)}%</span>
                    </div>
                    {v.details && <p className="text-[11px] text-slate-500 mt-1">{v.details}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            Source: Edge Camera & ML Adapter
          </div>
        </div>

        {/* 2. Sensor Evidence */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-3">
              <Activity className="w-4 h-4 text-emerald-700" />
              Sensor Telemetry ({sensor_evidence.length})
            </div>

            <div className="space-y-2">
              {sensor_evidence.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-600 font-medium capitalize">{s.metric.replace(/_/g, " ")}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {s.value.toFixed(1)} {s.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            Source: Normalized Soil Sensors
          </div>
        </div>

        {/* 3. Environmental Match Window */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-3">
              <CloudSun className="w-4 h-4 text-emerald-700" />
              Environmental Window
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Pathogen Window:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    environmental_match.matched
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  {environmental_match.matched ? "MATCHED" : "UNMATCHED"}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {environmental_match.reason}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
            Source: Canopy Microclimate Rules
          </div>
        </div>
      </div>

      {/* Footer Navigation to Explainability & Crop Scan */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => navigate("/farmer/why")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors shadow-2xs"
        >
          <HelpCircle className="w-4 h-4 text-emerald-700" />
          Why? Explain Causal Evidence Chain
        </button>

        <button
          type="button"
          onClick={() => navigate("/farmer/scan")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors shadow-2xs"
        >
          <Camera className="w-4 h-4 text-emerald-700" />
          Rescan Zone {activeZoneId}
        </button>
      </div>
    </div>
  );
};

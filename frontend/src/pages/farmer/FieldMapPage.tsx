import React from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import { ZoneGridMap } from "../../components/fields/ZoneGridMap";
import { Camera, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export const FieldMapPage: React.FC = () => {
  const { zones, activeZoneId, setActiveZoneId, activeDiagnosis, activeZone } = useFarm();
  const navigate = useNavigate();

  const currentRisk = activeZone?.current_risk || "HEALTHY";
  const condition = activeDiagnosis?.diagnosis.condition.replace(/_/g, " ").toUpperCase() || "OPTIMAL CANOPY";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 5x5 Grid Map */}
      <ZoneGridMap
        zones={zones}
        activeZoneId={activeZoneId}
        onSelectZone={(zoneId) => setActiveZoneId(zoneId)}
      />

      {/* Selected Zone Quick Inspector Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
              Zone {activeZoneId}
            </span>
            <span
              className={`px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${
                currentRisk === "ACTION_REQUIRED"
                  ? "bg-rose-100 text-rose-800"
                  : currentRisk === "ATTENTION"
                  ? "bg-orange-100 text-orange-800"
                  : currentRisk === "MONITOR"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {currentRisk.replace("_", " ")}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-800">
            Identified State: <span className="text-emerald-900 font-bold">{condition}</span>
          </p>

          <p className="text-xs text-slate-500">
            Grid Position: Row {activeZone?.row}, Column {activeZone?.column} • Area: 5m × 5m (25 sq.m) • Crop: {activeZone?.crop || "Tomato"}
          </p>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/farmer/scan")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Camera className="w-4 h-4 text-emerald-300" />
            Crop Scan
          </button>

          <button
            type="button"
            onClick={() => navigate("/farmer/diagnosis")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            Diagnosis
          </button>

          <button
            type="button"
            onClick={() => navigate("/farmer/advisory")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            Advisory
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

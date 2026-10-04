import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  Map,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wifi,
  WifiOff,
  CloudUpload,
} from "lucide-react";

export const FarmHomePage: React.FC = () => {
  const {
    zones,
    activeZoneId,
    setActiveZoneId,
    activeDiagnosis,
    notifications,
    network,
    syncState,
    pendingSyncCount,
  } = useFarm();
  const navigate = useNavigate();

  // Calculate metrics
  const actionRequiredZones = zones.filter((z) => z.current_risk === "ACTION_REQUIRED");
  const attentionZones = zones.filter((z) => z.current_risk === "ATTENTION");
  const healthyZones = zones.filter((z) => !z.current_risk || z.current_risk === "HEALTHY");

  const activeAlerts = notifications.filter((n) => n.status === "active");

  const overallHealth =
    actionRequiredZones.length > 0
      ? "Critical Attention Required"
      : attentionZones.length > 0
      ? "Advisory Attention"
      : "Optimal Health";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Offline banner if disconnected */}
      {network === "offline" && (
        <div className="bg-amber-500 text-white px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5" />
            <span className="text-sm font-medium">
              Offline Mode Active — Local diagnosis and advisories continue operating without internet.
            </span>
          </div>
          <Link
            to="/farmer/offline"
            className="text-xs bg-white text-amber-900 font-semibold px-2.5 py-1 rounded-md hover:bg-amber-50"
          >
            Sync Status ({pendingSyncCount} queued)
          </Link>
        </div>
      )}

      {/* Hero Farm Condition Banner */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-radial pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/60 border border-emerald-400/30 text-xs font-semibold uppercase tracking-wider mb-3">
              <span>Coimbatore Farm</span>
              <span>•</span>
              <span>Tomato Canopy</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {overallHealth}
            </h1>
            <p className="mt-2 text-emerald-100 text-sm sm:text-base max-w-xl">
              RhizoSense AI active across 25 spatial micro-zones (5m × 5m). Continuous multimodal root & canopy monitoring.
            </p>
          </div>

          {/* Action Stats Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 text-center min-w-[160px]">
            <span className="block text-3xl sm:text-4xl font-black text-white">
              {actionRequiredZones.length}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-200">
              Actions Required
            </span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-6 pt-6 border-t border-emerald-600/50 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveZoneId(actionRequiredZones[0]?.zone_id || "B3");
              navigate("/farmer/map");
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-900 font-bold text-sm shadow-md hover:bg-emerald-50 active:scale-98 transition-all"
          >
            <Map className="w-4 h-4 text-emerald-700" />
            Open 5m × 5m Field Map
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveZoneId("B3");
              navigate("/farmer/detection");
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            <Camera className="w-4 h-4 text-white" />
            Live Disease Detection (Zone {activeZoneId})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveZoneId("B3");
              navigate("/farmer/scan");
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-white font-bold text-sm border border-emerald-400/40 shadow-sm active:scale-98 transition-all"
          >
            <Camera className="w-4 h-4 text-emerald-300" />
            Crop Scan
          </button>
        </div>
      </div>

      {/* Grid of Key Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{actionRequiredZones.length}</div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Critical Zones</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{attentionZones.length}</div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Attention Zones</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{healthyZones.length}</div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Healthy Micro-Zones</div>
          </div>
        </div>
      </div>

      {/* Action Queue (Alerts) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Prioritized Farmer Action Queue
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {activeAlerts.length} Active
          </span>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            All farm zones are currently operating within optimal parameters.
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 gap-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 p-1.5 rounded-lg text-white ${
                      alert.severity === "critical"
                        ? "bg-rose-600"
                        : alert.severity === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-600"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{alert.title}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                        Zone {alert.fieldId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                    {alert.recommendation && (
                      <p className="text-xs text-emerald-800 font-medium mt-1">
                        Action: {alert.recommendation}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveZoneId(alert.fieldId || "B3");
                    navigate("/farmer/advisory");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg self-start sm:self-center shrink-0 transition-colors"
                >
                  View Action
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

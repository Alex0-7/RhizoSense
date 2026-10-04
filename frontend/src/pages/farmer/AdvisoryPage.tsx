import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import { VoiceAdvisoryPlayer } from "../../components/voice/VoiceAdvisoryPlayer";
import {
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export const AdvisoryPage: React.FC = () => {
  const { activeZoneId, activeDiagnosis, acknowledgeAction } = useFarm();
  const navigate = useNavigate();

  const [actionDone, setActionDone] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!activeDiagnosis) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto space-y-4">
        <h2 className="text-lg font-bold text-slate-900">No Advisory for Zone {activeZoneId}</h2>
        <p className="text-sm text-slate-500">Please select a zone with active diagnosis.</p>
        <button
          type="button"
          onClick={() => navigate("/farmer/map")}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold"
        >
          Return to Field Map
        </button>
      </div>
    );
  }

  const { recommendation, diagnosis } = activeDiagnosis;

  const handleAcknowledge = async () => {
    setSubmitting(true);
    try {
      await acknowledgeAction(
        activeZoneId,
        recommendation.action,
        `rec-${activeZoneId}-live`
      );
      setActionDone(true);
    } catch (e) {
      console.warn("Error acknowledging action:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Primary Action Card */}
      <div className="bg-white rounded-3xl border-2 border-emerald-600 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Recommended Agronomic Action • Zone {activeZoneId}
          </div>
          <span className="text-xs font-mono text-slate-500">
            Priority: <strong className="text-emerald-900">{diagnosis.risk_level}</strong>
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-950 leading-tight">
          {recommendation.action}
        </h1>

        {recommendation.secondary_action && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm">
            <span className="font-bold text-slate-900 block mb-1">Secondary Action:</span>
            {recommendation.secondary_action}
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Recommended deployment window: Immediate / within 3 hours.</span>
        </div>

        {/* Action Taken Button */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {!actionDone ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleAcknowledge}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98"
            >
              <CheckCircle className="w-5 h-5 text-emerald-300" />
              {submitting ? "Logging Action..." : "Confirm Action Taken (Queues for Sync)"}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Action recorded locally & added to offline sync queue!
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/farmer/why")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Why did AI recommend this?
          </button>
        </div>
      </div>

      {/* Multilingual Voice Player */}
      <VoiceAdvisoryPlayer
        voiceText={recommendation.voice_text}
        zoneId={activeZoneId}
        condition={diagnosis.condition}
      />

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={() => navigate("/farmer/diagnosis")}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back to Diagnosis
        </button>

        <button
          type="button"
          onClick={() => navigate("/farmer/map")}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950"
        >
          View All Zones on Map
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

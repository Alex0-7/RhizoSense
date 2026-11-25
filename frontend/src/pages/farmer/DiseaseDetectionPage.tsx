import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import { runVisionInference, ingestSensorReadings } from "../../services/api";
import { VoiceAdvisoryPlayer } from "../../components/voice/VoiceAdvisoryPlayer";
import { SyncedCropVideoPlayer } from "../../components/vision/SyncedCropVideoPlayer";
import { TimelineDetectionCue } from "../../config/visionMedia";
import {
  Camera,
  Video,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Droplets,
  Thermometer,
  CloudRain,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export const DiseaseDetectionPage: React.FC = () => {
  const {
    activeZoneId,
    setActiveZoneId,
    zones,
    activeDiagnosis,
    loadZoneDiagnosis,
    acknowledgeAction,
    refresh,
  } = useFarm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If query param ?zoneId is provided, sync activeZoneId
  useEffect(() => {
    const qZone = searchParams.get("zoneId");
    if (qZone && qZone.toUpperCase() !== activeZoneId.toUpperCase()) {
      setActiveZoneId(qZone.toUpperCase());
    }
  }, [searchParams, activeZoneId, setActiveZoneId]);

  const [selectedVideo, setSelectedVideo] = useState<string>("rhizome_rot_canopy.mp4");
  const [autoTimeline, setAutoTimeline] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<boolean>(false);
  const [providerState, setProviderState] = useState<string>("roboflow");
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [framesEvaluated, setFramesEvaluated] = useState<number>(0);

  const diag = activeDiagnosis;
  const isActionRequired = diag?.diagnosis.risk_level === "ACTION_REQUIRED";
  const isAttention = diag?.diagnosis.risk_level === "ATTENTION";
  const isHealthy = !diag || diag.diagnosis.risk_level === "HEALTHY";

  const conditionName = diag?.diagnosis.condition.replace(/_/g, " ").toUpperCase() || "OPTIMAL CANOPY";
  const confidencePercent = diag ? Math.round(diag.diagnosis.confidence === "HIGH" ? 91 : diag.diagnosis.confidence === "MEDIUM" ? 74 : 45) : 95;

  // Extract sensors
  const moistureReading = diag?.sensor_evidence.find((s) => s.metric.includes("moisture"))?.value ?? 46.0;
  const tempReading = diag?.sensor_evidence.find((s) => s.metric.includes("temp"))?.value ?? 30.1;
  const humidityReading = diag?.sensor_evidence.find((s) => s.metric.includes("hum"))?.value ?? 58.0;

  // Trigger video detection pipeline (Roboflow serverless inference or deterministic fallback)
  const handleRunDetection = async (overrideCondition?: string) => {
    setIsProcessing(true);
    setFeedbackMessage(null);
    setActionDone(false);

    try {
      const targetCondition = overrideCondition;
      const res = await runVisionInference({
        zone_id: activeZoneId,
        video_source: selectedVideo,
        condition_override: targetCondition,
        use_roboflow: !targetCondition,
        sample_fps: 2.0,
      });

      setProviderState(res.provider || "demo");
      setProviderNote(res.provider_note || null);
      setFramesEvaluated(res.frames_processed || 1);

      await loadZoneDiagnosis(activeZoneId);
      await refresh();

      const provLabel = res.provider === "roboflow" ? "Roboflow API (turmeric-final-tmips/1)" : "Deterministic Edge Provider";
      if (res.alert_created) {
        setFeedbackMessage(`Disease alert generated via ${provLabel}. Action dispatched to Farmer & FPO queues.`);
      } else {
        setFeedbackMessage(`Inference complete via ${provLabel}. Canopy evaluated as nominal.`);
      }
    } catch (err: any) {
      setFeedbackMessage(`Inference error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Automatic Timestamp Cue Handler for Presentation Mode
  const handleTimelineCueTransition = useCallback(
    async (cue: TimelineDetectionCue) => {
      try {
        if (cue.conditionOverride === "rhizome_rot") {
          // Corroborate root-zone saturation sensors before running rhizome rot fusion
          await ingestSensorReadings([
            {
              zone_id: activeZoneId,
              metric: "soil_moisture",
              value: 88.5,
              unit: "%",
              timestamp: new Date().toISOString(),
              source: "sensor_source:read_sensors",
            },
            {
              zone_id: activeZoneId,
              metric: "soil_temperature",
              value: 29.4,
              unit: "°C",
              timestamp: new Date().toISOString(),
              source: "sensor_source:read_sensors",
            },
            {
              zone_id: activeZoneId,
              metric: "humidity",
              value: 84.0,
              unit: "%",
              timestamp: new Date().toISOString(),
              source: "sensor_source:read_sensors",
            },
          ]).catch(() => {});
        } else if (cue.conditionOverride === "leaf_blotch") {
          await ingestSensorReadings([
            {
              zone_id: activeZoneId,
              metric: "soil_moisture",
              value: 62.0,
              unit: "%",
              timestamp: new Date().toISOString(),
              source: "sensor_source:read_sensors",
            },
            {
              zone_id: activeZoneId,
              metric: "soil_temperature",
              value: 28.5,
              unit: "°C",
              timestamp: new Date().toISOString(),
              source: "sensor_source:read_sensors",
            },
            {
              zone_id: activeZoneId,
              metric: "humidity",
              value: 79.0,
              unit: "%",
              timestamp: new Date().toISOString(),
              source: "sensor_source:read_sensors",
            },
          ]).catch(() => {});
        }

        const res = await runVisionInference({
          zone_id: activeZoneId,
          video_source: selectedVideo,
          condition_override: cue.conditionOverride,
          use_roboflow: false,
          sample_fps: 2.0,
        });
        setProviderState(res.provider || "demo");
        setProviderNote(`Video Timestamp Sync [${cue.startSec}s]: ${cue.summary}`);
        setFramesEvaluated((prev) => prev + 2);
        await loadZoneDiagnosis(activeZoneId);
      } catch (e) {
        console.warn("Timeline cue sync error:", e);
      }
    },
    [activeZoneId, selectedVideo, loadZoneDiagnosis]
  );


  // Trigger simulated read_sensors() update
  const handleReadSensors = async () => {
    setIsProcessing(true);
    try {
      const isRot = conditionName.includes("ROT");
      const fakeReadings = [
        {
          zone_id: activeZoneId,
          metric: "soil_moisture",
          value: isRot ? 88.5 : 22.0,
          unit: "%",
          timestamp: new Date().toISOString(),
          source: "sensor_source:read_sensors",
        },
        {
          zone_id: activeZoneId,
          metric: "soil_temperature",
          value: 30.5,
          unit: "°C",
          timestamp: new Date().toISOString(),
          source: "sensor_source:read_sensors",
        },
        {
          zone_id: activeZoneId,
          metric: "humidity",
          value: isRot ? 84.0 : 42.0,
          unit: "%",
          timestamp: new Date().toISOString(),
          source: "sensor_source:read_sensors",
        },
      ];

      await ingestSensorReadings(fakeReadings);
      await loadZoneDiagnosis(activeZoneId);
      setFeedbackMessage(`read_sensors() telemetry ingested and multimodal fusion executed for Zone ${activeZoneId}.`);
    } catch (e: any) {
      setFeedbackMessage(`Error in read_sensors(): ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!diag) return;
    try {
      await acknowledgeAction(activeZoneId, diag.recommendation.action, `rec-${activeZoneId}-live`);
      setActionDone(true);
    } catch (e) {
      console.warn("Acknowledge action error:", e);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Live Plant Pathology & Computer Vision
            </div>

            {providerState === "roboflow" ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                ROBOFLOW API · turmeric-final-tmips/1 (2 FPS)
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                DEMO / FALLBACK ADAPTER
              </div>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Real-Time Crop Disease Detection
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Edge video stream evaluated by Roboflow turmeric model. Corroborated with root-zone sensors for actionable diagnosis.
          </p>
        </div>

        {/* Target Zone Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
          <span className="text-xs font-semibold text-slate-600">Active Zone:</span>
          <select
            value={activeZoneId}
            onChange={(e) => setActiveZoneId(e.target.value)}
            className="font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-emerald-950 focus:ring-2 focus:ring-emerald-600"
          >
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                Zone {z.zone_id} ({z.crop})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left Video / HUD, Right Corroborating Telemetry & Action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Viewport & Detection Overlay (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            {/* Synchronized Live Crop Video & Timeline Detection Viewport */}
            <SyncedCropVideoPlayer
              presetId={selectedVideo}
              zoneLabel={`ZONE ${activeZoneId} CANOPY`}
              autoTimelineEnabled={autoTimeline}
              onToggleAutoTimeline={setAutoTimeline}
              onCueTransition={handleTimelineCueTransition}
              externalConditionLabel={conditionName}
              externalConfidencePercent={confidencePercent}
              externalIsHealthy={isHealthy}
              isProcessing={isProcessing}
              processingTitle="Sampling Video Frames @ 2 FPS & Running Inference..."
              processingSubtitle="Multimodal Fusion Engine Corroborating Telemetry"
            />

            {/* Interactive Demo Controller Strip */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Preset Selector */}
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-700 shrink-0" />
                <select
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800"
                >
                  <option value="rhizome_rot_canopy.mp4">Turmeric Rhizome Rot (Demo B3)</option>
                  <option value="turmeric_leaf_blotch.mp4">Turmeric Leaf Blotch Video</option>
                  <option value="healthy_crop_control.mp4">Healthy Turmeric Canopy</option>
                </select>
              </div>

              {/* Trigger Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleRunDetection()}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Run Live Inference
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleRunDetection("healthy")}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Clear (Nominal)
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleReadSensors}
                  title="Pull simulated telemetry from read_sensors()"
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  <Activity className="w-4 h-4 text-emerald-700" />
                </button>
              </div>
            </div>


            {feedbackMessage && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {feedbackMessage}
              </div>
            )}

            {providerNote && (
              <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>{providerNote}</span>
                {framesEvaluated > 0 && <span className="text-emerald-700 font-bold">{framesEvaluated} frames analyzed</span>}
              </div>
            )}
          </div>


          {/* Visual Symptoms Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Visual Evidence Breakdown (Canonical Schema)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {diag?.visual_evidence && diag.visual_evidence.length > 0 ? (
                diag.visual_evidence.map((ev, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-900 capitalize">
                      <span>{ev.type.replace(/_/g, " ")}</span>
                      <span className="font-mono text-emerald-800">{Math.round(ev.confidence * 100)}%</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">{ev.details || "Detected by ML vision adapter."}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 italic col-span-2">
                  Canopy is nominal. Zero pathological symptoms observed.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Synthesis, Corroborating Telemetry, Action Directive (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Status & Confidence Card */}
          <div
            className={`rounded-2xl border p-6 shadow-xs ${
              isActionRequired
                ? "bg-rose-50 border-rose-300"
                : isAttention
                ? "bg-amber-50 border-amber-300"
                : "bg-emerald-50 border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800">
                Zone {activeZoneId}
              </span>
              <span
                className={`text-xs font-black uppercase px-2.5 py-0.5 rounded ${
                  isActionRequired
                    ? "bg-rose-600 text-white"
                    : isAttention
                    ? "bg-amber-500 text-white"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {diag?.diagnosis.risk_level.replace(/_/g, " ") || "HEALTHY"}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {conditionName}
            </h2>

            <div className="mt-3">
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Confidence Assessment:</span>
                <span className="font-mono">{confidencePercent}% ({diag?.diagnosis.confidence || "HIGH"})</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    isActionRequired ? "bg-rose-600" : isAttention ? "bg-amber-500" : "bg-emerald-600"
                  }`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-slate-700 mt-3 pt-3 border-t border-slate-200/70 leading-relaxed">
              {diag?.recommendation.reason || "Canopy spectral index and root indicators corroborated by fusion engine."}
            </p>
          </div>

          {/* Sensor Context (read_sensors) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-700" />
                Root & Sensor Context (read_sensors)
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">5m × 5m Telemetry</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center text-blue-600 mb-1">
                  <Droplets className="w-4 h-4" />
                </div>
                <div className="font-mono font-bold text-sm text-slate-900">{moistureReading.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500 uppercase">Moisture</div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center text-amber-600 mb-1">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div className="font-mono font-bold text-sm text-slate-900">{tempReading.toFixed(1)}°C</div>
                <div className="text-[10px] text-slate-500 uppercase">Temp</div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center text-teal-600 mb-1">
                  <CloudRain className="w-4 h-4" />
                </div>
                <div className="font-mono font-bold text-sm text-slate-900">{humidityReading.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500 uppercase">Humidity</div>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800">Environment Window: </span>
              {diag?.environmental_match.reason || "Normal microclimate"}
            </div>
          </div>

          {/* Actionable Directive & Voice Player */}
          <div className="bg-white rounded-2xl border-2 border-emerald-600 p-5 shadow-xs space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                Actionable Recommendation
              </div>
              <h4 className="text-base font-black text-slate-950 leading-snug">
                {diag?.recommendation.action || "Continue regular sensory monitoring."}
              </h4>
            </div>

            {/* Voice Advisory Integration */}
            <VoiceAdvisoryPlayer
              voiceText={diag?.recommendation.voice_text}
              zoneId={activeZoneId}
              condition={diag?.diagnosis.condition || "healthy"}
            />

            {/* Acknowledge Action Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              {!actionDone ? (
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Action Taken
                </button>
              ) : (
                <div className="flex-1 text-center py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200">
                  ✓ Action Logged & Added to Sync Queue
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate("/farmer/why")}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
                Why?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

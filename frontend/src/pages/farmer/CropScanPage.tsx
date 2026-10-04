import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../../state/FarmContext";
import { runVisionInference } from "../../services/api";
import {
  Camera,
  Video,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { VisualEvidence } from "../../types/canonical";

interface VideoPreset {
  id: string;
  name: string;
  condition: string;
  description: string;
  badgeColor: string;
}

const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: "rhizome_rot_canopy.mp4",
    name: "Rhizome Rot / Wilting Sample (SIH Demo)",
    condition: "rhizome_rot",
    description: "Vascular wilting, petiole epinasty, and root collar necrosis in saturated tomato zone.",
    badgeColor: "bg-rose-100 text-rose-800",
  },
  {
    id: "early_blight_foliage.mp4",
    name: "Early Blight Foliage Sample",
    condition: "early_blight",
    description: "Concentric target lesions with yellow chlorotic halos across mature canopy leaves.",
    badgeColor: "bg-orange-100 text-orange-800",
  },
  {
    id: "healthy_crop_control.mp4",
    name: "Healthy Tomato Canopy (Control)",
    condition: "healthy",
    description: "Uniform leaf chlorophyll spectral profile; zero foliar spots or stem lesions.",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
];

export const CropScanPage: React.FC = () => {
  const { activeZoneId, setActiveZoneId, zones, loadZoneDiagnosis } = useFarm();
  const navigate = useNavigate();

  const [selectedVideo, setSelectedVideo] = useState<string>("rhizome_rot_canopy.mp4");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanCompleted, setScanCompleted] = useState<boolean>(false);
  const [detectedEvidences, setDetectedEvidences] = useState<VisualEvidence[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePreset = VIDEO_PRESETS.find((p) => p.id === selectedVideo) || VIDEO_PRESETS[0];

  const handleStartScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    setScanCompleted(false);
    setErrorMsg(null);

    // Simulated frame extraction and edge inference progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 150);

    try {
      const response = await runVisionInference({
        zone_id: activeZoneId,
        video_source: selectedVideo,
        condition_override: activePreset.condition,
      });

      clearInterval(interval);
      setScanProgress(100);
      setDetectedEvidences(response.visual_evidence);
      setScanCompleted(true);

      // Refresh diagnosis in context
      await loadZoneDiagnosis(activeZoneId);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg(err.message || "Inference failed");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Edge Computer Vision Pipeline
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Multimodal Crop Scan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Process live video frame or prerecorded crop footage through the canonical ML adapter.
          </p>
        </div>

        {/* Target Zone Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
          <span className="text-xs font-semibold text-slate-600">Target Zone:</span>
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

      {/* Edge System Status Bar */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-semibold uppercase">Edge Camera</div>
          <div className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> CONNECTED
          </div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-semibold uppercase">AI Edge Runtime</div>
          <div className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
            <Cpu className="w-3 h-3 text-emerald-600" /> ACTIVE
          </div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-semibold uppercase">Inference Mode</div>
          <div className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1 mt-0.5">
            CANONICAL ADAPTER
          </div>
        </div>
      </div>

      {/* Video Source Preset Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-700" />
          Select Video / Frame Source (SIH Demo Simulation)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {VIDEO_PRESETS.map((preset) => {
            const isSelected = selectedVideo === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSelectedVideo(preset.id);
                  setScanCompleted(false);
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/30"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/80"
                }`}
              >
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${preset.badgeColor} mb-2`}>
                  {preset.condition.replace("_", " ").toUpperCase()}
                </span>
                <div className="font-bold text-slate-900 text-sm">{preset.name}</div>
                <p className="text-xs text-slate-500 mt-1">{preset.description}</p>
              </button>
            );
          })}
        </div>

        {/* Video Canvas Simulation Viewport */}
        <div className="mt-5 relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-center p-6 shadow-inner">
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            LIVE FEED • Zone {activeZoneId}
          </div>

          <div className="absolute top-4 right-4 bg-emerald-600/80 backdrop-blur-md text-white px-2.5 py-0.5 rounded text-xs font-mono">
            1080p • 30 FPS
          </div>

          <Camera className="w-16 h-16 text-slate-600 mb-3" />
          <p className="text-slate-300 text-sm font-medium">
            Simulated Camera Stream: <span className="font-mono text-emerald-400">{selectedVideo}</span>
          </p>
          <p className="text-slate-500 text-xs mt-1 max-w-sm">
            Ready to extract canopy frames and dispatch to canonical ML adapter.
          </p>

          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white z-20">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
              <div className="text-base font-bold">Extracting & Analyzing Frames...</div>
              <div className="w-64 bg-slate-700 h-2.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-200"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <div className="text-xs font-mono text-slate-400 mt-2">{scanProgress}% completed</div>
            </div>
          )}
        </div>

        {/* Execute Scan Button */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            disabled={isScanning}
            onClick={handleStartScan}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98"
          >
            <Camera className="w-5 h-5 text-emerald-200" />
            {isScanning ? "Processing Video..." : `Extract Frame & Infer Zone ${activeZoneId}`}
          </button>

          <span className="text-xs text-slate-500">
            Pipeline: Frame Extraction → ML Adapter → Canonical VisualEvidence → Fusion Engine
          </span>
        </div>
      </div>

      {/* Inference Result Card */}
      {scanCompleted && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-base mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Canonical Inference Results Generated
          </div>

          <div className="space-y-2 mb-4">
            {detectedEvidences.map((ev, i) => (
              <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-100">
                <div>
                  <span className="font-bold text-slate-900 text-sm capitalize">
                    {ev.type.replace(/_/g, " ")}
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">{ev.details || "Detected by ML vision adapter."}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-800 font-mono">
                    {Math.round(ev.confidence * 100)}%
                  </span>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Confidence</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/farmer/diagnosis")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
            >
              Open Full Diagnosis
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          {errorMsg}
        </div>
      )}
    </div>
  );
};

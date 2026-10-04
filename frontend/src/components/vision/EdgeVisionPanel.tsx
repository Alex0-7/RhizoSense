import React, { useState, useEffect, useRef } from "react";
import { Camera, AlertTriangle, CheckCircle2, RefreshCw, Cpu, Eye } from "lucide-react";
import { VisionDetectionResult, Notification } from "../../types";
import { fetchVisionDetection, simulateVisionDetection } from "../../services/api";
import { useFarm } from "../../state/FarmContext";

interface EdgeVisionPanelProps {
  fieldId: string;
  fieldName: string;
}

export const EdgeVisionPanel: React.FC<EdgeVisionPanelProps> = ({ fieldId, fieldName }) => {
  const { addNotification } = useFarm();

  const [detection, setDetection] = useState<VisionDetectionResult>({
    detected: true,
    disease: "Early Blight",
    confidence: 0.91,
  });
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<string>(new Date().toLocaleTimeString());

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastDetectedRef = useRef<boolean | null>(null);

  // Live HUD clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial detection state from backend
  useEffect(() => {
    let isMounted = true;
    async function loadDetection() {
      try {
        const data = await fetchVisionDetection(fieldId);
        if (isMounted && data) {
          setDetection(data);
          // Set initial ref to avoid duplicate alert on initial load if already true
          if (lastDetectedRef.current === null) {
            lastDetectedRef.current = data.detected;
          }
        }
      } catch {
        // Retain deterministic fallback if backend is offline
        if (isMounted && lastDetectedRef.current === null) {
          lastDetectedRef.current = true;
        }
      }
    }
    loadDetection();
    return () => {
      isMounted = false;
    };
  }, [fieldId]);

  // Handle transition from false -> true to fire exactly ONE warning notification
  useEffect(() => {
    if (lastDetectedRef.current === false && detection.detected === true) {
      const diseaseName = detection.disease || "Crop Disease";
      const confPercent = Math.round(detection.confidence * 100);
      const newNotif: Notification = {
        id: `notif-vision-${fieldId}-${Date.now()}`,
        farmId: "farm-demo",
        fieldId: fieldId,
        severity: "warning",
        type: "disease",
        title: `${diseaseName} detected in ${fieldName}`,
        message: `Edge vision model detected ${diseaseName} with ${confPercent}% confidence.`,
        status: "active",
        recommendation: "Inspect foliage on lower stems and apply targeted fungicidal protocol.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addNotification(newNotif);
    }
    lastDetectedRef.current = detection.detected;
  }, [detection, fieldId, fieldName, addNotification]);

  // Toggle simulated detection state (deterministic)
  const handleToggleSimulation = async () => {
    if (simulating) return;
    setSimulating(true);
    const targetState = !detection.detected;
    try {
      const updated = await simulateVisionDetection(fieldId, targetState);
      setDetection(updated);
    } catch {
      // Fallback local deterministic simulation if backend unavailable
      setDetection({
        detected: targetState,
        disease: targetState ? "Early Blight" : null,
        confidence: targetState ? 0.91 : 0.12,
      });
    } finally {
      setSimulating(false);
    }
  };

  const confidencePercent = Math.round((detection.confidence || 0) * 100);

  return (
    <div className="rounded-card border border-borderDefault bg-surface shadow-card overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-borderDefault flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-secondary/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primaryText text-white flex items-center justify-center shrink-0">
            <Camera size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-primaryText">Edge Vision & Plant Pathology</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface border border-borderDefault text-secondaryText">
                Vision Demo
              </span>
            </div>
            <p className="text-xs text-secondaryText mt-0.5">
              Simulated canopy camera feed processed by Qualcomm Edge AI visual inference model
            </p>
          </div>
        </div>

        {/* Simulation Action Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSimulation}
            disabled={simulating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface border border-borderDefault text-secondaryText hover:text-primaryText hover:border-borderStrong text-xs font-medium transition-colors shadow-sm disabled:opacity-60"
            title="Toggle between disease detected and clear canopy states"
          >
            <RefreshCw size={13} className={simulating ? "animate-spin" : ""} />
            <span>{detection.detected ? "Simulate Clear Canopy" : "Simulate Disease (Early Blight)"}</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Video Feed Display (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="relative rounded-lg overflow-hidden bg-[#111613] aspect-video flex items-center justify-center border border-borderDefault/80 shadow-inner group">
            {/* HTML5 Video */}
            <video
              ref={videoRef}
              src="/vision/plant-feed.mp4"
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => {
                setVideoLoaded(true);
                setVideoError(false);
              }}
              onError={() => {
                setVideoLoaded(false);
                setVideoError(true);
              }}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                videoLoaded && !videoError ? "opacity-100" : "hidden"
              }`}
            />

            {/* Fallback Viewfinder when local MP4 is awaiting placement */}
            {(!videoLoaded || videoError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#18231D] via-[#101814] to-[#0A0F0D] text-white p-6 select-none">
                {/* Subtle grid pattern */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, #52B788 1px, transparent 1px), linear-gradient(to bottom, #52B788 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />

                {/* Simulated plant canopy silhouette & leaf scan target */}
                <div className="relative flex flex-col items-center z-10">
                  <div className="w-16 h-16 rounded-full bg-[#2D6A4F]/20 border border-[#52B788]/40 flex items-center justify-center mb-3">
                    <Eye size={30} className="text-[#52B788] animate-pulse" />
                  </div>
                  <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
                    Simulated Crop Camera Feed
                  </span>
                  <span className="text-[11px] text-gray-400 mt-1 max-w-xs text-center leading-relaxed">
                    Place MP4 at <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded font-mono">public/vision/plant-feed.mp4</code>
                  </span>
                </div>
              </div>
            )}

            {/* Simulated Edge AI Bounding Box Overlay when Disease is Detected */}
            {detection.detected && (
              <div className="absolute top-[28%] left-[32%] w-[38%] h-[42%] border-2 border-[#E67E22] bg-[#E67E22]/15 rounded pointer-events-none flex flex-col justify-between p-1 z-20 animate-pulse-subtle">
                <span className="self-start text-[10px] font-mono font-bold bg-[#E67E22] text-white px-1.5 py-0.5 rounded shadow">
                  {detection.disease || "Early Blight"} [{confidencePercent}%]
                </span>
                <div className="self-end text-[9px] font-mono text-amber-200 bg-black/60 px-1 rounded">
                  POS: 324,188 ROI-01
                </div>
              </div>
            )}

            {/* Viewfinder HUD Overlays */}
            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90 z-20 pointer-events-none drop-shadow">
              <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                <Camera size={12} className="text-emerald-400" />
                <span>CAM-01 · {fieldName.toUpperCase()} CANOPY</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-emerald-400 tracking-wider">LIVE</span>
                <span className="text-white/60">24 FPS</span>
              </div>
            </div>

            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/80 z-20 pointer-events-none drop-shadow">
              <div className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                <span>QUALCOMM NPU · 4.2ms INFERENCE</span>
              </div>
              <div className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                <span>{timestamp} UTC</span>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-secondaryText px-1">
            <span>Video Stream: Continuous loop (muted)</span>
            <span className="font-mono">Zone C Canopy · Node-03</span>
          </div>
        </div>

        {/* Right: Visual Detection Result Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-secondaryText mb-2">
              Visual Detection Result
            </div>

            {detection.detected ? (
              /* WARNING STATE */
              <div className="p-4 rounded-card border border-status-warning-border bg-status-warning-bg transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FDF3E7] text-status-warning flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-status-warning">
                        Warning
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/80 border border-status-warning-border text-status-warning">
                        Pathology Identified
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-primaryText mt-1">
                      {detection.disease || "Early Blight"} detected
                    </h4>

                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-secondaryText font-medium">Confidence:</span>
                        <strong className="text-primaryText font-semibold">{confidencePercent}%</strong>
                      </div>
                      {/* Confidence Meter */}
                      <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-status-warning-border/60">
                        <div
                          className="h-full bg-status-warning rounded-full transition-all duration-500"
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-secondaryText mt-3 leading-relaxed">
                      Leaf foliage displays concentric necrotic lesions typical of fungal blight. Recommended foliar inspection protocol triggered.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* NOMINAL STATE */
              <div className="p-4 rounded-card border border-[#C3E4CD] bg-[#EBF5EE] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-status-normal flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-status-normal">
                        Nominal
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-[#C3E4CD] text-status-normal">
                        Foliage Healthy
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-primaryText mt-1">
                      No disease detected
                    </h4>

                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-secondaryText font-medium">Confidence:</span>
                        <strong className="text-primaryText font-semibold">{confidencePercent}%</strong>
                      </div>
                      {/* Baseline Noise Meter */}
                      <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-[#C3E4CD]">
                        <div
                          className="h-full bg-status-normal rounded-full transition-all duration-500"
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-secondaryText mt-3 leading-relaxed">
                      Canopy foliage exhibits uniform chlorophyll coloration and healthy leaf architecture without signs of chlorosis or fungal spots.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Model Contract Note */}
          <div className="p-3 rounded-md bg-surface-secondary/60 border border-borderDefault/80 text-[11px] text-secondaryText space-y-1.5">
            <div className="flex items-center gap-1.5 text-primaryText font-medium">
              <Cpu size={13} />
              <span>CV Model Contract (3 Fields)</span>
            </div>
            <pre className="font-mono text-[10px] bg-white p-2 rounded border border-borderDefault text-secondaryText overflow-x-auto">
{JSON.stringify(
  {
    detected: detection.detected,
    disease: detection.disease,
    confidence: detection.confidence,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

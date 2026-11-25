import React, { useState, useRef, useEffect } from "react";
import { Camera, Play, Pause, RotateCcw, Sparkles, Video } from "lucide-react";
import {
  VISION_PRESET_SOURCES,
  DETECTION_TIMELINE_CUES,
  TimelineDetectionCue,
  getTimelineCueForTime,
} from "../../config/visionMedia";

interface SyncedCropVideoPlayerProps {
  presetId: string;
  zoneLabel: string;
  autoTimelineEnabled: boolean;
  onToggleAutoTimeline?: (enabled: boolean) => void;
  onCueTransition?: (cue: TimelineDetectionCue) => void;
  externalConditionLabel?: string;
  externalConfidencePercent?: number;
  externalIsHealthy?: boolean;
  isProcessing?: boolean;
  processingTitle?: string;
  processingSubtitle?: string;
  badgeRightText?: string;
}

export const SyncedCropVideoPlayer: React.FC<SyncedCropVideoPlayerProps> = ({
  presetId,
  zoneLabel,
  autoTimelineEnabled,
  onToggleAutoTimeline,
  onCueTransition,
  externalConditionLabel,
  externalConfidencePercent,
  externalIsHealthy,
  isProcessing = false,
  processingTitle = "Sampling Video Frames & Running Inference...",
  processingSubtitle = "Multimodal Fusion Engine Evaluating Risk",
  badgeRightText = "720p · 2 FPS SAMPLING · LIVE",
}) => {
  const preset =
    VISION_PRESET_SOURCES[presetId] || VISION_PRESET_SOURCES["rhizome_rot_canopy.mp4"];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [srcMode, setSrcMode] = useState<"remote" | "local" | "hud">("remote");
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(15);
  const lastCueIdRef = useRef<string | null>(null);

  // Reset source mode when preset changes
  useEffect(() => {
    setSrcMode("remote");
    setVideoReady(false);
    setCurrentTime(0);
    lastCueIdRef.current = null;
  }, [presetId]);

  const activeSrc =
    srcMode === "remote" ? preset.remoteUrl : preset.fallbackLocalUrl;

  const activeCue = getTimelineCueForTime(currentTime, presetId);

  // Determine overlay display: prefer live timeline cue when autoTimeline is active, otherwise external backend diagnosis
  const showOverlayHealthy = autoTimelineEnabled
    ? activeCue.severity === "healthy"
    : externalIsHealthy ?? activeCue.severity === "healthy";

  const overlayLabel = autoTimelineEnabled
    ? activeCue.label
    : externalConditionLabel || activeCue.label;

  const overlayConfidence = autoTimelineEnabled
    ? Math.round(activeCue.confidence * 100)
    : externalConfidencePercent ?? Math.round(activeCue.confidence * 100);

  const overlaySeverity = autoTimelineEnabled
    ? activeCue.severity
    : externalIsHealthy
    ? "healthy"
    : activeCue.severity === "healthy"
    ? "critical"
    : activeCue.severity;

  // Ensure video plays reliably once data/metadata is loaded
  const triggerPlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  // Fallback internal clock when autoTimelineEnabled is ON and video is paused/buffering slowly
  useEffect(() => {
    if (!autoTimelineEnabled || !isPlaying) return;
    const timer = window.setInterval(() => {
      const vid = videoRef.current;
      // If real video is actively playing forward, let onTimeUpdate handle time
      if (vid && !vid.paused && vid.readyState >= 3 && vid.currentTime > 0) {
        return;
      }
      setCurrentTime((prev) => {
        const next = (prev + 0.5) % 15;
        if (onCueTransition) {
          const cue = getTimelineCueForTime(next, presetId);
          if (lastCueIdRef.current !== cue.id) {
            lastCueIdRef.current = cue.id;
            onCueTransition(cue);
          }
        }
        return next;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [autoTimelineEnabled, isPlaying, presetId, onCueTransition]);

  const handleVideoError = () => {
    if (srcMode === "remote") {
      setSrcMode("local");
    } else {
      setSrcMode("hud");
      setVideoReady(false);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime || 0;
    // Loop timeline cleanly at 15s window even on 30s clips so demos stay snappy
    const cycleTime = presetId === "healthy_crop_control.mp4" ? t : t % 15;
    setCurrentTime(cycleTime);

    if (autoTimelineEnabled && onCueTransition) {
      const cue = getTimelineCueForTime(cycleTime, presetId);
      if (lastCueIdRef.current !== cue.id) {
        lastCueIdRef.current = cue.id;
        onCueTransition(cue);
      }
    }
  };

  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const jumpToTimestamp = (sec: number) => {
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = sec;
      if (vid.paused) {
        vid.play().catch(() => {});
        setIsPlaying(true);
      }
    }
    setCurrentTime(sec);
    const cue = getTimelineCueForTime(sec, presetId);
    lastCueIdRef.current = cue.id;
    if (onCueTransition) {
      onCueTransition(cue);
    }
  };

  const borderClass =
    overlaySeverity === "critical"
      ? "border-rose-500/90 bg-rose-500/15"
      : overlaySeverity === "warning"
      ? "border-amber-400/90 bg-amber-400/15"
      : "border-emerald-400/80 bg-emerald-400/10";

  const badgeBgClass =
    overlaySeverity === "critical"
      ? "bg-rose-600"
      : overlaySeverity === "warning"
      ? "bg-amber-500"
      : "bg-emerald-600";

  return (
    <div className="space-y-3">
      {/* Main Video Viewport */}
      <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex flex-col items-center justify-center">
        {srcMode !== "hud" && (
          <video
            key={`${preset.id}-${srcMode}`}
            ref={videoRef}
            src={activeSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onLoadedData={() => {
              setVideoReady(true);
              if (videoRef.current?.duration) {
                setDuration(Math.min(15, videoRef.current.duration));
              }
              triggerPlay();
            }}
            onCanPlay={triggerPlay}
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              videoReady ? "opacity-95" : "opacity-0"
            }`}
          />
        )}

        {/* Fallback Viewfinder if video is still buffering or both sources fail */}
        {(!videoReady || srcMode === "hud") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 select-none bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293725_1px,transparent_1px),linear-gradient(to_bottom,#1f293725_1px,transparent_1px)] bg-[size:32px_32px]" />
            <Camera className="w-12 h-12 text-emerald-500/70 mb-2 animate-pulse relative z-10" />
            <p className="text-xs text-slate-300 font-mono relative z-10">
              {srcMode === "hud" ? "EDGE SENSOR VIEWPORT • SIMULATED STREAM" : "STREAMING LIVE CROP FEED..."}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 relative z-10">{preset.label}</p>
          </div>
        )}

        {/* Top HUD Bar */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-mono z-10">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>CAM-01 · {zoneLabel}</span>
        </div>

        <div className="absolute top-3 right-3 bg-emerald-700/85 backdrop-blur-md text-white px-2.5 py-0.5 rounded text-[11px] font-mono z-10">
          {badgeRightText}
        </div>

        {/* Synchronized Bounding Box Overlay */}
        <div
          className={`absolute border-2 rounded-lg backdrop-blur-[1px] z-10 flex flex-col justify-between p-2 shadow-lg transition-all duration-500 pointer-events-none ${borderClass}`}
          style={{
            top: activeCue.box.top,
            left: activeCue.box.left,
            width: activeCue.box.width,
            height: activeCue.box.height,
          }}
        >
          <div className="flex justify-between items-start gap-1">
            <span
              className={`${badgeBgClass} text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-xs`}
            >
              {overlayLabel} • {overlayConfidence}%
            </span>
            <span className="text-[9px] font-mono text-white/90 bg-black/50 px-1.5 py-0.5 rounded">
              T+{currentTime.toFixed(1)}s
            </span>
          </div>
          <div className="text-[10px] text-white font-medium bg-black/65 px-2 py-1 rounded">
            {showOverlayHealthy
              ? "Uniform healthy canopy chlorophyll profile"
              : activeCue.summary}
          </div>
        </div>

        {/* Bottom Timestamp & Play/Pause Controls */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white z-20">
          <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md">
            <button
              type="button"
              onClick={togglePlayPause}
              className="hover:text-emerald-400 transition-colors"
              title={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => jumpToTimestamp(0)}
              className="hover:text-emerald-400 transition-colors"
              title="Restart timeline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="ml-1">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
          </div>

          <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-emerald-300 flex items-center gap-1.5">
            <Video className="w-3 h-3" />
            <span>{srcMode === "remote" ? "CLOUD STREAM MP4" : srcMode === "local" ? "LOCAL FEED MP4" : "HUD FALLBACK"}</span>
          </div>
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white z-30">
            <div className="w-9 h-9 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-2" />
            <div className="text-sm font-bold">{processingTitle}</div>
            <div className="text-xs font-mono text-emerald-300 mt-1">{processingSubtitle}</div>
          </div>
        )}
      </div>

      {/* Interactive Video Timestamp Simulation Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
            Timestamp-Synced Disease Detection Timeline
          </span>
          {onToggleAutoTimeline && (
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTimelineEnabled}
                onChange={(e) => onToggleAutoTimeline(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              Auto-Trigger Backend on Video Timestamps
            </label>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {DETECTION_TIMELINE_CUES.map((cue) => {
            const isActive = activeCue.id === cue.id;
            const pillStyle =
              cue.severity === "critical"
                ? isActive
                  ? "bg-rose-600 text-white border-rose-700"
                  : "bg-white text-rose-800 border-rose-200 hover:bg-rose-50"
                : cue.severity === "warning"
                ? isActive
                  ? "bg-amber-500 text-white border-amber-600"
                  : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
                : isActive
                ? "bg-emerald-600 text-white border-emerald-700"
                : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50";

            return (
              <button
                key={cue.id}
                type="button"
                onClick={() => jumpToTimestamp(cue.startSec + 0.2)}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${pillStyle}`}
              >
                <div className="text-[10px] font-mono opacity-85">
                  {cue.startSec}s–{cue.endSec > 100 ? "15s" : `${cue.endSec}s`}
                </div>
                <div className="text-[11px] font-bold truncate">{cue.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

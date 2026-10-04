import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, Play, Square, Globe } from "lucide-react";

interface VoiceAdvisoryPlayerProps {
  voiceText?: {
    en?: string;
    ta?: string;
    hi?: string;
  };
  zoneId: string;
  condition: string;
}

export type SupportedLanguage = "en" | "ta" | "hi";

const LANGUAGE_LABELS: Record<SupportedLanguage, { label: string; native: string; langCode: string }> = {
  en: { label: "English", native: "English", langCode: "en-IN" },
  ta: { label: "Tamil", native: "தமிழ்", langCode: "ta-IN" },
  hi: { label: "Hindi", native: "हिंदी", langCode: "hi-IN" },
};

export const VoiceAdvisoryPlayer: React.FC<VoiceAdvisoryPlayerProps> = ({
  voiceText,
  zoneId,
  condition,
}) => {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>("en");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>("Ready to play audio advisory");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechSupported(false);
      setStatusMessage("Web Speech API not available on this device");
    }
  }, []);

  const stopPlayback = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setStatusMessage("Playback stopped");
  };

  const playAdvisory = () => {
    if (!speechSupported) {
      setStatusMessage("Audio playback not supported in this browser");
      return;
    }

    const textToSpeak =
      voiceText?.[selectedLang] ||
      `Zone ${zoneId}. Condition: ${condition.replace("_", " ")}. Please review actionable recommendation.`;

    stopPlayback();

    try {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const targetLangCode = LANGUAGE_LABELS[selectedLang].langCode;
      utterance.lang = targetLangCode;
      utterance.rate = 0.95; // Slightly slower for clear agronomic advisory
      utterance.pitch = 1.0;

      // Try to find matching voice on system
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(
        (v) => v.lang === targetLangCode || v.lang.startsWith(selectedLang)
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsPlaying(true);
        setStatusMessage(`Playing advisory in ${LANGUAGE_LABELS[selectedLang].native}...`);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setStatusMessage("Advisory playback completed");
      };

      utterance.onerror = (e) => {
        console.warn("[VoicePlayer] Speech synthesis error:", e);
        setIsPlaying(false);
        setStatusMessage(`Speech note: ${textToSpeak}`);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[VoicePlayer] Failed to speak:", err);
      setIsPlaying(false);
      setStatusMessage("Audio synthesis unavailable offline; displaying text transcription below.");
    }
  };

  const currentText =
    voiceText?.[selectedLang] ||
    `Zone ${zoneId}: ${condition.replace("_", " ")}. Follow recommended advisory.`;

  return (
    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-600 text-white rounded-lg">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-950 text-sm sm:text-base">
              Voice Advisory Playback
            </h4>
            <p className="text-xs text-emerald-700">
              Listen to the actionable recommendation in your preferred language
            </p>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-emerald-200 shadow-xs">
          {(["en", "ta", "hi"] as SupportedLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                stopPlayback();
                setSelectedLang(lang);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedLang === lang
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {LANGUAGE_LABELS[lang].native}
            </button>
          ))}
        </div>
      </div>

      {/* Transcription Preview */}
      <div className="bg-white rounded-lg p-3 border border-emerald-100 mb-3 text-sm text-slate-800 italic">
        "{currentText}"
      </div>

      {/* Controls & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              type="button"
              onClick={playAdvisory}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium text-sm transition-colors shadow-xs active:scale-98"
            >
              <Play className="w-4 h-4 fill-white" />
              Play Voice Advisory
            </button>
          ) : (
            <button
              type="button"
              onClick={stopPlayback}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors shadow-xs active:scale-98"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Audio
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 font-mono">
          {isPlaying ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Playing ({LANGUAGE_LABELS[selectedLang].native})
            </span>
          ) : (
            statusMessage
          )}
        </span>
      </div>
    </div>
  );
};

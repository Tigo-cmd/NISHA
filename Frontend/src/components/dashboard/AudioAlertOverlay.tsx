"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Volume2, X, Camera, MessageSquareWarning } from "lucide-react";

// Theme configuration per alert category
const ALERT_THEMES = {
  audio: {
    label: "CRITICAL SOUND",
    icon: Volume2,
    borderColor: "border-red-600/50",
    bgColor: "bg-red-950/90",
    accentBorder: "border-red-500",
    accentText: "text-red-500",
    detailText: "text-red-400",
    btnBg: "bg-red-600 hover:bg-red-500",
    shadowColor: "rgba(239, 68, 68, 0.5)",
    glowColor: "rgba(239, 68, 68, 0.7)",
    ringColor: "border-red-500",
    infoBorder: "border-red-900/50",
  },
  video: {
    label: "VIOLENCE DETECTED",
    icon: Camera,
    borderColor: "border-purple-600/50",
    bgColor: "bg-purple-950/90",
    accentBorder: "border-purple-500",
    accentText: "text-purple-500",
    detailText: "text-purple-400",
    btnBg: "bg-purple-600 hover:bg-purple-500",
    shadowColor: "rgba(147, 51, 234, 0.5)",
    glowColor: "rgba(147, 51, 234, 0.7)",
    ringColor: "border-purple-500",
    infoBorder: "border-purple-900/50",
  },
  transcript: {
    label: "THREAT SPEECH",
    icon: MessageSquareWarning,
    borderColor: "border-orange-600/50",
    bgColor: "bg-orange-950/90",
    accentBorder: "border-orange-500",
    accentText: "text-orange-500",
    detailText: "text-orange-400",
    btnBg: "bg-orange-600 hover:bg-orange-500",
    shadowColor: "rgba(249, 115, 22, 0.5)",
    glowColor: "rgba(249, 115, 22, 0.7)",
    ringColor: "border-orange-500",
    infoBorder: "border-orange-900/50",
  },
};

type AlertCategory = keyof typeof ALERT_THEMES;

export function AudioAlertOverlay() {
  const activeAudioAlert = useStore((state) => state.activeAudioAlert);
  const setActiveAudioAlert = useStore((state) => state.setActiveAudioAlert);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    if (activeAudioAlert) {
      const timer = setTimeout(() => {
        setActiveAudioAlert(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [activeAudioAlert, setActiveAudioAlert]);

  if (!activeAudioAlert) return null;

  const category: AlertCategory = activeAudioAlert.alertCategory || "audio";
  const theme = ALERT_THEMES[category] || ALERT_THEMES.audio;
  const Icon = theme.icon;

  const confidenceStr = activeAudioAlert.confidence 
    ? `${(activeAudioAlert.confidence * 100).toFixed(0)}%` 
    : '';

  const displayLabel = activeAudioAlert.sound_class || activeAudioAlert.behavior || "Unknown";

  // For transcript alerts, show the actual text
  const transcriptText = category === "transcript" ? activeAudioAlert.text : null;
  const keywords = category === "transcript" ? (activeAudioAlert.keywords || []) : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
      >
        {/* Pulsing border overlay */}
        <motion.div
          animate={{
            boxShadow: [
              `inset 0 0 0px 0px ${theme.glowColor.replace("0.7", "0")}`,
              `inset 0 0 100px 20px ${theme.glowColor}`,
              `inset 0 0 0px 0px ${theme.glowColor.replace("0.7", "0")}`,
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`absolute inset-0 border-8 ${theme.borderColor}`}
        />

        {/* Central Alert Box */}
        <motion.div
          initial={{ scale: 0.8, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className={`relative z-10 ${theme.bgColor} ${theme.accentBorder} border p-8 rounded-2xl backdrop-blur-md max-w-2xl w-full mx-4 pointer-events-auto flex flex-col items-center text-center overflow-hidden`}
          style={{ boxShadow: `0 0 100px ${theme.shadowColor}` }}
        >
          {/* Animated background rings */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
            <motion.div
              animate={{ scale: [1, 2], opacity: [1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-32 h-32 rounded-full border-4 ${theme.ringColor} absolute`}
            />
            <motion.div
              animate={{ scale: [1, 2], opacity: [1, 0] }}
              transition={{ duration: 2, delay: 1, repeat: Infinity }}
              className={`w-32 h-32 rounded-full border-4 ${theme.ringColor} absolute`}
            />
          </div>

          <div className={`${theme.accentText} bg-white/5 p-4 rounded-full mb-6 relative z-10`}>
            <Icon className="w-16 h-16 animate-pulse" />
          </div>
          
          <h1 className="text-5xl font-black text-white mb-2 uppercase tracking-wider font-space-grotesk drop-shadow-lg flex items-center gap-4 relative z-10">
            <AlertTriangle className={theme.accentText} size={40} />
            {theme.label}
            <AlertTriangle className={theme.accentText} size={40} />
          </h1>
          
          <div className={`${theme.detailText} text-3xl font-bold font-jetbrains-mono mb-6 relative z-10`}>
            {displayLabel.toUpperCase()}
          </div>
          
          <div className={`bg-black/40 rounded-xl p-6 w-full mb-8 border ${theme.infoBorder} relative z-10`}>
            <div className="flex justify-between items-center text-lg mb-2">
              <span className="text-gray-400">Agent ID</span>
              <span className="text-white font-mono">{activeAudioAlert.agent_id || "—"}</span>
            </div>
            {confidenceStr && (
              <div className="flex justify-between items-center text-lg mb-2">
                <span className="text-gray-400">AI Confidence</span>
                <span className={`${theme.detailText} font-mono font-bold`}>{confidenceStr}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg mb-2">
              <span className="text-gray-400">Category</span>
              <span className={`${theme.accentText} font-mono uppercase font-bold`}>{category}</span>
            </div>
            {activeAudioAlert.severity && (
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-400">Severity</span>
                <span className="text-white font-mono uppercase font-bold">{activeAudioAlert.severity}</span>
              </div>
            )}
          </div>

          {/* Show transcript text for speech threats */}
          {transcriptText && (
            <div className={`bg-black/30 rounded-lg p-4 w-full mb-6 border ${theme.infoBorder} text-left relative z-10`}>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Intercepted Speech</div>
              <p className="text-white text-lg italic">"{transcriptText}"</p>
              {keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywords.map((kw: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-mono rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => setActiveAudioAlert(null)}
            className={`relative z-10 ${theme.btnBg} text-white font-bold py-4 px-12 rounded-full text-xl transition-all active:scale-95 flex items-center gap-2`}
            style={{ boxShadow: `0 0 20px ${theme.shadowColor}` }}
          >
            <X size={24} />
            ACKNOWLEDGE & DISMISS
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

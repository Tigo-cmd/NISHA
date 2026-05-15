"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Volume2, X } from "lucide-react";

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

  const confidenceStr = activeAudioAlert.confidence 
    ? `${(activeAudioAlert.confidence * 100).toFixed(0)}%` 
    : '';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
      >
        {/* Pulsing red border overlay */}
        <motion.div
          animate={{
            boxShadow: [
              "inset 0 0 0px 0px rgba(239, 68, 68, 0)",
              "inset 0 0 100px 20px rgba(239, 68, 68, 0.7)",
              "inset 0 0 0px 0px rgba(239, 68, 68, 0)",
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 border-8 border-red-600/50"
        />

        {/* Central Alert Box */}
        <motion.div
          initial={{ scale: 0.8, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="relative z-10 bg-red-950/90 border border-red-500 p-8 rounded-2xl shadow-[0_0_100px_rgba(239,68,68,0.5)] backdrop-blur-md max-w-2xl w-full mx-4 pointer-events-auto flex flex-col items-center text-center overflow-hidden"
        >
          {/* Animated background rings */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
            <motion.div
              animate={{ scale: [1, 2], opacity: [1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-32 h-32 rounded-full border-4 border-red-500 absolute"
            />
            <motion.div
              animate={{ scale: [1, 2], opacity: [1, 0] }}
              transition={{ duration: 2, delay: 1, repeat: Infinity }}
              className="w-32 h-32 rounded-full border-4 border-red-500 absolute"
            />
          </div>

          <div className="bg-red-500/20 p-4 rounded-full mb-6 text-red-500 relative z-10">
            <Volume2 className="w-16 h-16 animate-pulse" />
          </div>
          
          <h1 className="text-5xl font-black text-white mb-2 uppercase tracking-wider font-space-grotesk drop-shadow-lg flex items-center gap-4 relative z-10">
            <AlertTriangle className="text-red-500" size={40} />
            CRITICAL SOUND
            <AlertTriangle className="text-red-500" size={40} />
          </h1>
          
          <div className="text-red-400 text-3xl font-bold font-jetbrains-mono mb-6 relative z-10">
            {activeAudioAlert.sound_class.toUpperCase()}
          </div>
          
          <div className="bg-black/40 rounded-xl p-6 w-full mb-8 border border-red-900/50 relative z-10">
            <div className="flex justify-between items-center text-lg mb-2">
              <span className="text-gray-400">Agent ID</span>
              <span className="text-white font-mono">{activeAudioAlert.agent_id}</span>
            </div>
            {confidenceStr && (
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-400">AI Confidence</span>
                <span className="text-red-400 font-mono font-bold">{confidenceStr}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setActiveAudioAlert(null)}
            className="relative z-10 bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-12 rounded-full text-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] active:scale-95 flex items-center gap-2"
          >
            <X size={24} />
            ACKNOWLEDGE & DISMISS
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

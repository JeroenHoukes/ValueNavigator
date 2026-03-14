"use client";

import { useVoice } from "@/contexts/VoiceContext";

export function VoiceInputButton() {
  const { isListening, startListening, stopListening, isSupported, error } = useVoice();

  return (
    <div className="relative">
      {!isSupported ? (
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
          title="Voice input not supported in this browser"
          aria-label="Voice input not supported"
        >
          <span className="text-lg" aria-hidden>🎤</span>
          <span className="hidden sm:inline">Voice</span>
        </button>
      ) : (
        <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isListening
            ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
            : "text-slate-300 hover:text-white hover:bg-slate-800/70"
        }`}
        title={isListening ? "Stop listening" : "Start voice input"}
        aria-label={isListening ? "Stop voice input" : "Start voice input"}
        aria-pressed={isListening}
      >
        <span className="text-lg" aria-hidden>
          {isListening ? "🔴" : "🎤"}
        </span>
        <span className="hidden sm:inline">{isListening ? "Stop" : "Voice"}</span>
      </button>
      )}
      {error && (
        <p className="absolute top-full right-0 mt-1 w-48 rounded-lg bg-red-900/90 px-2 py-1.5 text-xs text-red-200 shadow-lg z-50">
          {error}
        </p>
      )}
    </div>
  );
}

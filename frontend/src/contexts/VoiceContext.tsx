"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode
} from "react";

const SpeechRecognition =
  typeof window !== "undefined" &&
  ((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

export interface VoiceContextValue {
  isListening: boolean;
  transcript: string;
  clearTranscript: () => void;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

const defaultContext: VoiceContextValue = {
  isListening: false,
  transcript: "",
  clearTranscript: () => {},
  startListening: () => {},
  stopListening: () => {},
  isSupported: false,
  error: null
};

export const VoiceContext = createContext<VoiceContextValue>(defaultContext);

export function useVoice(): VoiceContextValue {
  return useContext(VoiceContext);
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const interimRef = useRef("");

  useEffect(() => {
    const api = typeof window !== "undefined" && ((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
    setIsSupported(!!api);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    interimRef.current = "";
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined" &&
      ((window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition);
    if (!SpeechRecognitionAPI) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    clearTranscript();
    try {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-GB";
      rec.onresult = (event: any) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }
        if (final) {
          setTranscript((prev) => (prev + final).trim());
        }
        interimRef.current = interim;
      };
      rec.onend = () => {
        if (recognitionRef.current === rec) {
          setIsListening(false);
          recognitionRef.current = null;
          if (interimRef.current) {
            setTranscript((prev) => (prev + interimRef.current).trim());
            interimRef.current = "";
          }
        }
      };
      rec.onerror = (event: any) => {
        if (event.error === "aborted" || event.error === "no-speech") return;
        setError(event.error === "not-allowed" ? "Microphone access denied." : `Voice error: ${event.error}`);
      };
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start voice input.");
      setIsListening(false);
    }
  }, [clearTranscript]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const value: VoiceContextValue = {
    isListening,
    transcript,
    clearTranscript,
    startListening,
    stopListening,
    isSupported,
    error
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

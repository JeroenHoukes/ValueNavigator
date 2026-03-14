"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "value-navigator-background-color";
const DEFAULT_BG = "#020617"; // slate-950 (original dark)

function getStoredColor(): string {
  if (typeof window === "undefined") return DEFAULT_BG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || DEFAULT_BG;
  } catch {
    return DEFAULT_BG;
  }
}

function applyBackgroundColor(color: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--app-bg", color);
}

export function BackgroundColorPicker() {
  const [color, setColor] = useState(DEFAULT_BG);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredColor();
    setColor(stored);
    applyBackgroundColor(stored);
  }, []);

  function handleChange(newColor: string) {
    setColor(newColor);
    localStorage.setItem(STORAGE_KEY, newColor);
    applyBackgroundColor(newColor);
  }

  function handleReset() {
    handleChange(DEFAULT_BG);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
        title="Background color"
        aria-label="Choose background color"
        aria-expanded={open}
      >
        <span
          className="inline-block w-5 h-5 rounded border border-slate-600"
          style={{ backgroundColor: color }}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-xl min-w-[200px]">
            <p className="text-xs text-slate-400 mb-2">Background color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => handleChange(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                aria-label="Pick color"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => handleChange(e.target.value)}
                className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white font-mono"
                aria-label="Color hex value"
              />
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Reset to default
            </button>
          </div>
        </>
      )}
    </div>
  );
}

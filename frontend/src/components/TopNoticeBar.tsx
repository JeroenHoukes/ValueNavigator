"use client";

import { useEffect, useRef } from "react";

type Props = {
  message: string;
  variant: "success" | "error";
  onDismiss: () => void;
  /** Auto-hide after this many ms. */
  durationMs?: number;
};

/**
 * Non-blocking full-width bar at the top; auto-dismisses (no required click).
 */
export function TopNoticeBar({
  message,
  variant,
  onDismiss,
  durationMs = 5200
}: Props) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const t = window.setTimeout(() => onDismissRef.current(), durationMs);
    return () => window.clearTimeout(t);
  }, [message, variant, durationMs]);

  const isSuccess = variant === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[300] flex justify-center border-b px-4 py-3 shadow-lg ${
        isSuccess
          ? "border-emerald-600/80 bg-emerald-800 text-emerald-50"
          : "border-red-800 bg-red-950 text-red-100"
      }`}
    >
      <p className="max-h-[40vh] max-w-4xl overflow-y-auto text-center text-sm font-medium leading-snug whitespace-pre-wrap break-words">
        {message}
      </p>
    </div>
  );
}

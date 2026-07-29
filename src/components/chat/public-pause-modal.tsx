"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { DEFAULT_PAUSE_MESSAGE } from "@/lib/public-access-config";

type PublicPauseModalProps = {
  message: string | null;
  onAcknowledge: () => void;
};

/**
 * Full-screen notice shown when public access to the assistant is paused.
 * Chat chrome stays disabled after acknowledging — this only clears the overlay.
 */
export function PublicPauseModal({
  message,
  onAcknowledge,
}: PublicPauseModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onAcknowledge();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAcknowledge]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-pause-title"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-amber-500/40 bg-card p-6 text-center shadow-xl">
        <span className="flex size-11 items-center justify-center rounded-full bg-amber-500/15">
          <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
        </span>
        <h2 id="public-pause-title" className="text-base font-medium text-foreground">
          Assistant paused
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message?.trim() || DEFAULT_PAUSE_MESSAGE}
        </p>
        <Button autoFocus type="button" className="mt-1 w-24" onClick={onAcknowledge}>
          OK
        </Button>
      </div>
    </div>
  );
}

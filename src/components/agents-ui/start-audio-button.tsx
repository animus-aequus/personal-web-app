"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type StartAudioButtonProps = {
  label?: string;
};

/** Browser autoplay policies may block audio until user interaction. */
export function StartAudioButton({ label = "Enable audio" }: StartAudioButtonProps) {
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    const audio = document.createElement("audio");
    audio.src =
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    audio
      .play()
      .then(() => setNeedsUnlock(false))
      .catch(() => setNeedsUnlock(true));
  }, []);

  if (!needsUnlock) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => {
        setNeedsUnlock(false);
      }}
    >
      {label}
    </Button>
  );
}

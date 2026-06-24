"use client";

import {
  StartAudio,
  type UseSessionReturn,
} from "@livekit/components-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StartAudioButtonProps = {
  session: UseSessionReturn;
  label?: string;
};

/** Shown when the browser blocks LiveKit audio until user interaction. */
export function StartAudioButton({
  session,
  label = "Enable audio",
}: StartAudioButtonProps) {
  return (
    <StartAudio
      room={session.room}
      label={label}
      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
    />
  );
}

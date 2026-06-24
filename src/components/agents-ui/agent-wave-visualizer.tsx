"use client";

import { useEffect, useMemo, useState } from "react";

import {
  useTrackVolume,
  useVoiceAssistant,
  type TrackReference,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";

import { cn } from "@/lib/utils";

const WAVE_COLOR = "oklch(0.52 0.11 260)";
const WIDTH = 280;
const HEIGHT = 56;

function buildWavePath(time: number, amplitude: number): string {
  const mid = HEIGHT / 2;
  let path = `M 0 ${mid}`;

  for (let x = 0; x <= WIDTH; x += 2) {
    const norm = x / WIDTH;
    const envelope = Math.sin(norm * Math.PI);
    const y =
      mid + envelope * amplitude * Math.sin(norm * Math.PI * 6 + time * 7);
    path += ` L ${x} ${y}`;
  }

  return path;
}

type AgentWaveVisualizerProps = {
  track?: TrackReferenceOrPlaceholder;
  className?: string;
};

export function AgentWaveVisualizer({ track, className }: AgentWaveVisualizerProps) {
  const { audioTrack, state } = useVoiceAssistant();
  const activeTrack = track ?? audioTrack;
  const volume = useTrackVolume(
    activeTrack as TrackReference,
    activeTrack
      ? { fftSize: 512, smoothingTimeConstant: 0.55 }
      : undefined,
  );

  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      setTime(now / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const amplitude = useMemo(() => {
    if (!activeTrack) {
      return 3;
    }
    if (state === "speaking") {
      return 6 + volume * 26;
    }
    if (state === "thinking" || state === "connecting" || state === "initializing") {
      return 5 + Math.sin(time * 6) * 2;
    }
    return 4 + volume * 8;
  }, [activeTrack, state, volume, time]);

  const path = buildWavePath(time, amplitude);

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke={WAVE_COLOR}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={activeTrack ? 1 : 0.35}
      />
    </svg>
  );
}

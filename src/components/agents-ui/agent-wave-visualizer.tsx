"use client";

import { useEffect, useRef } from "react";

import {
  useTrackVolume,
  useVoiceAssistant,
  type AgentState,
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

function waveAmplitude(
  hasTrack: boolean,
  state: AgentState | undefined,
  volume: number,
  time: number,
): number {
  if (!hasTrack) {
    return 3;
  }
  if (state === "speaking") {
    return 6 + volume * 26;
  }
  if (state === "thinking" || state === "connecting" || state === "initializing") {
    return 5 + Math.sin(time * 6) * 2;
  }
  return 4 + volume * 8;
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

  const pathRef = useRef<SVGPathElement>(null);
  const hasTrackRef = useRef(Boolean(activeTrack));
  const stateRef = useRef(state);
  const volumeRef = useRef(volume);

  hasTrackRef.current = Boolean(activeTrack);
  stateRef.current = state;
  volumeRef.current = volume;

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const path = pathRef.current;
      if (path) {
        const time = now / 1000;
        path.setAttribute(
          "d",
          buildWavePath(
            time,
            waveAmplitude(
              hasTrackRef.current,
              stateRef.current,
              volumeRef.current,
              time,
            ),
          ),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <path
        ref={pathRef}
        d={buildWavePath(0, 3)}
        fill="none"
        stroke={WAVE_COLOR}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={activeTrack ? 1 : 0.35}
      />
    </svg>
  );
}

"use client";

import { useMemo } from "react";

import {
  useMultibandTrackVolume,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";

import { useAgentAudioVisualizerRadialAnimator } from "@/hooks/use-agent-audio-visualizer-radial";
import { cn } from "@/lib/utils";

export const USER_RADIAL_BAR_COUNT = 24;
export const USER_RADIAL_RADIUS = 52;

export function userRadialClusterSize(): number {
  const dotSize = (USER_RADIAL_RADIUS * Math.PI) / USER_RADIAL_BAR_COUNT;
  return USER_RADIAL_RADIUS * 2 + dotSize;
}

type UserRadialDotsProps = {
  track: TrackReferenceOrPlaceholder | undefined;
  className?: string;
};

/** Radial ring only — mount around a centered mic without replacing the control shell. */
export function UserRadialDots({ track, className }: UserRadialDotsProps) {
  const volumeBands = useMultibandTrackVolume(track, {
    bands: USER_RADIAL_BAR_COUNT,
    loPass: 100,
    hiPass: 200,
  });

  const highlightedIndices = useAgentAudioVisualizerRadialAnimator(
    track ? "speaking" : "listening",
    USER_RADIAL_BAR_COUNT,
    track ? 1000 : 500,
  );

  const bands = useMemo(
    () => (track ? volumeBands : new Array(USER_RADIAL_BAR_COUNT).fill(0)),
    [track, volumeBands],
  );

  const dotSize = useMemo(
    () => (USER_RADIAL_RADIUS * Math.PI) / USER_RADIAL_BAR_COUNT,
    [],
  );

  const clusterSize = userRadialClusterSize();

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary",
        className,
      )}
      style={{ width: clusterSize, height: clusterSize }}
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {bands.map((band, idx) => {
          const angle = (idx / USER_RADIAL_BAR_COUNT) * Math.PI * 2;
          const isHighlighted = highlightedIndices.includes(idx);
          const scaleY = 1 + band * 3.5;
          const active = band > 0.04 || isHighlighted;

          return (
            <span
              key={idx}
              className={cn(
                "absolute origin-bottom rounded-full transition-colors duration-150",
                active ? "bg-primary" : "bg-primary/25",
              )}
              style={{
                width: dotSize,
                height: dotSize,
                transform: `rotate(${angle}rad) translateY(-${USER_RADIAL_RADIUS}px) scaleY(${scaleY})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

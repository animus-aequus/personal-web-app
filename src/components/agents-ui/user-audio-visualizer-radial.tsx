"use client";

import { type ReactNode, useMemo } from "react";

import {
  useMultibandTrackVolume,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";

import { useAgentAudioVisualizerRadialAnimator } from "@/hooks/use-agent-audio-visualizer-radial";
import { cn } from "@/lib/utils";

const BAR_COUNT = 24;
const RADIUS = 52;

type UserAudioVisualizerRadialProps = {
  track: TrackReferenceOrPlaceholder | undefined;
  children: ReactNode;
  className?: string;
};

export function UserAudioVisualizerRadial({
  track,
  children,
  className,
}: UserAudioVisualizerRadialProps) {
  const volumeBands = useMultibandTrackVolume(track, {
    bands: BAR_COUNT,
    loPass: 100,
    hiPass: 200,
  });

  const highlightedIndices = useAgentAudioVisualizerRadialAnimator(
    track ? "speaking" : "listening",
    BAR_COUNT,
    track ? 1000 : 500,
  );

  const bands = useMemo(
    () => (track ? volumeBands : new Array(BAR_COUNT).fill(0)),
    [track, volumeBands],
  );

  const dotSize = useMemo(() => (RADIUS * Math.PI) / BAR_COUNT, []);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center text-primary",
        className,
      )}
      style={{ width: RADIUS * 2 + dotSize, height: RADIUS * 2 + dotSize }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {bands.map((band, idx) => {
          const angle = (idx / BAR_COUNT) * Math.PI * 2;
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
                transform: `rotate(${angle}rad) translateY(-${RADIUS}px) scaleY(${scaleY})`,
              }}
            />
          );
        })}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

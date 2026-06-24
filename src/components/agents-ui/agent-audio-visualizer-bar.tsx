"use client";

import type { CSSProperties } from "react";

import {
  BarVisualizer,
  useSessionContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";

const BAR_COUNT = 8;
const BAR_OPTIONS = { minHeight: 25, maxHeight: 100 };
const ROW_CLASS = "flex h-20 w-full items-end gap-1.5";
const BAR_CLASS = "lk-audio-bar h-[25%] min-h-[6px] w-2 flex-1 rounded-full";

const GOLD_VARS = {
  "--lk-fg": "oklch(0.72 0.12 75)",
  "--lk-va-bg": "oklch(0.35 0.03 75 / 40%)",
} as CSSProperties;

function idleBars() {
  return Array.from({ length: BAR_COUNT }, (_, index) => (
    <div key={index} className={BAR_CLASS} />
  ));
}

function AudioBarRow({ track }: { track: TrackReferenceOrPlaceholder | undefined }) {
  if (!track) {
    return <div className={ROW_CLASS}>{idleBars()}</div>;
  }

  return (
    <BarVisualizer
      track={track}
      barCount={BAR_COUNT}
      options={BAR_OPTIONS}
      className={ROW_CLASS}
    >
      <div className={BAR_CLASS} />
    </BarVisualizer>
  );
}

export function AgentAudioVisualizerBar() {
  const session = useSessionContext();
  const { audioTrack } = useVoiceAssistant();
  const userTrack = session.isConnected ? session.local.microphoneTrack : undefined;

  return (
    <div
      className="flex h-20 w-full max-w-md items-end justify-center gap-6 px-2"
      style={GOLD_VARS}
    >
      <div className="flex-1">
        <AudioBarRow track={userTrack} />
      </div>
      <div className="h-10 w-px shrink-0 bg-border/40" aria-hidden />
      <div className="flex-1">
        <AudioBarRow track={audioTrack} />
      </div>
    </div>
  );
}

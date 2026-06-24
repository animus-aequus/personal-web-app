"use client";

import { BarVisualizer, useAgent, useSessionContext } from "@livekit/components-react";

export function AgentAudioVisualizerBar() {
  const session = useSessionContext();
  const agent = useAgent(session);

  const audioTrack =
    agent.isConnected && agent.state === "speaking" && agent.microphoneTrack
      ? agent.microphoneTrack
      : session.local.microphoneTrack;

  if (!audioTrack) {
    return (
      <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-border px-4 text-xs text-muted-foreground">
        Waiting for audio…
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <BarVisualizer
        trackRef={audioTrack}
        barCount={12}
        options={{ minHeight: 4 }}
        className="flex h-10 items-end gap-1"
      />
    </div>
  );
}

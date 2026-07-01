"use client";

import { ConnectionState, type Room } from "livekit-client";

export const VOICE_CONTROL_TOPIC = "voice_control";

const MODE_EXIT_SETTLE_MS = 600;

/** Tell the worker to commit any in-flight assistant turn before disconnect. */
export async function publishVoiceModeExit(room: Room): Promise<void> {
  if (room.state !== ConnectionState.Connected) {
    return;
  }
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: "voice_mode_exit" }),
  );
  await room.localParticipant.publishData(payload, {
    topic: VOICE_CONTROL_TOPIC,
    reliable: true,
  });
  await new Promise((resolve) => setTimeout(resolve, MODE_EXIT_SETTLE_MS));
}

/** End voice after signalling mode exit so chat_sync can arrive before teardown. */
export async function endVoiceSession(
  room: Room | undefined,
  end: () => Promise<void>,
): Promise<void> {
  try {
    if (room) {
      await publishVoiceModeExit(room);
    }
  } catch (error) {
    console.warn("Voice mode exit signal failed", error);
  } finally {
    await end();
  }
}

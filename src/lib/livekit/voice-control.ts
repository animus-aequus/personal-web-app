"use client";

import { ConnectionState, type Room } from "livekit-client";

export const VOICE_CONTROL_TOPIC = "voice_control";

const MODE_EXIT_SETTLE_MS = 600;

async function publishVoiceControl(
  room: Room,
  type:
    | "voice_mode_exit"
    | "stop_speech"
    | "user_turn_length_exceeded"
    | "commit_user_turn"
    | "clear_user_turn",
): Promise<void> {
  if (room.state !== ConnectionState.Connected) {
    return;
  }
  const payload = new TextEncoder().encode(JSON.stringify({ type }));
  await room.localParticipant.publishData(payload, {
    topic: VOICE_CONTROL_TOPIC,
    reliable: true,
  });
}

/** Tell the worker to commit any in-flight assistant turn before disconnect. */
export async function publishVoiceModeExit(room: Room): Promise<void> {
  await publishVoiceControl(room, "voice_mode_exit");
  await new Promise((resolve) => setTimeout(resolve, MODE_EXIT_SETTLE_MS));
}

/** Stop agent speech while staying in the voice session (no user message). */
export async function publishStopSpeech(room: Room): Promise<void> {
  await publishVoiceControl(room, "stop_speech");
}

/** Commit the in-progress user turn after the UI character limit is reached. */
export async function publishUserTurnLengthExceeded(room: Room): Promise<void> {
  await publishVoiceControl(room, "user_turn_length_exceeded");
}

/** Commit the open user turn after push-to-talk send (UI button or timeout). */
export async function publishCommitUserTurn(room: Room): Promise<void> {
  await publishVoiceControl(room, "commit_user_turn");
}

/** Drop an open manual user turn without committing (empty / local interrupt). */
export async function publishClearUserTurn(room: Room): Promise<void> {
  await publishVoiceControl(room, "clear_user_turn");
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

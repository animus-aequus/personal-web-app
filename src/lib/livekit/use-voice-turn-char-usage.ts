"use client";

import { useTranscriptions } from "@livekit/components-react";
import type { Room } from "livekit-client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  CHAT_MESSAGE_MAX,
  userMessageCharCount,
} from "@/lib/chat/chat-message-validation";

export type VoiceTurnCharUsage = {
  /** Joined STT segments for the open voice turn (not chat history). */
  liveText: string;
  usedChars: number;
  ratio: number;
  percent: number;
  isAtLimit: boolean;
  /** Non-stale stream currently has text (wave UX; may be false across pauses). */
  isSpeaking: boolean;
};

type TranscriptionEntry = {
  text?: string;
  streamInfo: { id: string; timestamp: number };
};

/**
 * Join in-turn STT segments. Brief silence starts a new LiveKit stream; the
 * agent turn is only committed on endpointing or hard-cut — so the meter must
 * accumulate segments until `turnCommitSignal`, not reset per stream.
 */
function accumulateTurnText(transcriptions: TranscriptionEntry[]): string {
  if (!transcriptions.length) {
    return "";
  }
  const sorted = [...transcriptions].sort(
    (a, b) =>
      (a.streamInfo.timestamp ?? 0) - (b.streamInfo.timestamp ?? 0) ||
      a.streamInfo.id.localeCompare(b.streamInfo.id),
  );
  const parts: string[] = [];
  for (const entry of sorted) {
    const text = entry.text?.trim() ?? "";
    if (text) {
      parts.push(text);
    }
  }
  return parts.join(" ");
}

/**
 * Live character usage for the open voice user turn from `lk.transcription`.
 * Resets only when `turnCommitSignal` bumps (`voice_user` via `chat_sync`).
 */
export function useVoiceTurnCharUsage(
  room: Room | undefined,
  turnCommitSignal: number,
): VoiceTurnCharUsage {
  const localIdentity = room?.localParticipant?.identity;
  const transcriptions = useTranscriptions({
    room,
    participantIdentities: localIdentity ? [localIdentity] : undefined,
  });

  const [staleStreamIds, setStaleStreamIds] = useState(() => new Set<string>());
  const lastProcessedCommitRef = useRef(turnCommitSignal);

  useLayoutEffect(() => {
    if (turnCommitSignal === 0) {
      return;
    }
    if (turnCommitSignal === lastProcessedCommitRef.current) {
      return;
    }
    lastProcessedCommitRef.current = turnCommitSignal;
    setStaleStreamIds((prev) => {
      const next = new Set(prev);
      for (const entry of transcriptions) {
        next.add(entry.streamInfo.id);
      }
      return next;
    });
  }, [turnCommitSignal, transcriptions]);

  const liveText = useMemo(() => {
    const inTurn = transcriptions.filter(
      (entry) => !staleStreamIds.has(entry.streamInfo.id),
    );
    return accumulateTurnText(inTurn);
  }, [transcriptions, staleStreamIds]);

  const usedChars = userMessageCharCount(liveText);
  const ratio = Math.min(1, usedChars / CHAT_MESSAGE_MAX);
  const percent = Math.round(ratio * 100);

  return {
    liveText,
    usedChars,
    ratio,
    percent,
    isAtLimit: usedChars >= CHAT_MESSAGE_MAX,
    isSpeaking: usedChars > 0,
  };
}

"use client";

import { useTranscriptions } from "@livekit/components-react";
import type { Room } from "livekit-client";
import { useMemo, useState } from "react";

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
 * meter accumulates segments until the turn boundary signal bumps (commit or
 * discard), not reset per stream.
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
 * `turnBoundarySignal` bumps on `voice_user` commit or empty-turn discard;
 * reset to `0` clears all stale streams (voice exit).
 */
export function useVoiceTurnCharUsage(
  room: Room,
  turnBoundarySignal: number,
): VoiceTurnCharUsage {
  const localIdentity = room.localParticipant?.identity;
  const transcriptions = useTranscriptions({
    room,
    participantIdentities: localIdentity ? [localIdentity] : undefined,
  });

  const [staleStreamIds, setStaleStreamIds] = useState(() => new Set<string>());
  const [prevTurnBoundarySignal, setPrevTurnBoundarySignal] = useState(
    turnBoundarySignal,
  );

  if (turnBoundarySignal !== prevTurnBoundarySignal) {
    setPrevTurnBoundarySignal(turnBoundarySignal);
    if (turnBoundarySignal === 0) {
      setStaleStreamIds(new Set());
    } else {
      setStaleStreamIds((prev) => {
        const next = new Set(prev);
        for (const entry of transcriptions) {
          next.add(entry.streamInfo.id);
        }
        return next;
      });
    }
  }

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

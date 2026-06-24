"use client";

import type { UseSessionReturn } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect } from "react";

import { useChatStore } from "@/lib/stores/chat-store";

const CHAT_SYNC_TOPIC = "chat_sync";

type VoiceChatSyncPayload =
  | { type: "voice_user"; turnId: string; text: string }
  | { type: "voice_assistant"; turnId: string; text: string };

function parseChatSyncPayload(raw: Uint8Array): VoiceChatSyncPayload | null {
  try {
    const text = new TextDecoder().decode(raw);
    const data = JSON.parse(text) as VoiceChatSyncPayload;
    if (
      (data.type === "voice_user" || data.type === "voice_assistant") &&
      typeof data.turnId === "string" &&
      typeof data.text === "string" &&
      data.text.trim()
    ) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

/** Sync voice chat rows from worker llm_node via LiveKit data channel. */
export function useVoiceChatSync(session: UseSessionReturn) {
  const addVoiceMessage = useChatStore((state) => state.addVoiceMessage);

  useEffect(() => {
    const room = session.room;
    if (!room) {
      return;
    }

    const onDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== CHAT_SYNC_TOPIC) {
        return;
      }

      const message = parseChatSyncPayload(payload);
      if (!message) {
        return;
      }

      if (message.type === "voice_user") {
        addVoiceMessage({
          id: message.turnId,
          role: "user",
          content: message.text.trim(),
        });
        return;
      }

      addVoiceMessage({
        id: `${message.turnId}-assistant`,
        role: "assistant",
        content: message.text.trim(),
      });
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [session.room, addVoiceMessage]);
}

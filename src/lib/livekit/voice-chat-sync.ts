"use client";

import type { UseSessionReturn } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect } from "react";

import { useChatStore } from "@/lib/stores/chat-store";

const CHAT_SYNC_TOPIC = "chat_sync";

type VoiceChatSyncPayload =
  | { type: "voice_user"; turnId: string; text: string }
  | {
      type: "voice_assistant";
      turnId: string;
      text: string;
      interrupted?: boolean;
    };

function parseChatSyncPayload(raw: Uint8Array): VoiceChatSyncPayload | null {
  try {
    const text = new TextDecoder().decode(raw);
    const data = JSON.parse(text) as Record<string, unknown>;
    if (
      data.type !== "voice_user" &&
      data.type !== "voice_assistant"
    ) {
      return null;
    }
    if (
      typeof data.turnId !== "string" ||
      typeof data.text !== "string" ||
      !data.text.trim()
    ) {
      return null;
    }
    if (data.type === "voice_user") {
      return {
        type: "voice_user",
        turnId: data.turnId,
        text: data.text,
      };
    }
    return {
      type: "voice_assistant",
      turnId: data.turnId,
      text: data.text,
      interrupted: data.interrupted === true,
    };
  } catch {
    return null;
  }
}

/** Sync voice chat rows from worker via LiveKit data channel (conversation_item_added → chat_sync). */
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
        interrupted: message.interrupted,
      });
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [session.room, addVoiceMessage]);
}

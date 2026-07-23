"use client";

import type { UseSessionReturn } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect } from "react";

import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";

const UI_EVENTS_TOPIC = "ui_events";

type BookingOtpPayload = {
  type: "booking_otp";
  bookingId: string;
  emailMasked: string;
  expiresAt: string;
  attemptsLeft?: number;
};

type MeetingsListPayload = {
  type: "meetings_list";
  listId: string;
  meetings: Array<{
    bookingId: string;
    eventName: string;
    slotStart: string;
    durationMinutes: number;
  }>;
};

type UiPayload = BookingOtpPayload | MeetingsListPayload;

function parseUiEvent(raw: Uint8Array): UiPayload | null {
  try {
    const text = new TextDecoder().decode(raw);
    const data = JSON.parse(text) as Record<string, unknown>;
    if (data.type === "booking_otp") {
      if (
        typeof data.bookingId !== "string" ||
        typeof data.emailMasked !== "string" ||
        typeof data.expiresAt !== "string"
      ) {
        return null;
      }
      return {
        type: "booking_otp",
        bookingId: data.bookingId,
        emailMasked: data.emailMasked,
        expiresAt: data.expiresAt,
        attemptsLeft:
          typeof data.attemptsLeft === "number" ? data.attemptsLeft : undefined,
      };
    }
    if (data.type === "meetings_list") {
      if (typeof data.listId !== "string" || !Array.isArray(data.meetings)) {
        return null;
      }
      const meetings = data.meetings.filter(
        (item): item is MeetingsListPayload["meetings"][number] => {
          if (typeof item !== "object" || item === null) {
            return false;
          }
          const row = item as Record<string, unknown>;
          return (
            typeof row.bookingId === "string" &&
            typeof row.eventName === "string" &&
            typeof row.slotStart === "string" &&
            typeof row.durationMinutes === "number"
          );
        },
      );
      return { type: "meetings_list", listId: data.listId, meetings };
    }
    return null;
  } catch {
    return null;
  }
}

/** Subscribe to LiveKit `ui_events` (booking OTP + meetings list GenUI). */
export function useVoiceUiEvents(session: UseSessionReturn) {
  const setFromPayload = useBookingOtpStore((s) => s.setFromPayload);
  const setActiveList = useMeetingsListStore((s) => s.setActiveList);

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
      if (topic !== UI_EVENTS_TOPIC) {
        return;
      }
      const event = parseUiEvent(payload);
      if (!event) {
        return;
      }
      if (event.type === "booking_otp") {
        setFromPayload({
          bookingId: event.bookingId,
          emailMasked: event.emailMasked,
          expiresAt: event.expiresAt,
          attemptsLeft: event.attemptsLeft ?? 5,
        });
        return;
      }
      setActiveList(event.listId, event.meetings);
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [session.room, setFromPayload, setActiveList]);
}

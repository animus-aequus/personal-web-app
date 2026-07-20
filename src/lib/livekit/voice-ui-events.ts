"use client";

import type { UseSessionReturn } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect } from "react";

import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";

const UI_EVENTS_TOPIC = "ui_events";

type BookingOtpPayload = {
  type: "booking_otp";
  bookingId: string;
  emailMasked: string;
  expiresAt: string;
  attemptsLeft?: number;
};

function parseUiEvent(raw: Uint8Array): BookingOtpPayload | null {
  try {
    const text = new TextDecoder().decode(raw);
    const data = JSON.parse(text) as Record<string, unknown>;
    if (data.type !== "booking_otp") {
      return null;
    }
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
  } catch {
    return null;
  }
}

/** Subscribe to LiveKit `ui_events` (booking OTP GenUI). */
export function useVoiceUiEvents(session: UseSessionReturn) {
  const setFromPayload = useBookingOtpStore((s) => s.setFromPayload);

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
      setFromPayload({
        bookingId: event.bookingId,
        emailMasked: event.emailMasked,
        expiresAt: event.expiresAt,
        attemptsLeft: event.attemptsLeft ?? 5,
      });
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [session.room, setFromPayload]);
}

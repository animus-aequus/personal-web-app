"use client";

import type { UseSessionReturn } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect } from "react";

import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
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
    meetUrl: string | null;
    htmlLink: string | null;
  }>;
};

type DirectMessagePayload = {
  type: "direct_message";
  formId: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
};

type UiPayload = BookingOtpPayload | MeetingsListPayload | DirectMessagePayload;

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
      const meetings: MeetingsListPayload["meetings"] = [];
      for (const item of data.meetings) {
        if (typeof item !== "object" || item === null) {
          continue;
        }
        const row = item as Record<string, unknown>;
        if (
          typeof row.bookingId !== "string" ||
          typeof row.eventName !== "string" ||
          typeof row.slotStart !== "string" ||
          typeof row.durationMinutes !== "number" ||
          !(row.meetUrl === null || typeof row.meetUrl === "string") ||
          !(row.htmlLink === null || typeof row.htmlLink === "string")
        ) {
          continue;
        }
        meetings.push({
          bookingId: row.bookingId,
          eventName: row.eventName,
          slotStart: row.slotStart,
          durationMinutes: row.durationMinutes,
          meetUrl: row.meetUrl,
          htmlLink: row.htmlLink,
        });
      }
      return { type: "meetings_list", listId: data.listId, meetings };
    }
    if (data.type === "direct_message") {
      if (typeof data.formId !== "string") {
        return null;
      }
      return {
        type: "direct_message",
        formId: data.formId,
        name: typeof data.name === "string" ? data.name : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
        phoneNumber:
          typeof data.phoneNumber === "string" ? data.phoneNumber : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Subscribe to LiveKit `ui_events` (OTP, meetings list, direct message GenUI). */
export function useVoiceUiEvents(session: UseSessionReturn) {
  const setFromPayload = useBookingOtpStore((s) => s.setFromPayload);
  const setActiveList = useMeetingsListStore((s) => s.setActiveList);
  const setDirectMessage = useDirectMessageStore((s) => s.setFromPayload);

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
      if (event.type === "direct_message") {
        setDirectMessage({
          formId: event.formId,
          name: event.name,
          email: event.email,
          phoneNumber: event.phoneNumber,
        });
        return;
      }
      setActiveList(event.listId, event.meetings);
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [session.room, setFromPayload, setActiveList, setDirectMessage]);
}

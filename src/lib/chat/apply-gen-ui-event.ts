"use client";

import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import {
  useMeetingsListStore,
  type MeetingsListMeeting,
} from "@/lib/stores/meetings-list-store";

export type GenUiWidgetEvent =
  | {
      type: "booking_otp";
      bookingId: string;
      emailMasked: string;
      expiresAt: string;
      attemptsLeft?: number;
    }
  | {
      type: "meetings_list";
      listId: string;
      meetings: MeetingsListMeeting[];
    }
  | {
      type: "direct_message";
      formId: string;
      name?: string;
      email?: string;
      phoneNumber?: string;
    };

function isMeetingItem(value: unknown): value is MeetingsListMeeting {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const linkOk = (value: unknown) => value === null || typeof value === "string";
  return (
    typeof record.bookingId === "string" &&
    typeof record.eventName === "string" &&
    typeof record.slotStart === "string" &&
    typeof record.durationMinutes === "number" &&
    linkOk(record.meetUrl) &&
    linkOk(record.htmlLink)
  );
}

function parseMeetings(value: unknown): MeetingsListMeeting[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const meetings: MeetingsListMeeting[] = [];
  for (const item of value) {
    if (!isMeetingItem(item)) {
      continue;
    }
    meetings.push({
      bookingId: item.bookingId,
      eventName: item.eventName,
      slotStart: item.slotStart,
      durationMinutes: item.durationMinutes,
      meetUrl: item.meetUrl,
      htmlLink: item.htmlLink,
    });
  }
  return meetings;
}

/** Apply a GenUI widget event from text `onData` or LiveKit `ui_events`. */
export function applyGenUiEvent(event: GenUiWidgetEvent): void {
  if (event.type === "booking_otp") {
    useBookingOtpStore.getState().setFromPayload({
      bookingId: event.bookingId,
      emailMasked: event.emailMasked,
      expiresAt: event.expiresAt,
      attemptsLeft: event.attemptsLeft ?? 5,
    });
    return;
  }
  if (event.type === "meetings_list") {
    useMeetingsListStore.getState().setActiveList(event.listId, event.meetings);
    return;
  }
  useDirectMessageStore.getState().setFromPayload({
    formId: event.formId,
    name: event.name,
    email: event.email,
    phoneNumber: event.phoneNumber,
  });
}

function parseGenUiFromDataPart(part: {
  type: string;
  data?: unknown;
}): GenUiWidgetEvent | null {
  const data = part.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;

  if (part.type === "data-otp") {
    if (
      typeof record.bookingId !== "string" ||
      typeof record.emailMasked !== "string" ||
      typeof record.expiresAt !== "string"
    ) {
      return null;
    }
    return {
      type: "booking_otp",
      bookingId: record.bookingId,
      emailMasked: record.emailMasked,
      expiresAt: record.expiresAt,
      attemptsLeft:
        typeof record.attemptsLeft === "number" ? record.attemptsLeft : undefined,
    };
  }

  if (part.type === "data-meetings-list") {
    if (typeof record.listId !== "string") {
      return null;
    }
    const meetings = parseMeetings(record.meetings);
    if (!meetings) {
      return null;
    }
    return { type: "meetings_list", listId: record.listId, meetings };
  }

  if (part.type === "data-direct-message") {
    if (typeof record.formId !== "string") {
      return null;
    }
    return {
      type: "direct_message",
      formId: record.formId,
      name: typeof record.name === "string" ? record.name : undefined,
      email: typeof record.email === "string" ? record.email : undefined,
      phoneNumber:
        typeof record.phoneNumber === "string" ? record.phoneNumber : undefined,
    };
  }

  return null;
}

/** Ingest an AI SDK UI data part (`data-otp` / `data-meetings-list` / `data-direct-message`). */
export function applyGenUiFromDataPart(part: {
  type: string;
  data?: unknown;
}): void {
  const event = parseGenUiFromDataPart(part);
  if (event) {
    applyGenUiEvent(event);
  }
}

import type { TFunction } from "i18next";

/** Kinds mirrored from `app/agent/system_notes.py`. */
export const SYSTEM_NOTE_KINDS = [
  "booking_confirmed",
  "booking_cancelled",
  "meeting_cancelled",
  "cancellation_aborted",
  "private_message_sent",
  "private_message_cancelled",
] as const;

export type SystemNoteKind = (typeof SYSTEM_NOTE_KINDS)[number];

const KNOWN_KINDS = new Set<string>(SYSTEM_NOTE_KINDS);

function isSystemNoteKind(kind: string): kind is SystemNoteKind {
  return KNOWN_KINDS.has(kind);
}

type FormatSystemNoteInput = {
  kind?: string;
  params?: Record<string, string>;
  /** English label fallback from API / history `content`. */
  fallback: string;
};

export function formatSystemNoteText(
  t: TFunction,
  { kind, params, fallback }: FormatSystemNoteInput,
): string {
  if (!kind || !isSystemNoteKind(kind)) {
    return fallback;
  }
  const p = params ?? {};
  switch (kind) {
    case "booking_confirmed":
      return t("systemNotes.booking.confirmed", { name: p.name ?? "" });
    case "booking_cancelled":
      return t("systemNotes.booking.cancelled", { name: p.name ?? "" });
    case "meeting_cancelled":
      return t("systemNotes.meeting.cancelled", { name: p.name ?? "" });
    case "cancellation_aborted":
      return t("systemNotes.cancellation.aborted", { name: p.name ?? "" });
    case "private_message_sent":
      return t("systemNotes.private.message_sent", {
        name: p.name ?? "",
        email: p.email ?? "",
        message: p.message ?? "",
      });
    case "private_message_cancelled":
      return t("systemNotes.private.message_cancelled");
  }
}

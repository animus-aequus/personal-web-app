/**
 * Client-side .ics builder for the booking success dialog.
 * UID must match Google's iCalUID so imports do not duplicate the invite.
 */

export type BookingIcsInput = {
  icalUid: string;
  eventName: string;
  slotStartIso: string;
  durationMinutes: number;
  meetUrl?: string | null;
  htmlLink?: string | null;
  organizerEmail?: string | null;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Format a Date as UTC iCalendar datetime: YYYYMMDDTHHMMSSZ */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string): string {
  const max = 75;
  if (line.length <= max) {
    return line;
  }
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, max));
  remaining = remaining.slice(max);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, max - 1)}`);
    remaining = remaining.slice(max - 1);
  }
  return parts.join("\r\n");
}

export function buildBookingIcs(input: BookingIcsInput): string {
  const start = new Date(input.slotStartIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid slotStartIso");
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const descriptionParts = ["Confirmed meeting via personal assistant."];
  if (input.meetUrl) {
    descriptionParts.push(`Join Google Meet: ${input.meetUrl}`);
  }
  if (input.htmlLink) {
    descriptionParts.push(`Event: ${input.htmlLink}`);
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Assistant//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.icalUid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(input.eventName)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
  ];

  if (input.meetUrl) {
    lines.push(`URL:${input.meetUrl}`);
  } else if (input.htmlLink) {
    lines.push(`URL:${input.htmlLink}`);
  }

  if (input.organizerEmail) {
    lines.push(`ORGANIZER:mailto:${input.organizerEmail}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function downloadBookingIcs(input: BookingIcsInput, filename?: string): void {
  const body = buildBookingIcs(input);
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName =
    filename ??
    `${input.eventName.replace(/[^\w\-]+/g, "_").slice(0, 40) || "meeting"}.ics`;
  anchor.href = url;
  anchor.download = safeName.endsWith(".ics") ? safeName : `${safeName}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

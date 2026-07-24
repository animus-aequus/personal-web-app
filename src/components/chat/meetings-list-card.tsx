"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showBookingOtpErrorToast } from "@/lib/chat/booking-otp-toast";
import { cn } from "@/lib/utils";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";

export type MeetingListItem = {
  bookingId: string;
  eventName: string;
  slotStart: string;
  durationMinutes: number;
};

type MeetingsListCardProps = {
  listId: string;
  meetings: MeetingListItem[];
  sessionId: string;
  className?: string;
};

function formatDateParts(iso: string): { date: string; time: string } {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return { date: "—", time: "—" };
  }
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

export function MeetingsListCard({
  listId,
  meetings,
  sessionId,
  className,
}: MeetingsListCardProps) {
  const activeListId = useMeetingsListStore((s) => s.activeListId);
  const interactive = activeListId === listId;
  const upsertCancel = useBookingCancelOtpStore((s) => s.upsert);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCancel = async (meeting: MeetingListItem) => {
    if (!interactive || busyId) {
      return;
    }
    setBusyId(meeting.bookingId);
    try {
      const response = await fetch("/api/bookings/cancel-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, bookingId: meeting.bookingId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        showBookingOtpErrorToast(
          payload.error?.includes("not_confirmed")
            ? "That meeting can no longer be cancelled."
            : "Could not start cancellation.",
        );
        return;
      }
      const data = (await response.json()) as {
        cancellation_id: string;
        booking_id: string;
        email_masked: string;
        expires_at: string;
        attempts_left: number;
        event_name: string;
        slot_start: string;
      };
      upsertCancel({
        cancellationId: data.cancellation_id,
        bookingId: data.booking_id,
        emailMasked: data.email_masked,
        expiresAt: data.expires_at,
        attemptsLeft: data.attempts_left,
        eventName: data.event_name,
        slotStart: data.slot_start,
      });
    } catch {
      showBookingOtpErrorToast("Could not start cancellation.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className={cn(
        "mt-3 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      role="list"
      aria-label="Your upcoming meetings"
    >
      {meetings.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No upcoming meetings in this session.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {meetings.map((meeting) => {
            const { date, time } = formatDateParts(meeting.slotStart);
            const cancelButton = interactive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === meeting.bookingId}
                onClick={() => void handleCancel(meeting)}
              >
                Cancel
              </Button>
            ) : null;

            return (
              <div
                key={meeting.bookingId}
                role="listitem"
                className="px-4 py-4"
              >
                {/* Mobile: two stacked rows — the 4-column grid below doesn't
                    leave enough room for the title on narrow viewports. */}
                <div className="flex flex-col gap-2 md:hidden">
                  <div className="flex items-baseline justify-between gap-2 tabular-nums">
                    <span className="text-sm font-medium text-foreground">
                      {date}
                    </span>
                    <span className="text-xs text-muted-foreground">{time}</span>
                    <span className="text-xs text-muted-foreground">
                      {meeting.durationMinutes} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate text-sm text-foreground"
                      title={meeting.eventName}
                    >
                      {meeting.eventName}
                    </p>
                    {cancelButton}
                  </div>
                </div>

                {/* Desktop/tablet: single-row grid, equal column widths. */}
                <div className="hidden md:grid md:grid-cols-[5.5rem_minmax(0,1fr)_4rem_auto] md:items-center md:gap-3">
                  <div className="min-w-0 tabular-nums">
                    <p className="text-sm font-medium leading-tight text-foreground">
                      {date}
                    </p>
                    <p className="text-xs text-muted-foreground">{time}</p>
                  </div>
                  <p className="truncate text-sm text-foreground" title={meeting.eventName}>
                    {meeting.eventName}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {meeting.durationMinutes} min
                  </p>
                  {cancelButton ?? <span className="w-[4.5rem]" aria-hidden />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

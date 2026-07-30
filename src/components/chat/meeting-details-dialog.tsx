"use client";

import { Check, Copy, ExternalLink, Loader2, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showBookingOtpErrorToast } from "@/lib/chat/booking-otp-toast";
import { cn } from "@/lib/utils";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import type { MeetingsListMeeting } from "@/lib/stores/meetings-list-store";

type MeetingDetailsDialogProps = {
  meeting: MeetingsListMeeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Only the active (newest) meetings list may start cancellation. */
  canCancel: boolean;
};

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
};

function computeCountdown(slotStartIso: string, nowMs: number): CountdownParts | null {
  const targetMs = Date.parse(slotStartIso);
  if (Number.isNaN(targetMs)) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalSeconds };
}

function formatSlotLabel(slotStart: string, durationMinutes: number): string {
  const start = new Date(slotStart);
  if (Number.isNaN(start.getTime())) {
    return slotStart;
  }
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(start);
  if (durationMinutes > 0) {
    return `${dateLabel} · ${durationMinutes} min`;
  }
  return dateLabel;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[3.25rem] flex-1 flex-col items-center rounded-lg border border-border bg-muted/40 px-2 py-2">
      <span className="text-lg font-semibold tabular-nums leading-none text-foreground">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function MeetingCountdown({ slotStart }: { slotStart: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = useMemo(
    () => computeCountdown(slotStart, nowMs),
    [slotStart, nowMs],
  );

  if (!parts) {
    return null;
  }

  if (parts.totalSeconds === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
        This meeting has started.
      </p>
    );
  }

  const showDays = parts.days >= 1;

  return (
    <div
      className="flex gap-2"
      role="timer"
      aria-live="polite"
      aria-label={
        showDays
          ? `${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds remaining`
          : `${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds remaining`
      }
    >
      {showDays ? <CountdownUnit value={parts.days} label="Days" /> : null}
      <CountdownUnit value={parts.hours} label="Hours" />
      <CountdownUnit value={parts.minutes} label="Min" />
      <CountdownUnit value={parts.seconds} label="Sec" />
    </div>
  );
}

export function MeetingDetailsDialog({
  meeting,
  open,
  onOpenChange,
  sessionId,
  canCancel,
}: MeetingDetailsDialogProps) {
  const upsertCancel = useBookingCancelOtpStore((s) => s.upsert);
  const [copied, setCopied] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const meetUrl = meeting?.meetUrl?.trim() || null;
  const slotLabel = meeting
    ? formatSlotLabel(meeting.slotStart, meeting.durationMinutes)
    : "";

  const handleCopyMeet = async () => {
    if (!meetUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(meetUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCancel = async () => {
    if (!meeting || !canCancel || cancelBusy) {
      return;
    }
    setCancelBusy(true);
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
          payload.error?.includes("email_suppressed")
            ? "This email cannot receive codes. Use a different address or contact the host."
            : payload.error?.includes("not_confirmed")
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
      onOpenChange(false);
    } catch {
      showBookingOtpErrorToast("Could not start cancellation.");
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <Dialog open={open && meeting !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        {meeting ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-balance break-words">
                {meeting.eventName}
              </DialogTitle>
              <DialogDescription className="tabular-nums">
                {slotLabel}
              </DialogDescription>
            </DialogHeader>

            <MeetingCountdown slotStart={meeting.slotStart} />

            <div className="flex flex-col gap-2">
              {meetUrl ? (
                <div className="flex gap-2">
                  <a
                    href={meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "flex-1",
                    )}
                  >
                    <Video className="size-4" aria-hidden />
                    Join with Google Meet
                    <ExternalLink
                      className="size-3.5 opacity-70"
                      aria-hidden
                    />
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={copied ? "Copied" : "Copy Meet link"}
                    onClick={() => void handleCopyMeet()}
                  >
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No Google Meet link is available for this meeting.
                </p>
              )}
            </div>

            <DialogFooter
              className={cn(
                canCancel ? "sm:justify-between" : "sm:justify-end",
              )}
            >
              {canCancel ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cancelBusy}
                  aria-busy={cancelBusy}
                  onClick={() => void handleCancel()}
                >
                  {cancelBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Cancel meeting"
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                disabled={cancelBusy}
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

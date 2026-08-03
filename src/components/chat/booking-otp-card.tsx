"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  showBookingOtpErrorToast,
  showBookingOtpSuccessToast,
} from "@/lib/chat/booking-otp-toast";
import { cn } from "@/lib/utils";
import { appendSystemNote, type OnSystemNote } from "@/lib/chat/append-system-note";
import type { SystemNoteInfo } from "@/lib/agent-client";
import {
  useBookingOtpStore,
  type BookingOtpState,
} from "@/lib/stores/booking-otp-store";

type BookingOtpCardProps = {
  sessionId: string;
  /** Kept for callers; terminal states use Sonner, so overlay/inline share pending-only UI. */
  variant?: "inline" | "overlay";
  className?: string;
  onNote?: OnSystemNote;
};

function remainingSeconds(expiresAt: string, nowMs: number): number {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((expiresMs - nowMs) / 1000));
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function postConfirm(
  sessionId: string,
  bookingId: string,
  code: string,
): Promise<Response> {
  return fetch("/api/bookings/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, bookingId, code }),
  });
}

async function postCancel(sessionId: string, bookingId: string): Promise<Response> {
  return fetch("/api/bookings/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, bookingId }),
  });
}

type PendingAction = "confirm" | "cancel" | null;

function finishWithSuccess(message?: string): void {
  showBookingOtpSuccessToast(message);
  useBookingOtpStore.getState().dismiss();
}

function finishWithError(message: string): void {
  showBookingOtpErrorToast(message);
  useBookingOtpStore.getState().dismiss();
}

function BookingOtpCardInner({
  sessionId,
  active,
  className,
  onNote,
}: {
  sessionId: string;
  active: BookingOtpState;
  className?: string;
  onNote?: OnSystemNote;
}) {
  const { t } = useTranslation();
  const setStatus = useBookingOtpStore((s) => s.setStatus);
  const setSuccess = useBookingOtpStore((s) => s.setSuccess);
  const [code, setCode] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsLeft = useMemo(
    () => remainingSeconds(active.expiresAt, nowMs),
    [active.expiresAt, nowMs],
  );

  useEffect(() => {
    if (secondsLeft > 0 || expiredHandledRef.current) {
      return;
    }
    expiredHandledRef.current = true;
    finishWithError(t("booking.codeExpired"));
  }, [secondsLeft, t]);

  const handleConfirm = async () => {
    if (code.length < 6 || pendingAction) {
      return;
    }
    setPendingAction("confirm");
    try {
      const response = await postConfirm(sessionId, active.bookingId, code);
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          note?: SystemNoteInfo | null;
          meet_url?: string | null;
          html_link?: string | null;
          ical_uid?: string | null;
          event_name?: string | null;
          slot_start?: string | null;
          duration_minutes?: number | null;
        };
        appendSystemNote(onNote, data.note);
        setSuccess({
          eventName: data.event_name ?? active.eventName,
          slotStart: data.slot_start ?? active.slotStart,
          durationMinutes: data.duration_minutes ?? undefined,
          meetUrl: data.meet_url,
          htmlLink: data.html_link,
          icalUid: data.ical_uid,
        });
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const detail = payload.error ?? "";
      if (detail.includes("otp_expired")) {
        finishWithError(t("booking.codeExpired"));
      } else if (detail.includes("too_many_attempts")) {
        finishWithError(t("booking.tooManyAttempts"));
      } else if (detail.includes("slot_taken")) {
        finishWithError(t("booking.slotUnavailable"));
      } else if (detail.includes("otp_invalid")) {
        showBookingOtpErrorToast(t("booking.incorrectCode"));
        setStatus("pending", undefined, Math.max(0, active.attemptsLeft - 1));
        setCode("");
      } else {
        finishWithError(t("booking.confirmFailed"));
      }
    } catch {
      finishWithError(t("booking.confirmFailed"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleCancel = async () => {
    if (pendingAction) {
      return;
    }
    setPendingAction("cancel");
    try {
      const response = await postCancel(sessionId, active.bookingId);
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          note?: SystemNoteInfo | null;
        };
        appendSystemNote(onNote, data.note);
        finishWithSuccess(t("booking.cancelled"));
        return;
      }
      finishWithError(t("booking.cancelFailed"));
    } catch {
      finishWithError(t("booking.cancelFailed"));
    } finally {
      setPendingAction(null);
    }
  };

  const isBusy = pendingAction !== null;

  return (
    <div
      className={cn(
        "w-[min(100%,24rem)] rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
      role="group"
      aria-label={t("booking.otpAria")}
    >
      <p className="text-sm font-medium text-foreground">{t("booking.otpTitle")}</p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {t("booking.otpSent", {
          email: active.emailMasked,
          timer: formatTimer(secondsLeft),
        })}
      </p>
      <div className="mt-4 flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          disabled={isBusy}
          containerClassName="gap-2"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={code.length < 6 || isBusy}
          aria-busy={pendingAction === "confirm"}
          onClick={() => void handleConfirm()}
        >
          {pendingAction === "confirm" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            t("common.confirm")
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isBusy}
          aria-busy={pendingAction === "cancel"}
          onClick={() => void handleCancel()}
        >
          {pendingAction === "cancel" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            t("common.cancel")
          )}
        </Button>
      </div>
    </div>
  );
}

export function BookingOtpCard({
  sessionId,
  className,
  onNote,
}: BookingOtpCardProps) {
  const active = useBookingOtpStore((s) => s.active);
  // Terminal outcomes are reported via Sonner toast; keep the card only while pending.
  if (!active || active.status !== "pending") {
    return null;
  }
  return (
    <BookingOtpCardInner
      sessionId={sessionId}
      active={active}
      className={className}
      onNote={onNote}
    />
  );
}

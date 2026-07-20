"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
import {
  useBookingOtpStore,
  type BookingOtpState,
} from "@/lib/stores/booking-otp-store";

type BookingOtpCardProps = {
  sessionId: string;
  /** Kept for callers; terminal states use Sonner, so overlay/inline share pending-only UI. */
  variant?: "inline" | "overlay";
  className?: string;
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

function finishWithSuccess(message?: string): void {
  showBookingOtpSuccessToast(message);
  useBookingOtpStore.getState().clear();
}

function finishWithError(message: string): void {
  showBookingOtpErrorToast(message);
  useBookingOtpStore.getState().clear();
}

function BookingOtpCardInner({
  sessionId,
  active,
  className,
}: {
  sessionId: string;
  active: BookingOtpState;
  className?: string;
}) {
  const setStatus = useBookingOtpStore((s) => s.setStatus);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    finishWithError("Confirmation code expired.");
  }, [secondsLeft]);

  const handleConfirm = async () => {
    if (code.length < 6 || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const response = await postConfirm(sessionId, active.bookingId, code);
      if (response.ok) {
        finishWithSuccess();
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const detail = payload.error ?? "";
      if (detail.includes("otp_expired")) {
        finishWithError("Confirmation code expired.");
      } else if (detail.includes("too_many_attempts")) {
        finishWithError("Too many incorrect attempts.");
      } else if (detail.includes("slot_taken")) {
        finishWithError("That time slot is no longer available.");
      } else if (detail.includes("otp_invalid")) {
        setStatus(
          "pending",
          "Incorrect code. Try again.",
          Math.max(0, active.attemptsLeft - 1),
        );
        setCode("");
      } else {
        finishWithError("Could not confirm the booking.");
      }
    } catch {
      finishWithError("Could not confirm the booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const response = await postCancel(sessionId, active.bookingId);
      if (response.ok || response.status === 204) {
        finishWithError("Booking cancelled.");
        return;
      }
      finishWithError("Could not cancel the booking.");
    } catch {
      finishWithError("Could not cancel the booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur",
        className,
      )}
      role="group"
      aria-label="Booking confirmation code"
    >
      <p className="text-sm font-medium text-foreground">Enter confirmation code</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {`Code sent to ${active.emailMasked}. Expires in ${formatTimer(secondsLeft)}.`}
      </p>
      <div className="mt-4 flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          disabled={submitting}
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
          disabled={code.length < 6 || submitting}
          onClick={() => void handleConfirm()}
        >
          Confirm
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={submitting}
          onClick={() => void handleCancel()}
        >
          Cancel
        </Button>
      </div>
      {active.errorMessage ? (
        <p className="mt-2 text-xs text-destructive">{active.errorMessage}</p>
      ) : null}
    </div>
  );
}

export function BookingOtpCard({
  sessionId,
  className,
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
    />
  );
}

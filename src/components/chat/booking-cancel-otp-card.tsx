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
  useBookingCancelOtpStore,
  type CancelOtpCard,
} from "@/lib/stores/booking-cancel-otp-store";

type BookingCancelOtpCardProps = {
  sessionId: string;
  card: CancelOtpCard;
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

function formatSlot(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return "";
  }
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PendingAction = "confirm" | "abort" | null;

function BookingCancelOtpCardInner({
  sessionId,
  card,
  className,
  onNote,
}: BookingCancelOtpCardProps) {
  const { t } = useTranslation();
  const dismiss = useBookingCancelOtpStore((s) => s.dismiss);
  const updateAttempts = useBookingCancelOtpStore((s) => s.updateAttempts);
  const [code, setCode] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsLeft = useMemo(
    () => remainingSeconds(card.expiresAt, nowMs),
    [card.expiresAt, nowMs],
  );

  useEffect(() => {
    if (secondsLeft > 0 || expiredHandledRef.current) {
      return;
    }
    expiredHandledRef.current = true;
    showBookingOtpErrorToast(t("cancellation.codeExpired"));
    dismiss(card.cancellationId);
  }, [secondsLeft, card.cancellationId, dismiss, t]);

  const finishSuccess = (message?: string) => {
    showBookingOtpSuccessToast(message ?? t("cancellation.cancelled"));
    dismiss(card.cancellationId);
  };

  const finishError = (message: string) => {
    showBookingOtpErrorToast(message);
    dismiss(card.cancellationId);
  };

  const handleConfirm = async () => {
    if (code.length < 6 || pendingAction) {
      return;
    }
    setPendingAction("confirm");
    try {
      const response = await fetch("/api/cancellations/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          cancellationId: card.cancellationId,
          code,
        }),
      });
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          note?: SystemNoteInfo | null;
        };
        appendSystemNote(onNote, data.note);
        finishSuccess();
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const detail = payload.error ?? "";
      if (detail.includes("otp_expired")) {
        finishError(t("cancellation.codeExpired"));
      } else if (detail.includes("too_many_attempts")) {
        finishError(t("cancellation.tooManyAttempts"));
      } else if (detail.includes("otp_invalid")) {
        showBookingOtpErrorToast(t("cancellation.incorrectCode"));
        updateAttempts(card.cancellationId, Math.max(0, card.attemptsLeft - 1));
        setCode("");
      } else {
        finishError(t("cancellation.cancelFailed"));
      }
    } catch {
      finishError(t("cancellation.cancelFailed"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleAbort = async () => {
    if (pendingAction) {
      return;
    }
    setPendingAction("abort");
    try {
      const response = await fetch("/api/cancellations/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          cancellationId: card.cancellationId,
        }),
      });
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          note?: SystemNoteInfo | null;
        };
        appendSystemNote(onNote, data.note);
        finishSuccess(t("cancellation.aborted"));
        return;
      }
      finishError(t("cancellation.abortFailed"));
    } catch {
      finishError(t("cancellation.abortFailed"));
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
      aria-label={`${t("cancellation.title")} ${card.eventName}`}
    >
      <p className="text-sm font-medium text-foreground">{t("cancellation.title")}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={card.eventName}>
        {card.eventName}
        {card.slotStart ? ` · ${formatSlot(card.slotStart)}` : ""}
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {t("cancellation.otpSent", {
          email: card.emailMasked,
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
            t("cancellation.confirmCancel")
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isBusy}
          aria-busy={pendingAction === "abort"}
          onClick={() => void handleAbort()}
        >
          {pendingAction === "abort" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            t("cancellation.keepMeeting")
          )}
        </Button>
      </div>
    </div>
  );
}

export function BookingCancelOtpStack({
  sessionId,
  className,
  onNote,
}: {
  sessionId: string;
  className?: string;
  onNote?: OnSystemNote;
}) {
  const items = useBookingCancelOtpStore((s) => s.items);
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((card) => (
        <BookingCancelOtpCardInner
          key={card.cancellationId}
          sessionId={sessionId}
          card={card}
          onNote={onNote}
        />
      ))}
    </div>
  );
}

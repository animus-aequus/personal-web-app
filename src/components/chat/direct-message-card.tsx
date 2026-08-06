"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  showBookingOtpErrorToast,
  showBookingOtpSuccessToast,
} from "@/lib/chat/booking-otp-toast";
import {
  DIRECT_MESSAGE_MESSAGE_MAX,
  DIRECT_MESSAGE_NAME_MAX,
  normalizeDirectMessagePayload,
  validateDirectMessageForm,
  type DirectMessageFieldErrors,
} from "@/lib/chat/direct-message-validation";
import { cn } from "@/lib/utils";
import { appendSystemNote, type OnSystemNote } from "@/lib/chat/append-system-note";
import type { SystemNoteInfo } from "@/lib/agent-client";
import { handleRateLimitResponse } from "@/lib/rate-limit-client";
import {
  useDirectMessageStore,
  type DirectMessageState,
} from "@/lib/stores/direct-message-store";

const inputClassName =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

type DirectMessageCardProps = {
  sessionId: string;
  className?: string;
  onNote?: OnSystemNote;
};

type PendingAction = "send" | "cancel" | null;

async function postSend(
  sessionId: string,
  formId: string,
  payload: {
    name: string;
    email: string;
    message: string;
    phoneNumber?: string;
  },
): Promise<Response> {
  return fetch("/api/direct-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      formId,
      name: payload.name,
      email: payload.email,
      message: payload.message,
      phoneNumber: payload.phoneNumber,
    }),
  });
}

async function postCancel(sessionId: string, formId: string): Promise<Response> {
  return fetch("/api/direct-messages/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, formId }),
  });
}

function DirectMessageCardInner({
  sessionId,
  active,
  className,
  onNote,
}: {
  sessionId: string;
  active: DirectMessageState;
  className?: string;
  onNote?: OnSystemNote;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(active.name ?? "");
  const [email, setEmail] = useState(active.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(active.phoneNumber ?? "");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<DirectMessageFieldErrors>({});
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isBusy = pendingAction !== null;

  const handleSend = async () => {
    if (pendingAction) {
      return;
    }
    const values = { name, email, phoneNumber, message };
    const nextErrors = validateDirectMessageForm(values, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPendingAction("send");
    try {
      const payload = normalizeDirectMessagePayload(values);
      const response = await postSend(sessionId, active.formId, payload);
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          note?: SystemNoteInfo | null;
        };
        appendSystemNote(onNote, data.note);
        showBookingOtpSuccessToast(t("directMessage.sent"));
        useDirectMessageStore.getState().dismiss();
        return;
      }
      if (response.status === 429) {
        await handleRateLimitResponse(response, "direct_message");
        return;
      } else {
        showBookingOtpErrorToast(t("directMessage.sendFailed"));
      }
    } catch {
      showBookingOtpErrorToast(t("directMessage.sendFailed"));
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
      const response = await postCancel(sessionId, active.formId);
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          note?: SystemNoteInfo | null;
        };
        appendSystemNote(onNote, data.note);
        showBookingOtpSuccessToast(t("directMessage.cancelled"));
        useDirectMessageStore.getState().dismiss();
        return;
      }
      showBookingOtpErrorToast(t("directMessage.cancelFailed"));
    } catch {
      showBookingOtpErrorToast(t("directMessage.cancelFailed"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div
      className={cn(
        "w-[min(100%,24rem)] rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
      role="form"
      aria-label={t("directMessage.formAria")}
    >
      <p className="text-sm font-medium text-foreground">{t("directMessage.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("directMessage.description")}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{t("directMessage.name")}</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            maxLength={DIRECT_MESSAGE_NAME_MAX}
            value={name}
            disabled={isBusy}
            aria-invalid={Boolean(errors.name)}
            className={inputClassName}
            onChange={(event) => setName(event.target.value)}
          />
          {errors.name ? (
            <span className="text-xs text-destructive">{errors.name}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{t("directMessage.email")}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            disabled={isBusy}
            aria-invalid={Boolean(errors.email)}
            className={inputClassName}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email ? (
            <span className="text-xs text-destructive">{errors.email}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">
            {t("directMessage.phoneOptional")}
          </span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            value={phoneNumber}
            disabled={isBusy}
            aria-invalid={Boolean(errors.phoneNumber)}
            className={inputClassName}
            onChange={(event) => setPhoneNumber(event.target.value)}
          />
          {errors.phoneNumber ? (
            <span className="text-xs text-destructive">{errors.phoneNumber}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{t("directMessage.message")}</span>
          <Textarea
            name="message"
            rows={4}
            maxLength={DIRECT_MESSAGE_MESSAGE_MAX}
            value={message}
            disabled={isBusy}
            aria-invalid={Boolean(errors.message)}
            placeholder={t("directMessage.placeholder")}
            onChange={(event) => setMessage(event.target.value)}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {message.length}/{DIRECT_MESSAGE_MESSAGE_MAX}
          </span>
          {errors.message ? (
            <span className="text-xs text-destructive">{errors.message}</span>
          ) : null}
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={isBusy}
          aria-busy={pendingAction === "send"}
          onClick={() => void handleSend()}
        >
          {pendingAction === "send" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            t("common.send")
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

export function DirectMessageCard({
  sessionId,
  className,
  onNote,
}: DirectMessageCardProps) {
  const active = useDirectMessageStore((s) => s.active);
  if (!active) {
    return null;
  }
  return (
    <DirectMessageCardInner
      key={active.formId}
      sessionId={sessionId}
      active={active}
      className={className}
      onNote={onNote}
    />
  );
}

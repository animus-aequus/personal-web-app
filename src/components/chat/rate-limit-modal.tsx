"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { RateLimitAction } from "@/lib/rate-limit";
import { formatRetryDuration } from "@/lib/rate-limit-format";
import { useRateLimitStore } from "@/lib/stores/rate-limit-store";

type RateLimitModalProps = {
  action: RateLimitAction;
  retryAt: string;
  onAcknowledge: () => void;
};

function getBodyText(
  action: RateLimitAction,
  remaining: string | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!remaining) {
    return t("rateLimit.tryAgainNow");
  }
  switch (action) {
    case "voice":
      return t("rateLimit.bodyVoice", { time: remaining });
    case "direct_message":
      return t("rateLimit.bodyDirectMessage", { time: remaining });
    case "edge":
      return t("rateLimit.bodyEdge", { time: remaining });
    default:
      return t("rateLimit.bodyChat", { time: remaining });
  }
}

function RateLimitModalContent({
  action,
  retryAt,
  onAcknowledge,
}: RateLimitModalProps) {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onAcknowledge();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAcknowledge]);

  const remaining = formatRetryDuration(retryAt, {
    days: t("common.days"),
    hours: t("common.hours"),
    minutes: t("common.minutes"),
    seconds: t("common.seconds"),
  }, nowMs);

  const body = getBodyText(action, remaining, t);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-limit-title"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          <Clock className="size-5 text-muted-foreground" />
        </span>
        <h2
          id="rate-limit-title"
          className="text-base font-medium text-foreground"
        >
          {t("rateLimit.title")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        <Button
          autoFocus
          type="button"
          className="mt-1 min-w-28"
          onClick={onAcknowledge}
        >
          {t("rateLimit.understand")}
        </Button>
      </div>
    </div>
  );
}

export function RateLimitModal() {
  const open = useRateLimitStore((s) => s.open);
  const action = useRateLimitStore((s) => s.action);
  const retryAt = useRateLimitStore((s) => s.retryAt);
  const dismiss = useRateLimitStore((s) => s.dismiss);

  if (!open || !action || !retryAt) {
    return null;
  }

  return (
    <RateLimitModalContent
      action={action}
      retryAt={retryAt}
      onAcknowledge={dismiss}
    />
  );
}

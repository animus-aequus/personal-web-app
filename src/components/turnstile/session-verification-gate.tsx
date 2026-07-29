"use client";

import { Loader2 } from "lucide-react";

import { TurnstileChallenge } from "@/components/turnstile/turnstile-provider";

type SessionVerificationGateProps = {
  isReverification: boolean;
};

export function SessionVerificationGate({
  isReverification,
}: SessionVerificationGateProps) {
  const message = isReverification
    ? "Session expired. We need to verify you are human to continue."
    : "We need to verify you are human to continue.";

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div
        className="flex w-full flex-wrap items-center justify-center gap-2"
        role="status"
        aria-live="polite"
        aria-label={message}
      >
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
        <span className="w-max max-w-full text-center text-sm text-muted-foreground">
          {message}
        </span>
      </div>
      <div className="flex min-h-[65px] items-center justify-center">
        <TurnstileChallenge />
      </div>
    </div>
  );
}

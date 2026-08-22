"use client";

import { type ReactNode, useEffect } from "react";

import { AppHumanGate } from "@/components/turnstile/app-human-gate";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { AppShell } from "@/components/layout/app-shell";
import { TurnstileProvider } from "@/components/turnstile/turnstile-provider";
import { useChatStore } from "@/lib/stores/chat-store";
// Eager client import so device profiling runs with the app shell (module init).
import "@/lib/stores/device-profile-store";

type SiteShellProps = {
  children: ReactNode;
};

/**
 * Shared chrome for chat and sibling pages.
 * Turnstile unlocks the app; chat session lives only on `/chat`.
 */
export function SiteShell({ children }: SiteShellProps) {
  return (
    <TurnstileProvider>
      <I18nProvider>
        <SiteShellInner>{children}</SiteShellInner>
      </I18nProvider>
    </TurnstileProvider>
  );
}

function SiteShellInner({ children }: SiteShellProps) {
  useEffect(() => {
    void useChatStore.persist.rehydrate();
  }, []);

  return (
    <AppHumanGate>
      <AppShell>{children}</AppShell>
    </AppHumanGate>
  );
}

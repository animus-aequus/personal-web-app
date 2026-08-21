"use client";

import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useInviteWelcomeStore } from "@/lib/stores/invite-welcome-store";
import { AURA_PALETTE_CSS } from "@/lib/visualizer/aura-palette";

const auraBorderGradient = `conic-gradient(in oklch, ${AURA_PALETTE_CSS.join(", ")}, ${AURA_PALETTE_CSS[0]})`;

/**
 * Friendly overlay after a successful ``?invite=`` bootstrap.
 * Chat is already ready underneath; backdrop / OK / Escape / Enter dismisses.
 */
export function InviteWelcomeModal() {
  const { t } = useTranslation();
  const name = useInviteWelcomeStore((s) => s.name);
  const dismiss = useInviteWelcomeStore((s) => s.dismiss);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  if (!name) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-welcome-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-2xl p-[2px]">
          <div
            aria-hidden
            className="invite-welcome-border-spin pointer-events-none absolute inset-[-100%]"
            style={{ background: auraBorderGradient }}
          />
          <div className="relative flex flex-col items-center gap-4 rounded-[calc(var(--radius-2xl)-2px)] bg-card p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="size-5 text-primary" />
            </span>
            <h2
              id="invite-welcome-title"
              className="text-base font-medium break-words text-foreground"
            >
              {t("invite.welcomeTitle", { name })}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("invite.welcomeBody")}
            </p>
            <Button
              autoFocus
              type="button"
              className="mt-1 min-w-24 px-6"
              onClick={dismiss}
            >
              {t("invite.welcomeCta")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useInvalidInviteStore } from "@/lib/stores/invalid-invite-store";

type InvalidInviteModalProps = {
  onAcknowledge: () => void;
};

/**
 * Shown when ``?invite=`` fails validation (403). OK creates a public session
 * when none exists, or dismisses so the visitor can keep their prior session.
 */
export function InvalidInviteModal({ onAcknowledge }: InvalidInviteModalProps) {
  const { t } = useTranslation();
  const recovering = useInvalidInviteStore((s) => s.recovering);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (recovering) {
        return;
      }
      if (event.key === "Escape" || event.key === "Enter") {
        onAcknowledge();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAcknowledge, recovering]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invalid-invite-title"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-amber-500/40 bg-card p-6 text-center shadow-xl">
        <span className="flex size-11 items-center justify-center rounded-full bg-amber-500/15">
          <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
        </span>
        <h2
          id="invalid-invite-title"
          className="text-base font-medium text-foreground"
        >
          {t("invite.invalidTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("invite.invalidBody")}
        </p>
        <Button
          autoFocus
          type="button"
          className="mt-1 w-24"
          disabled={recovering}
          onClick={onAcknowledge}
        >
          {t("common.ok")}
        </Button>
      </div>
    </div>
  );
}

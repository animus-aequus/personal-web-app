"use client";

import { Clock } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { formatOperatingHoursSchedule } from "@/lib/operating-hours/format-schedule";
import type { OperatingHoursStatus } from "@/lib/operating-hours-config";
import { AURA_PALETTE_CSS } from "@/lib/visualizer/aura-palette";

const auraBorderGradient = `conic-gradient(in oklch, ${AURA_PALETTE_CSS.join(", ")}, ${AURA_PALETTE_CSS[0]})`;

type HoursClosedModalProps = {
  operatingHours: OperatingHoursStatus;
  onAcknowledge: () => void;
};

export function HoursClosedModal({
  operatingHours,
  onAcknowledge,
}: HoursClosedModalProps) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onAcknowledge();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAcknowledge]);

  const scheduleLines = useMemo(
    () => formatOperatingHoursSchedule(operatingHours.days, t),
    [operatingHours.days, t],
  );

  const nextOpenLabel = useMemo(() => {
    if (!operatingHours.nextOpenAt) {
      return null;
    }
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: operatingHours.timezone,
      }).format(new Date(operatingHours.nextOpenAt));
    } catch {
      return operatingHours.nextOpenAt;
    }
  }, [i18n.language, operatingHours.nextOpenAt, operatingHours.timezone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hours-closed-title"
    >
      <div className="relative w-full max-w-md rounded-2xl shadow-xl">
        <div className="relative overflow-hidden rounded-2xl p-[2px]">
          <div
            aria-hidden
            className="invite-welcome-border-spin pointer-events-none absolute inset-[-100%]"
            style={{ background: auraBorderGradient }}
          />
          <div className="relative flex flex-col items-center gap-4 rounded-[calc(var(--radius-2xl)-2px)] bg-card p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/15">
              <Clock className="size-5 text-primary" />
            </span>
            <h2
              id="hours-closed-title"
              className="text-base font-medium text-foreground"
            >
              {t("hoursClosed.title")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {nextOpenLabel
                ? t("hoursClosed.bodyWithNext", { nextOpen: nextOpenLabel })
                : t("hoursClosed.body")}
            </p>
            <div className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-left">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("hoursClosed.scheduleTitle")}
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {scheduleLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <Button
              autoFocus
              type="button"
              className="mt-1 min-w-24 px-6"
              onClick={onAcknowledge}
            >
              {t("common.ok")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

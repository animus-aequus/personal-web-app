import type { TFunction } from "i18next";

import type { OperatingHoursDays } from "@/lib/operating-hours-config";

const ISO_WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

type DayKey = (typeof ISO_WEEKDAY_KEYS)[number];

const DAY_I18N_KEYS: Record<DayKey, string> = {
  "0": "hoursClosed.weekdays.mon",
  "1": "hoursClosed.weekdays.tue",
  "2": "hoursClosed.weekdays.wed",
  "3": "hoursClosed.weekdays.thu",
  "4": "hoursClosed.weekdays.fri",
  "5": "hoursClosed.weekdays.sat",
  "6": "hoursClosed.weekdays.sun",
};

function dayLabel(t: TFunction, key: DayKey): string {
  return t(DAY_I18N_KEYS[key] as "hoursClosed.weekdays.mon");
}

function scheduleSignature(day: OperatingHoursDays[DayKey]): string {
  if (!day.length) {
    return "closed";
  }
  return day.map((window) => `${window.open}-${window.close}`).join("|");
}

function formatWindowLabel(
  t: TFunction,
  day: OperatingHoursDays[DayKey],
): string {
  if (!day.length) {
    return t("hoursClosed.closed");
  }
  return day
    .map((window) =>
      t("hoursClosed.window", { open: window.open, close: window.close }),
    )
    .join(", ");
}

/** Collapse consecutive ISO weekdays that share the same windows. */
export function formatOperatingHoursSchedule(
  days: OperatingHoursDays,
  t: TFunction,
): string[] {
  const lines: string[] = [];
  let runStart: DayKey | null = null;
  let runEnd: DayKey | null = null;
  let runSig: string | null = null;

  const flush = () => {
    if (runStart === null || runEnd === null || runSig === null) {
      return;
    }
    const windows = days[runStart] ?? [];
    const windowLabel = formatWindowLabel(t, windows);
    const startLabel = dayLabel(t, runStart);
    const endLabel = dayLabel(t, runEnd);
    const dayRange =
      runStart === runEnd ? startLabel : `${startLabel}–${endLabel}`;
    lines.push(`${dayRange}: ${windowLabel}`);
    runStart = null;
    runEnd = null;
    runSig = null;
  };

  for (const key of ISO_WEEKDAY_KEYS) {
    const sig = scheduleSignature(days[key] ?? []);
    if (runSig === null) {
      runStart = key;
      runEnd = key;
      runSig = sig;
      continue;
    }
    if (sig === runSig) {
      runEnd = key;
      continue;
    }
    flush();
    runStart = key;
    runEnd = key;
    runSig = sig;
  }
  flush();
  return lines;
}

import {
  DEFAULT_OPERATING_HOURS_CONFIG,
  type OperatingHoursConfig,
  type OperatingHoursDays,
  type OperatingHoursStatus,
  type OperatingHoursWindow,
} from "@/lib/operating-hours-config";

const ISO_WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

type ZonedParts = {
  isoWeekday: number;
  hour: number;
  minute: number;
  year: number;
  month: number;
  day: number;
};

function parseHm(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

function getZonedParts(date: Date, timeZone: string): ZonedParts | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const lookup = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    const weekdayMap: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };
    const isoWeekday = weekdayMap[lookup.weekday ?? ""];
    if (isoWeekday === undefined) {
      return null;
    }
    return {
      isoWeekday,
      hour: Number(lookup.hour),
      minute: Number(lookup.minute),
      year: Number(lookup.year),
      month: Number(lookup.month),
      day: Number(lookup.day),
    };
  } catch {
    return null;
  }
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function isOpenAtMinute(
  windows: OperatingHoursWindow[],
  minuteOfDay: number,
): boolean {
  for (const window of windows) {
    const open = parseHm(window.open);
    const close = parseHm(window.close);
    if (!open || !close) {
      continue;
    }
    const openMin = minutesSinceMidnight(open.hour, open.minute);
    const closeMin = minutesSinceMidnight(close.hour, close.minute);
    if (openMin < closeMin) {
      if (minuteOfDay >= openMin && minuteOfDay < closeMin) {
        return true;
      }
    } else if (openMin > closeMin) {
      if (minuteOfDay >= openMin || minuteOfDay < closeMin) {
        return true;
      }
    }
  }
  return false;
}

function zonedInstantIso(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string | null {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  for (let offsetHours = -14; offsetHours <= 14; offsetHours += 1) {
    const candidate = new Date(utcGuess + offsetHours * 60 * 60 * 1000);
    const parts = formatter.formatToParts(candidate);
    const lookup = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    if (
      Number(lookup.year) === year &&
      Number(lookup.month) === month &&
      Number(lookup.day) === day &&
      Number(lookup.hour) === hour &&
      Number(lookup.minute) === minute
    ) {
      return candidate.toISOString();
    }
  }
  return null;
}

function normalizeDays(raw: unknown): OperatingHoursDays {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const days: OperatingHoursDays = {};
  for (const key of ISO_WEEKDAY_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(value)) {
      days[key] = [];
      continue;
    }
    days[key] = value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const open = (item as { open?: unknown }).open;
        const close = (item as { close?: unknown }).close;
        if (typeof open !== "string" || typeof close !== "string") {
          return null;
        }
        return { open, close } satisfies OperatingHoursWindow;
      })
      .filter((item): item is OperatingHoursWindow => item !== null);
  }
  return days;
}

export function normalizeOperatingHoursConfig(
  raw: unknown,
): OperatingHoursConfig {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_OPERATING_HOURS_CONFIG;
  }
  const timezone =
    typeof (raw as { timezone?: unknown }).timezone === "string" &&
    (raw as { timezone: string }).timezone.trim()
      ? (raw as { timezone: string }).timezone.trim()
      : DEFAULT_OPERATING_HOURS_CONFIG.timezone;
  return {
    timezone,
    days: normalizeDays((raw as { days?: unknown }).days),
  };
}

function findNextOpenAt(
  config: OperatingHoursConfig,
  from: Date,
): string | null {
  const { timezone, days } = config;
  const start = getZonedParts(from, timezone);
  if (!start) {
    return null;
  }

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const probe = new Date(from.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const zoned = getZonedParts(probe, timezone);
    if (!zoned) {
      continue;
    }
    const weekdayKey = String(zoned.isoWeekday);
    const windows = days[weekdayKey] ?? [];
    for (const window of windows) {
      const open = parseHm(window.open);
      if (!open) {
        continue;
      }
      const openMinute = minutesSinceMidnight(open.hour, open.minute);
      const currentMinute = minutesSinceMidnight(zoned.hour, zoned.minute);
      if (dayOffset === 0 && currentMinute >= openMinute) {
        const close = parseHm(window.close);
        if (close) {
          const closeMinute = minutesSinceMidnight(close.hour, close.minute);
          if (currentMinute < closeMinute) {
            return null;
          }
        }
        continue;
      }
      const iso = zonedInstantIso(
        timezone,
        zoned.year,
        zoned.month,
        zoned.day,
        open.hour,
        open.minute,
      );
      if (iso) {
        return iso;
      }
    }
  }
  return null;
}

export function evaluateOperatingHours(
  config: OperatingHoursConfig,
  now: Date = new Date(),
): OperatingHoursStatus {
  const zoned = getZonedParts(now, config.timezone);
  if (!zoned) {
    return {
      open: true,
      timezone: config.timezone,
      days: config.days,
      nextOpenAt: null,
    };
  }
  const weekdayKey = String(zoned.isoWeekday);
  const windows = config.days[weekdayKey] ?? [];
  const minuteOfDay = minutesSinceMidnight(zoned.hour, zoned.minute);
  const open =
    windows.length > 0 && isOpenAtMinute(windows, minuteOfDay);
  return {
    open,
    timezone: config.timezone,
    days: config.days,
    nextOpenAt: open ? null : findNextOpenAt(config, now),
  };
}

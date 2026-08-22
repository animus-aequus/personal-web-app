import { fetchAppConfig } from "@/lib/app-config-client";
import {
  ASSISTANT_OFFLINE_ERROR_CODE,
  DEFAULT_OPERATING_HOURS_CONFIG,
  DEFAULT_OPERATING_TIMEZONE,
  type OperatingHoursStatus,
} from "@/lib/operating-hours-config";

export function parseAssistantOfflineFrom503(
  status: number,
  text: string,
): { nextOpenAt: string | null } | null {
  if (status !== 503) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as {
      error?: string;
      next_open_at?: string | null;
    };
    if (parsed.error === ASSISTANT_OFFLINE_ERROR_CODE) {
      return { nextOpenAt: parsed.next_open_at ?? null };
    }
  } catch {
    // fall through to substring check
  }
  if (text.includes(ASSISTANT_OFFLINE_ERROR_CODE)) {
    return { nextOpenAt: null };
  }
  return null;
}

/** Build modal payload after a 503 assistant_offline (schedule from app-config). */
export async function resolveAssistantOfflineStatus(
  nextOpenAt?: string | null,
): Promise<OperatingHoursStatus> {
  const config = await fetchAppConfig();
  const remote = config.operatingHours;
  return {
    open: false,
    timezone: remote.timezone || DEFAULT_OPERATING_TIMEZONE,
    days:
      Object.keys(remote.days).length > 0
        ? remote.days
        : DEFAULT_OPERATING_HOURS_CONFIG.days,
    nextOpenAt: nextOpenAt ?? remote.nextOpenAt ?? null,
  };
}

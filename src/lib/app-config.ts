import { NextResponse } from "next/server";

import { getBffPostgres } from "@/lib/db/postgres";
import {
  APP_CONFIG_PATH,
  ASSISTANT_OFFLINE_ERROR_CODE,
  DEFAULT_OPERATING_HOURS_CONFIG,
  DEFAULT_OPERATING_TIMEZONE,
  type AppConfigResponse,
  type OperatingHoursConfig,
  type OperatingHoursStatus,
} from "@/lib/operating-hours-config";
import {
  evaluateOperatingHours,
  normalizeOperatingHoursConfig,
} from "@/lib/operating-hours/evaluate";

const CONFIG_CACHE_TTL_MS = 30_000;

let cached: { config: AppConfigResponse; at: number } | undefined;

export function invalidateAppConfigCache(): void {
  cached = undefined;
}

function failOpenOperatingHours(): OperatingHoursStatus {
  return {
    open: true,
    timezone: DEFAULT_OPERATING_TIMEZONE,
    days: DEFAULT_OPERATING_HOURS_CONFIG.days,
    nextOpenAt: null,
  };
}

/** Returns config from Postgres, or null to fail-open (no DB URL or read error). */
async function readOperatingHoursConfig(): Promise<OperatingHoursConfig | null> {
  const sql = getBffPostgres();
  if (!sql) {
    console.warn(
      "[app-config] BFF_DATABASE_URL unset; operating hours fail-open",
    );
    return null;
  }
  try {
    const rows = await sql<{ value: unknown }[]>`
      SELECT value
      FROM app_config
      WHERE key = 'operating_hours'
      LIMIT 1
    `;
    if (!rows.length) {
      return DEFAULT_OPERATING_HOURS_CONFIG;
    }
    return normalizeOperatingHoursConfig(rows[0].value);
  } catch (error) {
    console.warn("[app-config] operating_hours read failed", error);
    return null;
  }
}

/** Operating hours from Postgres when configured; fail-open when DB is absent or errors. */
export async function getAppConfig(): Promise<AppConfigResponse> {
  const now = Date.now();
  if (cached && now - cached.at < CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }

  const config = await readOperatingHoursConfig();
  const response: AppConfigResponse = {
    operatingHours: config
      ? evaluateOperatingHours(config)
      : failOpenOperatingHours(),
  };

  cached = { config: response, at: now };
  return response;
}

/** Returns 503 when outside operating hours; null to proceed. Fail-open without DB URL. */
export async function enforceOperatingHours(): Promise<NextResponse | null> {
  const config = await readOperatingHoursConfig();
  if (!config) {
    return null;
  }
  const operatingHours = evaluateOperatingHours(config);
  if (operatingHours.open) {
    return null;
  }
  return NextResponse.json(
    {
      error: ASSISTANT_OFFLINE_ERROR_CODE,
      next_open_at: operatingHours.nextOpenAt,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export { APP_CONFIG_PATH };

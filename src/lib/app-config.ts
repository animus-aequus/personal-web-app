import { NextResponse } from "next/server";

import { getBffPostgres, resetBffPostgres } from "@/lib/db/postgres";
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
/** Fail-open rather than stall the `/chat` gate on a wedged pooler connection. */
const CONFIG_READ_TIMEOUT_MS = 4_000;

let cached: { config: AppConfigResponse; at: number } | undefined;
let inflight: Promise<AppConfigResponse> | undefined;

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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
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
    const rows = await withTimeout(
      sql<{ value: unknown }[]>`
        SELECT value
        FROM app_config
        WHERE key = 'operating_hours'
        LIMIT 1
      `,
      CONFIG_READ_TIMEOUT_MS,
      "app-config postgres timed out",
    );
    if (!rows.length) {
      return DEFAULT_OPERATING_HOURS_CONFIG;
    }
    return normalizeOperatingHoursConfig(rows[0].value);
  } catch (error) {
    console.warn("[app-config] operating_hours read failed", error);
    resetBffPostgres();
    return null;
  }
}

/** Operating hours from Postgres when configured; fail-open when DB is absent or errors. */
export async function getAppConfig(): Promise<AppConfigResponse> {
  if (cached && Date.now() - cached.at < CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }
  if (!inflight) {
    inflight = (async () => {
      const config = await readOperatingHoursConfig();
      const response: AppConfigResponse = {
        operatingHours: config
          ? evaluateOperatingHours(config)
          : failOpenOperatingHours(),
      };
      cached = { config: response, at: Date.now() };
      return response;
    })().finally(() => {
      inflight = undefined;
    });
  }
  return inflight;
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

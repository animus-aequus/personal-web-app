import {
  APP_CONFIG_PATH,
  DEFAULT_OPERATING_HOURS_CONFIG,
  DEFAULT_OPERATING_TIMEZONE,
  type AppConfigResponse,
} from "@/lib/operating-hours-config";

/** Slightly above the BFF postgres timeout so the server can fail-open first. */
const APP_CONFIG_FETCH_TIMEOUT_MS = 6_000;

function failOpenAppConfig(): AppConfigResponse {
  return {
    operatingHours: {
      open: true,
      timezone: DEFAULT_OPERATING_TIMEZONE,
      days: DEFAULT_OPERATING_HOURS_CONFIG.days,
      nextOpenAt: null,
    },
  };
}

function fetchSignal(external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(APP_CONFIG_FETCH_TIMEOUT_MS);
  if (!external) {
    return timeout;
  }

  const controller = new AbortController();
  const onAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  if (external.aborted || timeout.aborted) {
    onAbort();
    return controller.signal;
  }
  external.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

/** Client fetch for the `/chat` operating-hours gate. Fail-open on error. */
export async function fetchAppConfig(
  signal?: AbortSignal,
): Promise<AppConfigResponse> {
  try {
    const response = await fetch(APP_CONFIG_PATH, {
      cache: "no-store",
      signal: fetchSignal(signal),
    });
    if (!response.ok) {
      throw new Error(`app-config ${response.status}`);
    }
    return (await response.json()) as AppConfigResponse;
  } catch (error) {
    if (signal?.aborted) {
      return failOpenAppConfig();
    }
    console.warn("[app-config] client fetch failed", error);
    return failOpenAppConfig();
  }
}

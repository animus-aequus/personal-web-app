import {
  APP_CONFIG_PATH,
  type AppConfigResponse,
} from "@/lib/operating-hours-config";

/** Client fetch for the `/chat` operating-hours gate. Fail-open on error. */
export async function fetchAppConfig(): Promise<AppConfigResponse> {
  try {
    const response = await fetch(APP_CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`app-config ${response.status}`);
    }
    return (await response.json()) as AppConfigResponse;
  } catch (error) {
    console.warn("[app-config] client fetch failed", error);
    return {
      operatingHours: {
        open: true,
        timezone: "Europe/Warsaw",
        days: {},
        nextOpenAt: null,
      },
    };
  }
}

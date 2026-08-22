/** Shared operating-hours contract (BFF + client). */

export const APP_CONFIG_PATH = "/api/app-config";
export const ASSISTANT_OFFLINE_ERROR_CODE = "assistant_offline";

export type OperatingHoursWindow = {
  open: string;
  close: string;
};

/** ISO weekday keys "0" (Mon) … "6" (Sun). Empty array = closed day. */
export type OperatingHoursDays = Record<string, OperatingHoursWindow[]>;

export type OperatingHoursConfig = {
  timezone: string;
  days: OperatingHoursDays;
};

export type OperatingHoursStatus = {
  open: boolean;
  timezone: string;
  days: OperatingHoursDays;
  nextOpenAt: string | null;
};

export type AppConfigResponse = {
  operatingHours: OperatingHoursStatus;
};

export const DEFAULT_OPERATING_TIMEZONE = "Europe/Warsaw";

export const DEFAULT_OPERATING_HOURS_CONFIG: OperatingHoursConfig = {
  timezone: DEFAULT_OPERATING_TIMEZONE,
  days: {
    "0": [{ open: "07:00", close: "21:00" }],
    "1": [{ open: "07:00", close: "21:00" }],
    "2": [{ open: "07:00", close: "21:00" }],
    "3": [{ open: "07:00", close: "21:00" }],
    "4": [{ open: "07:00", close: "21:00" }],
    "5": [{ open: "07:00", close: "21:00" }],
    "6": [{ open: "07:00", close: "21:00" }],
  },
};

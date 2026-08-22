import { HoursClosedFallback } from "@/components/access/hours-closed-fallback";
import { fetchAppConfig } from "@/lib/app-config-client";
import type { AccessCondition } from "@/lib/access/types";
import type { OperatingHoursStatus } from "@/lib/operating-hours-config";
import { ABOUT_ME_PATH } from "@/lib/site-paths";

export const operatingHoursCondition: AccessCondition = {
  id: "operatingHours",
  async evaluate({ signal }) {
    const config = await fetchAppConfig();
    if (signal.aborted) {
      return { status: "pass" };
    }

    const hours = config.operatingHours;
    if (hours.open) {
      return { status: "pass" };
    }

    return {
      status: "fail",
      fallback: {
        Component: HoursClosedFallback,
        dismissAction: { type: "redirect", to: ABOUT_ME_PATH },
        payload: hours satisfies OperatingHoursStatus,
      },
    };
  },
};

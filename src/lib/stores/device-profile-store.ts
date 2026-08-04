"use client";

import { create } from "zustand";

import {
  detectDeviceProfile,
  type DeviceFormFactor,
  type DeviceProfileSignals,
  type PerformanceTier,
} from "@/lib/device-profile";

type DeviceProfileStore = {
  /** False until profiling has run in the browser. */
  ready: boolean;
  formFactor: DeviceFormFactor;
  tier: PerformanceTier;
  signals: DeviceProfileSignals | null;
  init: () => void;
};

export const useDeviceProfileStore = create<DeviceProfileStore>((set, get) => ({
  ready: false,
  formFactor: "desktop",
  tier: "medium",
  signals: null,
  init: () => {
    if (get().ready || typeof window === "undefined") {
      return;
    }
    const profile = detectDeviceProfile();
    set({
      ready: true,
      formFactor: profile.formFactor,
      tier: profile.tier,
      signals: profile.signals,
    });
  },
}));

/** Idempotent — safe if something needs to force a refresh later. */
export function initDeviceProfile(): void {
  useDeviceProfileStore.getState().init();
}

// Run once when this client module is first evaluated in the browser — outside
// any React component. SSR / RSC evaluation skips the `window` branch.
if (typeof window !== "undefined") {
  initDeviceProfile();
}

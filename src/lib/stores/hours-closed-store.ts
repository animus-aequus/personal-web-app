"use client";

import { create } from "zustand";

import type { OperatingHoursStatus } from "@/lib/operating-hours-config";

type HoursClosedStore = {
  hours: OperatingHoursStatus | null;
  dismissed: boolean;
  show: (hours: OperatingHoursStatus) => void;
  dismiss: () => void;
  reset: () => void;
};

export const useHoursClosedStore = create<HoursClosedStore>((set) => ({
  hours: null,
  dismissed: false,
  show: (hours) => set({ hours, dismissed: false }),
  dismiss: () => set({ dismissed: true }),
  reset: () => set({ hours: null, dismissed: false }),
}));

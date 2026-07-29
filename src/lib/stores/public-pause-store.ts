"use client";

import { create } from "zustand";

import {
  DEFAULT_PAUSE_MESSAGE,
  PUBLIC_STATUS_PATH,
  type PublicAccessStatus,
} from "@/lib/public-access-config";

type PublicPauseStore = {
  paused: boolean;
  message: string | null;
  /** True once the visitor acknowledged the modal (chrome stays disabled). */
  dismissed: boolean;
  setStatus: (status: PublicAccessStatus) => void;
  dismiss: () => void;
};

export const usePublicPauseStore = create<PublicPauseStore>((set) => ({
  paused: false,
  message: null,
  dismissed: false,
  setStatus: ({ paused, message }) =>
    set((state) => ({
      paused,
      message: paused ? (message?.trim() || DEFAULT_PAUSE_MESSAGE) : null,
      dismissed: paused && state.paused ? state.dismissed : false,
    })),
  dismiss: () => set({ dismissed: true }),
}));

/** Reads the BFF pause state; fails open so a status glitch never blocks chat. */
export async function fetchPublicStatus(): Promise<PublicAccessStatus> {
  try {
    const response = await fetch(PUBLIC_STATUS_PATH, { cache: "no-store" });
    if (!response.ok) {
      return { paused: false, message: null };
    }
    const data = (await response.json()) as Partial<PublicAccessStatus>;
    return {
      paused: data.paused === true,
      message: typeof data.message === "string" ? data.message : null,
    };
  } catch {
    return { paused: false, message: null };
  }
}

/** Re-reads the pause state after a request failed; true when paused. */
export async function refreshPublicPauseState(): Promise<boolean> {
  const status = await fetchPublicStatus();
  usePublicPauseStore.getState().setStatus(status);
  return status.paused;
}

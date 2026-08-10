"use client";

import { create } from "zustand";

type InvalidInviteStore = {
  open: boolean;
  /** True when a prior session id existed before the failed invite attempt. */
  hadPriorSession: boolean;
  /** True while invalid-invite recovery bootstrap is in flight. */
  recovering: boolean;
  show: (hadPriorSession: boolean) => void;
  dismiss: () => void;
  setRecovering: (recovering: boolean) => void;
};

export const useInvalidInviteStore = create<InvalidInviteStore>((set) => ({
  open: false,
  hadPriorSession: false,
  recovering: false,
  show: (hadPriorSession) => set({ open: true, hadPriorSession }),
  dismiss: () => set({ open: false }),
  setRecovering: (recovering) => set({ recovering }),
}));

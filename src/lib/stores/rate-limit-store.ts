"use client";

import { create } from "zustand";

import type { RateLimitAction } from "@/lib/rate-limit";

type RateLimitStore = {
  open: boolean;
  action: RateLimitAction | null;
  retryAt: string | null;
  show: (params: { action: RateLimitAction; retryAt: string }) => void;
  dismiss: () => void;
};

export const useRateLimitStore = create<RateLimitStore>((set) => ({
  open: false,
  action: null,
  retryAt: null,
  show: ({ action, retryAt }) =>
    set({
      open: true,
      action,
      retryAt,
    }),
  dismiss: () =>
    set({
      open: false,
      action: null,
      retryAt: null,
    }),
}));

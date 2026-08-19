"use client";

import { create } from "zustand";

type InviteWelcomeStore = {
  open: boolean;
  /** Display name from invitations.name (company, person, …). */
  name: string | null;
  show: (name: string) => void;
  dismiss: () => void;
};

export const useInviteWelcomeStore = create<InviteWelcomeStore>((set) => ({
  open: false,
  name: null,
  show: (name) => set({ open: true, name }),
  dismiss: () => set({ open: false, name: null }),
}));

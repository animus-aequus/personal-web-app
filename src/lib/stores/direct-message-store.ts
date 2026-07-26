"use client";

import { create } from "zustand";

export type DirectMessageState = {
  formId: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
};

type DirectMessageStore = {
  active: DirectMessageState | null;
  /** Forms already submitted/cancelled — ignore stale `data-direct-message` parts. */
  dismissedFormIds: ReadonlySet<string>;
  setFromPayload: (payload: DirectMessageState) => void;
  dismiss: () => void;
  clear: () => void;
};

export const useDirectMessageStore = create<DirectMessageStore>((set) => ({
  active: null,
  dismissedFormIds: new Set(),
  setFromPayload: (payload) =>
    set((state) => {
      if (state.dismissedFormIds.has(payload.formId)) {
        return state;
      }
      return {
        active: {
          formId: payload.formId,
          name: payload.name,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
        },
      };
    }),
  dismiss: () =>
    set((state) => {
      if (!state.active) {
        return state;
      }
      const dismissedFormIds = new Set(state.dismissedFormIds);
      dismissedFormIds.add(state.active.formId);
      return { active: null, dismissedFormIds };
    }),
  clear: () => set({ active: null, dismissedFormIds: new Set() }),
}));

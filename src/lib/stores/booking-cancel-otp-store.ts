"use client";

import { create } from "zustand";

export type CancelOtpCard = {
  cancellationId: string;
  bookingId: string;
  emailMasked: string;
  expiresAt: string;
  attemptsLeft: number;
  eventName: string;
  slotStart: string;
};

type BookingCancelOtpStore = {
  /** Pending cancel OTPs in request order. */
  items: CancelOtpCard[];
  dismissedIds: ReadonlySet<string>;
  upsert: (card: CancelOtpCard) => void;
  upsertMany: (cards: CancelOtpCard[]) => void;
  updateAttempts: (cancellationId: string, attemptsLeft: number) => void;
  dismiss: (cancellationId: string) => void;
  clear: () => void;
};

export const useBookingCancelOtpStore = create<BookingCancelOtpStore>((set) => ({
  items: [],
  dismissedIds: new Set(),
  upsert: (card) =>
    set((state) => {
      if (state.dismissedIds.has(card.cancellationId)) {
        return state;
      }
      // A re-initiated cancellation for the same booking supersedes any
      // previous card for it (different cancellationId) — only the newest
      // OTP per booking should ever be visible.
      const without = state.items.filter(
        (item) =>
          item.cancellationId !== card.cancellationId &&
          item.bookingId !== card.bookingId,
      );
      return { items: [...without, card] };
    }),
  upsertMany: (cards) =>
    set((state) => {
      let items = [...state.items];
      for (const card of cards) {
        if (state.dismissedIds.has(card.cancellationId)) {
          continue;
        }
        items = items.filter(
          (item) =>
            item.cancellationId !== card.cancellationId &&
            item.bookingId !== card.bookingId,
        );
        items.push(card);
      }
      return { items };
    }),
  updateAttempts: (cancellationId, attemptsLeft) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.cancellationId === cancellationId
          ? { ...item, attemptsLeft }
          : item,
      ),
    })),
  dismiss: (cancellationId) =>
    set((state) => {
      const dismissedIds = new Set(state.dismissedIds);
      dismissedIds.add(cancellationId);
      return {
        items: state.items.filter((item) => item.cancellationId !== cancellationId),
        dismissedIds,
      };
    }),
  clear: () => set({ items: [], dismissedIds: new Set() }),
}));

"use client";

import { create } from "zustand";

export type BookingOtpStatus = "pending" | "success" | "error";

export type BookingOtpState = {
  bookingId: string;
  emailMasked: string;
  expiresAt: string;
  attemptsLeft: number;
  status: BookingOtpStatus;
  errorMessage?: string;
  eventName?: string;
  slotStart?: string;
};

type BookingOtpStore = {
  active: BookingOtpState | null;
  setFromPayload: (
    payload: Omit<BookingOtpState, "status" | "errorMessage"> & {
      status?: BookingOtpStatus;
    },
  ) => void;
  setStatus: (
    status: BookingOtpStatus,
    errorMessage?: string,
    attemptsLeft?: number,
  ) => void;
  clear: () => void;
};

export const useBookingOtpStore = create<BookingOtpStore>((set) => ({
  active: null,
  setFromPayload: (payload) =>
    set({
      active: {
        bookingId: payload.bookingId,
        emailMasked: payload.emailMasked,
        expiresAt: payload.expiresAt,
        attemptsLeft: payload.attemptsLeft,
        status: payload.status ?? "pending",
        eventName: payload.eventName,
        slotStart: payload.slotStart,
        errorMessage: undefined,
      },
    }),
  setStatus: (status, errorMessage, attemptsLeft) =>
    set((state) => {
      if (!state.active) {
        return state;
      }
      return {
        active: {
          ...state.active,
          status,
          errorMessage,
          attemptsLeft:
            attemptsLeft !== undefined ? attemptsLeft : state.active.attemptsLeft,
        },
      };
    }),
  clear: () => set({ active: null }),
}));

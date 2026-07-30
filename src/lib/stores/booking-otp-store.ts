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
  durationMinutes?: number;
  meetUrl?: string;
  htmlLink?: string;
  icalUid?: string;
};

export type BookingSuccessPayload = {
  eventName?: string;
  slotStart?: string;
  durationMinutes?: number;
  meetUrl?: string | null;
  htmlLink?: string | null;
  icalUid?: string | null;
};

type BookingOtpStore = {
  active: BookingOtpState | null;
  /** Bookings the user already confirmed/cancelled/expired — ignore stale `data-otp` parts. */
  dismissedBookingIds: ReadonlySet<string>;
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
  setSuccess: (payload: BookingSuccessPayload) => void;
  /** Mark current booking dismissed and remove the widget (terminal OTP action). */
  dismiss: () => void;
  /** Full reset (session bootstrap) — clears active + dismissed history. */
  clear: () => void;
};

export const useBookingOtpStore = create<BookingOtpStore>((set) => ({
  active: null,
  dismissedBookingIds: new Set(),
  setFromPayload: (payload) =>
    set((state) => {
      if (state.dismissedBookingIds.has(payload.bookingId)) {
        return state;
      }
      // Do not clobber success/error UI when a stale data-otp part reappears.
      if (
        state.active?.bookingId === payload.bookingId &&
        state.active.status !== "pending"
      ) {
        return state;
      }
      return {
        active: {
          bookingId: payload.bookingId,
          emailMasked: payload.emailMasked,
          expiresAt: payload.expiresAt,
          attemptsLeft: payload.attemptsLeft,
          status: payload.status ?? "pending",
          eventName: payload.eventName,
          slotStart: payload.slotStart,
          durationMinutes: payload.durationMinutes,
          meetUrl: payload.meetUrl,
          htmlLink: payload.htmlLink,
          icalUid: payload.icalUid,
          errorMessage: undefined,
        },
      };
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
  setSuccess: (payload) =>
    set((state) => {
      if (!state.active) {
        return state;
      }
      return {
        active: {
          ...state.active,
          status: "success",
          errorMessage: undefined,
          eventName: payload.eventName ?? state.active.eventName,
          slotStart: payload.slotStart ?? state.active.slotStart,
          durationMinutes:
            payload.durationMinutes ?? state.active.durationMinutes,
          meetUrl: payload.meetUrl ?? state.active.meetUrl,
          htmlLink: payload.htmlLink ?? state.active.htmlLink,
          icalUid: payload.icalUid ?? state.active.icalUid,
        },
      };
    }),
  dismiss: () =>
    set((state) => {
      if (!state.active) {
        return state;
      }
      const dismissedBookingIds = new Set(state.dismissedBookingIds);
      dismissedBookingIds.add(state.active.bookingId);
      return { active: null, dismissedBookingIds };
    }),
  clear: () => set({ active: null, dismissedBookingIds: new Set() }),
}));

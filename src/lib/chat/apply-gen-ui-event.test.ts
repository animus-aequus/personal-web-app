import { beforeEach, describe, expect, it } from "vitest";

import {
  applyGenUiEvent,
  applyGenUiFromDataPart,
} from "@/lib/chat/apply-gen-ui-event";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";

const OTP_PAYLOAD = {
  bookingId: "booking-1",
  emailMasked: "k***@example.com",
  expiresAt: "2026-09-09T12:00:00.000Z",
};

const MEETING = {
  bookingId: "booking-1",
  eventName: "Intro",
  slotStart: "2026-09-10T10:00:00.000Z",
  durationMinutes: 30,
  meetUrl: "https://meet.example.com/abc",
  htmlLink: null,
};

describe("applyGenUiFromDataPart", () => {
  beforeEach(() => {
    useBookingOtpStore.getState().clear();
    useDirectMessageStore.getState().clear();
    useMeetingsListStore.getState().clear();
  });

  it("opens a booking OTP card and defaults attemptsLeft to 5", () => {
    applyGenUiFromDataPart({
      type: "data-otp",
      data: OTP_PAYLOAD,
    });

    const active = useBookingOtpStore.getState().active;
    expect(active).toMatchObject({
      ...OTP_PAYLOAD,
      attemptsLeft: 5,
      status: "pending",
    });
  });

  it("does not reopen a dismissed bookingId from a later data-otp", () => {
    applyGenUiFromDataPart({
      type: "data-otp",
      data: OTP_PAYLOAD,
    });
    useBookingOtpStore.getState().dismiss();

    applyGenUiFromDataPart({
      type: "data-otp",
      data: { ...OTP_PAYLOAD, emailMasked: "other@example.com" },
    });

    expect(useBookingOtpStore.getState().active).toBeNull();
    expect(useBookingOtpStore.getState().dismissedBookingIds.has("booking-1")).toBe(
      true,
    );
  });

  it("allows the same bookingId after clear", () => {
    applyGenUiFromDataPart({
      type: "data-otp",
      data: OTP_PAYLOAD,
    });
    useBookingOtpStore.getState().dismiss();
    useBookingOtpStore.getState().clear();

    applyGenUiFromDataPart({
      type: "data-otp",
      data: OTP_PAYLOAD,
    });

    expect(useBookingOtpStore.getState().active?.bookingId).toBe("booking-1");
  });

  it("does not overwrite an already-active OTP for the same bookingId", () => {
    applyGenUiFromDataPart({
      type: "data-otp",
      data: { ...OTP_PAYLOAD, attemptsLeft: 3 },
    });
    useBookingOtpStore.getState().setStatus("error", "bad code", 2);

    applyGenUiFromDataPart({
      type: "data-otp",
      data: { ...OTP_PAYLOAD, attemptsLeft: 5 },
    });

    expect(useBookingOtpStore.getState().active).toMatchObject({
      bookingId: "booking-1",
      status: "error",
      errorMessage: "bad code",
      attemptsLeft: 2,
    });
  });

  it("opens a direct-message form and ignores a dismissed formId", () => {
    applyGenUiFromDataPart({
      type: "data-direct-message",
      data: { formId: "form-1", name: "Ada" },
    });
    expect(useDirectMessageStore.getState().active).toEqual({
      formId: "form-1",
      name: "Ada",
      email: undefined,
      phoneNumber: undefined,
    });

    useDirectMessageStore.getState().dismiss();
    applyGenUiFromDataPart({
      type: "data-direct-message",
      data: { formId: "form-1", name: "Grace" },
    });

    expect(useDirectMessageStore.getState().active).toBeNull();
  });

  it("sets a meetings list from a valid data-meetings-list part", () => {
    applyGenUiFromDataPart({
      type: "data-meetings-list",
      data: { listId: "list-1", meetings: [MEETING] },
    });

    expect(useMeetingsListStore.getState().activeListId).toBe("list-1");
    expect(useMeetingsListStore.getState().activeMeetings).toEqual([MEETING]);
  });

  it("does not open a meetings list when meetings is not an array", () => {
    applyGenUiFromDataPart({
      type: "data-meetings-list",
      data: { listId: "list-1", meetings: { bookingId: "x" } },
    });

    expect(useMeetingsListStore.getState().activeListId).toBeNull();
  });

  it("does not open a meetings list without listId", () => {
    applyGenUiFromDataPart({
      type: "data-meetings-list",
      data: { meetings: [MEETING] },
    });

    expect(useMeetingsListStore.getState().activeListId).toBeNull();
  });

  it("ignores an incomplete OTP payload", () => {
    applyGenUiFromDataPart({
      type: "data-otp",
      data: { bookingId: 12, emailMasked: "k***@example.com", expiresAt: "soon" },
    });

    expect(useBookingOtpStore.getState().active).toBeNull();
  });

  it("ignores an unknown data part type", () => {
    applyGenUiFromDataPart({
      type: "data-unknown",
      data: { bookingId: "booking-1" },
    });

    expect(useBookingOtpStore.getState().active).toBeNull();
    expect(useDirectMessageStore.getState().active).toBeNull();
    expect(useMeetingsListStore.getState().activeListId).toBeNull();
  });
});

describe("applyGenUiEvent", () => {
  beforeEach(() => {
    useBookingOtpStore.getState().clear();
    useMeetingsListStore.getState().clear();
  });

  it("applies a typed meetings_list event", () => {
    applyGenUiEvent({
      type: "meetings_list",
      listId: "list-2",
      meetings: [MEETING],
    });

    expect(useMeetingsListStore.getState().activeListId).toBe("list-2");
  });
});

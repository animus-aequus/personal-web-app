export type BookingOtpData = {
  bookingId: string;
  emailMasked: string;
  expiresAt: string;
  attemptsLeft?: number;
  eventName?: string;
  slotStart?: string;
};

export type ChatDataParts = {
  otp: BookingOtpData;
};

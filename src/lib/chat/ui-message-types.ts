export type BookingOtpData = {
  bookingId: string;
  emailMasked: string;
  expiresAt: string;
  attemptsLeft?: number;
  eventName?: string;
  slotStart?: string;
};

export type MeetingsListData = {
  listId: string;
  meetings: Array<{
    bookingId: string;
    eventName: string;
    slotStart: string;
    durationMinutes: number;
  }>;
};

export type ChatDataParts = {
  otp: BookingOtpData;
  "meetings-list": MeetingsListData;
};

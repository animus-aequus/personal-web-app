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
    meetUrl: string | null;
    htmlLink: string | null;
  }>;
};

export type DirectMessageData = {
  formId: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
};

export type ChatDataParts = {
  otp: BookingOtpData;
  "meetings-list": MeetingsListData;
  "direct-message": DirectMessageData;
};

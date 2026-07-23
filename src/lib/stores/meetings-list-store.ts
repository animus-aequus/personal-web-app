"use client";

import { create } from "zustand";

export type MeetingsListMeeting = {
  bookingId: string;
  eventName: string;
  slotStart: string;
  durationMinutes: number;
};

type MeetingsListStore = {
  /** Newest meetings_list GenUI from this browser session (lost on refresh). */
  activeListId: string | null;
  /** Payload for the active list (needed for voice overlay before history merge). */
  activeMeetings: MeetingsListMeeting[];
  setActiveList: (listId: string, meetings: MeetingsListMeeting[]) => void;
  clear: () => void;
};

export const useMeetingsListStore = create<MeetingsListStore>((set) => ({
  activeListId: null,
  activeMeetings: [],
  setActiveList: (listId, meetings) =>
    set({ activeListId: listId, activeMeetings: meetings }),
  clear: () => set({ activeListId: null, activeMeetings: [] }),
}));

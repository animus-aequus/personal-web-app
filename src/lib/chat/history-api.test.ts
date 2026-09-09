import { describe, expect, it } from "vitest";

import type { HistoryMessage } from "@/lib/agent-client";
import {
  historyMessageToChatMessage,
  mergeMessagesById,
  prependUniqueMessages,
} from "@/lib/chat/history-api";
import type { ChatMessage } from "@/lib/stores/chat-store";

function chatMessage(
  overrides: Partial<ChatMessage> & Pick<ChatMessage, "id">,
): ChatMessage {
  return {
    role: "user",
    content: "",
    source: "text",
    timestamp: 0,
    ...overrides,
  };
}

describe("mergeMessagesById", () => {
  it("lets a later group win the same id", () => {
    const history = [
      chatMessage({ id: "a", content: "old", timestamp: 1 }),
    ];
    const live = [
      chatMessage({ id: "a", content: "new", source: "voice", timestamp: 1 }),
    ];

    expect(mergeMessagesById(history, live)).toEqual([
      chatMessage({ id: "a", content: "new", source: "voice", timestamp: 1 }),
    ]);
  });

  it("sorts merged rows by timestamp", () => {
    const later = chatMessage({ id: "b", content: "later", timestamp: 20 });
    const earlier = chatMessage({ id: "a", content: "earlier", timestamp: 10 });

    expect(mergeMessagesById([later], [earlier]).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("merges history, live text, and live voice without dropping distinct ids", () => {
    const history = [
      chatMessage({ id: "h1", content: "hist", timestamp: 1 }),
    ];
    const text = [
      chatMessage({ id: "t1", content: "text", timestamp: 3 }),
    ];
    const voice = [
      chatMessage({
        id: "v1",
        content: "voice",
        source: "voice",
        timestamp: 2,
      }),
    ];

    expect(mergeMessagesById(history, text, voice).map((row) => row.id)).toEqual(
      ["h1", "v1", "t1"],
    );
  });
});

describe("prependUniqueMessages", () => {
  it("keeps the existing row when an older page repeats the id", () => {
    const existing = [
      chatMessage({ id: "a", content: "live", timestamp: 2 }),
    ];
    const older = [
      chatMessage({ id: "a", content: "history", timestamp: 1 }),
      chatMessage({ id: "b", content: "older", timestamp: 0 }),
    ];

    expect(prependUniqueMessages(existing, older).map((row) => row.id)).toEqual(
      ["b", "a"],
    );
    expect(prependUniqueMessages(existing, older)[1]?.content).toBe("live");
  });

  it("returns the same existing array when nothing new prepends", () => {
    const existing = [chatMessage({ id: "a", timestamp: 1 })];
    const older = [chatMessage({ id: "a", content: "dup", timestamp: 0 })];

    expect(prependUniqueMessages(existing, older)).toBe(existing);
  });
});

describe("historyMessageToChatMessage", () => {
  it("maps ISO sent_at, meetings_list parts, and interrupted", () => {
    const sentAt = "2026-09-09T12:00:00.000Z";
    const message: HistoryMessage = {
      id: "m1",
      role: "assistant",
      content: "Your meetings",
      sent_at: sentAt,
      interrupted: true,
      parts: [
        {
          type: "meetings_list",
          listId: "list-1",
          meetings: [
            {
              bookingId: "b1",
              eventName: "Intro",
              slotStart: "2026-09-10T10:00:00.000Z",
              durationMinutes: 30,
              meetUrl: null,
              htmlLink: "https://calendar.example.com/e",
            },
          ],
        },
      ],
    };

    expect(historyMessageToChatMessage(message)).toEqual({
      id: "m1",
      role: "assistant",
      content: "Your meetings",
      source: "text",
      timestamp: Date.parse(sentAt),
      interrupted: true,
      parts: [
        {
          type: "meetings_list",
          listId: "list-1",
          meetings: [
            {
              bookingId: "b1",
              eventName: "Intro",
              slotStart: "2026-09-10T10:00:00.000Z",
              durationMinutes: 30,
              meetUrl: null,
              htmlLink: "https://calendar.example.com/e",
            },
          ],
        },
      ],
    });
  });
});

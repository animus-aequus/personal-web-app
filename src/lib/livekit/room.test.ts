import { describe, expect, it } from "vitest";

import {
  livekitRoomName,
  livekitVoiceRoomName,
  sessionIdFromRoomName,
} from "@/lib/livekit/room";

describe("LiveKit room names", () => {
  it("builds a web room and a unique voice room per connection", () => {
    expect(livekitRoomName("sess-1")).toBe("web-sess-1");
    expect(livekitVoiceRoomName("sess-1", "conn-9")).toBe("web-sess-1--conn-9");
  });

  it("parses sessionId back from text and voice room names", () => {
    expect(sessionIdFromRoomName("web-sess-1")).toBe("sess-1");
    expect(sessionIdFromRoomName("web-sess-1--conn-9")).toBe("sess-1");
  });

  it("returns null for a bad prefix or empty session segment", () => {
    expect(sessionIdFromRoomName("voice-sess-1")).toBeNull();
    expect(sessionIdFromRoomName("web-")).toBeNull();
  });
});

import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { lastUserTextFromUiMessages } from "@/lib/chat/chat-user-text";

function message(
  role: UIMessage["role"],
  parts: UIMessage["parts"],
): UIMessage {
  return { id: crypto.randomUUID(), role, parts };
}

describe("lastUserTextFromUiMessages", () => {
  it("returns empty string when there is no user turn", () => {
    expect(lastUserTextFromUiMessages(undefined)).toBe("");
    expect(lastUserTextFromUiMessages([])).toBe("");
    expect(
      lastUserTextFromUiMessages([
        message("assistant", [{ type: "text", text: "hi" }]),
      ]),
    ).toBe("");
  });

  it("returns the last user text parts joined and trimmed", () => {
    const messages = [
      message("user", [{ type: "text", text: " first " }]),
      message("assistant", [{ type: "text", text: "ok" }]),
      message("user", [
        { type: "text", text: "  hello" },
        { type: "text", text: "world  " },
      ]),
    ];

    expect(lastUserTextFromUiMessages(messages)).toBe("hello\nworld");
  });

  it("ignores non-text parts on the user turn", () => {
    const messages = [
      message("user", [
        { type: "step-start" },
        { type: "text", text: "book me" },
      ]),
    ];

    expect(lastUserTextFromUiMessages(messages)).toBe("book me");
  });
});

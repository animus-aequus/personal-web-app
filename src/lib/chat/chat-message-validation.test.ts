import { describe, expect, it } from "vitest";

import {
  CHAT_MESSAGE_INPUT_CEILING,
  CHAT_MESSAGE_MAX,
  CHAT_REQUEST_MAX_BODY_BYTES,
  clampChatInput,
  isChatMessageTooLong,
  isChatRequestBodyTooLarge,
  userMessageCharCount,
} from "@/lib/chat/chat-message-validation";

describe("userMessageCharCount", () => {
  it("counts emoji as one code point", () => {
    expect(userMessageCharCount("👍")).toBe(1);
  });
});

describe("isChatMessageTooLong", () => {
  it("trims before applying the 1000-character limit", () => {
    const padded = `  ${"a".repeat(CHAT_MESSAGE_MAX)}  `;
    expect(isChatMessageTooLong(padded)).toBe(false);
    expect(isChatMessageTooLong(`${"a".repeat(CHAT_MESSAGE_MAX)}x`)).toBe(true);
  });
});

describe("clampChatInput", () => {
  it("cuts paste input to the 1500 code-point ceiling", () => {
    const input = `${"👍".repeat(CHAT_MESSAGE_INPUT_CEILING)}x`;
    const clamped = clampChatInput(input);
    expect(userMessageCharCount(clamped)).toBe(CHAT_MESSAGE_INPUT_CEILING);
    expect(clamped).toBe("👍".repeat(CHAT_MESSAGE_INPUT_CEILING));
  });
});

describe("isChatRequestBodyTooLarge", () => {
  it("is false when Content-Length is missing or not a number", () => {
    expect(isChatRequestBodyTooLarge(null)).toBe(false);
    expect(isChatRequestBodyTooLarge("nope")).toBe(false);
  });

  it("is true only above 10 KiB", () => {
    expect(isChatRequestBodyTooLarge(String(CHAT_REQUEST_MAX_BODY_BYTES))).toBe(
      false,
    );
    expect(
      isChatRequestBodyTooLarge(String(CHAT_REQUEST_MAX_BODY_BYTES + 1)),
    ).toBe(true);
  });
});

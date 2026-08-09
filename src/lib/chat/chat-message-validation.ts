/** Max characters accepted per chat turn (matches agent API `ChatRequest.message`). */
export const CHAT_MESSAGE_MAX = 1000;

/**
 * Hard ceiling for textarea value (paste protection). Users can exceed
 * {@link CHAT_MESSAGE_MAX} briefly to see the live error state.
 */
export const CHAT_MESSAGE_INPUT_CEILING = CHAT_MESSAGE_MAX + 500;

/** Max request body size before JSON parse (BFF early reject). */
export const CHAT_REQUEST_MAX_BODY_BYTES = 10000;

/** BFF guard: reject oversized bodies before `request.json()`. */
export function isChatRequestBodyTooLarge(contentLengthHeader: string | null): boolean {
  if (!contentLengthHeader) {
    return false;
  }
  const bytes = Number(contentLengthHeader);
  return Number.isFinite(bytes) && bytes > CHAT_REQUEST_MAX_BODY_BYTES;
}

/** Count user-visible characters (Unicode code points; aligns with Python `len`). */
export function userMessageCharCount(text: string): number {
  return [...text].length;
}

/** Trim input to {@link CHAT_MESSAGE_INPUT_CEILING} code points. */
export function clampChatInput(text: string): string {
  const count = userMessageCharCount(text);
  if (count <= CHAT_MESSAGE_INPUT_CEILING) {
    return text;
  }
  return [...text].slice(0, CHAT_MESSAGE_INPUT_CEILING).join("");
}

/** True when trimmed text exceeds {@link CHAT_MESSAGE_MAX} (matches BFF/agent). */
export function isChatMessageTooLong(text: string): boolean {
  return userMessageCharCount(text.trim()) > CHAT_MESSAGE_MAX;
}

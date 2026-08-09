"use client";

import { toast } from "sonner";

import { CHAT_MESSAGE_MAX } from "@/lib/chat/chat-message-validation";
import i18n from "@/lib/i18n/client";

export const MESSAGE_TOO_LONG_ERROR = "message_too_long";

export function showChatMessageTooLongToast(maxChars = CHAT_MESSAGE_MAX): void {
  toast.error(i18n.t("chat.messageTooLong", { length: maxChars }));
}

export async function responseIndicatesMessageTooLong(
  response: Response,
): Promise<{ maxChars: number } | null> {
  if (response.status !== 400) {
    return null;
  }

  try {
    const data = (await response.clone().json()) as {
      error?: string;
      maxChars?: number;
    };
    if (data.error !== "message_too_long") {
      return null;
    }
    return {
      maxChars:
        typeof data.maxChars === "number" && data.maxChars > 0
          ? data.maxChars
          : CHAT_MESSAGE_MAX,
    };
  } catch {
    return null;
  }
}

export async function notifyMessageTooLongIfNeeded(
  response: Response,
): Promise<boolean> {
  const detail = await responseIndicatesMessageTooLong(response);
  if (!detail) {
    return false;
  }
  showChatMessageTooLongToast(detail.maxChars);
  return true;
}

/** Throw when a fetch response is a message-length rejection (after toast). */
export async function throwIfMessageTooLongResponse(
  response: Response,
): Promise<void> {
  const tooLong = await notifyMessageTooLongIfNeeded(response);
  if (tooLong) {
    throw new Error(MESSAGE_TOO_LONG_ERROR);
  }
}

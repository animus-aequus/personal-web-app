import type { UIMessage } from "ai";

/** Last user text from an AI SDK `UIMessage` list (client transport only). */
export function lastUserTextFromUiMessages(
  messages: UIMessage[] | undefined,
): string {
  if (!messages?.length) {
    return "";
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") {
      continue;
    }
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }

  return "";
}

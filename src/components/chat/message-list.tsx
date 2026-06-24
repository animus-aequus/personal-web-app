"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/stores/chat-store";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading?: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4">
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted/50 text-foreground",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Assistant is thinking…</p>
        ) : null}
      </div>
    </div>
  );
}

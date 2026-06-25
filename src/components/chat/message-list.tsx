"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/stores/chat-store";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading?: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6">
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "max-w-[85%] text-sm leading-relaxed",
              message.role === "user"
                ? "ml-auto rounded-2xl bg-muted/50 px-4 py-3 text-foreground"
                : "mr-auto text-foreground",
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

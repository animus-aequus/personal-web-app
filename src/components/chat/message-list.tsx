"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/stores/chat-store";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading?: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Start a conversation about scheduling a meeting.
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted text-foreground",
            )}
          >
            <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
              {message.role === "user" ? "You" : "Assistant"}
              {message.source === "voice" ? " · voice" : ""}
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Assistant is thinking…</p>
        ) : null}
      </div>
    </ScrollArea>
  );
}

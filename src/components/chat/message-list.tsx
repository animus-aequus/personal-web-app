"use client";

import { CirclePause } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/stores/chat-store";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading?: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken =
    isLoading && (!lastMessage || lastMessage.role === "user");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6">
        {messages.map((message) => {
          const isInterruptedAssistant =
            message.role === "assistant" && message.interrupted;

          return (
            <article
              key={message.id}
              className={cn(
                "max-w-[85%] text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto rounded-2xl bg-muted/50 px-4 py-3 text-foreground"
                  : "mr-auto text-foreground",
              )}
            >
              {isInterruptedAssistant ? (
                <div className="relative rounded-xl border border-amber-500/20 px-4 py-3 pr-7 dark:border-amber-500/15">
                  <p className="min-w-0 whitespace-pre-wrap">{message.content}</p>
                  <span
                    className="absolute -right-2.5 -top-2.5 flex items-center justify-center bg-background p-1 text-amber-600/55 dark:text-amber-500/50"
                    title="Interrupted before finishing"
                    aria-label="Interrupted before finishing"
                  >
                    <CirclePause className="size-3.5" aria-hidden />
                  </span>
                </div>
              ) : (
                <p className="min-w-0 whitespace-pre-wrap">{message.content}</p>
              )}
            </article>
          );
        })}
        {awaitingFirstToken ? (
          <p className="text-sm text-muted-foreground">Assistant is thinking…</p>
        ) : null}
      </div>
    </div>
  );
}

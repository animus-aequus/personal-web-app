"use client";

import { FormEvent, KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type MessageInputProps = {
  onSend: (message: string) => Promise<void> | void;
  disabled?: boolean;
  isLoading?: boolean;
};

export function MessageInput({ onSend, disabled, isLoading }: MessageInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) {
      return;
    }
    setValue("");
    await onSend(trimmed);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submit();
  };

  const onKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await submit();
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a message…"
        disabled={disabled || isLoading}
        rows={3}
        className="min-h-[72px] resize-none"
      />
      <Button type="submit" disabled={disabled || isLoading || !value.trim()}>
        Send
      </Button>
    </form>
  );
}

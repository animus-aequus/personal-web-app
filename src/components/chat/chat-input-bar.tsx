"use client";

import { Mic } from "lucide-react";
import { motion } from "motion/react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;

type ChatInputBarProps = {
  onSend: (message: string) => Promise<void> | void;
  onVoiceToggle: () => void;
  voiceEnabled: boolean;
  disabled?: boolean;
  isLoading?: boolean;
};

export function ChatInputBar({
  onSend,
  onVoiceToggle,
  voiceEnabled,
  disabled,
  isLoading,
}: ChatInputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    const maxHeight = 96;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    if (!voiceEnabled) {
      adjustHeight();
    }
  }, [value, voiceEnabled, adjustHeight]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading || voiceEnabled) {
      return;
    }
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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

  if (voiceEnabled) {
    return (
      <button
        type="button"
        onClick={onVoiceToggle}
        disabled={disabled}
        aria-pressed={true}
        aria-label="End voice conversation"
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90",
          disabled && "opacity-50",
        )}
      >
        <Mic className="size-6" />
      </button>
    );
  }

  return (
    <div className="relative w-full px-4 pb-6 pt-2">
      <motion.form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-2xl items-center rounded-full bg-card px-2 py-2 shadow-lg"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything…"
          disabled={disabled || isLoading}
          rows={1}
          className="min-h-[24px] max-h-24 w-full resize-none bg-transparent py-1 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onVoiceToggle}
          disabled={disabled}
          aria-pressed={false}
          aria-label="Start voice conversation"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground",
            disabled && "opacity-50",
          )}
        >
          <Mic className="size-5" />
        </button>
      </motion.form>
    </div>
  );
}

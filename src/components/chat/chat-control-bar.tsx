"use client";

import { Mic } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AgentWaveVisualizer } from "@/components/agents-ui/agent-wave-visualizer";
import { UserAudioVisualizerRadial } from "@/components/agents-ui/user-audio-visualizer-radial";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;
const BAR_MAX_PX = 672;
const MIC_SIZE = 56;

type ChatControlBarProps = {
  onSend: (message: string) => Promise<void> | void;
  onVoiceToggle: () => void;
  voiceEnabled: boolean;
  voiceChromeReady: boolean;
  userTrack?: TrackReferenceOrPlaceholder;
  disabled?: boolean;
  isLoading?: boolean;
};

export function ChatControlBar({
  onSend,
  onVoiceToggle,
  voiceEnabled,
  voiceChromeReady,
  userTrack,
  disabled,
  isLoading,
}: ChatControlBarProps) {
  const collapsed = voiceEnabled;
  const showRadial = voiceEnabled && voiceChromeReady;

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

  const micButton = (
    <button
      type="button"
      onClick={onVoiceToggle}
      disabled={disabled}
      aria-pressed={voiceEnabled}
      aria-label={voiceEnabled ? "End voice conversation" : "Start voice conversation"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors",
        voiceEnabled
          ? "size-14 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
          : "size-10 text-foreground/80 hover:bg-muted/60 hover:text-foreground",
        disabled && "opacity-50",
      )}
    >
      <Mic className={cn("size-5", voiceEnabled && "size-6")} />
    </button>
  );

  return (
    <div
      className="fixed inset-x-0 bottom-6 z-20 flex flex-col items-center px-4"
    >
      <AnimatePresence>
        {showRadial ? (
          <motion.div
            key="agent-wave"
            className="mb-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <AgentWaveVisualizer />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showRadial ? (
          <motion.div
            key="radial"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <UserAudioVisualizerRadial track={userTrack}>
              {micButton}
            </UserAudioVisualizerRadial>
          </motion.div>
        ) : (
          <motion.form
            key="bar"
            onSubmit={onSubmit}
            className="mx-auto flex items-center overflow-hidden bg-card shadow-lg"
            initial={false}
            animate={{
              width: collapsed ? MIC_SIZE : "100%",
              maxWidth: collapsed ? MIC_SIZE : BAR_MAX_PX,
              height: collapsed ? MIC_SIZE : "auto",
              borderRadius: MIC_SIZE / 2,
              paddingLeft: collapsed ? 0 : 8,
              paddingRight: collapsed ? 0 : 8,
              paddingTop: collapsed ? 0 : 8,
              paddingBottom: collapsed ? 0 : 8,
            }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <motion.div
              className="flex min-w-0 flex-1 items-center"
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : "auto",
              }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ pointerEvents: collapsed ? "none" : "auto" }}
            >
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything…"
                disabled={disabled || isLoading || collapsed}
                rows={1}
                className="min-h-[24px] max-h-24 w-full min-w-0 resize-none bg-transparent py-1 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
            </motion.div>
            {collapsed ? (
              <div className="flex size-full items-center justify-center">
                {micButton}
              </div>
            ) : (
              micButton
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

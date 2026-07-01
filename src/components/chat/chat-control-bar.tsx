"use client";

import { Mic } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { AgentWaveVisualizer } from "@/components/agents-ui/agent-wave-visualizer";
import { UserRadialDots } from "@/components/agents-ui/user-radial-dots";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import {
  CHAT_CONTROL,
  computeControlBarGeometry,
  measureTextareaMetrics,
  textSlotWidthForBar,
  type TextareaMetrics,
} from "@/lib/chat/control-bar-geometry";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;
const MORPH_TRANSITION = {
  duration: CHAT_CONTROL.MORPH_MS,
  ease: EASE,
} as const;

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
  const [value, setValue] = useState("");
  const [textMetrics, setTextMetrics] = useState<TextareaMetrics>(() => ({
    height: CHAT_CONTROL.TEXT_LINE_PX,
    scrollable: false,
  }));
  const [barMaxWidth, setBarMaxWidth] = useState<number>(CHAT_CONTROL.BAR_MAX_PX);

  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const geometry = computeControlBarGeometry(
    voiceEnabled,
    voiceChromeReady,
    voiceEnabled ? CHAT_CONTROL.TEXT_LINE_PX : textMetrics.height,
    barMaxWidth,
  );

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }

    const syncBarMaxWidth = () => {
      setBarMaxWidth(
        Math.min(anchor.clientWidth, CHAT_CONTROL.BAR_MAX_PX),
      );
    };

    syncBarMaxWidth();
    const observer = new ResizeObserver(syncBarMaxWidth);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (voiceEnabled) {
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    setTextMetrics(
      measureTextareaMetrics(textarea, textSlotWidthForBar(barMaxWidth)),
    );
  }, [voiceEnabled, barMaxWidth, value]);

  const handleTextChange = useCallback((nextValue: string) => {
    setValue(nextValue);
  }, []);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading || voiceEnabled) {
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
    <div className="fixed inset-x-0 bottom-6 z-20 px-4">
      <div
        ref={anchorRef}
        className="mx-auto flex w-full max-w-2xl flex-col items-center"
      >
        <AnimatePresence>
          {geometry.showRadial ? (
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

        <motion.div
          className="relative flex items-center justify-center"
          initial={false}
          animate={{
            width: geometry.wrapperWidth,
            height: geometry.wrapperHeight,
          }}
          transition={MORPH_TRANSITION}
        >
          <AnimatePresence>
            {geometry.showRadial ? (
              <motion.div
                key="radial-dots"
                className="pointer-events-none absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <UserRadialDots track={userTrack} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.form
            onSubmit={onSubmit}
            className="relative shrink-0 overflow-hidden rounded-full"
            initial={false}
            animate={{
              width: geometry.shellWidth,
              height: geometry.shellHeight,
            }}
            transition={MORPH_TRANSITION}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-card shadow-lg"
              initial={false}
              animate={{ opacity: geometry.shellBackgroundOpacity }}
              transition={MORPH_TRANSITION}
              aria-hidden
            />

            <motion.div
              className="absolute overflow-hidden"
              initial={false}
              animate={{
                left: CHAT_CONTROL.BAR_PADDING,
                top: geometry.textSlotTop,
                width: geometry.textSlotWidth,
                opacity: voiceEnabled ? 0 : 1,
              }}
              transition={MORPH_TRANSITION}
              style={{ pointerEvents: voiceEnabled ? "none" : "auto" }}
            >
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => handleTextChange(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything…"
                disabled={disabled || isLoading || voiceEnabled}
                rows={1}
                style={{
                  height: textMetrics.height,
                  maxHeight: CHAT_CONTROL.TEXT_MAX_PX,
                }}
                className={cn(
                  "w-full resize-none bg-transparent py-1 pl-4 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
                  textMetrics.scrollable
                    ? "overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    : "overflow-hidden",
                )}
              />
            </motion.div>

            <motion.button
              type="button"
              onClick={onVoiceToggle}
              disabled={disabled}
              aria-pressed={voiceEnabled}
              aria-label={
                voiceEnabled
                  ? "End voice conversation"
                  : "Start voice conversation"
              }
              className={cn(
                "absolute z-10 flex items-center justify-center rounded-full",
                voiceEnabled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
                disabled && "opacity-50",
              )}
              initial={false}
              animate={{
                width: geometry.micSize,
                height: geometry.micSize,
                left: geometry.micLeft,
                top: geometry.micTop,
              }}
              transition={MORPH_TRANSITION}
            >
              <Mic className={cn("size-5", voiceEnabled && "size-6")} />
            </motion.button>
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
}

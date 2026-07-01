"use client";

import { Mic, Send } from "lucide-react";
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
  textButtonSize,
  textSlotWidthForBar,
  type TextareaMetrics,
} from "@/lib/chat/control-bar-geometry";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;
const SEND_TRANSITION = {
  duration: 0.25,
  ease: EASE,
} as const;
const MORPH_TRANSITION = {
  duration: CHAT_CONTROL.MORPH_MS,
  ease: EASE,
  borderRadius: { duration: 0 },
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
    multiLine: false,
  }));
  const [barMaxWidth, setBarMaxWidth] = useState<number>(CHAT_CONTROL.BAR_MAX_PX);
  const [isDesktop, setIsDesktop] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const buttonSize = textButtonSize(isDesktop);
  const showSendButton = !voiceEnabled && value.length > 0;

  const geometry = computeControlBarGeometry(
    voiceEnabled,
    voiceChromeReady,
    voiceEnabled ? CHAT_CONTROL.TEXT_LINE_PX : textMetrics.height,
    barMaxWidth,
    !voiceEnabled && textMetrics.multiLine,
    showSendButton,
    buttonSize,
  );

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-width: ${CHAT_CONTROL.DESKTOP_MIN_PX}px)`,
    );
    const syncDesktop = () => setIsDesktop(mediaQuery.matches);
    syncDesktop();
    mediaQuery.addEventListener("change", syncDesktop);
    return () => mediaQuery.removeEventListener("change", syncDesktop);
  }, []);

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
      measureTextareaMetrics(
        textarea,
        textSlotWidthForBar(barMaxWidth, buttonSize, showSendButton),
      ),
    );
  }, [voiceEnabled, barMaxWidth, value, showSendButton, buttonSize]);

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
            className="relative shrink-0 overflow-hidden"
            initial={false}
            animate={{
              width: geometry.shellWidth,
              height: geometry.shellHeight,
              borderRadius: geometry.borderRadius,
            }}
            transition={MORPH_TRANSITION}
          >
            <motion.div
              className="absolute inset-0 bg-card shadow-lg"
              initial={false}
              animate={{
                opacity: geometry.shellBackgroundOpacity,
                borderRadius: geometry.borderRadius,
              }}
              transition={MORPH_TRANSITION}
              aria-hidden
            />

            {voiceEnabled ? (
              <motion.button
                type="button"
                onClick={onVoiceToggle}
                disabled={disabled}
                aria-pressed={voiceEnabled}
                aria-label="End voice conversation"
                className={cn(
                  "absolute z-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
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
                <Mic className="size-6" />
              </motion.button>
            ) : (
              <>
                <motion.div
                  className="absolute overflow-hidden"
                  initial={false}
                  animate={{
                    left: geometry.textSlotLeft,
                    top: geometry.textSlotTop,
                    width: geometry.textSlotWidth,
                  }}
                  transition={MORPH_TRANSITION}
                >
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(event) => handleTextChange(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask anything…"
                    disabled={disabled || isLoading}
                    rows={1}
                    style={{
                      height: textMetrics.height,
                      maxHeight: CHAT_CONTROL.TEXT_MAX_PX,
                    }}
                    className={cn(
                      "w-full resize-none bg-transparent text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
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
                  aria-label="Start voice conversation"
                  className={cn(
                    "absolute z-10 flex items-center justify-center rounded-full text-foreground/80 hover:bg-muted/60 hover:text-foreground",
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
                  <Mic className={cn(isDesktop ? "size-4" : "size-5")} />
                </motion.button>

                <AnimatePresence>
                  {showSendButton ? (
                    <motion.button
                      key="send"
                      type="submit"
                      disabled={disabled || isLoading}
                      aria-label="Send message"
                      className={cn(
                        "absolute z-10 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90",
                        (disabled || isLoading) && "opacity-50",
                      )}
                      style={{
                        left: geometry.sendLeft,
                        top: geometry.sendTop,
                        width: geometry.sendSize,
                        height: geometry.sendSize,
                      }}
                      initial={{ x: buttonSize, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: buttonSize, opacity: 0 }}
                      transition={SEND_TRANSITION}
                    >
                      <Send
                        className={cn(
                          "text-black",
                          isDesktop ? "size-4" : "size-5",
                        )}
                      />
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </>
            )}
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
}

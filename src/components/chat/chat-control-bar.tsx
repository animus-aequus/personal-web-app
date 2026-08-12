"use client";

import {
  Keyboard,
  Lightbulb,
  Loader2,
  Mic,
  Send,
  Square,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Trans, useTranslation } from "react-i18next";

import { AgentWaveVisualizer } from "@/components/agents-ui/agent-wave-visualizer";
import { VoiceTurnProgress } from "@/components/chat/voice-turn-progress";
import { UserRadialDots } from "@/components/agents-ui/user-radial-dots";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import type { Room } from "livekit-client";
import {
  CHAT_CONTROL,
  computeControlBarGeometry,
  measureTextareaMetrics,
  textButtonSize,
  textSlotWidthForBar,
  type TextareaMetrics,
} from "@/lib/chat/control-bar-geometry";
import {
  CHAT_MESSAGE_MAX,
  clampChatInput,
  isChatMessageTooLong,
} from "@/lib/chat/chat-message-validation";
import { changeAppLanguage } from "@/lib/i18n/change-language";
import {
  LOCALE_CODES,
  LOCALE_LABELS,
  normalizeLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import {
  type VoiceChromeState,
  voiceLanguageSelectLocked,
} from "@/lib/livekit/voice-ptt-constants";
import { hasTtsFallback } from "@/lib/livekit/voice-languages";
import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useVoiceChromeStore } from "@/lib/stores/voice-chrome-store";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;
const SEND_TRANSITION = {
  duration: 0.25,
  ease: EASE,
} as const;
const SEND_LAYOUT_TRANSITION = {
  duration: CHAT_CONTROL.MORPH_MS,
  ease: EASE,
  x: SEND_TRANSITION,
  opacity: SEND_TRANSITION,
} as const;
const MORPH_TRANSITION = {
  duration: CHAT_CONTROL.MORPH_MS,
  ease: EASE,
  borderRadius: { duration: 0 },
} as const;
const ICON_SWAP_TRANSITION = {
  duration: 0.18,
  ease: EASE,
} as const;

type ChatControlBarProps = {
  onSend: (message: string) => Promise<void> | void;
  onVoiceToggle: () => void;
  onExitVoice: () => void;
  onVoicePrimaryClick: () => void;
  voiceEnabled: boolean;
  voiceChromeReady: boolean;
  voiceChromeState: VoiceChromeState | null;
  voiceListening: boolean;
  turnCountdownLabel: string;
  onHardCut: () => void;
  onSpeakingInterrupt?: () => void;
  voiceTurnRatio?: number;
  voiceTurnIsAtLimit?: boolean;
  voiceTurnIsSpeaking?: boolean;
  voiceTurnBoundarySignal?: number;
  sessionId?: string;
  onVoiceReconnect?: () => void;
  userTrack?: TrackReferenceOrPlaceholder;
  voiceRoom?: Room;
  disabled?: boolean;
  isLoading?: boolean;
  onChromeHeightChange?: (heightPx: number) => void;
};

function primaryAriaLabel(
  state: VoiceChromeState | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (state) {
    case "loading":
      return t("chat.voiceLoading");
    case "idle":
      return t("chat.startListening");
    case "speaking":
      return t("chat.sendVoiceTurn");
    case "thinking":
      return t("chat.agentThinking");
    case "answering":
      return t("chat.stopResponse");
    case "error":
      return t("chat.endVoice");
    default:
      return t("chat.startVoice");
  }
}

function primaryButtonClass(state: VoiceChromeState | null): string {
  switch (state) {
    case "loading":
      return "bg-muted text-muted-foreground";
    case "idle":
      return "bg-muted text-foreground hover:bg-muted/80";
    case "speaking":
      return "bg-primary text-primary-foreground hover:bg-primary/90";
    case "thinking":
      return "bg-muted text-primary";
    case "answering":
      return "bg-red-600 text-white hover:bg-red-700";
    case "error":
      return "bg-red-600 text-white hover:bg-red-700";
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90";
  }
}

function primaryDisabled(state: VoiceChromeState | null, disabled: boolean): boolean {
  if (disabled) {
    return true;
  }
  return state === "loading" || state === "thinking";
}

export function ChatControlBar({
  onSend,
  onVoiceToggle,
  onExitVoice,
  onVoicePrimaryClick,
  voiceEnabled,
  voiceChromeReady,
  voiceChromeState,
  voiceListening,
  turnCountdownLabel,
  onHardCut,
  onSpeakingInterrupt,
  voiceTurnRatio = 0,
  voiceTurnIsAtLimit = false,
  voiceTurnIsSpeaking = false,
  voiceTurnBoundarySignal = 0,
  sessionId,
  onVoiceReconnect,
  userTrack,
  voiceRoom,
  disabled,
  isLoading,
  onChromeHeightChange,
}: ChatControlBarProps) {
  const { t } = useTranslation();
  const language = useChatStore((state) => normalizeLocale(state.language));
  const voiceReconnectPending = useVoiceChromeStore(
    (state) => state.voiceReconnectPending,
  );
  const agentPhase = useAgentActivityStore((state) => state.phase);
  const [value, setValue] = useState("");
  const [textMetrics, setTextMetrics] = useState<TextareaMetrics>(() => ({
    height: CHAT_CONTROL.TEXT_LINE_PX,
    scrollable: false,
    multiLine: false,
  }));
  const [barMaxWidth, setBarMaxWidth] = useState<number>(CHAT_CONTROL.BAR_MAX_PX);
  const [isDesktop, setIsDesktop] = useState(false);
  const [stackedLayoutLatch, setStackedLayoutLatch] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(Boolean(isLoading));

  const buttonSize = textButtonSize(isDesktop);
  const showSendButton = !voiceEnabled && value.length > 0;
  const isOverLimit = !voiceEnabled && isChatMessageTooLong(value);
  const showTtsFallbackWarning = voiceEnabled && hasTtsFallback(language);
  const showVoiceLanguageSelect = showTtsFallbackWarning;
  const languageSelectDisabled =
    disabled ||
    voiceLanguageSelectLocked(voiceChromeState, voiceReconnectPending);

  const stackedLayout =
    !voiceEnabled &&
    value.length > 0 &&
    (textMetrics.multiLine || stackedLayoutLatch);

  const geometry = computeControlBarGeometry(
    voiceEnabled,
    voiceChromeReady,
    voiceEnabled ? CHAT_CONTROL.TEXT_LINE_PX : textMetrics.height,
    barMaxWidth,
    !voiceEnabled && stackedLayout,
    showSendButton,
    buttonSize,
    voiceListening,
  );

  const showAgentWave =
    voiceEnabled && voiceChromeReady && agentPhase === "responding";

  const keyboardExitEnabled =
    voiceChromeState === "idle" ||
    voiceChromeState === "loading" ||
    voiceChromeState === "error";

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

    const sync = () => {
      setBarMaxWidth(Math.min(anchor.clientWidth, CHAT_CONTROL.BAR_MAX_PX));
      if (onChromeHeightChange) {
        const rect = anchor.getBoundingClientRect();
        const panel = anchor.closest("[data-chat-panel]");
        const bottom =
          panel instanceof HTMLElement
            ? panel.getBoundingClientRect().bottom
            : window.innerHeight;
        onChromeHeightChange(Math.max(0, bottom - rect.top));
      }
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(anchor);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [onChromeHeightChange]);

  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = Boolean(isLoading);

    // Desktop only: restore caret after the agent finishes so the next
    // message can be typed immediately. Mobile must not auto-focus (keyboard).
    if (!isDesktop || voiceEnabled || disabled) {
      return;
    }
    if (wasLoading && !isLoading) {
      textareaRef.current?.focus();
    }
  }, [disabled, isDesktop, isLoading, voiceEnabled]);

  useLayoutEffect(() => {
    if (voiceEnabled) {
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const metrics = measureTextareaMetrics(
      textarea,
      textSlotWidthForBar(
        barMaxWidth,
        buttonSize,
        showSendButton,
        stackedLayout,
      ),
    );
    setStackedLayoutLatch((current) => {
      if (value.length === 0) {
        return false;
      }
      if (metrics.multiLine) {
        return true;
      }
      return current;
    });
    setTextMetrics(metrics);
  }, [voiceEnabled, barMaxWidth, value, showSendButton, buttonSize, stackedLayout]);

  const handleTextChange = useCallback((nextValue: string) => {
    setValue(clampChatInput(nextValue));
  }, []);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading || voiceEnabled || isOverLimit) {
      return;
    }
    setValue("");
    // Mobile: dismiss the keyboard after send. Desktop: keep caret in place
    // (send button click can steal focus; Enter already leaves it on textarea).
    if (isDesktop) {
      textareaRef.current?.focus();
    } else {
      textareaRef.current?.blur();
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

  const handleVoiceLanguageChange = (next: LocaleCode) => {
    void changeAppLanguage(next, {
      sessionId,
      onVoiceReconnect,
    });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-6">
      <div
        ref={anchorRef}
        className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col items-center"
      >
        <AnimatePresence>
          {showVoiceLanguageSelect ? (
            <motion.div
              key="voice-language"
              className="mb-3 flex w-full max-w-xs flex-col items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <label className="sr-only" htmlFor="voice-language-select">
                {t("chat.voiceLanguageLabel")}
              </label>
              <select
                id="voice-language-select"
                value={language}
                disabled={languageSelectDisabled}
                onChange={(event) => {
                  handleVoiceLanguageChange(event.target.value as LocaleCode);
                }}
                className={cn(
                  "h-9 w-full max-w-[12rem] appearance-none rounded-full border bg-card px-4 text-center text-sm text-foreground shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  showTtsFallbackWarning
                    ? "border-amber-500 focus-visible:ring-amber-500/40"
                    : "border-border",
                )}
              >
                {LOCALE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_LABELS[code]}
                  </option>
                ))}
              </select>
              {showTtsFallbackWarning ? (
                <p
                  role="status"
                  className="px-2 text-center text-xs leading-snug text-amber-700 dark:text-amber-400"
                >
                  {t("voice.ttsFallbackWarning")}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showAgentWave ? (
            <motion.div
              key="agent-wave"
              className="mb-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <AgentWaveVisualizer />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {voiceEnabled && voiceListening ? (
          <VoiceTurnProgress
            room={voiceRoom}
            voiceEnabled={voiceEnabled}
            listening={voiceListening}
            ratio={voiceTurnRatio}
            isAtLimit={voiceTurnIsAtLimit}
            isSpeaking={voiceTurnIsSpeaking}
            turnBoundarySignal={voiceTurnBoundarySignal}
            barMaxWidth={geometry.primaryStageSize}
            countdownLabel={turnCountdownLabel}
            onHardCut={onHardCut}
            onSpeakingInterrupt={onSpeakingInterrupt}
          />
        ) : null}

        <motion.div
          className="relative flex items-center justify-center"
          initial={false}
          animate={{
            width: geometry.wrapperWidth,
            height: geometry.wrapperHeight,
          }}
          transition={MORPH_TRANSITION}
        >
          {/* Keyboard sits beside the primary unit — never inside the radial. */}
          {voiceEnabled && geometry.showKeyboard ? (
            <motion.button
              type="button"
              onClick={onExitVoice}
              disabled={disabled || !keyboardExitEnabled}
              aria-label={t("chat.exitToText")}
              className={cn(
                "absolute z-10 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                (disabled || !keyboardExitEnabled) && "opacity-50",
              )}
              initial={false}
              animate={{
                width: geometry.keyboardSize,
                height: geometry.keyboardSize,
                left: geometry.keyboardLeft,
                top: geometry.keyboardTop,
              }}
              transition={MORPH_TRANSITION}
            >
              <Keyboard className="size-5" />
            </motion.button>
          ) : null}

          {/* Primary unit: floating mic + optional user radial (speaking only). */}
          {voiceEnabled ? (
            <motion.div
              className="absolute z-10"
              initial={false}
              animate={{
                width: geometry.primaryStageSize,
                height: geometry.primaryStageSize,
                left: geometry.primaryStageLeft,
                top: geometry.primaryStageTop,
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

              <motion.button
                type="button"
                onClick={onVoicePrimaryClick}
                disabled={primaryDisabled(voiceChromeState, Boolean(disabled))}
                aria-label={primaryAriaLabel(voiceChromeState, t)}
                className={cn(
                  "absolute z-10 flex items-center justify-center rounded-full transition-colors duration-300",
                  primaryButtonClass(voiceChromeState),
                  primaryDisabled(voiceChromeState, Boolean(disabled)) &&
                    "opacity-50",
                  voiceChromeState === "thinking" && "ring-2 ring-primary/40",
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
                {voiceChromeState === "thinking" ? (
                  <span className="relative flex items-center justify-center">
                    <span
                      className="absolute inset-0 animate-ping rounded-full bg-primary/25"
                      aria-hidden
                    />
                    <Lightbulb className="relative size-6" />
                  </span>
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    {voiceChromeState === "loading" ? (
                      <motion.span
                        key="loading"
                        className="flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.45 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.45 }}
                        transition={ICON_SWAP_TRANSITION}
                      >
                        <Loader2 className="size-6 animate-spin" />
                      </motion.span>
                    ) : voiceChromeState === "answering" ? (
                      <motion.span
                        key="stop"
                        className="flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.45 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.45 }}
                        transition={ICON_SWAP_TRANSITION}
                      >
                        <Square className="size-5 fill-white text-white" />
                      </motion.span>
                    ) : voiceChromeState === "error" ? (
                      <motion.span
                        key="error"
                        className="flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.45 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.45 }}
                        transition={ICON_SWAP_TRANSITION}
                      >
                        <X className="size-6" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="mic"
                        className="flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.45 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.45 }}
                        transition={ICON_SWAP_TRANSITION}
                      >
                        <Mic className="size-6" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                )}
              </motion.button>
            </motion.div>
          ) : null}

          <motion.form
            onSubmit={onSubmit}
            className={cn(
              "relative shrink-0 border transition-colors duration-300",
              voiceEnabled
                ? "pointer-events-none overflow-visible border-transparent"
                : cn(
                    "overflow-hidden",
                    isOverLimit ? "border-destructive" : "border-transparent",
                  ),
            )}
            initial={false}
            animate={{
              width: geometry.shellWidth,
              height: geometry.shellHeight,
              borderRadius: geometry.borderRadius,
              opacity: voiceEnabled ? 0 : 1,
            }}
            transition={MORPH_TRANSITION}
            aria-hidden={voiceEnabled}
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

            {!voiceEnabled ? (
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
                    placeholder={t("chat.placeholder")}
                    disabled={disabled}
                    aria-busy={isLoading || undefined}
                    aria-invalid={isOverLimit}
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
                  aria-label={t("chat.startVoice")}
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
                      disabled={disabled || isLoading || isOverLimit}
                      aria-label={t("chat.sendMessage")}
                      className={cn(
                        "absolute z-10 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90",
                        (disabled || isLoading || isOverLimit) && "opacity-50",
                      )}
                      style={{
                        left: geometry.sendLeft,
                        width: geometry.sendSize,
                        height: geometry.sendSize,
                      }}
                      initial={{ x: buttonSize, opacity: 0, top: geometry.sendTop }}
                      animate={{
                        x: 0,
                        opacity: 1,
                        top: geometry.sendTop,
                      }}
                      exit={{ x: buttonSize, opacity: 0 }}
                      transition={SEND_LAYOUT_TRANSITION}
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
            ) : null}
          </motion.form>
        </motion.div>

        <AnimatePresence>
          {isOverLimit ? (
            <motion.p
              key="message-too-long"
              role="alert"
              className="mt-2 px-1 text-center text-xs leading-snug text-destructive"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {t("chat.messageTooLong", { length: CHAT_MESSAGE_MAX })}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <p className="mt-2 px-1 text-center text-xs leading-snug text-muted-foreground/80">
          <Trans
            i18nKey="chat.aiTermsNotice"
            components={{
              termsLink: (
                <Link
                  href="/terms"
                  className="underline underline-offset-2 transition-colors hover:text-muted-foreground"
                />
              ),
            }}
          />
        </p>
      </div>
    </div>
  );
}

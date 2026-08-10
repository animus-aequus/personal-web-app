import { userRadialClusterSize } from "@/components/agents-ui/user-radial-dots";

export const CHAT_CONTROL = {
  BAR_MAX_PX: 672,
  BAR_PADDING_X: 24,
  BAR_PADDING_Y: 16,
  BAR_BUTTON_GAP: 8,
  BAR_TEXT_BUTTON_GAP: 16,
  MIC_VOICE: 56,
  MIC_TEXT: 40,
  MIC_TEXT_DESKTOP: 32,
  VOICE_SIDE_BUTTON: 40,
  VOICE_BUTTON_GAP: 16,
  DESKTOP_MIN_PX: 768,
  TEXT_LINE_PX: 24,
  TEXT_VERTICAL_PADDING_PX: 8,
  TEXT_MAX_PX: 96,
  RADIAL_CLUSTER: userRadialClusterSize(),
  MORPH_MS: 0.45,
} as const;

export function textButtonSize(isDesktop: boolean): number {
  return isDesktop ? CHAT_CONTROL.MIC_TEXT_DESKTOP : CHAT_CONTROL.MIC_TEXT;
}

export function textContentBlockHeight(
  textHeight: number,
  buttonSize: number,
): number {
  return Math.max(
    buttonSize,
    textHeight,
    CHAT_CONTROL.TEXT_LINE_PX,
  );
}

export type ControlBarGeometry = {
  showRadial: boolean;
  showKeyboard: boolean;
  micSize: number;
  keyboardSize: number;
  /** Mic + radial unit only (excludes keyboard). */
  primaryStageSize: number;
  primaryStageLeft: number;
  primaryStageTop: number;
  shellWidth: number;
  shellHeight: number;
  wrapperWidth: number;
  wrapperHeight: number;
  micTop: number;
  micLeft: number;
  keyboardTop: number;
  keyboardLeft: number;
  sendSize: number;
  sendTop: number;
  sendLeft: number;
  textSlotLeft: number;
  textSlotWidth: number;
  textSlotTop: number;
  shellBackgroundOpacity: number;
  borderRadius: number;
};

function inlineControlPositions(
  shellWidth: number,
  shellHeight: number,
  textHeight: number,
  buttonSize: number,
  showSendButton: boolean,
): Pick<
  ControlBarGeometry,
  | "micTop"
  | "micLeft"
  | "keyboardTop"
  | "keyboardLeft"
  | "sendTop"
  | "sendLeft"
  | "textSlotLeft"
  | "textSlotWidth"
  | "textSlotTop"
> {
  const { BAR_PADDING_X, BAR_PADDING_Y, BAR_BUTTON_GAP, BAR_TEXT_BUTTON_GAP } =
    CHAT_CONTROL;

  const contentBlockHeight = textContentBlockHeight(textHeight, buttonSize);
  const sendLeft = shellWidth - BAR_PADDING_X - buttonSize;
  const micLeft = showSendButton
    ? sendLeft - BAR_BUTTON_GAP - buttonSize
    : shellWidth - BAR_PADDING_X - buttonSize;

  return {
    sendLeft,
    sendTop: BAR_PADDING_Y + (contentBlockHeight - buttonSize) / 2,
    micLeft,
    micTop: BAR_PADDING_Y + (contentBlockHeight - buttonSize) / 2,
    keyboardLeft: 0,
    keyboardTop: 0,
    textSlotLeft: BAR_PADDING_X,
    textSlotWidth: Math.max(0, micLeft - BAR_PADDING_X - BAR_TEXT_BUTTON_GAP),
    textSlotTop: BAR_PADDING_Y + (contentBlockHeight - textHeight) / 2,
  };
}

function stackedControlPositions(
  shellWidth: number,
  shellHeight: number,
  textHeight: number,
  buttonSize: number,
  showSendButton: boolean,
): Pick<
  ControlBarGeometry,
  | "micTop"
  | "micLeft"
  | "keyboardTop"
  | "keyboardLeft"
  | "sendTop"
  | "sendLeft"
  | "textSlotLeft"
  | "textSlotWidth"
  | "textSlotTop"
> {
  const { BAR_PADDING_X, BAR_PADDING_Y, BAR_BUTTON_GAP } = CHAT_CONTROL;

  const sendLeft = shellWidth - BAR_PADDING_X - buttonSize;
  const micLeft = showSendButton
    ? sendLeft - BAR_BUTTON_GAP - buttonSize
    : shellWidth - BAR_PADDING_X - buttonSize;
  const controlsTop = shellHeight - BAR_PADDING_Y - buttonSize;

  return {
    sendLeft,
    sendTop: controlsTop,
    micLeft,
    micTop: controlsTop,
    keyboardLeft: 0,
    keyboardTop: 0,
    textSlotLeft: BAR_PADDING_X,
    textSlotWidth: Math.max(0, shellWidth - BAR_PADDING_X * 2),
    textSlotTop: BAR_PADDING_Y,
  };
}

export function computeControlBarGeometry(
  voiceEnabled: boolean,
  voiceChromeReady: boolean,
  textHeight: number,
  barMaxWidth: number,
  stackedLayout: boolean = false,
  showSendButton: boolean = false,
  buttonSize: number = CHAT_CONTROL.MIC_TEXT,
  voiceListening: boolean = false,
): ControlBarGeometry {
  const {
    BAR_PADDING_Y,
    MIC_VOICE,
    RADIAL_CLUSTER,
    VOICE_SIDE_BUTTON,
    VOICE_BUTTON_GAP,
  } = CHAT_CONTROL;

  const showRadial = voiceEnabled && voiceChromeReady && voiceListening;
  const showKeyboard = voiceEnabled;
  const micSize = voiceEnabled ? MIC_VOICE : buttonSize;
  const keyboardSize = VOICE_SIDE_BUTTON;
  const sendSize = buttonSize;

  // Primary stage = mic alone, or mic + radial ring. Keyboard is never inside it.
  const primaryStageSize = showRadial ? RADIAL_CLUSTER : MIC_VOICE;

  // Text-mode chrome only.
  const shellWidth = voiceEnabled ? MIC_VOICE : barMaxWidth;
  const shellHeight = voiceEnabled
    ? MIC_VOICE
    : stackedLayout
      ? BAR_PADDING_Y * 2 +
        CHAT_CONTROL.BAR_TEXT_BUTTON_GAP +
        buttonSize +
        textHeight
      : textContentBlockHeight(textHeight, buttonSize) + BAR_PADDING_Y * 2;

  const wrapperWidth = voiceEnabled
    ? primaryStageSize + 2 * (VOICE_SIDE_BUTTON + VOICE_BUTTON_GAP)
    : shellWidth;
  const wrapperHeight = voiceEnabled
    ? Math.max(VOICE_SIDE_BUTTON, primaryStageSize)
    : shellHeight;

  // Primary (mic + radial) is X-centered; keyboard is a side control to the left
  // and does not shift the visual center (matching gutter on the right).
  const sideGutter = VOICE_SIDE_BUTTON + VOICE_BUTTON_GAP;
  const primaryStageLeft = voiceEnabled ? sideGutter : 0;
  const primaryStageTop = voiceEnabled
    ? (wrapperHeight - primaryStageSize) / 2
    : 0;

  const layoutPositions = voiceEnabled
    ? {
        keyboardLeft: 0,
        keyboardTop: (wrapperHeight - VOICE_SIDE_BUTTON) / 2,
        // Stage-local: mic dead-centered inside radial/mic unit.
        micLeft: (primaryStageSize - MIC_VOICE) / 2,
        micTop: (primaryStageSize - MIC_VOICE) / 2,
        sendLeft: 0,
        sendTop: 0,
        textSlotLeft: CHAT_CONTROL.BAR_PADDING_X,
        textSlotWidth: 0,
        textSlotTop: BAR_PADDING_Y,
      }
    : stackedLayout
      ? stackedControlPositions(
          shellWidth,
          shellHeight,
          textHeight,
          buttonSize,
          showSendButton,
        )
      : inlineControlPositions(
          shellWidth,
          shellHeight,
          textHeight,
          buttonSize,
          showSendButton,
        );

  const borderRadius =
    voiceEnabled || !stackedLayout ? 9999 : shellHeight / 4;

  return {
    showRadial,
    showKeyboard,
    micSize,
    keyboardSize,
    primaryStageSize,
    primaryStageLeft,
    primaryStageTop,
    shellWidth,
    shellHeight,
    wrapperWidth,
    wrapperHeight,
    sendSize,
    ...layoutPositions,
    shellBackgroundOpacity: voiceEnabled ? 0 : showRadial ? 0 : 1,
    borderRadius,
  };
}

export function textSlotWidthForBar(
  barMaxWidth: number,
  buttonSize: number,
  showSendButton: boolean = false,
  stackedLayout: boolean = false,
): number {
  const { BAR_PADDING_X, BAR_BUTTON_GAP, BAR_TEXT_BUTTON_GAP } = CHAT_CONTROL;

  if (stackedLayout) {
    return Math.max(0, barMaxWidth - BAR_PADDING_X * 2);
  }

  const buttonChrome =
    buttonSize + (showSendButton ? BAR_BUTTON_GAP + buttonSize : 0);
  return Math.max(
    0,
    barMaxWidth - BAR_PADDING_X * 2 - BAR_TEXT_BUTTON_GAP - buttonChrome,
  );
}

export type TextareaMetrics = {
  height: number;
  scrollable: boolean;
  multiLine: boolean;
};

export function measureTextareaMetrics(
  element: HTMLTextAreaElement,
  slotWidthPx: number,
  singleLinePx: number = CHAT_CONTROL.TEXT_LINE_PX,
  maxPx: number = CHAT_CONTROL.TEXT_MAX_PX,
): TextareaMetrics {
  const previousHeight = element.style.height;
  const previousWidth = element.style.width;

  element.style.width = `${slotWidthPx}px`;
  element.style.height = "0px";

  const contentHeight = element.scrollHeight;
  const height = Math.max(singleLinePx, Math.min(contentHeight, maxPx));
  const scrollable = contentHeight > maxPx;
  const multiLine =
    contentHeight >
    singleLinePx + CHAT_CONTROL.TEXT_VERTICAL_PADDING_PX;

  element.style.width = previousWidth;
  element.style.height = previousHeight;

  return { height, scrollable, multiLine };
}

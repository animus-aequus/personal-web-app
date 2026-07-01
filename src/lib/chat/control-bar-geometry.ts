import { userRadialClusterSize } from "@/components/agents-ui/user-radial-dots";

export const CHAT_CONTROL = {
  BAR_MAX_PX: 672,
  BAR_PADDING: 8,
  BAR_PADDING_MULTILINE: 10,
  MIC_VOICE: 56,
  MIC_TEXT: 40,
  TEXT_LINE_PX: 24,
  TEXT_VERTICAL_PADDING_PX: 8,
  TEXT_MAX_PX: 96,
  RADIAL_CLUSTER: userRadialClusterSize(),
  MORPH_MS: 0.45,
} as const;

export type ControlBarGeometry = {
  showRadial: boolean;
  micSize: number;
  shellWidth: number;
  shellHeight: number;
  wrapperWidth: number;
  wrapperHeight: number;
  micTop: number;
  micLeft: number;
  textSlotWidth: number;
  textSlotTop: number;
  shellBackgroundOpacity: number;
  borderRadius: number;
};

export function computeControlBarGeometry(
  voiceEnabled: boolean,
  voiceChromeReady: boolean,
  textHeight: number,
  barMaxWidth: number,
  multiLine: boolean = false,
): ControlBarGeometry {
  const { BAR_PADDING, BAR_PADDING_MULTILINE, MIC_VOICE, MIC_TEXT, RADIAL_CLUSTER } =
    CHAT_CONTROL;

  const barPadding =
    !voiceEnabled && multiLine ? BAR_PADDING_MULTILINE : BAR_PADDING;

  const showRadial = voiceEnabled && voiceChromeReady;
  const micSize = voiceEnabled ? MIC_VOICE : MIC_TEXT;

  const shellWidth = voiceEnabled ? MIC_VOICE : barMaxWidth;
  const shellHeight = voiceEnabled
    ? MIC_VOICE
    : Math.max(MIC_TEXT, textHeight) + barPadding * 2;

  const wrapperWidth = voiceEnabled
    ? showRadial
      ? RADIAL_CLUSTER
      : MIC_VOICE
    : shellWidth;
  const wrapperHeight = voiceEnabled
    ? showRadial
      ? RADIAL_CLUSTER
      : MIC_VOICE
    : shellHeight;

  const micTop = (shellHeight - micSize) / 2;
  const micLeft = voiceEnabled
    ? (shellWidth - micSize) / 2
    : shellWidth - barPadding - micSize;

  const textSlotWidth = voiceEnabled
    ? 0
    : Math.max(0, micLeft - barPadding);

  const textSlotTop = barPadding;

  const borderRadius =
    voiceEnabled || !multiLine ? 9999 : shellHeight / 4;

  return {
    showRadial,
    micSize,
    shellWidth,
    shellHeight,
    wrapperWidth,
    wrapperHeight,
    micTop,
    micLeft,
    textSlotWidth,
    textSlotTop,
    shellBackgroundOpacity: showRadial ? 0 : 1,
    borderRadius,
  };
}

export function textSlotWidthForBar(
  barMaxWidth: number,
  barPadding: number = CHAT_CONTROL.BAR_PADDING,
): number {
  const { MIC_TEXT } = CHAT_CONTROL;
  return Math.max(0, barMaxWidth - barPadding * 2 - MIC_TEXT);
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

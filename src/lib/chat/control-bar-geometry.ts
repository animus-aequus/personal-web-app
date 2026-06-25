import { userRadialClusterSize } from "@/components/agents-ui/user-radial-dots";

export const CHAT_CONTROL = {
  BAR_MAX_PX: 672,
  BAR_PADDING: 8,
  MIC_VOICE: 56,
  MIC_TEXT: 40,
  TEXT_LINE_PX: 24,
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
};

export function computeControlBarGeometry(
  voiceEnabled: boolean,
  voiceChromeReady: boolean,
  textHeight: number,
  barMaxWidth: number,
): ControlBarGeometry {
  const { BAR_PADDING, MIC_VOICE, MIC_TEXT, RADIAL_CLUSTER } = CHAT_CONTROL;

  const showRadial = voiceEnabled && voiceChromeReady;
  const micSize = voiceEnabled ? MIC_VOICE : MIC_TEXT;

  const shellWidth = voiceEnabled ? MIC_VOICE : barMaxWidth;
  const shellHeight = voiceEnabled
    ? MIC_VOICE
    : Math.max(MIC_TEXT, textHeight) + BAR_PADDING * 2;

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
    : shellWidth - BAR_PADDING - micSize;

  const textSlotWidth = voiceEnabled
    ? 0
    : Math.max(0, micLeft - BAR_PADDING);

  const textSlotTop = BAR_PADDING;

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
  };
}

export function textSlotWidthForBar(barMaxWidth: number): number {
  const { BAR_PADDING, MIC_TEXT } = CHAT_CONTROL;
  return Math.max(0, barMaxWidth - BAR_PADDING * 2 - MIC_TEXT);
}

export function measureTextareaHeight(
  element: HTMLTextAreaElement,
  slotWidthPx: number,
  singleLinePx: number = CHAT_CONTROL.TEXT_LINE_PX,
  maxPx: number = CHAT_CONTROL.TEXT_MAX_PX,
): number {
  const previousHeight = element.style.height;
  const previousWidth = element.style.width;

  element.style.width = `${slotWidthPx}px`;
  element.style.height = "0px";

  const measured = Math.max(
    singleLinePx,
    Math.min(element.scrollHeight, maxPx),
  );

  element.style.width = previousWidth;
  element.style.height = previousHeight;

  return measured;
}

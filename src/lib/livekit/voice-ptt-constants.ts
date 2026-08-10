/** No STT growth for this long while speaking → auto-commit or empty idle. */
export const VOICE_IDLE_TIMEOUT_MS = 15_000;

/** Max duration of one open speaking turn before forced commit. */
export const VOICE_TURN_MAX_MS = 60_000;

/** Agent thinking without responding → auto barge-in + toast. */
export const VOICE_THINKING_TIMEOUT_MS = 30_000;

export type VoiceChromeState =
  | "loading"
  | "idle"
  | "speaking"
  | "thinking"
  | "answering"
  | "error";

/** Block language selectors while voice is in an active turn or reconnecting. */
export function voiceLanguageSelectLocked(
  state: VoiceChromeState | null,
  reconnectPending = false,
): boolean {
  return (
    reconnectPending ||
    state === "loading" ||
    state === "speaking" ||
    state === "thinking" ||
    state === "answering"
  );
}

export function formatVoiceTurnCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const cappedSeconds = Math.min(
    totalSeconds,
    Math.ceil(VOICE_TURN_MAX_MS / 1000),
  );
  return `0:${cappedSeconds.toString().padStart(2, "0")}`;
}

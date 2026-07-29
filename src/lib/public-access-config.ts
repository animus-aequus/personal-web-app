/** Shared (client + server) contract for the public access pause state. */
export const PAUSED_ERROR_CODE = "assistant_paused";
export const PUBLIC_STATUS_PATH = "/api/public-status";
export const DEFAULT_PAUSE_MESSAGE =
  "Due to high interest, public access to the assistant is temporarily paused.";

export type PublicAccessStatus = {
  paused: boolean;
  message: string | null;
};

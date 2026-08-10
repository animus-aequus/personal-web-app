/** Shared (client + server) contract for the public access pause state. */
export const PAUSED_ERROR_CODE = "assistant_paused";
export const INVITE_INVALID_ERROR_CODE = "invite_invalid";
export const PUBLIC_STATUS_PATH = "/api/public-status";
export const DEFAULT_PAUSE_MESSAGE =
  "Due to high interest, access to the assistant is temporarily paused.";

export type SessionType = "public" | "invited";

export type PublicAccessBucketStatus = {
  paused: boolean;
  message: string | null;
};

export type PublicAccessStatus = {
  byType: Record<SessionType, PublicAccessBucketStatus>;
};

export function emptyPublicAccessStatus(): PublicAccessStatus {
  const idle: PublicAccessBucketStatus = { paused: false, message: null };
  return {
    byType: { public: idle, invited: { ...idle } },
  };
}

export function bucketForType(
  status: PublicAccessStatus,
  sessionType: SessionType,
): PublicAccessBucketStatus {
  return status.byType[sessionType] ?? { paused: false, message: null };
}

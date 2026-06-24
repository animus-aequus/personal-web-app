export const LIVEKIT_ROOM_PREFIX = "web-";
/** Separates chat session id from a per-connection suffix in LiveKit room names. */
export const LIVEKIT_VOICE_CONNECTION_SEPARATOR = "--";

export function livekitRoomName(sessionId: string): string {
  return `${LIVEKIT_ROOM_PREFIX}${sessionId}`;
}

/** Unique LiveKit room per voice connect so agent dispatch runs on every start(). */
export function livekitVoiceRoomName(
  sessionId: string,
  connectionId: string,
): string {
  return `${livekitRoomName(sessionId)}${LIVEKIT_VOICE_CONNECTION_SEPARATOR}${connectionId}`;
}

export function sessionIdFromRoomName(roomName: string): string | null {
  if (!roomName.startsWith(LIVEKIT_ROOM_PREFIX)) {
    return null;
  }
  const raw = roomName.slice(LIVEKIT_ROOM_PREFIX.length);
  const sessionPart = raw.includes(LIVEKIT_VOICE_CONNECTION_SEPARATOR)
    ? raw.split(LIVEKIT_VOICE_CONNECTION_SEPARATOR, 1)[0]
    : raw;
  return sessionPart || null;
}

export const LIVEKIT_ROOM_PREFIX = "web-";

export function livekitRoomName(sessionId: string): string {
  return `${LIVEKIT_ROOM_PREFIX}${sessionId}`;
}

export function sessionIdFromRoomName(roomName: string): string | null {
  if (!roomName.startsWith(LIVEKIT_ROOM_PREFIX)) {
    return null;
  }
  return roomName.slice(LIVEKIT_ROOM_PREFIX.length);
}

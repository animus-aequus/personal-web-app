import { TokenSourceRequest } from "@livekit/protocol";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
  type VideoGrant,
} from "livekit-server-sdk";
import { NextResponse } from "next/server";

import { livekitRoomName, sessionIdFromRoomName } from "@/lib/livekit/room";

export const revalidate = 0;

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_AGENT_NAME =
  process.env.LIVEKIT_AGENT_NAME ?? "personal-voice-agent";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const livekitUrl = requireEnv("LIVEKIT_URL", LIVEKIT_URL);
    const apiKey = requireEnv("LIVEKIT_API_KEY", LIVEKIT_API_KEY);
    const apiSecret = requireEnv("LIVEKIT_API_SECRET", LIVEKIT_API_SECRET);

    const rawBody = await request.json();
    const tokenRequest = TokenSourceRequest.fromJson(rawBody, {
      ignoreUnknownFields: true,
    });

    const roomName =
      tokenRequest.roomName ??
      (tokenRequest.participantMetadata
        ? livekitRoomName(tokenRequest.participantMetadata)
        : undefined);

    if (!roomName) {
      throw new Error("room_name is required");
    }

    const sessionId =
      tokenRequest.participantMetadata?.trim() ||
      sessionIdFromRoomName(roomName) ||
      "unknown";

    const roomConfig = new RoomConfiguration({
      metadata: JSON.stringify({ session_id: sessionId }),
      agents: [new RoomAgentDispatch({ agentName: LIVEKIT_AGENT_NAME })],
    });

    const identity =
      tokenRequest.participantIdentity ?? `user-${sessionId.slice(0, 12)}`;
    const participantName = tokenRequest.participantName ?? "User";

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      metadata: tokenRequest.participantMetadata,
      ttl: "30m",
    });
    token.addGrant(grant);
    token.roomConfig = roomConfig;

    return NextResponse.json(
      {
        serverUrl: livekitUrl,
        participantToken: await token.toJwt(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

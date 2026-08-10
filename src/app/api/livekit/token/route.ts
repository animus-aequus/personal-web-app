import { TokenSourceRequest } from "@livekit/protocol";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
  type VideoGrant,
} from "livekit-server-sdk";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyAgentSession } from "@/lib/agent-client";
import { livekitRoomName, sessionIdFromRoomName } from "@/lib/livekit/room";
import {
  parseVoiceLanguage,
  type VoiceLanguageCode,
} from "@/lib/livekit/voice-languages";
import { getClientIp } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

function resolveVoiceLanguage(agentMetadata: unknown): VoiceLanguageCode {
  if (typeof agentMetadata !== "string" || !agentMetadata.trim()) {
    return "en";
  }
  try {
    const parsed = JSON.parse(agentMetadata) as { voice_language?: unknown };
    return parseVoiceLanguage(parsed?.voice_language);
  } catch {
    return "en";
  }
}

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
  // Pause is enforced on the agent voice turn path by session_type.
  try {
    const livekitUrl = requireEnv("LIVEKIT_URL", LIVEKIT_URL);
    const apiKey = requireEnv("LIVEKIT_API_KEY", LIVEKIT_API_KEY);
    const apiSecret = requireEnv("LIVEKIT_API_SECRET", LIVEKIT_API_SECRET);

    const rawBody = (await request.json()) as Record<string, unknown> & {
      [key: string]: unknown;
    };

    const tokenRequest = TokenSourceRequest.fromJson(
      rawBody as Parameters<typeof TokenSourceRequest.fromJson>[0],
      {
        ignoreUnknownFields: true,
      },
    );

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

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled()) {
      if (!sessionSecret) {
        return missingSessionSecretResponse();
      }
      await verifyAgentSession(sessionId, {
        clientIp: getClientIp(request),
        sessionSecret,
      });
    }

    const voiceLanguage = resolveVoiceLanguage(rawBody.agentMetadata);
    const agentJobMetadata = JSON.stringify({ voice_language: voiceLanguage });

    const roomConfig = new RoomConfiguration({
      // Include voice_language on the room as a fallback if job metadata is empty.
      metadata: JSON.stringify({
        session_id: sessionId,
        voice_language: voiceLanguage,
      }),
      agents: [
        new RoomAgentDispatch({
          agentName: LIVEKIT_AGENT_NAME,
          metadata: agentJobMetadata,
        }),
      ],
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
    const status = message.includes("(401)") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

"use client";

import type { ReactNode } from "react";

import {
  RoomAudioRenderer,
  SessionProvider,
  type UseSessionReturn,
} from "@livekit/components-react";

type AgentSessionProviderProps = {
  session: UseSessionReturn;
  children: ReactNode;
};

/** Thin wrapper matching LiveKit Agents UI naming conventions. */
export function AgentSessionProvider({
  session,
  children,
}: AgentSessionProviderProps) {
  return (
    <SessionProvider session={session}>
      <RoomAudioRenderer room={session.room} />
      {children}
    </SessionProvider>
  );
}

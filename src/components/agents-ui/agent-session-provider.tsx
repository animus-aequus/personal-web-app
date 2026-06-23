"use client";

import type { ReactNode } from "react";

import {
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
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

"use client";

import type { ReactNode } from "react";

import { RouteAccessGate } from "@/components/access/route-access-gate";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <RouteAccessGate>{children}</RouteAccessGate>;
}

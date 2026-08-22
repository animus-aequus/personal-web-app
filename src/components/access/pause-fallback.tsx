"use client";

import { PublicPauseModal } from "@/components/chat/public-pause-modal";
import type { AccessFallbackProps } from "@/lib/access/types";

export function PauseFallback({ onDismiss }: AccessFallbackProps) {
  return <PublicPauseModal onAcknowledge={onDismiss} />;
}

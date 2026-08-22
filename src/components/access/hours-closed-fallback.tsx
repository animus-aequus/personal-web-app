"use client";

import { HoursClosedModal } from "@/components/chat/hours-closed-modal";
import type { AccessFallbackProps } from "@/lib/access/types";
import type { OperatingHoursStatus } from "@/lib/operating-hours-config";

export function HoursClosedFallback({ payload, onDismiss }: AccessFallbackProps) {
  const hours = payload as OperatingHoursStatus | undefined;
  if (!hours) {
    return null;
  }
  return <HoursClosedModal operatingHours={hours} onAcknowledge={onDismiss} />;
}

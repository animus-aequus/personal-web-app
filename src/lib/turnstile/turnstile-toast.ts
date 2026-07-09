"use client";

import { toast } from "sonner";

import { TURNSTILE_ERROR_CODE } from "@/lib/turnstile/turnstile-config";

const TURNSTILE_TOAST_MESSAGE =
  "Verification failed. Please try again.";

export function showTurnstileErrorToast(): void {
  toast.error(TURNSTILE_TOAST_MESSAGE);
}

export async function responseIndicatesTurnstileFailure(
  response: Response,
): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }

  try {
    const data = (await response.clone().json()) as { error?: string };
    return data.error === TURNSTILE_ERROR_CODE;
  } catch {
    return false;
  }
}

export async function notifyTurnstileFailureIfNeeded(
  response: Response,
): Promise<boolean> {
  const failed = await responseIndicatesTurnstileFailure(response);
  if (failed) {
    showTurnstileErrorToast();
  }
  return failed;
}

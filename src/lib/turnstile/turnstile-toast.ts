"use client";

import { toast } from "sonner";

import i18n from "@/lib/i18n/client";
import { TURNSTILE_ERROR_CODE } from "@/lib/turnstile/turnstile-config";

export function showTurnstileErrorToast(): void {
  toast.error(i18n.t("turnstile.verificationFailed"));
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

import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/rate-limit";
import {
  TURNSTILE_ERROR_CODE,
  loadTurnstileConfig,
} from "@/lib/turnstile/turnstile-config";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

let warnedMissingKeys = false;

async function verifyToken(
  token: string,
  remoteIp: string | undefined,
): Promise<boolean> {
  const config = loadTurnstileConfig();
  if (!config.secretKey) {
    return false;
  }

  const params = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });
  if (remoteIp) {
    params.set("remoteip", remoteIp);
  }

  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as SiteVerifyResponse;
  return data.success === true;
}

function turnstileFailedResponse(): NextResponse {
  return NextResponse.json(
    { error: TURNSTILE_ERROR_CODE },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

function turnstileUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "turnstile_unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** Returns a NextResponse when verification fails; null when the request may proceed. */
export async function enforceTurnstile(
  request: Request,
  token: string | undefined,
): Promise<NextResponse | null> {
  const config = loadTurnstileConfig();

  if (!config.enabled) {
    if (
      config.failClosed &&
      !config.secretKey &&
      !warnedMissingKeys
    ) {
      warnedMissingKeys = true;
      console.error(
        "Turnstile is fail-closed but TURNSTILE_SECRET_KEY is missing",
      );
    }
    if (config.failClosed && !config.secretKey) {
      return turnstileUnavailableResponse();
    }
    return null;
  }

  if (!token?.trim()) {
    return turnstileFailedResponse();
  }

  const remoteIp = getClientIp(request);
  const valid = await verifyToken(token.trim(), remoteIp);
  if (!valid) {
    return turnstileFailedResponse();
  }

  return null;
}

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { notifyLangSmithAlert } from "@/lib/agent-client";

export const revalidate = 0;

type LangSmithAlertPayload = {
  alert_rule_name?: string;
  project_name?: string;
  triggered_metric_value?: number | string;
  triggered_threshold?: number | string;
};

function secretMatches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

function toAmount(value: number | string | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * LangSmith cost-alert webhook → Telegram notify only (does not pause access).
 * Only Cost alerts should point here. The agent API stays behind Cloudflare
 * Access; LangSmith hits this BFF proxy instead. LangSmith may send an empty
 * body on test delivery; cost/threshold fields are optional when absent.
 */
export async function POST(request: Request) {
  const expected = process.env.LANGSMITH_WEBHOOK_SECRET?.trim();
  if (!expected) {
    console.error("[langsmith-webhook] LANGSMITH_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request
    .json()
    .catch(() => ({}))) as LangSmithAlertPayload;

  try {
    const result = await notifyLangSmithAlert({
      costUsd: toAmount(payload.triggered_metric_value),
      thresholdUsd: toAmount(payload.triggered_threshold),
      alertName: payload.alert_rule_name?.trim() || undefined,
      projectName: payload.project_name?.trim() || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[langsmith-webhook] notify failed", error);
    // 5xx so LangSmith retries the delivery.
    return NextResponse.json({ error: "notify_failed" }, { status: 500 });
  }
}

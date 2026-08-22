import { NextResponse } from "next/server";

import { getAppConfig } from "@/lib/app-config";

export const revalidate = 0;

/** Read-only app config for the UI access gate (Postgres via BFF, not the agent). */
export async function GET() {
  const config = await getAppConfig();
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}

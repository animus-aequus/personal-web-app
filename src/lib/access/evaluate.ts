import { getAccessCondition, ROUTE_CONDITIONS } from "@/lib/access/catalog";
import type { AccessEvalContext, AccessVerdict } from "@/lib/access/types";

function catalogPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

/**
 * Sequential AND. First fail wins; later conditions are not evaluated.
 */
export async function evaluateRouteAccess(
  pathname: string,
  signal: AbortSignal,
): Promise<AccessVerdict> {
  const ids = ROUTE_CONDITIONS[catalogPath(pathname)] ?? [];
  const ctx: AccessEvalContext = { pathname, signal };

  for (const id of ids) {
    if (signal.aborted) {
      return { status: "pass" };
    }
    const verdict = await getAccessCondition(id).evaluate(ctx);
    if (verdict.status === "fail") {
      return verdict;
    }
  }

  return { status: "pass" };
}

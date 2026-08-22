"use client";

import { useEffect, useRef, useState } from "react";

import { evaluateRouteAccess } from "@/lib/access/evaluate";
import type { RouteAccessState } from "@/lib/access/types";

export function useRouteAccess(pathname: string): RouteAccessState {
  const [completed, setCompleted] = useState<{
    pathname: string;
    state: Exclude<RouteAccessState, { status: "checking" }>;
  } | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const controller = new AbortController();

    void (async () => {
      const verdict = await evaluateRouteAccess(pathname, controller.signal);
      if (runId !== runIdRef.current || controller.signal.aborted) {
        return;
      }
      if (verdict.status === "fail") {
        setCompleted({
          pathname,
          state: { status: "blocked", fallback: verdict.fallback },
        });
        return;
      }
      setCompleted({ pathname, state: { status: "allowed" } });
    })();

    return () => {
      runIdRef.current += 1;
      controller.abort();
    };
  }, [pathname]);

  if (completed?.pathname !== pathname) {
    return { status: "checking" };
  }
  return completed.state;
}

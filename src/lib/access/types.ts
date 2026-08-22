import type { ComponentType } from "react";

export type AccessDismissAction =
  | { type: "none" }
  | { type: "redirect"; to: string };

export type AccessFallbackProps = {
  payload?: unknown;
  onDismiss: () => void;
};

export type AccessFallback = {
  Component: ComponentType<AccessFallbackProps>;
  dismissAction: AccessDismissAction;
  payload?: unknown;
};

export type AccessVerdict =
  | { status: "pass" }
  | { status: "fail"; fallback: AccessFallback };

export type AccessEvalContext = {
  pathname: string;
  signal: AbortSignal;
};

export type AccessCondition = {
  id: string;
  evaluate: (ctx: AccessEvalContext) => Promise<AccessVerdict>;
};

export type RouteAccessStatus = "checking" | "allowed" | "blocked";

export type RouteAccessState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "blocked"; fallback: AccessFallback };

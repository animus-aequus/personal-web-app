"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";

import { ChatSessionLoading } from "@/components/chat/chat-panel";
import { useRouteAccess } from "@/lib/access/use-route-access";

type RouteAccessGateProps = {
  children: ReactNode;
};

export function RouteAccessGate({ children }: RouteAccessGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const access = useRouteAccess(pathname);

  const onDismiss = useCallback(() => {
    if (access.status !== "blocked") {
      return;
    }
    const action = access.fallback.dismissAction;
    if (action.type === "redirect") {
      router.push(action.to);
    }
  }, [access, router]);

  if (access.status === "checking") {
    return <ChatSessionLoading />;
  }

  if (access.status === "blocked") {
    const Fallback = access.fallback.Component;
    return (
      <Fallback
        payload={access.fallback.payload}
        onDismiss={onDismiss}
      />
    );
  }

  return children;
}

import { PauseFallback } from "@/components/access/pause-fallback";
import { peekInviteToken, resolvePauseGateType } from "@/lib/chat/invite-token";
import { ABOUT_ME_PATH } from "@/lib/site-paths";
import { bucketForType } from "@/lib/public-access-config";
import type { AccessCondition } from "@/lib/access/types";
import { useChatStore } from "@/lib/stores/chat-store";
import { fetchPublicStatus, usePublicPauseStore } from "@/lib/stores/public-pause-store";

export const pauseCondition: AccessCondition = {
  id: "pause",
  async evaluate({ signal }) {
    await useChatStore.persist.rehydrate();
    if (signal.aborted) {
      return { status: "pass" };
    }

    const inviteToken = peekInviteToken();
    const { sessionId, sessionType } = useChatStore.getState();
    const gateType = resolvePauseGateType(inviteToken, sessionType, sessionId);
    const status = await fetchPublicStatus();
    if (signal.aborted) {
      return { status: "pass" };
    }

    usePublicPauseStore.getState().setStatus(status, gateType);
    if (!bucketForType(status, gateType).paused) {
      return { status: "pass" };
    }

    return {
      status: "fail",
      fallback: {
        Component: PauseFallback,
        dismissAction: { type: "redirect", to: ABOUT_ME_PATH },
      },
    };
  },
};

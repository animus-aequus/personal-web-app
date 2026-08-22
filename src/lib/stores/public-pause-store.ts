"use client";

import { create } from "zustand";

import {
  PUBLIC_STATUS_PATH,
  bucketForType,
  emptyPublicAccessStatus,
  type PublicAccessBucketStatus,
  type PublicAccessStatus,
  type SessionType,
} from "@/lib/public-access-config";

type PublicPauseStore = {
  status: PublicAccessStatus;
  /** Bucket currently gating the UI (public vs invited). */
  activeType: SessionType;
  /** True once the visitor acknowledged the modal. */
  dismissed: boolean;
  setStatus: (status: PublicAccessStatus, activeType?: SessionType) => void;
  setActiveType: (activeType: SessionType) => void;
  dismiss: () => void;
};

export const usePublicPauseStore = create<PublicPauseStore>((set) => ({
  status: emptyPublicAccessStatus(),
  activeType: "public",
  dismissed: false,
  setStatus: (status, activeType) =>
    set((state) => {
      const nextType = activeType ?? state.activeType;
      const wasPaused = bucketForType(state.status, state.activeType).paused;
      const nowPaused = bucketForType(status, nextType).paused;
      return {
        status,
        activeType: nextType,
        dismissed: nowPaused && wasPaused ? state.dismissed : false,
      };
    }),
  setActiveType: (activeType) => set({ activeType }),
  dismiss: () => set({ dismissed: true }),
}));

function pausedBucket(paused: boolean): PublicAccessBucketStatus {
  return { paused, message: null };
}

/** Keep local/forced pause when a stale BFF read would report not paused yet. */
function mergePauseStatus(
  current: PublicAccessStatus,
  remote: PublicAccessStatus,
  forcedType: SessionType,
): PublicAccessStatus {
  return {
    byType: {
      public: pausedBucket(
        current.byType.public.paused ||
          remote.byType.public.paused ||
          forcedType === "public",
      ),
      invited: pausedBucket(
        current.byType.invited.paused ||
          remote.byType.invited.paused ||
          forcedType === "invited",
      ),
    },
  };
}

/** Reads the BFF pause state; fails open so a status glitch never blocks chat. */
export async function fetchPublicStatus(options?: {
  refresh?: boolean;
}): Promise<PublicAccessStatus> {
  try {
    const query = options?.refresh ? "?refresh=1" : "";
    const response = await fetch(`${PUBLIC_STATUS_PATH}${query}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return emptyPublicAccessStatus();
    }
    const data = (await response.json()) as Partial<PublicAccessStatus>;
    if (data.byType?.public && data.byType?.invited) {
      return { byType: data.byType };
    }
    return emptyPublicAccessStatus();
  } catch {
    return emptyPublicAccessStatus();
  }
}

/** Re-reads the pause state after a request failed; true when active bucket paused. */
export async function refreshPublicPauseState(
  activeType: SessionType = "public",
): Promise<boolean> {
  const status = await fetchPublicStatus({ refresh: true });
  usePublicPauseStore.getState().setStatus(status, activeType);
  return bucketForType(status, activeType).paused;
}

/**
 * Mid-turn pause (503 / voice ui_events): show modal immediately, then refresh
 * without clearing the forced bucket when BFF cache lags.
 */
export async function applyAssistantPaused(
  activeType: SessionType = "public",
): Promise<void> {
  const store = usePublicPauseStore.getState();
  const optimistic = mergePauseStatus(
    store.status,
    emptyPublicAccessStatus(),
    activeType,
  );
  store.setStatus(optimistic, activeType);

  const remote = await fetchPublicStatus({ refresh: true });
  usePublicPauseStore
    .getState()
    .setStatus(mergePauseStatus(optimistic, remote, activeType), activeType);
}

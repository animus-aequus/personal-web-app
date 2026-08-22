import { pauseCondition } from "@/lib/access/conditions/pause";
import type { AccessCondition } from "@/lib/access/types";
import { CHAT_PATH } from "@/lib/site-paths";

const CONDITIONS: Record<string, AccessCondition> = {
  [pauseCondition.id]: pauseCondition,
};

/** Ordered AND lists. Paths omitted here skip the engine (static pages). */
export const ROUTE_CONDITIONS: Record<string, string[]> = {
  [CHAT_PATH]: [pauseCondition.id],
};

export function getAccessCondition(id: string): AccessCondition {
  const condition = CONDITIONS[id];
  if (!condition) {
    throw new Error(`Unknown access condition: ${id}`);
  }
  return condition;
}

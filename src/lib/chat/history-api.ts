"use client";

import type { HistoryMessage, HistoryPageResponse } from "@/lib/agent-client";
import { HISTORY_PAGE_SIZE } from "@/lib/agent-client";
import type { ChatMessage } from "@/lib/stores/chat-store";

export type HistoryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "loading_more"
  | "exhausted"
  | "error";

export function historyMessageToChatMessage(message: HistoryMessage): ChatMessage {
  const parsed = Date.parse(message.sent_at);
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    source: "text",
    timestamp: Number.isNaN(parsed) ? Date.now() : parsed,
    interrupted: message.interrupted ?? false,
  };
}

export async function fetchHistoryPage(
  sessionId: string,
  options?: { before?: string; limit?: number },
): Promise<HistoryPageResponse> {
  const params = new URLSearchParams({ sessionId });
  const limit = options?.limit ?? HISTORY_PAGE_SIZE;
  params.set("limit", String(limit));
  if (options?.before) {
    params.set("before", options.before);
  }

  const response = await fetch(`/api/session/messages?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`History fetch failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export function mergeMessagesById(...groups: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const group of groups) {
    for (const message of group) {
      byId.set(message.id, message);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function prependUniqueMessages(
  existing: ChatMessage[],
  older: ChatMessage[],
): ChatMessage[] {
  const seen = new Set(existing.map((message) => message.id));
  const prepended = older.filter((message) => !seen.has(message.id));
  if (prepended.length === 0) {
    return existing;
  }
  return [...prepended, ...existing].sort((a, b) => a.timestamp - b.timestamp);
}

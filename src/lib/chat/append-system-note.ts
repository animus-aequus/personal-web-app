import type { SystemNoteInfo } from "@/lib/agent-client";
import type { ChatMessage } from "@/lib/stores/chat-store";

/** Appends a system-note row immediately, without waiting for a history refetch. */
export type OnSystemNote = (
  message: Omit<ChatMessage, "timestamp"> & { timestamp?: number },
) => void;

export function appendSystemNote(
  onNote: OnSystemNote | undefined,
  note?: SystemNoteInfo | null,
): void {
  if (!onNote || !note) {
    return;
  }
  const parsed = Date.parse(note.sent_at);
  onNote({
    id: note.id,
    role: "system-note",
    content: note.label,
    kind: note.kind,
    params: note.params ?? undefined,
    source: "text",
    timestamp: Number.isNaN(parsed) ? Date.now() : parsed,
  });
}

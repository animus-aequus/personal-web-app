"use client";

import { toast } from "sonner";

import i18n from "@/lib/i18n/client";

/** Saved session could not be resumed; a fresh one replaced it. */
export function showSessionRepairedToast(): void {
  toast.info(i18n.t("chat.sessionRepaired"));
}

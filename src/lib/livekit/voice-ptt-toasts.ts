import { toast } from "sonner";

import i18n from "@/lib/i18n/client";

export function showVoiceEmptyTurnToast(): void {
  toast.warning(i18n.t("chat.voiceEmptyTurn"));
}

export function showVoiceSomethingWentWrongToast(): void {
  toast.error(i18n.t("chat.voiceSomethingWentWrong"));
}

export function showVoiceThinkingTooLongToast(): void {
  toast.error(i18n.t("chat.voiceThinkingTooLong"));
}

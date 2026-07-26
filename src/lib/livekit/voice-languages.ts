/** Voice STT/TTS language options for LiveKit web voice. */

export const VOICE_LANGUAGE_CODES = ["en", "pl", "de", "es", "fr"] as const;

export type VoiceLanguageCode = (typeof VOICE_LANGUAGE_CODES)[number];

export type VoiceLanguageOption = {
  code: VoiceLanguageCode;
  label: string;
  /** When false, agent replies in English and Aura TTS uses the English voice. */
  ttsSupported: boolean;
};

export const VOICE_LANGUAGES: readonly VoiceLanguageOption[] = [
  { code: "en", label: "English", ttsSupported: true },
  { code: "pl", label: "Polski", ttsSupported: false },
  { code: "de", label: "Deutsch", ttsSupported: true },
  { code: "es", label: "Español", ttsSupported: true },
  { code: "fr", label: "Français", ttsSupported: true },
] as const;

export const DEFAULT_VOICE_LANGUAGE: VoiceLanguageCode = "en";

export const TTS_FALLBACK_WARNING =
  "Voice replies in this language are not supported yet. The agent will answer in English.";

export function isVoiceLanguageCode(value: unknown): value is VoiceLanguageCode {
  return (
    typeof value === "string" &&
    (VOICE_LANGUAGE_CODES as readonly string[]).includes(value)
  );
}

export function getVoiceLanguageOption(
  code: VoiceLanguageCode,
): VoiceLanguageOption {
  const option = VOICE_LANGUAGES.find((entry) => entry.code === code);
  return option ?? VOICE_LANGUAGES[0];
}

/** True when STT uses this language but TTS/replies fall back to English. */
export function hasTtsFallback(code: VoiceLanguageCode): boolean {
  return !getVoiceLanguageOption(code).ttsSupported;
}

export function parseVoiceLanguage(
  value: unknown,
  fallback: VoiceLanguageCode = DEFAULT_VOICE_LANGUAGE,
): VoiceLanguageCode {
  return isVoiceLanguageCode(value) ? value : fallback;
}

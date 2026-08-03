/** Voice STT/TTS capabilities per locale (LiveKit web voice). */

import {
  isLocaleCode,
  LOCALE_CODES,
  type LocaleCode,
} from "@/lib/i18n/locales";

export type VoiceLanguageCode = LocaleCode;

export const VOICE_LANGUAGE_CODES = LOCALE_CODES;

/** When false, agent replies in English and Aura TTS uses the English voice. */
export const VOICE_TTS_SUPPORTED: Record<LocaleCode, boolean> = {
  en: true,
  pl: false,
  de: true,
  es: true,
  fr: true,
};

export function isVoiceLanguageCode(value: unknown): value is VoiceLanguageCode {
  return isLocaleCode(value);
}

/** True when STT uses this language but TTS/replies fall back to English. */
export function hasTtsFallback(code: LocaleCode): boolean {
  return !VOICE_TTS_SUPPORTED[code];
}

export function parseVoiceLanguage(
  value: unknown,
  fallback: VoiceLanguageCode = "en",
): VoiceLanguageCode {
  return isVoiceLanguageCode(value) ? value : fallback;
}

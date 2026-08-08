/** Voice STT/TTS capabilities per locale (LiveKit web voice). */

import {
  isLocaleCode,
  LOCALE_CODES,
  type LocaleCode,
} from "@/lib/i18n/locales";

export type VoiceLanguageCode = LocaleCode;

export const VOICE_LANGUAGE_CODES = LOCALE_CODES;

/** When false, voice TTS and spoken replies are not fully supported for this locale. */
export const VOICE_TTS_SUPPORTED: Record<LocaleCode, boolean> = {
  en: true,
  pl: true,
  de: true,
  es: true,
  fr: true,
};

export function isVoiceLanguageCode(value: unknown): value is VoiceLanguageCode {
  return isLocaleCode(value);
}

/** True when STT uses this language but TTS/replies are not fully supported. */
export function hasTtsFallback(code: LocaleCode): boolean {
  return !VOICE_TTS_SUPPORTED[code];
}

export function parseVoiceLanguage(
  value: unknown,
  fallback: VoiceLanguageCode = "en",
): VoiceLanguageCode {
  return isVoiceLanguageCode(value) ? value : fallback;
}

"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "@/lib/i18n/client";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import { useChatStore } from "@/lib/stores/chat-store";

function syncDocumentLanguage(language: LocaleCode): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

type I18nProviderProps = {
  children: React.ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
  const language = useChatStore((state) => state.language);

  useEffect(() => {
    const resolved = normalizeLocale(language, DEFAULT_LOCALE);
    if (i18n.language !== resolved) {
      void i18n.changeLanguage(resolved);
    }
    syncDocumentLanguage(resolved);
  }, [language]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export { syncDocumentLanguage };

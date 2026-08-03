import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { de } from "@/lib/i18n/messages/de";
import { en } from "@/lib/i18n/messages/en";
import { es } from "@/lib/i18n/messages/es";
import { fr } from "@/lib/i18n/messages/fr";
import { pl } from "@/lib/i18n/messages/pl";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

const resources = {
  en: { translation: en },
  pl: { translation: pl },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;

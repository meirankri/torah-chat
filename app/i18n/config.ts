import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./fr.json";
import en from "./en.json";
import he from "./he.json";

export const SUPPORTED_LANGUAGES = ["fr", "en", "he"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const RTL_LANGUAGES: SupportedLanguage[] = ["he"];
export const DEFAULT_LANGUAGE: SupportedLanguage = "fr";

export const LANGUAGE_COOKIE = "torah-chat-lang";

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as SupportedLanguage);
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
        he: { translation: he },
      },
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      detection: {
        order: ["cookie", "navigator"],
        lookupCookie: LANGUAGE_COOKIE,
        caches: ["cookie"],
        cookieOptions: { path: "/", sameSite: "lax" },
      },
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;

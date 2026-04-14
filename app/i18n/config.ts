import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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

/**
 * Detect user language from cookie or navigator.
 * Must be called client-side only (after hydration).
 */
export function detectLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.split("=")[1];
  const candidate = cookie ?? navigator.language.split("-")[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(candidate ?? "")
    ? (candidate as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      // Always start with default language to match SSR output — language is
      // applied client-side in root.tsx useEffect to avoid hydration mismatch.
      lng: DEFAULT_LANGUAGE,
      resources: {
        fr: { translation: fr },
        en: { translation: en },
        he: { translation: he },
      },
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      interpolation: {
        escapeValue: false,
      },
    });
}

export default i18n;

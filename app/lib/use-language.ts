import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_COOKIE,
  isRTL,
} from "~/i18n/config";

export function useLanguage() {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language as SupportedLanguage;
  const rtl = isRTL(currentLanguage);

  const changeLanguage = useCallback(
    (lang: SupportedLanguage) => {
      i18n.changeLanguage(lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
      // Persist preference in cookie (read by detectLanguage() on next load)
      document.cookie = `${LANGUAGE_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // Also persist in user profile if authenticated (fire-and-forget)
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {
        // Non-blocking — cookie is the source of truth for unauthenticated users
      });
    },
    [i18n]
  );

  return {
    currentLanguage,
    rtl,
    changeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}

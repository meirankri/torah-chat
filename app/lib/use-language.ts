import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
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

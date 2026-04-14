import { useTranslation } from "react-i18next";
import { useLanguage } from "~/lib/use-language";
import type { SupportedLanguage } from "~/i18n/config";

export function LanguageSelector() {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <select
      value={currentLanguage}
      onChange={(e) => changeLanguage(e.target.value as SupportedLanguage)}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      aria-label={t("language.selector")}
    >
      {supportedLanguages.map((lang) => (
        <option key={lang} value={lang}>
          {t(`language.${lang}`)}
        </option>
      ))}
    </select>
  );
}

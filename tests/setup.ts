import "@testing-library/jest-dom/vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "../app/i18n/fr.json";
import en from "../app/i18n/en.json";
import he from "../app/i18n/he.json";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: "fr",
    fallbackLng: "fr",
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      he: { translation: he },
    },
    interpolation: { escapeValue: false },
  });
}

import { I18n } from "i18n-js";
import en from "./en";
import ar from "./ar";

// Create new I18n instance
const i18n = new I18n();

// Set translations
i18n.translations = {
  en,
  ar,
};

// Set default locale to English
i18n.locale = "en";
i18n.fallbacks = true;

export default i18n;

// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importe seus arquivos de tradução
import translationEN from './locales/en/translation.json';
import translationPT from './locales/pt/translation.json';
import translationFR from './locales/fr/translation.json';
import translationES from './locales/es/translation.json';

const resources = {
  en: {
    translation: translationEN,
  },
  pt: {
    translation: translationPT,
  },
  fr: {
    translation: translationFR,
  },
  es: {
    translation: translationES,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en', // ✅ MUDANÇA AQUI: 'pt' → 'en'
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
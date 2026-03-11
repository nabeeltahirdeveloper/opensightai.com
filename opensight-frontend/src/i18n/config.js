import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import enTranslations from './locales/en.json'
import trTranslations from './locales/tr.json'

// Get language from environment variable (set at build time) or default to 'en'
const defaultLanguage = import.meta.env.VITE_LANG || 'en'
const isLanguageSetViaEnv = !!import.meta.env.VITE_LANG

// Only use language detector if VITE_LANG is not set
if (!isLanguageSetViaEnv) {
  i18n.use(LanguageDetector)
}

i18n
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // Default language (build-time setting takes priority)
    lng: defaultLanguage,
    
    // Fallback language
    fallbackLng: 'en',
    
    // Namespace configuration
    defaultNS: 'common',
    ns: ['common', 'landing', 'dashboard', 'admin', 'brand', 'reseller'],
    
    // Debug mode (set to false in production)
    debug: import.meta.env.DEV || false,
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Language detection options (only used if VITE_LANG is not set)
    ...(isLanguageSetViaEnv ? {} : {
      detection: {
        // Order of detection methods
        order: ['querystring', 'localStorage', 'navigator'],
        
        // Keys to lookup language from
        lookupQuerystring: 'lang',
        lookupLocalStorage: 'i18nextLng',
        
        // Cache user language
        caches: ['localStorage'],
        
        // Don't cache if language is from querystring
        excludeCacheFor: ['cimode'],
      },
    }),
    
    // Resources (translations)
    resources: {
      en: {
        common: enTranslations.common || {},
        landing: enTranslations.landing || {},
        dashboard: enTranslations.dashboard || {},
        admin: enTranslations.admin || {},
        brand: enTranslations.brand || {},
        reseller: enTranslations.reseller || {},
      },
      tr: {
        common: trTranslations.common || {},
        landing: trTranslations.landing || {},
        dashboard: trTranslations.dashboard || {},
        admin: trTranslations.admin || {},
        brand: trTranslations.brand || {},
        reseller: trTranslations.reseller || {},
      },
    },
  })
  .then(() => {
    // Log the initialized language for debugging
    if (import.meta.env.DEV) {
      console.log('[i18n] Initialized with language:', i18n.language)
      console.log('[i18n] Available languages:', Object.keys(i18n.options.resources || {}))
      console.log('[i18n] VITE_LANG:', import.meta.env.VITE_LANG)
    }
  })

export default i18n


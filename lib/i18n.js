import { useTranslations } from 'next-intl';

export function useI18n() {
  const t = useTranslations();
  return { t };
}

// Helper to get current locale
export function getCurrentLocale() {
  if (typeof window === 'undefined') return 'en';
  
  // Try to get from localStorage
  const saved = localStorage.getItem('three21_locale');
  if (saved) return saved;
  
  // Fallback to browser language
  const browserLang = navigator.language.split('-')[0];
  const supported = ['en', 'es', 'de', 'fr', 'ja', 'zh', 'pt', 'hi'];
  return supported.includes(browserLang) ? browserLang : 'en';
}

// Helper to set locale
export function setLocale(locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('three21_locale', locale);
    window.location.reload();
  }
}

import { NextIntlClientProvider } from 'next-intl';
import { getCurrentLocale } from '@/lib/i18n';

export default async function getMessages(locale) {
  try {
    return (await import(`@/locales/${locale}.json`)).default;
  } catch (error) {
    console.warn(`Failed to load locale ${locale}, falling back to English`);
    return (await import('@/locales/en.json')).default;
  }
}

export async function I18nProvider({ children, locale }) {
  const messages = await getMessages(locale || getCurrentLocale());
  
  return (
    <NextIntlClientProvider locale={locale || 'en'} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

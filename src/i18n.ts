import '@/intl-polyfills';

import { i18n, type Messages } from '@lingui/core';
import { getLocales } from 'expo-localization';

import { messages as en } from '@/locales/en/messages.po';
import { messages as zhHans } from '@/locales/zh-Hans/messages.po';
import { storage } from '@/storage';

const STORAGE_KEY = '@liberbili/locale/v1';

export type Locale = 'en' | 'zh-Hans';
const translations: Record<Locale, Messages> = {
  en,
  'zh-Hans': zhHans,
};

function isLocale(locale: string | null): locale is Locale {
  return locale === 'en' || locale === 'zh-Hans';
}

function activateLocale(locale: Locale): void {
  i18n.loadAndActivate({ locale, messages: translations[locale] });
}

const deviceLocale: Locale =
  getLocales()[0]?.languageCode === 'zh' ? 'zh-Hans' : 'en';
const savedLocale = storage.getString(STORAGE_KEY) ?? null;
activateLocale(isLocale(savedLocale) ? savedLocale : deviceLocale);

export function setLocale(locale: Locale): void {
  activateLocale(locale);
  storage.set(STORAGE_KEY, locale);
}

export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

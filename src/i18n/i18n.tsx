import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocales } from "expo-localization";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "./en.json";
import zhHans from "./zh-Hans.json";

const STORAGE_KEY = "@liberbili/locale/v1";

export type TranslationKey = keyof typeof en;
export type Locale = "en" | "zh-Hans";
const translations: Record<Locale, Record<TranslationKey, string>> = {
  en,
  "zh-Hans": zhHans,
};
type I18nValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: TranslationKey): string;
};
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const deviceLocale: Locale =
    locales[0]?.languageCode === "zh" ? "zh-Hans" : "en";
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(
      (saved) => saved && setLocaleState(saved as Locale),
    );
  }, []);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);
  const t = useCallback(
    (key: TranslationKey) => translations[locale][key],
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function formatCount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

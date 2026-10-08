'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, localeOf, translate, type Lang, type Params } from '@/lib/i18n';

interface I18nValue {
  lang: Lang;
  locale: string;
  t: (key: string, params?: Params) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue>({
  lang: 'en', locale: 'en-US', t: (k, p) => translate('en', k, p), setLang: () => {},
});

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh(); // los componentes de servidor releen la cookie
  }, [router]);

  const value = useMemo<I18nValue>(() => ({
    lang, locale: localeOf(lang), setLang, t: (key, params) => translate(lang, key, params),
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
/** Atajo: solo la función de traducción. */
export const useT = () => useContext(I18nContext).t;

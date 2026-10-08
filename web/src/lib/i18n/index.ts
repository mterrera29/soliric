// Traducción en/es. El texto en español es la clave: en español se devuelve tal cual y en inglés se busca en
// `EN`. Si falta una traducción se muestra el español (nunca se rompe la pantalla). Sirve igual en servidor y cliente.
import { EN } from './en';

export type Lang = 'en' | 'es';
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'lang';

export const parseLang = (value: string | null | undefined): Lang => (value === 'es' ? 'es' : value === 'en' ? 'en' : DEFAULT_LANG);

export type Params = Record<string, string | number>;

export function interpolate(text: string, params?: Params): string {
  return params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;
}

// Las claves con {parámetros} sirven también para mensajes ya armados (por ejemplo, errores del servidor):
// se reconocen por su forma y se vuelven a armar en inglés.
let templates: { re: RegExp; names: string[]; en: string }[] | null = null;
function templateList() {
  return (templates ??= Object.entries(EN).filter(([k]) => k.includes('{')).map(([key, en]) => {
    const names: string[] = [];
    const src = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n: string) => { names.push(n); return '([\\s\\S]+?)'; });
    return { re: new RegExp(`^${src}$`), names, en };
  }));
}

export function translate(lang: Lang, key: string, params?: Params): string {
  if (lang === 'es') return interpolate(key, params);
  const direct = EN[key];
  if (direct !== undefined) return interpolate(direct, params);
  if (!params) {
    for (const t of templateList()) {
      const m = key.match(t.re);
      if (m) return interpolate(t.en, Object.fromEntries(t.names.map((n, i) => [n, EN[m[i + 1]] !== undefined ? EN[m[i + 1]] : m[i + 1]])));
    }
  }
  return interpolate(key, params);
}

/** Código de idioma para fechas y números. */
export const localeOf = (lang: Lang) => (lang === 'es' ? 'es-AR' : 'en-US');

/** Idioma actual en el navegador (lo fija el proveedor en <html lang>). */
export const clientLang = (): Lang =>
  typeof document === 'undefined' ? DEFAULT_LANG : parseLang(document.documentElement.lang);

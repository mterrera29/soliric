import { cookies } from 'next/headers';
import { LANG_COOKIE, parseLang, translate, type Lang, type Params } from './index';

/** Idioma elegido (cookie `lang`); inglés por defecto. Solo para componentes de servidor. */
export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: (key: string, params?: Params) => translate(lang, key, params) };
}

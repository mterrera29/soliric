'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, Lock, ShieldCheck, ScrollText } from 'lucide-react';
import WorkGlyph from '@/components/soliric/WorkGlyph';
import StatusBadge from '@/components/soliric/StatusBadge';
import { soliricFetch } from '@/lib/soliric/client-api';
import type { RegistryItem, RegistryPage } from '@/lib/soliric/types';
import { useI18n, useT } from '@/hooks/useI18n';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };
const noAuth = async () => null;
const shortDate = (iso: string | null, locale: string) =>
  iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function RegistryCard({ item }: { item: RegistryItem }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/registry/${item.fingerprint}`}
      className="group flex flex-col gap-3 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-ember/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
      style={card}>
      <div className="flex items-start gap-3">
        {item.isPublic ? (
          <WorkGlyph seed={`${item.title}-${item.artist}`} size={56} className="rounded-xl" />
        ) : (
          <span className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center bg-terracotta/15 text-warm-tan" aria-hidden>
            <Lock className="w-6 h-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg leading-tight truncate group-hover:text-ember-light transition-colors" style={{ color: 'var(--text-primary)' }}>
            {item.isPublic ? item.title : t('Letra privada')}
          </h2>
          <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
            {item.isPublic ? [item.artist, item.author && t('por {author}', { author: item.author })].filter(Boolean).join(' · ') : t('Su autor eligió no publicarla')}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        {item.status ? <StatusBadge status={item.status} /> : <span />}
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{shortDate(item.registeredAt, locale)}</span>
      </div>
      <p className="font-mono text-[11px] truncate" style={{ color: 'var(--text-muted)' }} title={item.fingerprint}>
        {item.fingerprint.slice(0, 10)}…{item.fingerprint.slice(-8)}
      </p>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-4 space-y-3 animate-pulse" style={card} aria-hidden>
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-xl bg-terracotta/15" />
        <div className="flex-1 space-y-2 pt-1"><div className="h-4 w-3/4 rounded bg-terracotta/15" /><div className="h-3 w-1/2 rounded bg-terracotta/10" /></div>
      </div>
      <div className="h-6 w-28 rounded-full bg-terracotta/10" />
    </div>
  );
}

export default function RegistryListPage() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(async (q: string, after: string | null) => {
    const id = ++seq.current;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (after) params.set('cursor', after);
    try {
      const page = await soliricFetch<RegistryPage>(noAuth, `registry?${params}`);
      if (id !== seq.current) return; // llegó una respuesta vieja: se descarta
      setItems((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setTotal(page.total);
      setError('');
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
    } finally {
      if (id === seq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga desde la API al cambiar la búsqueda
  useEffect(() => { setLoading(true); fetchPage(debounced, null); }, [debounced, fetchPage]);

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm text-warm-tan"><ShieldCheck className="w-4 h-4" /> {t('Soliric · registro público')}</p>
          <h1 className="text-4xl font-heading" style={{ color: 'var(--text-primary)' }}>{t('Obras registradas')}</h1>
          <p className="max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            {t('Letras con autoría registrada en la blockchain de Solana. Cualquiera puede comprobarlo, sin cuenta y sin pedirle permiso a nadie.')}
            {total !== null && <> <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> {total === 1 ? t('obra registrada') : t('obras registradas')}.</>}
          </p>
        </header>

        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-xl">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('Buscar por título, artista o autor')}
            placeholder={t('Buscar por título, artista o autor')}
            className="w-full rounded-xl pl-11 pr-11 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ember/50"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Borrar búsqueda')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-terracotta/20">
              <X className="w-4 h-4 text-warm-tan" />
            </button>
          )}
        </form>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</div>
        ) : items.length === 0 && !error ? (
          <div className="rounded-2xl p-10 text-center space-y-3" style={card}>
            <ScrollText className="w-10 h-10 mx-auto text-warm-tan" aria-hidden />
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {debounced ? t('No encontramos obras públicas con «{q}»', { q: debounced }) : t('Todavía no hay obras registradas')}
            </p>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {debounced
                ? t('Las letras privadas no se pueden buscar por nombre. Si tenés la letra, pegala en el verificador y fijate si está registrada.')
                : t('Registrá la primera desde cualquiera de tus canciones.')}
            </p>
            {debounced && <Link href="/verify" className="inline-block text-sm font-semibold text-warm-tan hover:underline">{t('Ir al verificador')}</Link>}
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('Obras registradas')}>
              {items.map((item) => <li key={item.fingerprint} className="flex"><div className="w-full flex"><RegistryCard item={item} /></div></li>)}
            </ul>
            {cursor && (
              <div className="text-center">
                <button type="button" disabled={loadingMore} onClick={() => { setLoadingMore(true); fetchPage(debounced, cursor); }}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 disabled:opacity-40 transition-colors">
                  {loadingMore ? t('Cargando…') : t('Ver más obras')}
                </button>
              </div>
            )}
          </>
        )}

        <p className="text-xs max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          {t('En la blockchain nunca se publica el texto de una letra, solo su huella. El título y el autor se muestran únicamente cuando el dueño de la canción la hizo pública.')}
        </p>
      </div>
    </main>
  );
}

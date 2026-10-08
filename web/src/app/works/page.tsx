'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ScrollText } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import Spinner from '@/components/Spinner';
import StatusBadge from '@/components/soliric/StatusBadge';
import WorkGlyph from '@/components/soliric/WorkGlyph';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { soliricFetch } from '@/lib/soliric/client-api';
import type { ChainStatus } from '@/lib/soliric/types';

interface Item { id: string; title: string; artist: string; isPublic: boolean; status: ChainStatus | null; workPda: string | null; registeredAt: string | null; createdAt: string }
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

export default function WorksPage() {
  const { t, locale } = useI18n();
  const { userId, getToken } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await soliricFetch<Item[]>(getToken, 'works')); } catch (e) { setError((e as Error).message); }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { if (userId) load(); }, [userId, load]);

  return (
    <RequireAuth>
      <main className="px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-heading" style={{ color: 'var(--text-primary)' }}>{t('Mis obras')}</h1>
            <Link href="/new" className="btn-cozy bg-ember hover:bg-ember-light text-white px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
              <Plus className="w-4 h-4" aria-hidden /> {t('Nueva obra')}
            </Link>
          </header>

          {!items && !error && <Spinner />}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

          {items?.length === 0 && (
            <div className="rounded-2xl p-10 text-center space-y-3" style={card}>
              <ScrollText className="w-10 h-10 mx-auto text-warm-tan" aria-hidden />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('Todavía no cargaste ninguna obra')}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('Registrá tu primera letra: tarda un minuto.')}</p>
            </div>
          )}

          <ul className="space-y-3">
            {items?.map((w) => (
              <li key={w.id}>
                <Link href={`/works/${w.id}`} className="flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-white/5" style={card}>
                  <WorkGlyph seed={`${w.title}-${w.artist}`} size={48} className="rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-lg truncate" style={{ color: 'var(--text-primary)' }}>{w.title}</p>
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                      {w.artist || t('Sin artista')} · {new Date(w.registeredAt ?? w.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {w.status ? <StatusBadge status={w.status} /> : <span className="text-xs rounded-full px-2.5 py-1 bg-terracotta/15 text-warm-tan">{t('Borrador')}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </RequireAuth>
  );
}

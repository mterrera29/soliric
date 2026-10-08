'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch } from '@/lib/soliric/client-api';
import { useT } from '@/hooks/useI18n';

interface Invitation { workId: string; title: string; owner: string | null; status: string }

export default function CollaborationsPage() {
  const t = useT();
  const { userId, loading: authLoading, getToken, login } = useAuth();
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await soliricFetch<Invitation[]>(getToken, 'invitations')); } catch (e) { setError((e as Error).message); }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { if (userId) load(); }, [userId, load]);

  if (authLoading) return <Spinner />;
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
        <button onClick={login} className="btn-cozy bg-ember hover:bg-ember-light text-white px-6 py-2.5">{t('Iniciar sesión')}</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-heading flex items-center gap-3" style={{ color: 'var(--text-primary)' }}><Users className="w-7 h-7 text-ember-light" /> {t('Colaboraciones')}</h1>
        {!items && !error && <Spinner />}
        {items?.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{t('Todavía nadie te invitó a una canción.')}</p>}
        {items?.map((i) => (
          <Link key={i.workId} href={`/collaborations/${i.workId}`} className="block rounded-2xl p-4 hover:bg-white/5 transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{i.title}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {i.owner ? `${t('De {owner}', { owner: i.owner })} · ` : ''}{i.status === 'pending' ? t('Invitación pendiente') : t('Ya sos coautor/a')}
            </p>
          </Link>
        ))}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch } from '@/lib/soliric/client-api';
import { useT } from '@/hooks/useI18n';

interface Invitation { workId: string; title: string; owner: string | null; status: string }
interface Pending { invitations: { workId: string; title: string; owner: string | null }[]; toSign: { workId: string; title: string }[]; count: number }

export default function CollaborationsPage() {
  const t = useT();
  const { userId, loading: authLoading, getToken, login } = useAuth();
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, todo] = await Promise.all([soliricFetch<Invitation[]>(getToken, 'invitations'), soliricFetch<Pending>(getToken, 'me/pending')]);
      setItems(list); setPending(todo);
    } catch (e) { setError((e as Error).message); }
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
        {pending && pending.count > 0 && (
          <section aria-label={t('Pendiente')} className="space-y-3">
            <h2 className="text-sm font-semibold" style={{ color: '#F58A45' }}>{t('Te toca a vos')}</h2>
            {pending.toSign.map((w) => (
              <Link key={`s-${w.workId}`} href={`/works/${w.workId}`} className="block rounded-2xl p-4 hover:bg-white/5 transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid #F58A45' }}>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{w.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('Te toca firmar el reparto')}</p>
              </Link>
            ))}
            {pending.invitations.map((w) => (
              <Link key={`i-${w.workId}`} href={`/works/${w.workId}`} className="block rounded-2xl p-4 hover:bg-white/5 transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid #F58A45' }}>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{w.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{w.owner ? `${t('De {owner}', { owner: w.owner })} · ` : ''}{t('Te invitaron: falta que aceptes')}</p>
              </Link>
            ))}
          </section>
        )}
        {pending && pending.count === 0 && items && items.length > 0 && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('No tenés nada pendiente.')}</p>
        )}
        {items?.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>{t('Todavía nadie te invitó a una canción.')}</p>}
        {items?.map((i) => (
          <Link key={i.workId} href={`/works/${i.workId}`} className="block rounded-2xl p-4 hover:bg-white/5 transition-colors"
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

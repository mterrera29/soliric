'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { soliricFetch } from '@/lib/soliric/client-api';

interface Key { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }
const card = { background: 'var(--l-surface, #1f1814)', border: '1px solid var(--l-line, rgba(247,239,229,0.12))' };

/** Claves de API del usuario: crear (se muestra una sola vez), listar y revocar. */
export default function KeysPanel() {
  const { t, locale } = useI18n();
  const { userId, loading, login, getToken } = useAuth();
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setKeys(await soliricFetch<Key[]>(getToken, 'developers/keys')); } catch (e) { setError((e as Error).message); }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { if (userId) load(); }, [userId, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const out = await soliricFetch<{ key: string }>(getToken, 'developers/keys', { body: { name } });
      setFresh(out.key); setName(''); await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setError('');
    try { await soliricFetch(getToken, 'developers/keys', { method: 'DELETE', body: { id } }); await load(); } catch (err) { setError((err as Error).message); }
  }

  if (loading) return null;
  if (!userId) {
    return (
      <div className="rounded-3xl p-6 space-y-3" style={card}>
        <p style={{ color: 'var(--l-muted, rgba(247,239,229,0.74))' }}>{t('Ingresá con tu cuenta de Google para crear una clave de API.')}</p>
        <button onClick={login} className="sol-btn-primary inline-flex items-center min-h-11 px-5 text-sm">{t('Iniciar sesión')}</button>
      </div>
    );
  }
  const active = keys?.filter((k) => !k.revokedAt) ?? [];
  return (
    <div className="rounded-3xl p-6 space-y-5" style={card}>
      <form onSubmit={create} className="flex flex-col sm:flex-row gap-2">
        <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label={t('Nombre de la app')} placeholder={t('Nombre de la app (por ejemplo, Fogón)')}
          className="w-full rounded-xl px-4 py-3 text-base focus:outline-none"
          style={{ background: 'var(--l-bg, #15100d)', border: '1px solid var(--l-line, rgba(247,239,229,0.12))', color: 'var(--l-text, #f7efe5)' }} />
        <button disabled={busy} className="sol-btn-primary inline-flex items-center justify-center gap-2 min-h-12 px-5 text-sm shrink-0 disabled:opacity-40">
          <Plus className="w-4 h-4" aria-hidden /> {t('Crear clave')}
        </button>
      </form>

      {fresh && (
        <div className="space-y-2" role="status">
          <p className="text-sm font-semibold text-[var(--sol-green)]">{t('Copiá tu clave ahora: no la vas a poder ver de nuevo.')}</p>
          <CodeBlock code={fresh} label={t('Clave de API')} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <ul className="divide-y" style={{ borderColor: 'var(--l-line, rgba(247,239,229,0.12))' }}>
        {active.length === 0 && keys && <li className="py-3 text-sm" style={{ color: 'var(--l-faint, rgba(247,239,229,0.5))' }}>{t('Todavía no creaste ninguna clave.')}</li>}
        {active.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 py-3 border-inherit">
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-2" style={{ color: 'var(--l-text, #f7efe5)' }}><KeyRound className="w-4 h-4 text-[var(--ember-soft)]" aria-hidden /> {k.name}</p>
              <p className="mono text-xs mt-0.5" style={{ color: 'var(--l-faint, rgba(247,239,229,0.5))' }}>
                {k.keyPrefix}… · {t('creada el {date}', { date: new Date(k.createdAt).toLocaleDateString(locale) })}
                {k.lastUsedAt ? ` · ${t('último uso {date}', { date: new Date(k.lastUsedAt).toLocaleDateString(locale) })}` : ''}
              </p>
            </div>
            <button onClick={() => revoke(k.id)} aria-label={t('Revocar')} title={t('Revocar')} className="p-2.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

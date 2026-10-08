'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Copy, KeyRound, ExternalLink } from 'lucide-react';
import Spinner from '@/components/Spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch, SoliricError } from '@/lib/soliric/client-api';
import { useT } from '@/hooks/useI18n';

interface WalletInfo { pubkey: string; balance: number; cluster: string; explorer: string }
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

export default function WalletPage() {
  const t = useT();
  const { userId, loading: authLoading, getToken, login } = useAuth();
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try { setInfo(await soliricFetch<WalletInfo>(getToken, 'wallet')); } catch (e) { setError((e as Error).message); }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { if (userId) load(); }, [userId, load]);

  async function exportKey() {
    setConfirming(false);
    setBusy(true); setError('');
    try {
      try {
        setSecret((await soliricFetch<{ secretKey: string }>(getToken, 'wallet/export', { body: {} })).secretKey);
      } catch (e) {
        // la clave solo se entrega con un login de los últimos minutos
        if (!(e instanceof SoliricError) || e.data.code !== 'reauth') throw e;
        await login();
        setSecret((await soliricFetch<{ secretKey: string }>(getToken, 'wallet/export', { body: {} })).secretKey);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
        <header>
          <h1 className="text-3xl font-heading mb-2 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}><Wallet className="w-7 h-7 text-ember-light" /> {t('Mi wallet')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t('Soliric creó una wallet de Solana para vos y firma tus registros. Si querés, podés llevarte la clave a Phantom.')}</p>
        </header>
        {!info && !error && <Spinner />}
        {info && (
          <div className="rounded-2xl p-5 space-y-3" style={card}>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Dirección')} ({info.cluster})</p>
            <p className="font-mono text-sm break-all" style={{ color: 'var(--text-primary)' }}>{info.pubkey}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <button onClick={() => navigator.clipboard.writeText(info.pubkey)} className="inline-flex items-center gap-1.5 text-warm-tan hover:underline"><Copy className="w-3.5 h-3.5" /> {t('Copiar')}</button>
              <a href={info.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-warm-tan hover:underline"><ExternalLink className="w-3.5 h-3.5" /> {t('Explorer')}</a>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('Saldo:')} <strong style={{ color: 'var(--text-primary)' }}>{info.balance.toFixed(4)} SOL</strong></p>
          </div>
        )}
        <section className="rounded-2xl p-5 space-y-3" style={card}>
          <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><KeyRound className="w-4 h-4 text-warm-tan" /> {t('Exportar clave privada')}</h2>
          {secret ? (
            <>
              <p className="font-mono text-xs break-all p-3 rounded-lg" style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}>{secret}</p>
              <p className="text-xs text-amber-400">{t('Importala en Phantom (Agregar cuenta → Importar clave privada). Cerrá esta pantalla cuando termines.')}</p>
              <button onClick={() => setSecret('')} className="text-sm text-warm-tan hover:underline">{t('Ocultar')}</button>
            </>
          ) : (
            <button disabled={busy} onClick={() => setConfirming(true)} className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 disabled:opacity-40">
              {busy ? t('Pidiendo…') : t('Mostrar mi clave')}
            </button>
          )}
        </section>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>
      <ConfirmDialog
        open={confirming}
        title={t('Vas a ver tu clave privada')}
        message={t('Quien la tenga controla tu wallet y tus registros. No la compartas con nadie.')}
        confirmLabel={t('Mostrar clave')}
        danger
        onConfirm={exportKey}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}

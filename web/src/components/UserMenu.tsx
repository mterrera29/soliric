'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, FileText, KeyRound, LogOut, Users, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePending } from '@/hooks/usePending';
import { soliricFetch } from '@/lib/soliric/client-api';
import { useT } from '@/hooks/useI18n';

interface WalletInfo { pubkey: string; balance: number; cluster: string; explorer: string; freeLeft?: number | null; freeTotal?: number }

/** Pastilla con la cantidad de cosas pendientes (invitaciones por aceptar y repartos por firmar). */
export function PendingBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span aria-hidden className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold ${className}`}
      style={{ background: '#F58A45', color: '#1B120C' }}>{count > 9 ? '9+' : count}</span>
  );
}

/** Menú de la cuenta: quién sos, tu wallet, lo que tenés pendiente y los accesos de uso diario. */
export default function UserMenu() {
  const t = useT();
  const { user, userEmail, getToken, logout } = useAuth();
  const { count } = usePending();
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef(getToken);
  useEffect(() => { tokenRef.current = getToken; });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // La wallet se pide al abrir el menú, no en cada pantalla
  useEffect(() => {
    if (!open || wallet) return;
    let alive = true;
    soliricFetch<WalletInfo>(() => tokenRef.current(), 'wallet').then((w) => { if (alive) setWallet(w); }).catch(() => {});
    return () => { alive = false; };
  }, [open, wallet]);

  const name = user?.displayName || userEmail || '';
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  async function copy() {
    if (!wallet) return;
    try { await navigator.clipboard.writeText(wallet.pubkey); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ }
  }

  const item = 'flex items-center gap-3 min-h-11 px-3 rounded-lg text-sm hover:bg-white/8';
  return (
    <div ref={box} className="relative hidden lg:block">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={count ? t('Mi cuenta ({n} pendientes)', { n: count }) : t('Mi cuenta')}
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-white/10">
        {user?.photoURL
          // eslint-disable-next-line @next/next/no-img-element -- foto de Google, tamaño fijo
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
          : <span className="w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-semibold" style={{ background: '#F58A45', color: '#1B120C' }}>{initial}</span>}
        {count > 0 && <PendingBadge count={count} className="absolute -top-0.5 -right-0.5" />}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-80 rounded-2xl p-2 shadow-2xl z-50"
          style={{ background: '#1F1712', border: '1px solid rgba(247,239,229,0.14)', color: '#F7EFE5' }}>
          <div className="px-3 pt-2 pb-3">
            <p className="font-semibold truncate">{name}</p>
            {userEmail && name !== userEmail && <p className="text-sm truncate" style={{ color: 'rgba(247,239,229,0.66)' }}>{userEmail}</p>}
          </div>

          <div className="mx-1 mb-2 rounded-xl p-3 text-sm" style={{ background: 'rgba(247,239,229,0.06)' }}>
            <p className="text-xs" style={{ color: 'rgba(247,239,229,0.66)' }}>{t('Tu wallet')}{wallet ? ` · ${wallet.cluster}` : ''}</p>
            {wallet ? (
              <>
                <p className="mono mt-1 break-all">{wallet.pubkey.slice(0, 6)}…{wallet.pubkey.slice(-6)}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="mono">{wallet.balance.toFixed(4)} SOL</span>
                  <span className="flex items-center gap-3">
                    <button onClick={copy} className="inline-flex items-center gap-1.5 min-h-8 hover:underline" style={{ color: '#F58A45' }}>
                      {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />} {copied ? t('Copiada') : t('Copiar')}
                    </button>
                    <a href={wallet.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 min-h-8 hover:underline" style={{ color: '#F58A45' }}>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden /> {t('Explorer')}
                    </a>
                  </span>
                </div>
              </>
            ) : <p className="mt-1" style={{ color: 'rgba(247,239,229,0.66)' }}>{t('Cargando…')}</p>}
            {wallet && wallet.freeLeft !== undefined && (
              <p className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(247,239,229,0.12)' }}>
                <span style={{ color: 'rgba(247,239,229,0.66)' }}>{t('Registros gratis')}</span>
                <span className="mono">{wallet.freeLeft === null ? t('Sin límite') : t('{left} de {total}', { left: wallet.freeLeft, total: wallet.freeTotal ?? 3 })}</span>
              </p>
            )}
          </div>

          <Link href="/works" role="menuitem" onClick={() => setOpen(false)} className={item}><FileText className="w-4 h-4" aria-hidden /> {t('Mis obras')}</Link>
          <Link href="/collaborations" role="menuitem" onClick={() => setOpen(false)} className={`${item} justify-between`}>
            <span className="inline-flex items-center gap-3"><Users className="w-4 h-4" aria-hidden /> {t('Colaboraciones')}</span>
            {count > 0 && <span className="text-xs" style={{ color: '#F58A45' }}>{count === 1 ? t('1 pendiente') : t('{n} pendientes', { n: count })}</span>}
          </Link>
          <Link href="/wallet" role="menuitem" onClick={() => setOpen(false)} className={item}><Wallet className="w-4 h-4" aria-hidden /> {t('Mi wallet')}</Link>
          <Link href="/developers" role="menuitem" onClick={() => setOpen(false)} className={item}><KeyRound className="w-4 h-4" aria-hidden /> {t('Claves de API')}</Link>
          <div className="my-1 h-px" style={{ background: 'rgba(247,239,229,0.12)' }} />
          <button role="menuitem" onClick={() => { setOpen(false); logout(); }} className={`${item} w-full text-left`}><LogOut className="w-4 h-4" aria-hidden /> {t('Cerrar sesión')}</button>
        </div>
      )}
    </div>
  );
}

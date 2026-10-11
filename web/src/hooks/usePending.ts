'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch } from '@/lib/soliric/client-api';

export interface PendingData {
  invitations: { workId: string; title: string; owner: string | null }[];
  toSign: { workId: string; title: string }[];
  count: number;
}

export const PENDING_CHANGED = 'soliric:pending-changed';
const EMPTY: PendingData = { invitations: [], toSign: [], count: 0 };

/** Invitaciones por aceptar y repartos por firmar. Se actualiza cada minuto, al volver a la pestaña y después de cada acción. */
export function usePending() {
  const { userId, getToken } = useAuth();
  const tokenRef = useRef(getToken);
  useEffect(() => { tokenRef.current = getToken; });
  const [data, setData] = useState<PendingData>(EMPTY);

  const refresh = useCallback(async () => {
    try { setData(await soliricFetch<PendingData>(() => tokenRef.current(), 'me/pending')); } catch { /* sin aviso si falla */ }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(PENDING_CHANGED, refresh);
    return () => {
      clearTimeout(first); clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(PENDING_CHANGED, refresh);
    };
  }, [userId, refresh]);

  return { ...(userId ? data : EMPTY), refresh };
}

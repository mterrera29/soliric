'use client';

import { Suspense, use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import ConfirmDialog from '@/components/ConfirmDialog';
import Spinner from '@/components/Spinner';
import RegisterPanel from '@/components/soliric/RegisterPanel';
import RegistryPanel from '@/components/soliric/RegistryPanel';
import WorkForm, { type WorkFormValues } from '@/components/soliric/WorkForm';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/hooks/useI18n';
import { soliricFetch } from '@/lib/soliric/client-api';
import type { Relation } from '@/lib/soliric/types';

interface WorkInfo {
  id: string; relation: Relation; isPublic: boolean; registered: boolean; status: string | null; fingerprint: string | null;
  title: string | null; artist: string | null; authorName: string | null; lyrics: string | null; chords: string | null;
}
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

export default function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequireAuth><Suspense fallback={<Spinner />}><WorkContent id={id} /></Suspense></RequireAuth>;
}

function WorkContent({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const { getToken } = useAuth();
  const [info, setInfo] = useState<WorkInfo | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try { setInfo(await soliricFetch<WorkInfo>(getToken, `works/${id}`)); setError(''); } catch (e) { setError((e as Error).message); }
  }, [getToken, id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { load(); }, [load]);

  async function save(v: WorkFormValues) {
    await soliricFetch(getToken, `works/${id}`, { method: 'PATCH', body: { title: v.title, artist: v.artist, authorName: v.authorName, lyrics: v.lyrics, isPublic: v.isPublic } });
    setEditing(false);
    await load();
  }

  async function togglePublic(next: boolean) {
    await soliricFetch(getToken, `works/${id}`, { method: 'PATCH', body: { isPublic: next } }).catch((e: Error) => setError(e.message));
    await load();
  }

  async function remove() {
    setDeleting(false);
    try { await soliricFetch(getToken, `works/${id}`, { method: 'DELETE' }); router.push('/works'); } catch (e) { setError((e as Error).message); }
  }

  const invites = (search.get('invite') ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  const isOwner = info?.relation === 'owner';

  return (
    <main className="px-4 py-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href={isOwner ? '/works' : '/collaborations'} className="inline-flex items-center gap-2 min-h-11 px-2 -ml-2 rounded-lg hover:bg-terracotta/10" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" aria-hidden /> {isOwner ? t('Mis obras') : t('Colaboraciones')}
        </Link>

        {!info && !error && <Spinner />}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        {info && info.registered && (
          <>
            <article style={card} className="rounded-3xl"><RegistryPanel workId={id} onChanged={load} /></article>
            {isOwner && (
              <label className="flex items-start gap-2.5 rounded-xl p-4 cursor-pointer text-sm" style={card}>
                <input type="checkbox" checked={info.isPublic} onChange={(e) => togglePublic(e.target.checked)} className="mt-1 accent-orange-500" />
                <span style={{ color: 'var(--text-primary)' }}>
                  {t('Mostrar el título y el autor en el registro público')}
                  {info.fingerprint && <Link href={`/registry/${info.fingerprint}`} className="block text-xs mt-0.5 text-warm-tan hover:underline">{t('Ver la página pública del registro')}</Link>}
                </span>
              </label>
            )}
          </>
        )}

        {info && !info.registered && isOwner && (
          <>
            <section className="rounded-3xl p-6 space-y-4" style={card} aria-label={t('Borrador')}>
              {editing ? (
                <WorkForm initial={{ title: info.title ?? '', artist: info.artist ?? '', authorName: info.authorName ?? '', lyrics: info.lyrics ?? '', isPublic: info.isPublic }}
                  submitLabel={t('Guardar')} onSubmit={save} onCancel={() => setEditing(false)} />
              ) : (
                <>
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-2xl font-heading break-words" style={{ color: 'var(--text-primary)' }}>{info.title}</h1>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{[info.artist, info.authorName && t('por {author}', { author: info.authorName })].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditing(true)} aria-label={t('Editar')} title={t('Editar')} className="p-2.5 rounded-lg hover:bg-terracotta/20"><Pencil className="w-4 h-4 text-warm-tan" /></button>
                      <button onClick={() => setDeleting(true)} aria-label={t('Eliminar')} title={t('Eliminar')} className="p-2.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </header>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-56 overflow-y-auto rounded-xl p-4" style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>{info.lyrics}</pre>
                </>
              )}
            </section>
            {!editing && (
              <article style={card} className="rounded-3xl">
                <RegisterPanel workId={id} initialInvites={invites} defaultAuthorName={info.authorName ?? undefined} onRegistered={load} />
              </article>
            )}
          </>
        )}

        {info && !info.registered && !isOwner && <p style={{ color: 'var(--text-secondary)' }}>{t('Esta canción todavía no está registrada.')}</p>}
      </div>

      <ConfirmDialog open={deleting} title={t('Eliminar borrador')} message={t('Se borra esta obra sin registrar. No se puede deshacer.')}
        confirmLabel={t('Eliminar')} danger onConfirm={remove} onCancel={() => setDeleting(false)} />
    </main>
  );
}

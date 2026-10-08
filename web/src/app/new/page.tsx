'use client';

import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import WorkForm, { type WorkFormValues } from '@/components/soliric/WorkForm';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/hooks/useI18n';
import { soliricFetch } from '@/lib/soliric/client-api';

export default function NewWorkPage() {
  const t = useT();
  const router = useRouter();
  const { getToken, userDisplayName } = useAuth();

  async function create(v: WorkFormValues) {
    const { id } = await soliricFetch<{ id: string }>(getToken, 'works', {
      body: { title: v.title, artist: v.artist, authorName: v.authorName, lyrics: v.lyrics, isPublic: v.isPublic },
    });
    const invite = v.coauthors.length ? `?invite=${encodeURIComponent(v.coauthors.join(','))}` : '';
    router.push(`/works/${id}${invite}`);
  }

  return (
    <RequireAuth>
      <main className="px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-2xl mx-auto space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-heading" style={{ color: 'var(--text-primary)' }}>{t('Registrar una letra')}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('Cargá los datos de la obra. En el siguiente paso revisamos que no exista en otros catálogos y firmás la declaración de autoría.')}
            </p>
          </header>
          <WorkForm withCoauthors initial={{ authorName: userDisplayName ?? '' }} submitLabel={t('Continuar')} onSubmit={create} />
        </div>
      </main>
    </RequireAuth>
  );
}

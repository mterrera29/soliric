'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Spinner from '@/components/Spinner';
import RegistryPanel from '@/components/soliric/RegistryPanel';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/hooks/useI18n';

export default function CollaborationPage({ params }: { params: Promise<{ workId: string }> }) {
  const t = useT();
  const { workId } = use(params);
  const router = useRouter();
  const { userId, loading, login } = useAuth();

  if (loading) return <Spinner />;
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
        <button onClick={login} className="btn-cozy bg-ember hover:bg-ember-light text-white px-6 py-2.5">{t('Iniciar sesión')}</button>
      </main>
    );
  }
  return (
    <main className="min-h-screen px-4 py-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto">
        <button type="button" onClick={() => router.push('/collaborations')} className="inline-flex items-center gap-2 min-h-11 px-2 rounded-lg hover:bg-terracotta/10" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" /> {t('Colaboraciones')}
        </button>
        <RegistryPanel workId={workId} />
      </div>
    </main>
  );
}

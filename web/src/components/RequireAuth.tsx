'use client';

import { LogIn } from 'lucide-react';
import Spinner from './Spinner';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/hooks/useI18n';

/** Muestra el contenido solo con sesión iniciada; si no, invita a ingresar. */
export default function RequireAuth({ children, message }: { children: React.ReactNode; message?: string }) {
  const t = useT();
  const { userId, loading, login } = useAuth();
  if (loading) return <Spinner />;
  if (userId) return <>{children}</>;
  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center space-y-4 max-w-sm">
        <p style={{ color: 'var(--text-secondary)' }}>{message ?? t('Ingresá con tu cuenta de Google para continuar.')}</p>
        <button onClick={login} className="btn-cozy bg-ember hover:bg-ember-light text-white px-6 py-2.5 inline-flex items-center gap-2">
          <LogIn className="w-4 h-4" aria-hidden /> {t('Iniciar sesión')}
        </button>
      </div>
    </main>
  );
}

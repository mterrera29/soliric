'use client';

import { use, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { ArrowLeft, FileDown } from 'lucide-react';
import Spinner from '@/components/Spinner';
import CertificateSheet from '@/components/soliric/CertificateSheet';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch } from '@/lib/soliric/client-api';
import type { CertificateData } from '@/lib/soliric/types';

export default function CertificatePage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = use(params);
  const router = useRouter();
  const { getToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<CertificateData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    soliricFetch<CertificateData>(getToken, `works/${workId}/certificate`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [authLoading, getToken, workId]);

  useEffect(() => {
    if (!data?.fingerprint) return;
    QRCode.toDataURL(`${window.location.origin}/registry/${data.fingerprint}`, { margin: 1, width: 224 })
      .then(setQr).catch(() => setQr(null));
  }, [data?.fingerprint]);

  // Imprimir: el nombre del documento es el nombre sugerido del PDF
  useEffect(() => {
    if (!printing || !data) return;
    const prev = document.title;
    document.title = `Certificado - ${data.title}`;
    const done = () => { document.title = prev; setPrinting(false); };
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing, data]);

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-[720px] mx-auto mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 min-h-11 px-2 rounded-lg hover:bg-terracotta/10" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        {data && (
          <button type="button" onClick={() => setPrinting(true)} className="btn-cozy bg-ember hover:bg-ember-light text-white px-5 py-2.5 inline-flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Descargar PDF
          </button>
        )}
      </div>
      {!data && !error && <Spinner />}
      {error && <p role="alert" className="text-center text-red-400">{error}</p>}
      {data && <CertificateSheet data={data} qr={qr} />}
      {printing && data && createPortal(<div className="print-root"><CertificateSheet data={data} qr={qr} /></div>, document.body)}
    </main>
  );
}

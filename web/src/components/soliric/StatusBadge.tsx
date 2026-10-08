'use client';

import { ShieldCheck, ShieldAlert, ShieldX, Hourglass, PenLine, Handshake } from 'lucide-react';
import { useT } from '@/hooks/useI18n';
import { STATUS_LABEL, type ChainStatus } from '@/lib/soliric/types';

const STYLE: Record<ChainStatus, { icon: React.ReactNode; cls: string }> = {
  open: { icon: <PenLine className="w-3.5 h-3.5" />, cls: 'bg-terracotta/20 text-warm-tan' },
  proposed: { icon: <Handshake className="w-3.5 h-3.5" />, cls: 'bg-terracotta/20 text-warm-tan' },
  closing: { icon: <Hourglass className="w-3.5 h-3.5" />, cls: 'bg-amber-500/15 text-amber-400' },
  final: { icon: <ShieldCheck className="w-3.5 h-3.5" />, cls: 'bg-soft-sage/20 text-soft-sage' },
  disputed: { icon: <ShieldAlert className="w-3.5 h-3.5" />, cls: 'bg-red-500/15 text-red-400' },
  revoked: { icon: <ShieldX className="w-3.5 h-3.5" />, cls: 'bg-red-500/15 text-red-400' },
};

export default function StatusBadge({ status }: { status: ChainStatus }) {
  const t = useT();
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      {s.icon} {t(STATUS_LABEL[status])}
    </span>
  );
}

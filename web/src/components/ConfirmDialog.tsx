'use client';

import Modal from './Modal';
import { useT } from '@/hooks/useI18n';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva: el botón de confirmar va en rojo. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Reemplaza a window.confirm con un diálogo de la app. */
export default function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  return (
    <Modal isOpen={open} onClose={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={title ?? message} className="p-6 space-y-5">
        {title && <h2 className="text-xl font-heading pr-8" style={{ color: 'var(--text-primary)' }}>{title}</h2>}
        <p className={title ? '' : 'pr-8'} style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-warm-tan hover:bg-terracotta/20 transition-colors">
            {cancelLabel ?? t('Cancelar')}
          </button>
          <button type="button" autoFocus onClick={onConfirm}
            className={`btn-cozy px-5 py-2.5 text-white ${danger ? 'bg-red-500 hover:bg-red-400' : 'bg-ember hover:bg-ember-light'}`}>
            {confirmLabel ?? t('Confirmar')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

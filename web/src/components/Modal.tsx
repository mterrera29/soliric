'use client';

import { X } from 'lucide-react';

interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export default function Modal({ children, isOpen, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl animate-fade-in"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-terracotta/20 transition-colors z-10"
        >
          <X className="w-5 h-5 text-warm-tan" />
        </button>
        {children}
      </div>
    </div>
  );
}
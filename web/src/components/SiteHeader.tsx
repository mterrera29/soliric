'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, Menu, X } from 'lucide-react';
import UserMenu, { PendingBadge } from './UserMenu';
import { usePending } from '@/hooks/usePending';
import LanguageToggle from './LanguageToggle';
import Logo from './Logo';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/hooks/useI18n';

/** Cabecera común a todas las pantallas de Soliric. */
export default function SiteHeader() {
  const t = useT();
  const pathname = usePathname();
  const { userId, login, logout } = useAuth();
  const { count: pending } = usePending();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/registry', label: t('Registro') },
    { href: '/verify', label: t('Verificar') },
    { href: '/developers', label: t('Desarrolladores') },
    ...(userId ? [{ href: '/works', label: t('Mis obras') }, { href: '/collaborations', label: t('Colaboraciones') }, { href: '/wallet', label: t('Mi wallet') }] : []),
  ];
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) =>
    `inline-flex items-center min-h-11 px-3 text-sm rounded-lg transition-colors hover:bg-white/5 ${active(href) ? 'text-white font-semibold' : ''}`;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ borderColor: 'rgba(247,239,229,0.12)', background: 'rgba(21,16,13,0.86)' }}>
      <nav className="mx-auto w-full max-w-6xl px-5 sm:px-8 flex items-center justify-between gap-3 h-16" aria-label={t('Principal')}>
        <Link href="/" aria-label="Soliric" className="min-h-11 inline-flex items-center"><Logo size={26} /></Link>

        <div className="hidden lg:flex items-center gap-1" style={{ color: 'rgba(247,239,229,0.74)' }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`${linkClass(l.href)} gap-2`} aria-current={active(l.href) ? 'page' : undefined}>
              {l.label}{l.href === '/collaborations' && <PendingBadge count={pending} />}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link href="/new" className="sol-btn-primary hidden sm:inline-flex items-center min-h-11 px-4 text-sm">{t('Registrar una letra')}</Link>
          {userId ? (
            <UserMenu />
          ) : (
            <button onClick={login} className="sol-btn-ghost hidden lg:inline-flex items-center gap-2 min-h-11 px-4 text-sm">
              <LogIn className="w-4 h-4" aria-hidden /> {t('Ingresar')}
            </button>
          )}
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('Menú')} className="lg:hidden p-2.5 rounded-lg hover:bg-white/10" style={{ color: '#f7efe5' }}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="lg:hidden border-t px-5 py-3 space-y-1 animate-fade-in" style={{ borderColor: 'rgba(247,239,229,0.12)', color: 'rgba(247,239,229,0.82)' }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`${linkClass(l.href)} w-full justify-between`}>
              {l.label}{l.href === '/collaborations' && <PendingBadge count={pending} />}
            </Link>
          ))}
          <Link href="/new" onClick={() => setOpen(false)} className="sol-btn-primary flex items-center justify-center min-h-11 px-4 text-sm mt-2">{t('Registrar una letra')}</Link>
          {userId
            ? <button onClick={() => { setOpen(false); logout(); }} className={`${linkClass('')} w-full`}>{t('Cerrar sesión')}</button>
            : <button onClick={() => { setOpen(false); login(); }} className={`${linkClass('')} w-full`}>{t('Ingresar')}</button>}
        </div>
      )}
    </header>
  );
}

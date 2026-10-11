import type { Metadata } from 'next';
import Link from 'next/link';
import { isNotNull, desc, sql } from 'drizzle-orm';
import { ExternalLink, Gavel, Lock, ScanSearch, ShieldCheck, Users, Globe } from 'lucide-react';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import HeroSeal from '@/components/soliric/landing/HeroSeal';
import CopyText from '@/components/soliric/landing/CopyText';
import CodeBlock from '@/components/soliric/CodeBlock';
import { PROGRAM_ID, CLUSTER } from '@/lib/soliric/client';
import { explorerAddr } from '@/lib/soliric/links';
import { getT } from '@/lib/i18n/server';
import { localeOf } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  const title = t('Soliric · Dejá registrado que la escribiste vos');
  const description = t('Soliric sella en Solana tu declaración de autoría: fecha, autores y reparto, sin publicar una sola palabra.');
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title, description,
    openGraph: { title, description, type: 'website', siteName: 'Soliric' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

async function liveStats() {
  try {
    const registered = isNotNull(works.workPda);
    const [[count], latest] = await Promise.all([
      db.select({ n: sql<string>`count(*)` }).from(works).where(registered),
      db.select({ fingerprint: works.fingerprint, registeredAt: works.registeredAt, status: works.onchainStatus })
        .from(works).where(registered).orderBy(desc(works.registeredAt)).limit(4),
    ]);
    return { total: Number(count?.n ?? 0), latest: latest.filter((r) => r.fingerprint) };
  } catch {
    return null;
  }
}

export default async function SoliricLanding() {
  const { t, lang } = await getT();
  const stats = await liveStats();
  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const muted = { color: 'var(--l-muted)' };
  const line = { borderColor: 'var(--l-line)' };
  const container = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

  return (
    <div className="soliric-landing relative min-h-dvh overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:text-black focus:px-3 focus:py-2">
        {t('Saltar al contenido')}
      </a>

      <main id="main">
        {/* ── Hero ── */}
        <section className="sol-hero-glow relative">
          <div className={`${container} grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 items-center py-16 sm:py-24`}>
            <div className="space-y-7">
              <h1 className="font-heading text-[clamp(2.4rem,6.2vw,4.7rem)] leading-[1.02] tracking-tight max-w-[14ch]">
                {t('Dejá registrado que la escribiste vos, y cuándo.')}
              </h1>
              <p className="text-lg leading-relaxed max-w-[52ch]" style={muted}>
                {t('Soliric sella en Solana tu declaración de autoría con fecha, autores y reparto, sin publicar una sola palabra. Cualquiera puede comprobarlo, sin cuenta.')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/new" className="sol-btn-primary inline-flex items-center min-h-12 px-6 text-base">{t('Registrar mi letra')}</Link>
                <Link href="/verify" className="sol-btn-ghost inline-flex items-center min-h-12 px-6 text-base">{t('Verificar una letra')}</Link>
              </div>
              <p className="text-sm max-w-[52ch]" style={{ color: 'var(--l-faint)' }}>
                {t('Tus primeros 3 registros son gratis. Hoy corre en la red de pruebas (devnet) de Solana.')}
              </p>
            </div>
            <HeroSeal key={lang} />
          </div>
        </section>

        {/* ── Qué queda privado y qué va a la cadena ── */}
        <section id="how" className="border-t py-20 sm:py-28" style={line}>
          <div className={`${container} grid gap-14 lg:grid-cols-[0.9fr_1.1fr]`}>
            <div className="space-y-5 lg:sticky lg:top-28 self-start">
              <h2 className="font-heading text-3xl sm:text-4xl leading-tight max-w-[18ch]">{t('Tu letra se queda con vos. Solo su huella es pública.')}</h2>
              <p className="leading-relaxed max-w-[50ch]" style={muted}>
                {t('Una huella es un código único que sale de tu texto. Sirve para comprobar que una letra existía en una fecha, pero no permite leerla ni reconstruirla.')}
              </p>
            </div>
            <div className="space-y-10">
              <div className="grid gap-px rounded-3xl overflow-hidden sm:grid-cols-2" style={{ background: 'var(--l-line)' }}>
                <div className="p-6 space-y-3" style={{ background: 'var(--l-surface)' }}>
                  <h3 className="flex items-center gap-2 font-semibold"><Lock className="w-4 h-4 text-[var(--ember-soft)]" aria-hidden /> {t('Queda guardado en Soliric, en privado')}</h3>
                  <ul className="space-y-2 text-[15px]" style={muted}>
                    <li>{t('La letra y los acordes')}</li>
                    <li>{t('Tus datos personales')}</li>
                    <li>{t('Los borradores y el texto de cada versión')}</li>
                  </ul>
                </div>
                <div className="p-6 space-y-3" style={{ background: 'var(--l-raised)' }}>
                  <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="w-4 h-4 text-[var(--sol-green)]" aria-hidden /> {t('Se escribe en Solana')}</h3>
                  <ul className="space-y-2 text-[15px]" style={muted}>
                    <li>{t('La huella SHA-256 de la letra')}</li>
                    <li>{t('La fecha del registro')}</li>
                    <li>{t('Las wallets de los autores y su reparto')}</li>
                    <li>{t('El estado: abierta, registrada, disputada')}</li>
                  </ul>
                </div>
              </div>

              <ol className="space-y-6">
                {([
                  ['Cargás tu letra', 'Pegá la letra y sumá a tus coautores si los hay, o dejá que lo haga la app que ya usás.'],
                  ['La registrás', 'Sacamos la huella, la firmamos con tu wallet y queda guardada en Solana. No necesitás tener cripto.'],
                  ['Cualquiera la verifica', 'Pegando la letra en el verificador, sin cuenta. La respuesta se lee directo de la cadena.'],
                ] as const).map(([title, text], i) => (
                  <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                    <span className="mono flex h-10 w-10 items-center justify-center rounded-full border text-sm" style={{ ...line, color: 'var(--ember-soft)' }} aria-hidden>{i + 1}</span>
                    <div>
                      <h3 className="font-semibold">{t(title)}</h3>
                      <p className="mt-1 max-w-[52ch] leading-relaxed" style={muted}>{t(text)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Funciones ── */}
        <section id="features" className="border-t py-20 sm:py-28" style={line}>
          <div className={`${container} space-y-12`}>
            <h2 className="font-heading text-3xl sm:text-4xl leading-tight max-w-[22ch]">{t('Pensado para que nadie se quede con lo tuyo.')}</h2>
            <div className="grid gap-5 md:grid-cols-6">
              <article className="md:col-span-4 rounded-3xl border p-7 space-y-5" style={{ ...line, background: 'var(--l-surface)' }}>
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xl font-heading"><Users className="w-5 h-5 text-[var(--ember-soft)]" aria-hidden /> {t('Coautoría con reparto firmado')}</h3>
                  <p className="max-w-[56ch] leading-relaxed" style={muted}>{t('Invitás a tus coautores. El reparto sale de lo que aportó cada uno y todos lo tienen que firmar: si alguno no lo acepta, vuelve todo atrás.')}</p>
                </div>
                <div className="space-y-3" role="img" aria-label={t('Ejemplo: Ana 62 por ciento, Leo 38 por ciento, ambos firmaron')}>
                  <p className="mono text-xs" style={muted}>{t('Ejemplo')}</p>
                  {([['Ana', 62], ['Leo', 38]] as const).map(([name, pct]) => (
                    <div key={name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm"><span>{name}</span><span className="mono inline-flex items-center gap-2">{pct} % <ShieldCheck className="w-4 h-4 text-[var(--sol-green)]" aria-hidden /></span></div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--l-line)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--ember)' }} /></div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="md:col-span-2 rounded-3xl p-7 space-y-5" style={{ background: 'var(--l-raised)' }}>
                <h3 className="flex items-center gap-2 text-xl font-heading"><ScanSearch className="w-5 h-5 text-[var(--ember-soft)]" aria-hidden /> {t('Detecta las copias')}</h3>
                <p className="leading-relaxed" style={muted}>{t('Antes de registrar, compara con catálogos públicos y con todo lo ya registrado, aunque cambien una coma o una palabra.')}</p>
                <p className="mono rounded-2xl p-4 text-[13px] leading-relaxed" style={{ background: 'var(--l-bg)' }}>
                  {t('Ejemplo')}: {t('Una palabra de más')}<br /><span className="text-[var(--ember-soft)]">97 % {t('de coincidencia')}</span> · {t('bloqueada')}
                </p>
              </article>

              <article className="md:col-span-2 rounded-3xl border p-7 space-y-5" style={{ ...line, background: 'var(--l-surface)' }}>
                <h3 className="flex items-center gap-2 text-xl font-heading"><Gavel className="w-5 h-5 text-[var(--ember-soft)]" aria-hidden /> {t('Impugnaciones con revisión')}</h3>
                <p className="leading-relaxed" style={muted}>{t('Cualquiera puede denunciar un registro con una fuente. Una persona lo revisa antes de congelar nada, y el autor puede responder.')}</p>
              </article>

              <article className="sol-ring md:col-span-4 p-7 space-y-5">
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xl font-heading"><Globe className="w-5 h-5 text-[var(--sol-green)]" aria-hidden /> {t('Verificación abierta')}</h3>
                  <p className="max-w-[56ch] leading-relaxed" style={muted}>{t('Pegás una letra y la respuesta sale directo de la blockchain: quién la registró, cuándo y con qué reparto. Sin cuenta y sin pedirle permiso a nadie.')}</p>
                </div>
                <Link href="/verify" className="sol-btn-ghost inline-flex items-center min-h-11 px-5 text-sm">{t('Verificar una letra')}</Link>
              </article>
            </div>
          </div>
        </section>

        {/* ── En vivo ── */}
        {stats && stats.total > 0 && (
          <section className="border-t py-16 sm:py-20" style={line} aria-label={t('En vivo desde el registro')}>
            <div className={`${container} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] items-start`}>
              <div>
                <p className="mono text-6xl sm:text-7xl leading-none text-[var(--sol-green)]">{stats.total}</p>
                <p className="mt-3 text-lg" style={muted}>{stats.total === 1 ? t('obra registrada en Solana') : t('obras registradas en Solana')}</p>
              </div>
              <ul className="divide-y rounded-3xl border" style={{ ...line, background: 'var(--l-surface)' }}>
                {stats.latest.map((r) => (
                  <li key={r.fingerprint} className="border-inherit">
                    <Link href={`/registry/${r.fingerprint}`} className="flex items-center justify-between gap-4 px-5 py-4 min-h-14 hover:bg-white/5 transition-colors">
                      <code className="mono text-[13px] sm:text-sm truncate">{r.fingerprint!.slice(0, 12)}…{r.fingerprint!.slice(-8)}</code>
                      <span className="text-sm shrink-0" style={muted}>{fmtDate(r.registeredAt)}</span>
                    </Link>
                  </li>
                ))}
                <li className="px-5 py-3.5 text-sm"><Link href="/registry" className="font-semibold text-[var(--ember-soft)] hover:underline">{t('Ver todas las obras registradas')}</Link></li>
              </ul>
            </div>
          </section>
        )}

        {/* ── Costos ── */}
        <section id="cost" className="border-t py-20 sm:py-28" style={line}>
          <div className={`${container} grid gap-12 lg:grid-cols-2 items-start`}>
            <div className="space-y-5">
              <h2 className="font-heading text-3xl sm:text-4xl leading-tight max-w-[18ch]">{t('Lo que cuesta, sin letra chica.')}</h2>
              <p className="leading-relaxed max-w-[52ch]" style={muted}>
                {t('Son los costos reales medidos en devnet. Casi todo es el alquiler de las cuentas que guardan tu registro: la comisión de la red en sí es de 0,000005 SOL.')}
              </p>
              <p className="leading-relaxed max-w-[52ch]" style={muted}>
                {t('No necesitás wallet ni SOL: creamos una por vos y cubrimos la comisión. Podés exportarla a Phantom cuando quieras. Tus primeros 3 registros son gratis.')}
              </p>
            </div>
            <dl className="grid gap-px rounded-3xl overflow-hidden" style={{ background: 'var(--l-line)' }}>
              {([['0,0048 SOL', 'por registro de una obra'], ['0,0015 SOL', 'por cada versión nueva']] as const).map(([value, label]) => (
                <div key={label} className="p-7" style={{ background: 'var(--l-surface)' }}>
                  <dt className="text-sm" style={muted}>{t(label)}</dt>
                  <dd className="mono mt-2 text-4xl sm:text-5xl">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Integraciones ── */}
        <section className="border-t py-20 sm:py-28" style={line}>
          <div className={`${container} grid gap-12 lg:grid-cols-2 items-center`}>
            <div className="space-y-5">
              <h2 className="font-heading text-3xl sm:text-4xl leading-tight max-w-[18ch]">{t('Pensado para enchufarse a cualquier app.')}</h2>
              <p className="leading-relaxed max-w-[52ch]" style={muted}>
                {t('Soliric es un servicio con API abierta. Una app para escribir letras, un sitio de letras o la plataforma de un sello pueden registrar las letras de sus usuarios con una sola llamada. Fogón, la app para escribir letras con acordes, es la primera.')}
              </p>
              <Link href="/developers" className="sol-btn-ghost inline-flex items-center min-h-11 px-5 text-sm">{t('Ver la documentación de la API')}</Link>
            </div>
            <CodeBlock label="POST /api/v1/works" code={`curl -X POST $SOLIRIC/api/v1/works \\
  -H "Authorization: Bearer sol_live_…" \\
  -d '{ "title": "After three",
        "author": { "name": "Mati", "email": "…" },
        "lyrics": "I woke up wanting to sing…",
        "attestation": true }'`} />
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="sol-hero-glow border-t py-24 sm:py-32 text-center" style={line}>
          <div className={`${container} space-y-8`}>
            <h2 className="font-heading text-4xl sm:text-6xl leading-[1.05] tracking-tight mx-auto max-w-[18ch]">
              {t('Tu próxima letra, con una fecha que nadie puede cambiar.')}
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/new" className="sol-btn-primary inline-flex items-center min-h-12 px-7 text-base">{t('Registrar mi letra')}</Link>
              <Link href="/registry" className="sol-btn-ghost inline-flex items-center min-h-12 px-7 text-base">{t('Ver el registro público')}</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Pie ── */}
      <footer className="border-t py-10" style={line}>
        <div className={`${container} flex flex-col gap-6 md:flex-row md:items-center md:justify-between text-sm`} style={muted}>
          <div className="space-y-2">
            <p>{t('Soliric es de código abierto en lo que importa: dónde corre.')}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{t('Programa en')} {CLUSTER}:</span>
              <CopyText value={PROGRAM_ID.toBase58()} shown={`${PROGRAM_ID.toBase58().slice(0, 6)}…${PROGRAM_ID.toBase58().slice(-6)}`} />
              <a href={explorerAddr(PROGRAM_ID.toBase58(), CLUSTER)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline text-[var(--ember-soft)]">
                {t('Ver en el Explorer')} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            </p>
          </div>
          <div className="flex gap-5">
            <Link href="/registry" className="hover:underline">{t('Registro')}</Link>
            <Link href="/verify" className="hover:underline">{t('Verificar')}</Link>
            <Link href="/developers" className="hover:underline">{t('Desarrolladores')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

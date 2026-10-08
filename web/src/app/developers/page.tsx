import type { Metadata } from 'next';
import Link from 'next/link';
import { Boxes, KeyRound, Send, ShieldCheck } from 'lucide-react';
import CodeBlock from '@/components/soliric/CodeBlock';
import KeysPanel from '@/components/soliric/KeysPanel';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Developers · Soliric',
  description: 'Register authorship from your own app with one HTTP call.',
};

const muted = { color: 'var(--l-muted)' };
const line = { borderColor: 'var(--l-line)' };

// La documentación técnica va en inglés (es el idioma habitual de las docs de API); la gestión de claves sí se traduce.
export default async function DevelopersPage() {
  const { t } = await getT();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://YOUR-SOLIRIC-DOMAIN';

  const create = `curl -X POST ${base}/api/v1/works \\
  -H "Authorization: Bearer sol_live_XXXXXXXX" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "After three",
    "artist": "Mati",
    "author": { "name": "Matías Terrera", "email": "mati@example.com" },
    "lyrics": "I woke up wanting to sing to the moon\\nand the empty street kept me company",
    "attestation": true,
    "externalRef": "your-song-id-123"
  }'`;
  const created = `{
  "id": "3f6c1a52-…",
  "externalRef": "your-song-id-123",
  "status": "closing",
  "fingerprint": "e4f1327390d7c1ed4e86b052ab0cb0d7ebc597cc…",
  "workAddress": "8WfSnAoL6W4KsU9tEwTGo1R1x4JihUCs2tmzp7rido1H",
  "registryUrl": "${base}/registry/e4f1327390d7…",
  "signature": "5GYm7cnWRy4mmozF9UddfTPQE9ukvp4GG6zNYz1T…"
}`;
  const status = `curl ${base}/api/v1/works/3f6c1a52-… \\
  -H "Authorization: Bearer sol_live_XXXXXXXX"`;
  const verify = `curl -X POST ${base}/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -d '{ "lyrics": "I woke up wanting to sing to the moon…" }'`;

  const endpoints: [string, string, string][] = [
    ['POST', '/api/v1/works', 'Register a lyric for an author. Idempotent by externalRef.'],
    ['GET', '/api/v1/works', 'List your app\'s works, or look one up with ?externalRef=.'],
    ['GET', '/api/v1/works/{id}', 'Status, split read from the chain, and any open dispute.'],
    ['POST', '/api/v1/works/{id}/respond', 'Send the author\'s response to an open dispute.'],
    ['GET', '/api/v1/verify?hash=', 'Public. Look up a registration by its fingerprint.'],
    ['POST', '/api/v1/verify', 'Public. Paste a lyric and find out whether it is registered.'],
  ];

  return (
    <div className="soliric-landing min-h-dvh">
      <main className="mx-auto w-full max-w-4xl px-5 sm:px-8 py-14 sm:py-20 space-y-16">
        <header className="space-y-5">
          <h1 className="font-heading text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.05] tracking-tight max-w-[18ch]" style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}>
            Register authorship from your own app.
          </h1>
          <p className="text-lg leading-relaxed max-w-[60ch]" style={muted}>
            Soliric is a service, not a closed app. Any songwriting tool, lyrics site or label platform can register its users&apos; lyrics on Solana
            with one HTTP call. Fogón, a lyric-writing app, is the first one doing it.
          </p>
        </header>

        <section aria-label="How it works" className="grid gap-px rounded-3xl overflow-hidden sm:grid-cols-3" style={{ background: 'var(--l-line)' }}>
          {([
            [KeyRound, 'Create a key', 'One key per app. It is shown once and stored only as a hash.'],
            [Send, 'Send the lyric', 'When your user asks to register, POST the lyric with their name and email. No wallet or crypto needed on your side.'],
            [ShieldCheck, 'Link to the proof', 'You get a public registry URL anyone can open, and a fingerprint that anyone can verify.'],
          ] as const).map(([Icon, title, text]) => (
            <div key={title} className="p-6 space-y-2" style={{ background: 'var(--l-surface)' }}>
              <Icon className="w-5 h-5 text-[var(--ember-soft)]" aria-hidden />
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm leading-relaxed" style={muted}>{text}</p>
            </div>
          ))}
        </section>

        <section className="space-y-5" aria-labelledby="quickstart">
          <h2 id="quickstart" className="font-heading text-2xl sm:text-3xl">Quickstart</h2>
          <CodeBlock label="Register a lyric" code={create} />
          <CodeBlock label="201 Created" code={created} />
          <p className="text-sm leading-relaxed max-w-[64ch]" style={muted}>
            Only the fingerprint, the date and the authors&apos; wallets go on-chain. The lyric stays in Soliric and is never published.
            A new registration enters a public dispute window (<code className="mono">closing</code>) before it becomes <code className="mono">final</code>.
          </p>
          <CodeBlock label="Check the status" code={status} />
          <CodeBlock label="Verify a lyric (no key needed)" code={verify} />
        </section>

        <section className="space-y-4" aria-labelledby="reference">
          <h2 id="reference" className="font-heading text-2xl sm:text-3xl">Reference</h2>
          <div className="rounded-3xl overflow-hidden border" style={line}>
            <table className="w-full text-sm">
              <caption className="sr-only">Endpoints</caption>
              <tbody className="divide-y" style={line}>
                {endpoints.map(([method, path, text]) => (
                  <tr key={method + path} className="align-top border-inherit">
                    <td className="p-4 w-20"><span className="mono text-xs font-bold text-[var(--sol-green)]">{method}</span></td>
                    <td className="p-4"><code className="mono text-[13px] break-all">{path}</code><p className="mt-1" style={muted}>{text}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="notes">
          <h2 id="notes" className="font-heading text-2xl sm:text-3xl">Good to know</h2>
          <ul className="space-y-3 text-sm leading-relaxed max-w-[68ch]" style={muted}>
            <li><strong className="text-[var(--l-text)]">The author attests.</strong> Send <code className="mono">&quot;attestation&quot;: true</code> only after your user accepted the declaration of authorship.</li>
            <li><strong className="text-[var(--l-text)]">Copies are rejected.</strong> Lyrics found in public catalogs or already registered (even with an extra word or comma) return <code className="mono">422</code> or <code className="mono">409</code>. If you imported the lyric from elsewhere, send <code className="mono">&quot;origin&quot;: &quot;imported&quot;</code> and it will be refused.</li>
            <li><strong className="text-[var(--l-text)]">Disputes.</strong> Anyone can dispute a registration with a source; an administrator reviews it before anything is frozen. Read the dispute in <code className="mono">GET /works/{'{id}'}</code> and answer with <code className="mono">/respond</code>.</li>
            <li><strong className="text-[var(--l-text)]">Limits.</strong> Each author gets free registrations, and each app has a daily cap. Beyond that you get <code className="mono">402</code> or <code className="mono">429</code>.</li>
            <li><strong className="text-[var(--l-text)]">Errors</strong> are JSON: <code className="mono">{'{ "error": "…", "code": "…" }'}</code>.</li>
          </ul>
        </section>

        <section className="space-y-4" aria-labelledby="keys">
          <h2 id="keys" className="font-heading text-2xl sm:text-3xl flex items-center gap-3"><Boxes className="w-6 h-6 text-[var(--ember-soft)]" aria-hidden /> {t('Tus claves de API')}</h2>
          <KeysPanel />
        </section>

        <p className="text-sm" style={{ color: 'var(--l-faint)' }}>
          <Link href="/verify" className="underline hover:text-white">{t('Verificar una letra')}</Link>
        </p>
      </main>
    </div>
  );
}

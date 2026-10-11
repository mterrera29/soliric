# Soliric

**Put on record that you wrote it — and when.** Soliric seals a signed declaration of authorship on Solana — the date, the authors and their split — without publishing a single word. Anyone can verify a registration, with no account.

> **What a registration is.** A dated, signed declaration: *this person said they wrote this lyric, with these co-authors, on this date* — fixed on-chain where nobody can change it afterwards. It is not a certificate that no one else wrote it first; that is what the disputes layer below is for.

It is a **service with an open API**, not a closed app: songwriting tools, lyrics sites or label platforms can register their users' lyrics with one HTTP call.

- Program (devnet): `5LWoTgRR5HD4pkPq4qQ38BEeaVfd6Uuvs3Svkm6X3MTJ`
- Web app + API: `web/` (Next.js 16)
- On-chain program: `programs/lyrics_solana/` (Anchor)

---

## The problem

A songwriter has no cheap, fast way to put on record that a lyric was theirs on a given date. Formal copyright registries are slow and expensive, and e-mailing yourself a draft is weak evidence. Meanwhile nothing stops someone from registering a lyric that isn't theirs.

## What Soliric does

1. **Fingerprints the lyric.** The text is normalized (no case, accents, punctuation, chords or section labels) and hashed with SHA-256. Only the fingerprint goes on-chain — the lyric never leaves Soliric's database.
2. **Registers it on Solana** with the authors' wallets, their split, and a memo that seals the title/author metadata (as a hash).
3. **Opens a public dispute window** before a registration becomes final.
4. **Lets anyone verify** a lyric by pasting it: the answer is read from the chain, tolerating small differences (an extra word, a missing line, a title on top).

### Co-authorship
Invite co-authors by e-mail. The split is computed from each person's contributions (a line-level diff of each saved version), everyone gets a window to object, and manual splits need every signature.

### Fighting copies (layered, with honest limits)
| Layer | What it does |
|---|---|
| Provenance | Anything marked as imported from another source is refused. |
| Catalog check | Compares the lyric with Genius, lrclib, Musixmatch and lyrics.ovh before registering. |
| Duplicate check | Rejects a lyric ≥75% similar to one already registered (word-trigram similarity), even with a changed comma or word. |
| Public dispute window | Solo registrations stay `closing` for a configurable period. |
| Disputes with triage | Anyone can report a registration with a source. A reviewer admits or rejects it **before anything is frozen**; if admitted, the work is frozen on-chain and the author can respond. The arbiter then revokes or dismisses. |
| Anti-troll limits | One active dispute per account, 3 per day, blocked after 2 failed ones. |

**Limits:** no automatic system can prove who composed an *unpublished* lyric. The registry proves *who registered what, when* — disputes and the signed declaration are the accountability layer. The arbiter is currently a single key (the treasury); see the roadmap.

## Architecture

```
 your app ──(API key)──▶  POST /api/v1/works ─┐
                                              ▼
 author on soliric.app ──▶  web (Next.js) ──▶ service layer ──▶ Anchor program (Solana)
                                  │                  │
                         Neon Postgres        custodial wallets (AES-256-GCM)
                       works · versions ·     treasury sponsors fees with caps
                       disputes · API keys
```

- **Custodial wallets.** Users don't need crypto: Soliric creates a wallet per user (encrypted at rest) and signs for them. They can export the key to Phantom at any time (requires a fresh login).
- **Sponsored fees.** The treasury funds each wallet *exactly* what an action needs, with a per-user cap and a global daily budget. Each author gets 3 free registrations.
- **Public API for partner apps.** API keys are shown once and stored hashed. See `/developers` in the app, or `web/src/app/api/v1`.

### How Soliric uses Solana

| | |
|---|---|
| **Program (devnet)** | [`5LWoTgRR5HD4pkPq4qQ38BEeaVfd6Uuvs3Svkm6X3MTJ`](https://explorer.solana.com/address/5LWoTgRR5HD4pkPq4qQ38BEeaVfd6Uuvs3Svkm6X3MTJ?cluster=devnet) |
| **A real registration** | [public record with its transaction](https://soliric.vercel.app/registry/9059fe7507bfed618cd86fc1490a4d501149a5f638778efc86a4e435def40094) |
| **Framework** | Anchor 1.2, tested with LiteSVM (19 tests) |

- **One PDA per work.** The address is derived from the SHA-256 fingerprint of the normalized lyric, so the same lyric can never be registered twice. Accounts: `Work`, `Version`, `Challenge`, `Config`.
- **16 instructions:** `create_work`, `add_collaborator`, `accept_invite`, `remove_invite`, `commit_version`, `propose_split`, `sign_split`, `object`, `finalize`, `reopen`, `set_license`, `create_derivative`, `init_config`, `set_arbiter`, `challenge`, `resolve_challenge`. Events are emitted for creation, versions, finalization and disputes.
- **Memo program.** Each registration also writes a memo that seals the hash of the title, author and date metadata and the hash of the signed declaration, so neither can be changed later.
- **Fee sponsorship.** A treasury keypair funds each author's wallet with exactly what an action needs (per-user cap and a daily budget), so authors need no SOL.
- **Where to look in the code**
  - `programs/lyrics_solana/src/lib.rs`: the Anchor program. `programs/lyrics_solana/tests/test_initialize.rs`: the LiteSVM tests.
  - `web/src/lib/soliric/idl.json` and `client.ts`: the generated IDL and the Anchor client (`@anchor-lang/core` with `@solana/web3.js`).
  - `web/src/lib/soliric/service.ts`: `registerWork`, `finalizeIfDue`, the dispute functions. `sponsor.ts` and `sponsor-policy.ts`: fee sponsorship. `verify.ts`: reads registrations back from the chain.
  - `web/src/app/api/v1/works/route.ts`: the public API that partner apps call.

## Costs (measured on devnet)

| Action | SOL |
|---|---|
| Register a work | ~0.0048 (almost all rent for the accounts holding the record) |
| Save a new version | ~0.0015 |
| Network fee only | 0.000005 |

## Run it locally

Prerequisites: Node 20+, a [Neon](https://neon.tech) database, a Firebase project (Google sign-in), Solana CLI.

```bash
cd web
cp .env.example .env.local        # fill it in (see below)
npm install
npm run db:push                   # creates the tables
npm run soliric:setup             # checks env, treasury balance and the on-chain config
npm run dev                       # http://localhost:3001
```

Environment (see `web/.env.example`): `DATABASE_URL`, the `NEXT_PUBLIC_FIREBASE_*` values and `FIREBASE_SERVICE_ACCOUNT_KEY`, `TREASURY_SECRET` (a funded devnet keypair), `WALLET_ENC_KEY` (`openssl rand -hex 32`), `SOLIRIC_ADMIN_UIDS` (who reviews disputes).

**Program** (only needed to redeploy):

```bash
cargo build-sbf --arch v0
mkdir -p target/test-deploy && cp target/deploy/lyrics_solana.so target/test-deploy/
cargo test                        # 19 tests
solana program deploy target/deploy/lyrics_solana.so --program-id <keypair> --max-len 300000 --url devnet
```

**Tests:** `cd web && npm test` (36 unit tests: fingerprints, similarity, policies, sponsorship limits, API keys, i18n).

## Deploy

Vercel (root `web/`) + Neon + the devnet program. Set the env vars above plus `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET`; `vercel.json` schedules the daily job that finalizes registrations whose dispute window has ended.

## Roadmap / known limitations

- Wallets are custodial; the next step is letting authors connect their own wallet.
- Works created through the API belong to a partner-managed identity; letting the author claim them with their own Google account is planned.
- Disputes are decided by one arbiter key; a committee or on-chain vote would remove that central point.
- Dispute deposits and paid plans (the cost model above) are designed but not enabled.
- Runs on Solana **devnet**.

## Credits

Built for a Solana hackathon. Developed with AI assistance (Claude Code). The Anchor program and the first prototype were written first; the web app, partner API and this repository were built afterwards.

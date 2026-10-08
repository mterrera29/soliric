# Soliric

**Prove your lyrics were yours first.** Soliric registers the authorship of a lyric on Solana — the date, the authors and their split — without publishing a single word. Anyone can verify a registration, with no account.

It is a **service with an open API**, not a closed app: songwriting tools, lyrics sites or label platforms can register their users' lyrics with one HTTP call.

- Program (devnet): `5LWoTgRR5HD4pkPq4qQ38BEeaVfd6Uuvs3Svkm6X3MTJ`
- Web app + API: `web/` (Next.js 16)
- On-chain program: `programs/lyrics_solana/` (Anchor)

---

## The problem

A songwriter has no cheap, fast way to prove a lyric was theirs on a given date. Formal copyright registries are slow and expensive, and e-mailing yourself a draft is weak evidence. Meanwhile nothing stops someone from registering a lyric that isn't theirs.

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

### On-chain program (`programs/lyrics_solana`)
`create_work`, `add_collaborator`, `accept_invite`, `commit_version`, `propose_split`, `sign_split`, `object`, `finalize`, `reopen`, `set_license`, `create_derivative`, `init_config`, `set_arbiter`, `challenge`, `resolve_challenge`. Accounts: `Work`, `Version`, `Challenge`, `Config`. Events are emitted for creation, versions, finalization and disputes. 19 LiteSVM tests cover the flows above.

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

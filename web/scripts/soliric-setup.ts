// Verifica la configuración de Soliric y deja lista la cuenta de configuración on-chain.
//   npx tsx scripts/soliric-setup.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { CLUSTER, PROGRAM_ID, configPda, connection, programFor, treasury } from '../src/lib/soliric/client';

const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string): never => { console.error(`  ✗ ${m}`); process.exit(1); };

async function main() {
  console.log(`Soliric · cluster ${CLUSTER} · programa ${PROGRAM_ID.toBase58()}\n`);

  for (const name of ['TREASURY_SECRET', 'WALLET_ENC_KEY', 'SOLANA_RPC_URL']) {
    if (!process.env[name]) fail(`falta ${name} en .env.local`);
  }
  if (!/^[0-9a-f]{64}$/i.test(process.env.WALLET_ENC_KEY!)) fail('WALLET_ENC_KEY tiene que ser 64 caracteres hexadecimales (openssl rand -hex 32)');
  ok('variables de entorno');

  const c = connection();
  const t = treasury();
  const balance = await c.getBalance(t.publicKey);
  console.log(`  · tesorería ${t.publicKey.toBase58()} · ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
  if (balance < 0.5 * LAMPORTS_PER_SOL) fail('la tesorería necesita saldo (cada wallet nueva recibe 0.1 SOL). En devnet: solana airdrop 2 <dirección> --url devnet');
  ok('tesorería con saldo');

  const program = await c.getAccountInfo(PROGRAM_ID);
  if (!program?.executable) fail(`el programa no está desplegado en ${CLUSTER}`);
  ok('programa desplegado');

  if (await c.getAccountInfo(configPda())) {
    ok('config on-chain ya inicializada');
  } else {
    await programFor(t).methods.initConfig(t.publicKey)
      .accounts({ config: configPda(), payer: t.publicKey, systemProgram: SystemProgram.programId }).rpc();
    ok('config on-chain creada (la tesorería es el árbitro)');
  }
  console.log('\nTodo listo. Reiniciá `npm run dev`.');
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });

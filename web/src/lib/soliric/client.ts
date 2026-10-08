import { AnchorProvider, Program, type Idl } from '@anchor-lang/core';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { ConfigError } from './http';
import idl from './idl.json';

export const PROGRAM_ID = new PublicKey((idl as { address: string }).address);
export const CLUSTER = process.env.SOLANA_CLUSTER || 'devnet';

let conn: Connection | null = null;
export function connection(): Connection {
  return (conn ??= new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed'));
}

let treasuryKp: Keypair | null = null;
/** Tesorería del servidor: paga las comisiones de las wallets custodiales y es el árbitro por defecto. */
export function treasury(): Keypair {
  if (treasuryKp) return treasuryKp;
  const raw = process.env.TREASURY_SECRET;
  if (!raw) throw new ConfigError('falta TREASURY_SECRET');
  treasuryKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  return treasuryKp;
}

export function programFor(kp: Keypair): Program<Idl> {
  const sign = <T extends { partialSign?: (k: Keypair) => void; sign?: (k: Keypair[]) => void }>(tx: T): T => {
    if (tx.partialSign) tx.partialSign(kp);
    else tx.sign?.([kp]);
    return tx;
  };
  const wallet = {
    publicKey: kp.publicKey,
    signTransaction: async <T,>(tx: T) => sign(tx as never) as T,
    signAllTransactions: async <T,>(txs: T[]) => txs.map((tx) => sign(tx as never) as T),
  };
  return new Program(idl as Idl, new AnchorProvider(connection(), wallet as never, { commitment: 'confirmed' }));
}

export const readProgram = () => programFor(treasury());

export const workPda = (id: Uint8Array) =>
  PublicKey.findProgramAddressSync([Buffer.from('work'), Buffer.from(id)], PROGRAM_ID)[0];

export const versionPda = (work: PublicKey, index: number) => {
  const n = Buffer.alloc(4);
  n.writeUInt32LE(index);
  return PublicKey.findProgramAddressSync([Buffer.from('version'), work.toBuffer(), n], PROGRAM_ID)[0];
};

export const configPda = () => PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID)[0];

export const challengePda = (work: PublicKey, challenger: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from('challenge'), work.toBuffer(), challenger.toBuffer()], PROGRAM_ID)[0];

/** Cuántos lamports faltan para que `target` llegue a `requiredBalance` (0 si ya alcanza). */
export async function topUpAmount(target: PublicKey, requiredBalance: number): Promise<number> {
  const balance = await connection().getBalance(target);
  return Math.max(0, requiredBalance - balance);
}

/** Transfiere desde la tesorería y espera la confirmación. */
export async function sendFromTreasury(target: PublicKey, lamports: number): Promise<string> {
  const c = connection();
  const t = treasury();
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: t.publicKey, toPubkey: target, lamports }));
  tx.feePayer = t.publicKey;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  tx.sign(t);
  const sig = await c.sendRawTransaction(tx.serialize());
  await c.confirmTransaction(sig, 'confirmed');
  return sig;
}

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}${CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`}`;
export const explorerAddr = (a: string) =>
  `https://explorer.solana.com/address/${a}${CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`}`;

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ConfigError } from './http';

function key(): Buffer {
  const raw = process.env.WALLET_ENC_KEY;
  if (!raw) throw new ConfigError('falta WALLET_ENC_KEY');
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new ConfigError('WALLET_ENC_KEY debe tener 32 bytes (hex o base64)');
  return buf;
}

/** AES-256-GCM. Formato: iv.tag.ciphertext (base64). */
export function encryptSecret(plain: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(payload: string): Uint8Array {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(enc), decipher.final()]));
}

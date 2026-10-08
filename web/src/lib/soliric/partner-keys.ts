import { createHash, randomBytes } from 'node:crypto';

export const KEY_PREFIX = 'sol_live_';

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Una clave nueva: `sol_live_` + 32 bytes aleatorios. Se muestra una sola vez; en la base queda solo su hash. */
export const generateKey = (): string => KEY_PREFIX + randomBytes(32).toString('base64url');

/** Lo que se muestra de una clave ya creada para reconocerla (no alcanza para usarla). */
export const keyPrefixOf = (key: string): string => key.slice(0, KEY_PREFIX.length + 4);

/** Uid sintético del autor cuando la obra la crea una app asociada (identificado por su email). */
export const externalUid = (partnerId: string, email: string) =>
  `ext:${partnerId}:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24)}`;

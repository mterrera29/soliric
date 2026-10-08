import { connection } from './client';

// Tamaños (en bytes, con el discriminador de 8) de las cuentas que crea el programa
const WORK_SIZE = 528;
const VERSION_SIZE = 157;
const CHALLENGE_SIZE = 116;
/** Margen para comisiones (una firma cuesta 5.000 lamports). */
const FEE_BUFFER = 10_000;

export type SponsoredAction = 'register' | 'version' | 'challenge' | 'tx';

const rent = (size: number) => connection().getMinimumBalanceForRentExemption(size);

/**
 * Saldo que debe tener la wallet para ejecutar la acción: la renta de las cuentas que crea, la comisión
 * y el mínimo para que la propia wallet siga existiendo (una cuenta no puede quedar con menos).
 */
export async function requiredBalance(action: SponsoredAction): Promise<number> {
  const floor = await rent(0);
  switch (action) {
    case 'register': return floor + (await rent(WORK_SIZE)) + (await rent(VERSION_SIZE)) + FEE_BUFFER;
    case 'version': return floor + (await rent(VERSION_SIZE)) + FEE_BUFFER;
    case 'challenge': return floor + (await rent(CHALLENGE_SIZE)) + FEE_BUFFER;
    case 'tx': return floor + FEE_BUFFER;
  }
}

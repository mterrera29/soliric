// Enlaces al Explorer (sin imports de servidor, se usan también en la UI).
const suffix = (cluster: string) => (cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`);
export const explorerTx = (sig: string, cluster: string) => `https://explorer.solana.com/tx/${sig}${suffix(cluster)}`;
export const explorerAddr = (addr: string, cluster: string) => `https://explorer.solana.com/address/${addr}${suffix(cluster)}`;

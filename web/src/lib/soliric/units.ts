/** Cantidad de cambio entre dos textos (diff LCS por línea); base del reparto automático. */
export function diffUnits(a: string, b: string): number {
  const A = a.split('\n');
  const B = b.split('\n');
  const dp = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0, j = 0, u = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { u += A[i].length || 1; i++; }
    else { u += B[j].length || 1; j++; }
  }
  for (; i < A.length; i++) u += A[i].length || 1;
  for (; j < B.length; j++) u += B[j].length || 1;
  return u;
}

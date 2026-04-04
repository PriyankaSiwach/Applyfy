/** Browser-safe non-crypto fingerprint for dev logs (payload before server cleaning). */
export function clientResumeFingerprint(raw: string): {
  length: number;
  djb2Hex: string;
} {
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i);
  }
  return {
    length: raw.length,
    djb2Hex: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

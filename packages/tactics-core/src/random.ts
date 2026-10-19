/** Mulberry32: explicit uint32 state in/out; no shared or ambient state.
 * The caller owns the sequence. Both the increment and final word wrap at 32 bits. */
export function nextRandom(state: number): readonly [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let word = Math.imul(next ^ (next >>> 15), next | 1);
  word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
  return [next, (word ^ (word >>> 14)) >>> 0];
}

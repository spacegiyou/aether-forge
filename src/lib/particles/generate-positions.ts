/** Deterministic particle positions — pure, no Math.random (A1 lint fix) */
export function generateParticlePositions(count: number, seed = 42): Float32Array {
  let state = seed;
  const arr = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    state = (state * 1103515245 + 12345) | 0;
    arr[i * 3] = ((state & 0xffff) / 0xffff - 0.5) * 20;
    state = (state * 1103515245 + 12345) | 0;
    arr[i * 3 + 1] = ((state & 0xffff) / 0xffff - 0.5) * 20;
    state = (state * 1103515245 + 12345) | 0;
    arr[i * 3 + 2] = ((state & 0xffff) / 0xffff - 0.5) * 20;
  }

  return arr;
}
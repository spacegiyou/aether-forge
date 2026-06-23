const WORDS = [
  "aether", "neural", "swarm", "cosmic", "forge", "agentic", "quantum",
  "synthesis", "multimodal", "inference", "tensor", "vector", "embed",
  "orchestrate", "deploy", "viral", "studio", "pipeline", "cascade",
  "resonance", "flux", "nexus", "prism", "lattice", "epoch", "signal",
];

/** Generate pseudo-random lorem text from a seed for reproducible demos */
export function generateLorem(seed: string, wordCount = 24): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    hash = (hash * 1103515245 + 12345) | 0;
    words.push(WORDS[Math.abs(hash) % WORDS.length]);
  }

  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}
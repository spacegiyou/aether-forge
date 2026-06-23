import { generateLorem } from "./lorem-generator";

export interface XThreadPost {
  index: number;
  text: string;
  engagement: number;
}

/** Generate a mock X (Twitter) thread from a goal */
export function generateXThread(goal: string): XThreadPost[] {
  const hook = `🚀 Just forged something wild with AetherForge: "${goal.slice(0, 80)}${goal.length > 80 ? "…" : ""}"`;
  const threads = [
    hook,
    `Thread 🧵 — How our agent swarm tackled this in under 60 seconds:\n\n1/ Researcher scanned X in real-time\n2/ Designer imagined the visual\n3/ Coder shipped TypeScript\n4/ Analyst charted the metrics`,
    generateLorem(goal + "-insight", 18),
    `The future of agentic AI isn't one model — it's a swarm.\n\nBuilt with @Grok Build ⚡\n\n#aetherforge #agenticAI #grok`,
  ];

  return threads.map((text, index) => ({
    index: index + 1,
    text,
    engagement: 120 + (goal.length * 3) + index * 47,
  }));
}
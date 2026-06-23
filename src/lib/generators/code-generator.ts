import { generateLorem } from "./lorem-generator";

export interface MockCodeOutput {
  language: string;
  filename: string;
  content: string;
}

/** Produce mock generated code from a user goal (simulation only) */
export function generateMockCode(goal: string): MockCodeOutput {
  const slug = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "agent-task";

  const comment = generateLorem(goal, 12);

  return {
    language: "typescript",
    filename: `${slug}.ts`,
    content: `// AetherForge Agent Output — simulated generation
// Goal: ${goal}
// ${comment}

import { orchestrate } from "@aetherforge/core";

export async function execute${toPascal(slug)}() {
  const agents = ["researcher", "designer", "coder", "analyst"];
  const result = await orchestrate({
    goal: "${goal.replace(/"/g, '\\"')}",
    agents,
    mode: "swarm",
  });
  return result.metrics;
}

export const metadata = {
  generatedAt: "${new Date().toISOString()}",
  confidence: ${(0.85 + (goal.length % 15) / 100).toFixed(2)},
};
`,
  };
}

function toPascal(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}
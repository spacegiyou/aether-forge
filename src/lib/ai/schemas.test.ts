import { describe, it, expect } from "vitest";
import { grokExecutionSchema } from "./schemas";

describe("grokExecutionSchema", () => {
  it("parses combined execution payload with code, thread, and chartData", () => {
    const payload = {
      steps: [{ agent: "coder", message: "Synthesizing TypeScript…" }],
      code: {
        language: "typescript",
        filename: "agent.ts",
        content: "export async function run() { return true; }",
      },
      imagePrompt: "Cosmic glassmorphism dashboard",
      thread: [{ index: 1, text: "Shipped with AetherForge" }],
      chartData: [{ name: "Throughput", value: 72, agents: 4 }],
      summary: "Goal executed by agent swarm.",
    };

    const parsed = grokExecutionSchema.parse(payload);
    expect(parsed.code.content).toContain("export async function");
    expect(parsed.thread[0].text).toContain("AetherForge");
    expect(parsed.chartData[0].name).toBe("Throughput");
    expect(parsed.steps).toHaveLength(1);
  });
});
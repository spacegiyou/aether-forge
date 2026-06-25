import { describe, it, expect } from "vitest";
import { buildExecutionSteps, processGoal } from "./goal-processor";
import { generateLorem } from "./lorem-generator";
import { generateChartData } from "./chart-generator";
import { generateXThread } from "./thread-generator";
import { generateMockCode } from "./code-generator";

describe("goal-processor", () => {
  it("buildExecutionSteps returns 6 steps for any goal", () => {
    const steps = buildExecutionSteps("Build an AI dashboard");
    expect(steps).toHaveLength(6);
    expect(steps[0].agent).toBe("researcher");
    expect(steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("processGoal returns all four output types", () => {
    const goal = "Ship viral agentic AI studio";
    const output = processGoal(goal);

    expect(output.code.content).toContain(goal);
    expect(output.code.filename).toMatch(/\.ts$/);
    expect(output.thread.length).toBeGreaterThanOrEqual(3);
    expect(output.chartData.length).toBe(6);
    expect(output.imagePlaceholder).toBeTruthy();
    expect(output.summary.length).toBeGreaterThan(10);
  });
});

describe("lorem-generator", () => {
  it("generateLorem is deterministic for same seed", () => {
    const a = generateLorem("test-seed", 10);
    const b = generateLorem("test-seed", 10);
    expect(a).toBe(b);
    expect(a.endsWith(".")).toBe(true);
  });

  it("generateLorem differs for different seeds", () => {
    expect(generateLorem("alpha")).not.toBe(generateLorem("beta"));
  });
});

describe("chart-generator", () => {
  it("generateChartData returns 6 data points with numeric values", () => {
    const data = generateChartData("metrics");
    expect(data).toHaveLength(6);
    data.forEach((d) => {
      expect(d.value).toBeGreaterThanOrEqual(40);
      expect(d.value).toBeLessThanOrEqual(99);
    });
  });
});

describe("thread-generator", () => {
  it("generateXThread includes goal in first post without engagement fields", () => {
    const goal = "Grok Build demo";
    const thread = generateXThread(goal);
    expect(thread[0].text).toContain("AetherForge");
    expect(thread.every((p) => "engagement" in p === false)).toBe(true);
    expect(thread.length).toBeGreaterThanOrEqual(3);
  });
});

describe("code-generator", () => {
  it("generateMockCode produces valid TypeScript structure", () => {
    const code = generateMockCode("hello world");
    expect(code.language).toBe("typescript");
    expect(code.content).toContain("export async function");
    expect(code.filename).toBe("hello-world.ts");
    expect(code.content).toContain("executeHelloWorld");
  });
});
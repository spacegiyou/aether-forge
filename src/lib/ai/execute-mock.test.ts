import { describe, it, expect } from "vitest";
import { streamMockExecution } from "./execute-mock";

describe("streamMockExecution", () => {
  it("yields meta, steps, output, and done without calling xAI", async () => {
    const events = [];
    for await (const event of streamMockExecution("Build a test swarm")) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: "meta", aiMode: "mock" });
    const steps = events.filter((e) => e.type === "step");
    expect(steps.length).toBeGreaterThanOrEqual(12); // 6 running + 6 complete
    expect(events.some((e) => e.type === "output")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });

    const outputEvent = events.find((e) => e.type === "output");
    if (outputEvent?.type === "output") {
      expect(outputEvent.output.code.content).toContain("export");
      expect(outputEvent.output.thread.length).toBeGreaterThan(0);
    }
  });
});
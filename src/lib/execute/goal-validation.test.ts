import { describe, it, expect } from "vitest";
import { validateGoal, extractExecuteError, MAX_GOAL_LENGTH } from "./goal-validation";
import { executeGoalAction } from "@/actions/execute-goal";

describe("validateGoal", () => {
  it("rejects empty goals", () => {
    const result = validateGoal("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("goal");
  });

  it("rejects goals over MAX_GOAL_LENGTH", () => {
    const result = validateGoal("x".repeat(MAX_GOAL_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_GOAL_LENGTH));
  });

  it("accepts valid goals", () => {
    const result = validateGoal("Build an agent swarm");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.trimmed).toBe("Build an agent swarm");
  });
});

describe("extractExecuteError", () => {
  it("returns error string when present", () => {
    expect(extractExecuteError({ error: "Failed" })).toBe("Failed");
  });

  it("returns null for success results", () => {
    expect(extractExecuteError({ steps: [], output: {} })).toBeNull();
  });
});

describe("executeGoalAction error path", () => {
  it("returns error for oversized goal via real server action", async () => {
    const result = await executeGoalAction("a".repeat(MAX_GOAL_LENGTH + 50));
    const err = extractExecuteError(result);
    expect(err).toContain(String(MAX_GOAL_LENGTH));
  });
});
"use server";

import { buildExecutionSteps, processGoal } from "@/lib/generators/goal-processor";
import { validateGoal } from "@/lib/execute/goal-validation";

/** Server Action — processes goal and returns mock swarm outputs */
export async function executeGoalAction(goal: string) {
  const validation = validateGoal(goal);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const { trimmed } = validation;

  // Simulate server-side processing delay
  await new Promise((r) => setTimeout(r, 400));

  return {
    steps: buildExecutionSteps(trimmed),
    output: processGoal(trimmed),
    executedAt: new Date().toISOString(),
  };
}
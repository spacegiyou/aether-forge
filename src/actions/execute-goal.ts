"use server";

import { buildExecutionSteps, processGoal } from "@/lib/generators/goal-processor";
import { validateGoal } from "@/lib/execute/goal-validation";

/**
 * Legacy server action — always uses mock generators (AI_MODE=mock path).
 * GoalExecutor uses /api/execute streaming; this remains for unit tests.
 */
export async function executeGoalAction(goal: string) {
  const validation = validateGoal(goal);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const { trimmed } = validation;

  return {
    steps: buildExecutionSteps(trimmed),
    output: processGoal(trimmed),
    executedAt: new Date().toISOString(),
  };
}
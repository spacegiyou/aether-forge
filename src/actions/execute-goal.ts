"use server";

import { buildExecutionSteps, processGoal } from "@/lib/generators/goal-processor";

/** Server Action — processes goal and returns mock swarm outputs */
export async function executeGoalAction(goal: string) {
  const trimmed = goal.trim();
  if (!trimmed) {
    return { error: "Please set a goal before executing." };
  }

  // Simulate server-side processing delay
  await new Promise((r) => setTimeout(r, 400));

  return {
    steps: buildExecutionSteps(trimmed),
    output: processGoal(trimmed),
    executedAt: new Date().toISOString(),
  };
}
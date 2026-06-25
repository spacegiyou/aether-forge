import { buildExecutionSteps, processGoal } from "@/lib/generators/goal-processor";
import type { ExecutionStep } from "@/lib/generators/goal-processor";
import type { ExecuteStreamEvent } from "./stream-events";

const MOCK_STEP_MS = 80;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Mock execution — uses existing generators, never calls xAI */
export async function* streamMockExecution(goal: string): AsyncGenerator<ExecuteStreamEvent> {
  yield { type: "meta", aiMode: "mock" };

  const planned = buildExecutionSteps(goal);

  for (const plannedStep of planned) {
    const running: ExecutionStep = { ...plannedStep, status: "running" };
    yield { type: "step", step: running };
    await delay(MOCK_STEP_MS);
    const complete: ExecutionStep = { ...plannedStep, status: "complete" };
    yield { type: "step", step: complete };
  }

  const output = processGoal(goal);
  yield {
    type: "output",
    output: {
      ...output,
      imageUrl: undefined,
      imageError: undefined,
      aiMode: "mock",
    },
  };
  yield { type: "done" };
}
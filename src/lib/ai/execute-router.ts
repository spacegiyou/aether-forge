import "server-only";

import { isMockMode } from "./env";
import { streamMockExecution } from "./execute-mock";
import { streamLiveExecution } from "./execute-live";
import type { ExecuteStreamEvent } from "./stream-events";

/** Route execution to mock generators or live Grok based on AI_MODE */
export function streamGoalExecution(goal: string): AsyncGenerator<ExecuteStreamEvent> {
  if (isMockMode()) {
    return streamMockExecution(goal);
  }
  return streamLiveExecution(goal);
}
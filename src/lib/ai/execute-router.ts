import "server-only";

import { resolveXaiCredential } from "./credentials";
import { streamMockExecution } from "./execute-mock";
import { streamLiveExecution } from "./execute-live";
import type { ExecuteStreamEvent } from "./stream-events";

/** Route execution to mock generators or live Grok based on resolved credential */
export async function* streamGoalExecution(
  goal: string
): AsyncGenerator<ExecuteStreamEvent> {
  const cred = await resolveXaiCredential();
  if (cred.source === "mock") {
    yield* streamMockExecution(goal);
    return;
  }
  yield* streamLiveExecution(goal, cred);
}
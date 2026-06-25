import type { ExecutionOutput, ExecutionStep } from "@/lib/generators/goal-processor";

/** NDJSON stream events from /api/execute */
export type ExecuteStreamEvent =
  | { type: "meta"; aiMode: "mock" | "live" }
  | { type: "step"; step: ExecutionStep }
  | { type: "output"; output: ExecutionOutput }
  | { type: "error"; error: string }
  | { type: "done" };

export function encodeStreamEvent(event: ExecuteStreamEvent): string {
  return JSON.stringify(event) + "\n";
}
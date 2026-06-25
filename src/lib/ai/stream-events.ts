import type { ExecutionOutput, ExecutionStep } from "@/lib/generators/goal-processor";
import type { CredentialSource } from "./credentials";

/** NDJSON stream events from /api/execute */
export type ExecuteStreamEvent =
  | { type: "meta"; aiMode: "mock" | "live"; source: CredentialSource }
  | { type: "step"; step: ExecutionStep }
  | { type: "output"; output: ExecutionOutput }
  | { type: "error"; error: string }
  | { type: "done" };

export function encodeStreamEvent(event: ExecuteStreamEvent): string {
  return JSON.stringify(event) + "\n";
}
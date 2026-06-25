import type { ExecuteStreamEvent } from "@/lib/ai/stream-events";

/** Parse NDJSON buffer into complete events — pure, testable */
export function parseNdjsonBuffer(buffer: string): {
  events: ExecuteStreamEvent[];
  remainder: string;
} {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  const events: ExecuteStreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    events.push(JSON.parse(trimmed) as ExecuteStreamEvent);
  }

  return { events, remainder };
}
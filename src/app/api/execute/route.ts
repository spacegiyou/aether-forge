import { validateGoal } from "@/lib/execute/goal-validation";
import { streamGoalExecution } from "@/lib/ai/execute-router";
import { encodeStreamEvent } from "@/lib/ai/stream-events";

export const runtime = "nodejs";

/** Streaming goal execution — NDJSON events for GoalExecutor */
export async function POST(request: Request): Promise<Response> {
  let goal = "";
  try {
    const body = (await request.json()) as { goal?: string };
    goal = body.goal ?? "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateGoal(goal);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of streamGoalExecution(validation.trimmed)) {
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
          if (event.type === "error" || event.type === "done") break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(
          encoder.encode(encodeStreamEvent({ type: "error", error: message }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
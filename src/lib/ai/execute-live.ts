import "server-only";

import { getGrokClient, getFastModel } from "./grok-client";
import { grokExecutionSchema } from "./schemas";
import { generateGrokImage } from "./generate-image";
import type { ExecutionOutput, ExecutionStep, AgentType } from "@/lib/generators/goal-processor";
import type { ExecuteStreamEvent } from "./stream-events";

const LIVE_STEP_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const EXECUTION_SYSTEM = `You are AetherForge, an agentic AI studio. Given a user goal, produce a complete execution result as valid JSON only.
Agents: researcher, designer, coder, analyst.
- steps: realistic swarm execution log entries
- code: real runnable TypeScript (language, filename, content with export async function)
- imagePrompt: concise prompt for image generation
- thread: genuine X posts with NO engagement metrics or like counts
- chartData: honest metric labels (name, value 0-100, agents count)
- summary: one-paragraph recap`;

/** Single structured Grok call — grok-code-fast-1 returns full execution payload */
async function fetchGrokExecution(goal: string) {
  const client = getGrokClient();
  const completion = await client.chat.completions.create({
    model: getFastModel(),
    messages: [
      { role: "system", content: EXECUTION_SYSTEM },
      {
        role: "user",
        content: `Goal: ${goal}\n\nReturn JSON: { steps: [{agent, message}], code: {language, filename, content}, imagePrompt, thread: [{index, text}], chartData: [{name, value, agents}], summary }`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Grok returned empty execution");
  return grokExecutionSchema.parse(JSON.parse(raw));
}

/** Live execution — real Grok API calls, server-only */
export async function* streamLiveExecution(goal: string): AsyncGenerator<ExecuteStreamEvent> {
  yield { type: "meta", aiMode: "live" };

  try {
    const execution = await fetchGrokExecution(goal);

    for (let i = 0; i < execution.steps.length; i++) {
      const s = execution.steps[i];
      const base: Omit<ExecutionStep, "status"> = {
        id: `step-${i}`,
        agent: s.agent as AgentType,
        message: s.message,
        timestamp: Date.now() + i * 800,
      };
      yield { type: "step", step: { ...base, status: "running" } };
      await delay(LIVE_STEP_MS);
      yield { type: "step", step: { ...base, status: "complete" } };
    }

    yield { type: "step", step: {
      id: "step-image",
      agent: "designer",
      message: "Generating image via Grok Imagine…",
      timestamp: Date.now(),
      status: "running",
    }};

    const imageResult = await generateGrokImage(execution.imagePrompt);

    yield { type: "step", step: {
      id: "step-image-done",
      agent: "designer",
      message: imageResult.url ? "Image generated" : "Image generation skipped",
      timestamp: Date.now(),
      status: "complete",
    }};

    const output: ExecutionOutput = {
      code: execution.code,
      imagePrompt: execution.imagePrompt,
      imagePlaceholder: execution.imagePrompt.slice(0, 32),
      thread: execution.thread,
      chartData: execution.chartData,
      summary: execution.summary,
      imageUrl: imageResult.url,
      imageError: imageResult.error,
      aiMode: "live",
    };

    yield { type: "output", output };
    yield { type: "done" };
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "Live execution failed",
    };
  }
}
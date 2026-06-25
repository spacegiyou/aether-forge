import { z } from "zod";

const agentSchema = z.enum(["researcher", "designer", "coder", "analyst"]);

const codeOutputSchema = z.object({
  language: z.string(),
  filename: z.string(),
  content: z.string(),
});

/** Single structured Grok response for goal execution (step 3 schema) */
export const grokExecutionSchema = z.object({
  steps: z.array(
    z.object({
      agent: agentSchema,
      message: z.string(),
    })
  ),
  code: codeOutputSchema,
  imagePrompt: z.string(),
  thread: z.array(
    z.object({
      index: z.number(),
      text: z.string(),
    })
  ),
  chartData: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      agents: z.number(),
    })
  ),
  summary: z.string(),
});

export const grokCodeSchema = codeOutputSchema;

export type GrokExecutionResult = z.infer<typeof grokExecutionSchema>;
export type GrokCodeResult = z.infer<typeof grokCodeSchema>;
import "server-only";

import type OpenAI from "openai";
import type { CredentialSource } from "./credentials";
import { isOAuthCompletionRejected } from "./grok-errors";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function extractResponsesText(response: OpenAI.Responses.Response): string {
  for (const item of response.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) {
          return part.text;
        }
      }
    }
  }
  return "";
}

/** Chat completion with OAuth fallback to /v1/responses */
export async function createGrokJsonCompletion(
  client: OpenAI,
  source: CredentialSource,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Grok returned empty execution");
    return raw;
  } catch (err) {
    if (source !== "oauth" || !isOAuthCompletionRejected(err)) {
      throw err;
    }

    const response = await client.responses.create({
      model,
      input: messages.map((m) => ({
        role: m.role,
        content: m.content,
        type: "message" as const,
      })),
      text: { format: { type: "json_object" } },
    });

    const raw = extractResponsesText(response);
    if (!raw) throw new Error("Grok returned empty execution");
    return raw;
  }
}
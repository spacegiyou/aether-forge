"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlowCanvas } from "./FlowCanvas";
import { OutputPanel } from "./OutputPanel";
import { parseNdjsonBuffer } from "@/lib/execute/parse-stream";
import { saveSession } from "@/lib/storage/supabase-mock";
import type { ExecutionStep, ExecutionOutput, AgentType } from "@/lib/generators/goal-processor";
import type { ExecuteStreamEvent } from "@/lib/ai/stream-events";

interface GoalExecutorProps {
  goal: string;
  onGoalChange: (goal: string) => void;
  draggingAgent?: AgentType | null;
  addAgentRequest?: { type: AgentType; key: number } | null;
}

function applyStreamEvent(
  event: ExecuteStreamEvent,
  setters: {
    setAiMode: (m: "mock" | "live") => void;
    setSteps: React.Dispatch<React.SetStateAction<ExecutionStep[]>>;
    setActiveAgent: (a: AgentType | null) => void;
    setOutput: (o: ExecutionOutput | null) => void;
    setError: (e: string | null) => void;
  }
): boolean {
  switch (event.type) {
    case "meta":
      setters.setAiMode(event.aiMode);
      return false;
    case "step": {
      const step = event.step;
      setters.setActiveAgent(step.status === "running" ? step.agent : null);
      setters.setSteps((prev) => {
        const existing = prev.findIndex((s) => s.id === step.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = step;
          return next;
        }
        return [...prev, step];
      });
      return false;
    }
    case "output":
      setters.setOutput(event.output);
      setters.setActiveAgent(null);
      return false;
    case "error":
      setters.setError(event.error);
      return true;
    case "done":
      setters.setActiveAgent(null);
      return true;
    default:
      return false;
  }
}

export function GoalExecutor({ goal, onGoalChange, draggingAgent, addAgentRequest }: GoalExecutorProps) {
  const [executing, setExecuting] = useState(false);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [output, setOutput] = useState<ExecutionOutput | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"mock" | "live">("mock");

  const handleExecute = async () => {
    if (executing) return;
    setExecuting(true);
    setSteps([]);
    setOutput(null);
    setActiveAgent(null);
    setError(null);

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Request failed (${res.status})`);
        setExecuting(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setExecuting(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let outputSummary: string | null = null;

      const setters = {
        setAiMode,
        setSteps,
        setActiveAgent,
        setOutput: (o: ExecutionOutput | null) => {
          setOutput(o);
          if (o) outputSummary = o.summary;
        },
        setError,
      };

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseNdjsonBuffer(buffer);
        buffer = remainder;

        for (const event of events) {
          finished = applyStreamEvent(event, setters);
          if (finished) break;
        }
      }

      if (outputSummary) {
        saveSession({
          id: `session-${Date.now()}`,
          goal,
          createdAt: new Date().toISOString(),
          outputs: { summary: outputSummary },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed unexpectedly.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <motion.div
        className="glass-panel rounded-xl border border-white/10 p-4"
        animate={executing ? { boxShadow: "0 0 30px rgba(34,211,238,0.2)" } : {}}
      >
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor="goal-input" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Set your goal
          </label>
          <Badge variant={aiMode === "live" ? "green" : "default"}>
            {aiMode === "live" ? "Live" : "Demo"}
          </Badge>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            data-testid="execute-error"
          >
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="goal-input"
            placeholder="e.g. Build a viral AI dashboard with real-time swarm viz…"
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            className="flex-1 h-12 text-base"
            data-testid="goal-input"
          />
          <Button
            size="lg"
            onClick={handleExecute}
            disabled={executing}
            data-testid="execute-btn"
            aria-label="Execute goal with agent swarm"
            className="shrink-0"
          >
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Execute
          </Button>
        </div>
      </motion.div>

      <div className="min-h-[240px] flex-1">
        <FlowCanvas
          executing={executing}
          activeAgent={activeAgent}
          draggingAgent={draggingAgent}
          addAgentRequest={addAgentRequest}
        />
      </div>

      <AnimatePresence>
        {steps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="glass-panel rounded-xl border border-white/10 p-3"
            data-testid="step-logs"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Execution Log
            </p>
            <ScrollArea className="h-28">
              {steps.map((step) => (
                <div key={step.id} data-testid="execution-step" className="flex items-center gap-2 py-1 text-[11px]">
                  <Badge
                    variant={
                      step.agent === "researcher" ? "default" :
                      step.agent === "designer" ? "violet" :
                      step.agent === "coder" ? "green" : "amber"
                    }
                  >
                    {step.agent}
                  </Badge>
                  <span className={step.status === "running" ? "text-cyan-300 animate-pulse" : "text-muted-foreground"}>
                    {step.message}
                  </span>
                  {step.status === "complete" && <span className="text-emerald-400">✓</span>}
                </div>
              ))}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      <OutputPanel output={output} aiMode={aiMode} />
    </div>
  );
}
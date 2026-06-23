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
import { executeGoalAction } from "@/actions/execute-goal";
import { saveSession } from "@/lib/storage/supabase-mock";
import type { ExecutionStep, ExecutionOutput } from "@/lib/generators/goal-processor";
import { sleep } from "@/lib/utils";

interface GoalExecutorProps {
  goal: string;
  onGoalChange: (goal: string) => void;
}

export function GoalExecutor({ goal, onGoalChange }: GoalExecutorProps) {
  const [executing, setExecuting] = useState(false);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [output, setOutput] = useState<ExecutionOutput | null>(null);

  const handleExecute = async () => {
    if (!goal.trim() || executing) return;
    setExecuting(true);
    setSteps([]);
    setOutput(null);

    const result = await executeGoalAction(goal);
    if ("error" in result && result.error) {
      setExecuting(false);
      return;
    }

    const { steps: planned, output: out } = result as {
      steps: ExecutionStep[];
      output: ExecutionOutput;
      executedAt: string;
    };

    // Animate steps sequentially
    for (let i = 0; i < planned.length; i++) {
      setSteps((prev) => [
        ...prev.map((s) => ({ ...s, status: "complete" as const })),
        { ...planned[i], status: "running" },
      ]);
      await sleep(600);
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === prev.length - 1 ? { ...s, status: "complete" } : s
        )
      );
    }

    setOutput(out);
    saveSession({
      id: `session-${Date.now()}`,
      goal,
      createdAt: new Date().toISOString(),
      outputs: { summary: out.summary },
    });
    setExecuting(false);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      {/* Goal input */}
      <motion.div
        className="glass-panel rounded-xl border border-white/10 p-4"
        animate={executing ? { boxShadow: "0 0 30px rgba(34,211,238,0.2)" } : {}}
      >
        <label htmlFor="goal-input" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Set your goal
        </label>
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
            disabled={executing || !goal.trim()}
            data-testid="execute-btn"
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

      {/* Canvas */}
      <div className="min-h-[240px] flex-1">
        <FlowCanvas executing={executing} />
      </div>

      {/* Step logs */}
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
                <div key={step.id} className="flex items-center gap-2 py-1 text-[11px]">
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

      <OutputPanel output={output} />
    </div>
  );
}
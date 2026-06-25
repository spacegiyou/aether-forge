import { generateMockCode, type MockCodeOutput } from "./code-generator";
import { generateChartData, type ChartDataPoint } from "./chart-generator";
import { generateXThread, type XThreadPost } from "./thread-generator";
import { generateLorem } from "./lorem-generator";

export type AgentType = "researcher" | "designer" | "coder" | "analyst";

export interface ExecutionStep {
  id: string;
  agent: AgentType;
  message: string;
  timestamp: number;
  status: "pending" | "running" | "complete";
}

export interface ExecutionOutput {
  code: MockCodeOutput;
  imagePrompt: string;
  imagePlaceholder: string;
  thread: XThreadPost[];
  chartData: ChartDataPoint[];
  summary: string;
  /** Real image URL from Grok Imagine (live mode) */
  imageUrl?: string;
  imageError?: string;
  /** Source mode for badge display */
  aiMode?: "mock" | "live";
  /** Resolved credential source for badge display */
  source?: "oauth" | "key" | "mock";
}

/** Build the step sequence for goal execution animation */
export function buildExecutionSteps(goal: string): ExecutionStep[] {
  const base = Date.now();
  const steps: Array<{ agent: AgentType; message: string }> = [
    { agent: "researcher", message: `Scanning X for signals related to "${goal.slice(0, 40)}…"` },
    { agent: "designer", message: "Generating visual concept via Imagine pipeline…" },
    { agent: "coder", message: "Synthesizing TypeScript agent orchestration layer…" },
    { agent: "analyst", message: "Computing swarm performance metrics…" },
    { agent: "researcher", message: "Packaging viral X thread draft…" },
    { agent: "coder", message: "Finalizing deploy-ready artifact bundle…" },
  ];

  return steps.map((s, i) => ({
    id: `step-${i}`,
    agent: s.agent,
    message: s.message,
    timestamp: base + i * 800,
    status: "pending" as const,
  }));
}

/** Aggregate all mock outputs for a completed goal execution */
export function processGoal(goal: string): ExecutionOutput {
  const trimmed = goal.trim() || "Build the future with agentic AI";

  return {
    code: generateMockCode(trimmed),
    imagePrompt: `Cosmic glassmorphism UI for: ${trimmed}`,
    imagePlaceholder: `aether-${trimmed.slice(0, 8).replace(/\s/g, "-").toLowerCase()}`,
    thread: generateXThread(trimmed),
    chartData: generateChartData(trimmed),
    summary: generateLorem(trimmed + "-summary", 20),
  };
}
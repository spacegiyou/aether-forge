"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentType } from "@/lib/generators/goal-processor";
import {
  Search,
  Palette,
  Code2,
  BarChart3,
  GripVertical,
  Play,
  Radio,
} from "lucide-react";

const AGENT_META: Record<
  AgentType,
  { label: string; icon: typeof Search; color: string; badge: "default" | "violet" | "green" | "amber" }
> = {
  researcher: { label: "Researcher", icon: Search, color: "from-cyan-500/20 to-cyan-600/5", badge: "default" },
  designer: { label: "Designer", icon: Palette, color: "from-violet-500/20 to-violet-600/5", badge: "violet" },
  coder: { label: "Coder", icon: Code2, color: "from-emerald-500/20 to-emerald-600/5", badge: "green" },
  analyst: { label: "Analyst", icon: BarChart3, color: "from-amber-500/20 to-amber-600/5", badge: "amber" },
};

interface AgentCardProps {
  type: AgentType;
  onDragStart: (type: AgentType) => void;
  onDragEnd?: () => void;
  onXSim?: () => void;
  onImagine?: () => void;
  xSimActive?: boolean;
}

export function AgentCard({ type, onDragStart, onDragEnd, onXSim, onImagine, xSimActive }: AgentCardProps) {
  const meta = AGENT_META[type];
  const Icon = meta.icon;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("agent-type", type);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(type);
      }}
      onDragEnd={() => onDragEnd?.()}
      data-testid={`agent-card-${type}`}
    >
    <motion.div
      layout
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "glass-panel group cursor-grab rounded-xl border border-white/10 bg-gradient-to-br p-3 active:cursor-grabbing",
        meta.color
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-foreground/80" />
            <span className="text-sm font-semibold">{meta.label}</span>
            <Badge variant={meta.badge} className="ml-auto text-[10px]">
              Agent
            </Badge>
          </div>

          {/* Researcher: X real-time sim */}
          {type === "researcher" && (
            <button
              onClick={(e) => { e.stopPropagation(); onXSim?.(); }}
              className="mt-2 flex w-full items-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5 text-[11px] hover:bg-white/10 transition-colors"
              data-testid="x-sim-btn"
            >
              <Radio className={cn("h-3 w-3", xSimActive && "text-cyan-400 animate-pulse")} />
              {xSimActive ? "Live X scan…" : "Start X real-time sim"}
            </button>
          )}

          {/* Designer: Imagine video button */}
          {type === "designer" && (
            <button
              onClick={(e) => { e.stopPropagation(); onImagine?.(); }}
              className="mt-2 flex w-full items-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5 text-[11px] hover:bg-white/10 transition-colors"
              data-testid="imagine-btn"
            >
              <Play className="h-3 w-3 text-violet-400" />
              Imagine video
            </button>
          )}
        </div>
      </div>
    </motion.div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { AgentCard } from "./AgentCard";
import type { AgentType } from "@/lib/generators/goal-processor";
import { generateLorem } from "@/lib/generators/lorem-generator";
import { ScrollArea } from "@/components/ui/scroll-area";

const AGENTS: AgentType[] = ["researcher", "designer", "coder", "analyst"];

interface AgentSidebarProps {
  onDragStart: (type: AgentType) => void;
}

export function AgentSidebar({ onDragStart }: AgentSidebarProps) {
  const [xSimActive, setXSimActive] = useState(false);
  const [xFeed, setXFeed] = useState<string[]>([]);
  const [imagineMsg, setImagineMsg] = useState("");

  useEffect(() => {
    if (!xSimActive) return;
    const interval = setInterval(() => {
      setXFeed((prev) => [
        generateLorem(`x-${Date.now()}`, 8),
        ...prev.slice(0, 4),
      ]);
    }, 2000);
    return () => clearInterval(interval);
  }, [xSimActive]);

  return (
    <aside className="glass-panel flex h-full w-full flex-col border-r border-white/10 md:w-64 lg:w-72" data-testid="agent-sidebar">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Agent Swarm
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          Drag agents onto the canvas
        </p>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-2">
          {AGENTS.map((type) => (
            <AgentCard
              key={type}
              type={type}
              onDragStart={onDragStart}
              xSimActive={type === "researcher" ? xSimActive : undefined}
              onXSim={() => setXSimActive((v) => !v)}
              onImagine={() => setImagineMsg(`🎬 Imagine: ${generateLorem("video", 10)}`)}
            />
          ))}
        </div>

        {xSimActive && xFeed.length > 0 && (
          <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2" data-testid="x-feed">
            <p className="mb-1 text-[10px] font-semibold text-cyan-400">X Live Feed</p>
            {xFeed.map((item, i) => (
              <p key={i} className="text-[10px] text-muted-foreground leading-relaxed border-t border-white/5 pt-1 mt-1">
                @{["grok", "xai", "aether"][i % 3]} · {item}
              </p>
            ))}
          </div>
        )}

        {imagineMsg && (
          <p className="mt-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 text-[10px] text-violet-300" data-testid="imagine-msg">
            {imagineMsg}
          </p>
        )}
      </ScrollArea>
    </aside>
  );
}
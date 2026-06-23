"use client";

import { useState } from "react";
import { LiveSwarmViz } from "./LiveSwarmViz";
import { MultimodalLab } from "./MultimodalLab";
import { OneClickDeploy } from "./OneClickDeploy";
import { ViralKit } from "./ViralKit";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "swarm", label: "Live Swarm Viz" },
  { id: "multimodal", label: "Multimodal Lab" },
  { id: "deploy", label: "One-Click Deploy" },
  { id: "viral", label: "Viral Kit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TabPanel() {
  const [active, setActive] = useState<TabId>("swarm");

  return (
    <div className="glass-panel flex h-full flex-col border-t border-white/10 md:border-t-0 md:border-l" data-testid="tab-panel">
      <div className="flex overflow-x-auto border-b border-white/10 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "shrink-0 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
              active === tab.id
                ? "border-b-2 border-cyan-400 text-cyan-300 bg-white/5"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {active === "swarm" && <LiveSwarmViz />}
        {active === "multimodal" && <MultimodalLab />}
        {active === "deploy" && <OneClickDeploy />}
        {active === "viral" && <ViralKit />}
      </div>
    </div>
  );
}
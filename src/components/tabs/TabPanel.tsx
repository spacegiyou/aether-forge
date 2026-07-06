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
      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "min-w-0 px-3 py-3 text-[11px] font-medium transition-colors sm:text-xs",
              active === tab.id
                ? "border-b-2 border-cyan-400 text-cyan-300 bg-white/5"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
            data-testid={`tab-${tab.id}`}
          >
            <span className="block truncate">{tab.label}</span>
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

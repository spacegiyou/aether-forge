"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { ParticleBackground } from "@/components/layout/ParticleBackground";
import { AgentSidebar } from "@/components/sidebar/AgentSidebar";
import { GoalExecutor } from "@/components/canvas/GoalExecutor";
import { TabPanel } from "@/components/tabs/TabPanel";
import type { AgentType } from "@/lib/generators/goal-processor";

export function AetherForgeApp() {
  const [goal, setGoal] = useState("Build a stunning agentic AI studio for 2026");
  const [, setDragging] = useState<AgentType | null>(null);

  return (
    <div className="relative flex min-h-screen flex-col">
      <ParticleBackground />
      <Header goal={goal} />

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar */}
        <div className="shrink-0 lg:w-72">
          <AgentSidebar onDragStart={setDragging} />
        </div>

        {/* Main canvas area */}
        <main className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 min-h-[400px]">
            <GoalExecutor goal={goal} onGoalChange={setGoal} />
          </div>
        </main>

        {/* Tabs panel */}
        <div className="shrink-0 lg:w-96 xl:w-[420px] min-h-[300px]">
          <TabPanel />
        </div>
      </div>
    </div>
  );
}
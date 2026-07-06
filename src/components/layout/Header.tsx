"use client";

import { Sparkles, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { GrokAuthControl } from "./GrokAuthControl";
import { downloadRepo } from "@/lib/export/repo-exporter";

interface HeaderProps {
  goal: string;
}

export function Header({ goal }: HeaderProps) {
  return (
    <header className="glass-panel sticky top-0 z-50 flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-500/30">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight md:text-base">
            AetherForge
          </h1>
          <p className="text-[10px] text-muted-foreground md:text-xs">
            Grok-Built AI Studio
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <GrokAuthControl />
        <Button
          variant="glass"
          size="sm"
          className="hidden sm:flex"
          onClick={() => downloadRepo(goal || "AetherForge demo")}
          data-testid="export-repo-btn"
        >
          <Download className="h-3.5 w-3.5" />
          Export Repo
        </Button>
        <Button variant="glass" size="icon" asChild>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

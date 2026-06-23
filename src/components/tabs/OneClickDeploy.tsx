"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateReadme } from "@/lib/generators/readme-generator";
import { Rocket, Copy, Check, FileText } from "lucide-react";

export function OneClickDeploy() {
  const [readme, setReadme] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateReadme = () => {
    setReadme(generateReadme("AetherForge Export", "Ship agentic AI experiences at lightspeed"));
  };

  const handleDeploy = async () => {
    setDeploying(true);
    await new Promise((r) => setTimeout(r, 2000));
    setDeploying(false);
    setDeployed(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(readme);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4" data-testid="tab-deploy">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold">One-Click Deploy</span>
        <Badge variant="green">Vercel Ready</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleGenerateReadme} variant="glass" data-testid="generate-readme-btn">
          <FileText className="h-4 w-4" />
          Generate README
        </Button>
        <Button
          onClick={handleDeploy}
          disabled={deploying}
          data-testid="vercel-deploy-btn"
        >
          {deploying ? (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Rocket className="h-4 w-4" />
            </motion.span>
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {deploying ? "Deploying…" : "Deploy to Vercel"}
        </Button>
      </div>

      {deployed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"
          data-testid="deploy-success"
        >
          <p className="text-sm font-semibold text-emerald-300">✓ Deployed successfully!</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Preview: <span className="text-cyan-400">https://aetherforge-demo.vercel.app</span> (simulated)
          </p>
        </motion.div>
      )}

      {readme && (
        <div className="relative">
          <Button
            variant="glass"
            size="sm"
            className="absolute right-2 top-2 z-10"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Textarea
            readOnly
            value={readme}
            className="min-h-[300px] font-mono text-[11px]"
            data-testid="readme-output"
          />
        </div>
      )}
    </div>
  );
}
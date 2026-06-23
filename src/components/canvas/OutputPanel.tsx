"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExecutionOutput } from "@/lib/generators/goal-processor";
import { Code2, ImageIcon, MessageCircle, BarChart3 } from "lucide-react";

interface OutputPanelProps {
  output: ExecutionOutput | null;
}

export function OutputPanel({ output }: OutputPanelProps) {
  if (!output) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 md:grid-cols-2"
        data-testid="output-panel"
      >
        {/* Mock Code */}
        <Card data-testid="output-code">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4 text-emerald-400" />
              Generated Code
              <Badge variant="green" className="ml-auto">{output.code.filename}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-36">
              <pre className="text-[10px] leading-relaxed text-emerald-300/90 font-mono whitespace-pre-wrap">
                {output.code.content}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Image Placeholder */}
        <Card data-testid="output-image">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-violet-400" />
              Generated Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/30 via-cyan-600/20 to-transparent border border-white/10">
              <div className="text-center">
                <div className="mx-auto mb-2 h-16 w-16 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 opacity-60 animate-pulse" />
                <p className="text-[10px] text-muted-foreground">{output.imagePrompt}</p>
                <Badge variant="violet" className="mt-1">{output.imagePlaceholder}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* X Thread */}
        <Card data-testid="output-thread">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-cyan-400" />
              X Thread Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-36">
              {output.thread.map((post) => (
                <div key={post.index} className="mb-2 rounded-lg bg-white/5 p-2 text-[11px] leading-relaxed">
                  <span className="text-cyan-400 font-semibold">{post.index}/</span> {post.text}
                  <span className="ml-2 text-muted-foreground">♥ {post.engagement}</span>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card data-testid="output-chart">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Swarm Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={output.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
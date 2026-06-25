"use client";

import { useState } from "react";
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
import { Code2, ImageIcon, MessageCircle, BarChart3, Loader2, AlertCircle } from "lucide-react";

interface OutputPanelProps {
  output: ExecutionOutput | null;
  aiMode?: "mock" | "live";
}

export function OutputPanel({ output, aiMode = "mock" }: OutputPanelProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);

  if (!output) return null;

  const showLiveImage = aiMode === "live" && output.imageUrl;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 md:grid-cols-2"
        data-testid="output-panel"
      >
        <Card data-testid="output-code">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="h-4 w-4 text-emerald-400" />
              Generated Code
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{output.code.filename}</span>
              <Badge variant={aiMode === "live" ? "green" : "default"}>
                {aiMode === "live" ? "Live" : "Demo"}
              </Badge>
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

        <Card data-testid="output-image">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4 text-violet-400" />
              Generated Image
              <Badge variant={showLiveImage ? "green" : "violet"} className="ml-auto">
                {showLiveImage ? "Live" : "Demo"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-violet-600/30 via-cyan-600/20 to-transparent">
              {output.imageError && (
                <div className="flex flex-col items-center gap-1 p-2 text-center" data-testid="output-image-error">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="text-[10px] text-red-300">{output.imageError}</p>
                </div>
              )}
              {showLiveImage && !output.imageError && (
                <>
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40" data-testid="output-image-loading">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                    </div>
                  )}
                  {imageFailed ? (
                    <p className="text-[10px] text-red-300">Failed to load image</p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={output.imageUrl}
                      alt={output.imagePrompt}
                      className="h-full w-full object-cover"
                      onLoad={() => setImageLoading(false)}
                      onError={() => { setImageLoading(false); setImageFailed(true); }}
                      data-testid="output-image-real"
                    />
                  )}
                </>
              )}
              {!showLiveImage && !output.imageError && (
                <div className="text-center">
                  <div className="mx-auto mb-2 h-16 w-16 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 opacity-60 animate-pulse" />
                  <p className="text-[10px] text-muted-foreground">{output.imagePrompt}</p>
                  <Badge variant="violet" className="mt-1">{output.imagePlaceholder}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="output-thread">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-cyan-400" />
              X Thread Draft
              <Badge variant={aiMode === "live" ? "green" : "default"} className="ml-auto">
                {aiMode === "live" ? "Live" : "Demo"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-36">
              {output.thread.map((post) => (
                <div key={post.index} className="mb-2 rounded-lg bg-white/5 p-2 text-[11px] leading-relaxed">
                  <span className="text-cyan-400 font-semibold">{post.index}/</span> {post.text}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="output-chart">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Swarm Metrics
              <Badge variant={aiMode === "live" ? "green" : "amber"} className="ml-auto">
                {aiMode === "live" ? "Live" : "Demo"}
              </Badge>
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
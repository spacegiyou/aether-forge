"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateXThread } from "@/lib/generators/thread-generator";
import { generateLorem } from "@/lib/generators/lorem-generator";
import { Share2, Image, Copy, Check } from "lucide-react";

export function ViralKit() {
  const [topic, setTopic] = useState("");
  const [thread, setThread] = useState<ReturnType<typeof generateXThread>>([]);
  const [images, setImages] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const t = topic.trim() || "AetherForge agentic AI studio";
    setThread(generateXThread(t));
    setImages([
      `gradient-cosmic-${Date.now()}`,
      `swarm-viz-${Date.now()}`,
      `glass-ui-${Date.now()}`,
      `chart-metric-${Date.now()}`,
    ]);
  };

  const handleCopyThread = async () => {
    const text = thread.map((p) => `${p.index}/ ${p.text}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4" data-testid="tab-viral">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-semibold">Viral Kit</span>
        <Badge variant="default">X Ready</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="What's going viral? e.g. Grok Build just shipped this…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="flex-1"
          data-testid="viral-topic"
        />
        <Button onClick={handleGenerate} data-testid="viral-generate">
          Generate Kit
        </Button>
      </div>

      {thread.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              X Thread
            </span>
            <Button variant="glass" size="sm" onClick={handleCopyThread}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy Thread
            </Button>
          </div>

          <div className="space-y-2" data-testid="viral-thread">
            {thread.map((post) => (
              <div key={post.index} className="glass-panel rounded-lg p-3 text-[12px] leading-relaxed">
                <span className="font-bold text-cyan-400">{post.index}/</span> {post.text}
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                  <span>♥ {post.engagement}</span>
                  <span>↻ {Math.floor(post.engagement / 3)}</span>
                </div>
              </div>
            ))}
          </div>

          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Image Pack
          </span>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="image-pack">
            {images.map((img, i) => (
              <motion.div
                key={img}
                whileHover={{ scale: 1.05 }}
                className="aspect-square rounded-xl border border-white/10 bg-gradient-to-br from-cyan-600/30 via-violet-600/20 to-transparent flex flex-col items-center justify-center p-2"
              >
                <Image className="h-6 w-6 text-white/40 mb-1" />
                <p className="text-[9px] text-center text-muted-foreground">{img}</p>
                <p className="text-[8px] text-white/30 mt-1">{generateLorem(img, 6)}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
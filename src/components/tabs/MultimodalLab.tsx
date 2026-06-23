"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateLorem } from "@/lib/generators/lorem-generator";
import { Play, Pause, Volume2, Wand2 } from "lucide-react";

export function MultimodalLab() {
  const [prompt, setPrompt] = useState("");
  const [playing, setPlaying] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [audioNote, setAudioNote] = useState("");

  const handleGenerate = () => {
    const p = prompt.trim() || "Cosmic agent swarm visualization";
    setGenerated(true);
    setPlaying(true);
    setAudioNote(generateLorem(p + "-audio", 16));
  };

  return (
    <div className="space-y-4" data-testid="tab-multimodal">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold">Multimodal Lab</span>
        <Badge variant="violet">Simulated</Badge>
      </div>

      <Textarea
        placeholder="Describe your video concept… e.g. 'Aether particles forming an AI brain in deep space'"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[80px]"
        data-testid="multimodal-prompt"
      />

      <Button onClick={handleGenerate} data-testid="multimodal-generate">
        <Play className="h-4 w-4" />
        Generate Multimodal
      </Button>

      {generated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-3"
        >
          {/* Fake video player */}
          <div
            className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 via-violet-950 to-cyan-950"
            data-testid="fake-video-player"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={playing ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 4, repeat: Infinity }}
                className="h-24 w-24 rounded-full bg-gradient-to-br from-cyan-400/40 to-violet-500/40 blur-sm"
              />
              <motion.div
                className="absolute text-center"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <p className="text-sm font-semibold text-white/80">AetherForge Video</p>
                <p className="text-[10px] text-white/50 mt-1">{prompt.slice(0, 60)}…</p>
              </motion.div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-black/50 px-3 py-2">
              <button onClick={() => setPlaying((p) => !p)} className="text-white/80 hover:text-white">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <div className="h-1 flex-1 rounded-full bg-white/20">
                <motion.div
                  className="h-full rounded-full bg-cyan-400"
                  animate={playing ? { width: ["0%", "100%"] } : {}}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <span className="text-[10px] text-white/60">0:00 / 0:08</span>
            </div>
          </div>

          {/* Audio note */}
          <div className="glass-panel rounded-xl p-3" data-testid="audio-note">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold">Audio Narration</span>
              <Badge variant="default">AI Voice</Badge>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground italic">
              &ldquo;{audioNote}&rdquo;
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateLorem } from "@/lib/generators/lorem-generator";
import {
  sourceBadgeLabel,
  sourceBadgeVariant,
  isLiveSource,
  type CredentialSource,
} from "@/lib/ai/source-badge";
import { Play, Pause, Volume2, Wand2, Loader2, AlertCircle } from "lucide-react";

export function MultimodalLab() {
  const [prompt, setPrompt] = useState("");
  const [playing, setPlaying] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [audioNote, setAudioNote] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [imageError, setImageError] = useState<string | undefined>();
  const [imageLoading, setImageLoading] = useState(false);
  const [imageSource, setImageSource] = useState<CredentialSource>("mock");

  const handleGenerate = async () => {
    const p = prompt.trim() || "Cosmic agent swarm visualization";
    setGenerated(true);
    setPlaying(true);
    setAudioNote(generateLorem(p + "-audio", 16));
    setImageUrl(undefined);
    setImageError(undefined);
    setImageLoading(true);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = (await res.json()) as {
        source?: CredentialSource;
        imageUrl?: string;
        imageError?: string;
      };
      setImageSource(data.source ?? "mock");
      setImageUrl(data.imageUrl);
      setImageError(data.imageError);
    } catch {
      setImageError("Image request failed");
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="tab-multimodal">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold">Multimodal Lab</span>
        <Badge variant="violet">Video Demo</Badge>
        <Badge variant={isLiveSource(imageSource) && imageUrl ? sourceBadgeVariant(imageSource) : "default"}>
          Image {isLiveSource(imageSource) && imageUrl ? sourceBadgeLabel(imageSource) : "Demo"}
        </Badge>
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
          {/* Fake video player — kept as Demo */}
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
                <p className="text-sm font-semibold text-white/80">AetherForge Video (Demo)</p>
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

          {/* Real / placeholder image from Grok Imagine */}
          <div className="glass-panel rounded-xl p-3" data-testid="multimodal-image">
            <p className="mb-2 text-xs font-semibold">Generated Image</p>
            {imageLoading && (
              <div className="flex h-32 items-center justify-center" data-testid="multimodal-image-loading">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            )}
            {!imageLoading && imageError && (
              <div className="flex items-center gap-2 text-[11px] text-red-300" data-testid="multimodal-image-error">
                <AlertCircle className="h-4 w-4" />
                {imageError}
              </div>
            )}
            {!imageLoading && imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={prompt}
                className="h-32 w-full rounded-lg object-cover"
                data-testid="multimodal-image-real"
              />
            )}
            {!imageLoading && !imageUrl && !imageError && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-violet-600/20 to-cyan-600/10">
                <p className="text-[10px] text-muted-foreground">Demo placeholder — run npm run auth:xai or set XAI_API_KEY</p>
              </div>
            )}
          </div>

          <div className="glass-panel rounded-xl p-3" data-testid="audio-note">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold">Audio Narration</span>
              <Badge variant="default">Demo</Badge>
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
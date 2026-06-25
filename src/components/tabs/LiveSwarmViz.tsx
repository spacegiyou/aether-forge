"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateChartData } from "@/lib/generators/chart-generator";
import { Activity, RefreshCw } from "lucide-react";

export function LiveSwarmViz() {
  const [data, setData] = useState(generateChartData("swarm-live"));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setData((prev) =>
        prev.map((d) => ({
          ...d,
          value: Math.max(20, Math.min(99, d.value + (Math.random() - 0.5) * 12)),
        }))
      );
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const agents = ["Researcher", "Designer", "Coder", "Analyst"];

  return (
    <div className="space-y-4" data-testid="tab-swarm-viz">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span className="text-sm font-semibold">Live Swarm Telemetry</span>
          <Badge variant="default">Demo</Badge>
        </div>
        <Button variant="glass" size="sm" onClick={() => setData(generateChartData(`refresh-${Date.now()}`))}>
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {agents.map((agent, i) => (
          <motion.div
            key={agent}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            className="glass-panel rounded-lg p-3 text-center"
          >
            <p className="text-[10px] text-muted-foreground">{agent}</p>
            <p className="text-lg font-bold text-cyan-300">{data[i]?.value ?? 0}%</p>
          </motion.div>
        ))}
      </div>

      <div className="glass-panel rounded-xl p-4">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Tick #{tick} — simulated real-time</p>
      </div>
    </div>
  );
}
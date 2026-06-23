export interface ChartDataPoint {
  name: string;
  value: number;
  agents: number;
}

/** Generate chart data seeded from goal text for Recharts */
export function generateChartData(goal: string): ChartDataPoint[] {
  let hash = 0;
  for (let i = 0; i < goal.length; i++) {
    hash = (hash << 5) - hash + goal.charCodeAt(i);
    hash |= 0;
  }

  const labels = ["Research", "Design", "Code", "Analysis", "Deploy", "Viral"];
  return labels.map((name, i) => {
    hash = (hash * 1664525 + 1013904223 + i) | 0;
    const value = 40 + (Math.abs(hash) % 55);
    return {
      name,
      value,
      agents: 1 + (Math.abs(hash >> 8) % 4),
    };
  });
}
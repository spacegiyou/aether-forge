import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { AgentType } from "@/lib/generators/goal-processor";

export const AGENT_COLORS: Record<AgentType, string> = {
  researcher: "#22d3ee",
  designer: "#a78bfa",
  coder: "#34d399",
  analyst: "#fbbf24",
};

export const DEFAULT_AGENT_POSITIONS: Record<AgentType, { x: number; y: number }> = {
  researcher: { x: 80, y: 80 },
  designer: { x: 320, y: 80 },
  coder: { x: 80, y: 280 },
  analyst: { x: 320, y: 280 },
};

const AGENTS: AgentType[] = ["researcher", "designer", "coder", "analyst"];

/** Default collaboration edges forming a swarm ring + cross-links */
export const DEFAULT_SWARM_EDGES: Array<{ source: string; target: string }> = [
  { source: "researcher-0", target: "designer-0" },
  { source: "designer-0", target: "coder-0" },
  { source: "coder-0", target: "analyst-0" },
  { source: "analyst-0", target: "researcher-0" },
  { source: "researcher-0", target: "coder-0" },
];

export function agentNodeId(type: AgentType, suffix = 0): string {
  return `${type}-${suffix}`;
}

export function createAgentNode(
  type: AgentType,
  id: string,
  position: { x: number; y: number },
  options?: { active?: boolean; dragging?: boolean }
): Node {
  const color = AGENT_COLORS[type];
  const active = options?.active ?? false;
  const dragging = options?.dragging ?? false;

  return {
    id,
    type: "default",
    position,
    data: {
      label: type.charAt(0).toUpperCase() + type.slice(1),
      agentType: type,
    },
    style: {
      background: active ? `${color}22` : "rgba(255,255,255,0.06)",
      border: `2px solid ${color}${active ? "" : "55"}`,
      borderRadius: 12,
      padding: 12,
      color,
      fontSize: 13,
      fontWeight: 600,
      backdropFilter: "blur(12px)",
      minWidth: 120,
      boxShadow: active ? `0 0 20px ${color}66` : dragging ? `0 0 12px ${color}44` : undefined,
      transition: "box-shadow 0.3s, background 0.3s, border 0.3s",
    },
  };
}

/** Four connected agent nodes visible on canvas load */
export function createDefaultSwarmNodes(): Node[] {
  return AGENTS.map((type) =>
    createAgentNode(type, agentNodeId(type), DEFAULT_AGENT_POSITIONS[type])
  );
}

export function createSwarmEdge(
  source: string,
  target: string,
  options?: { animated?: boolean; stroke?: string; strokeWidth?: number }
): Edge {
  const stroke = options?.stroke ?? "#22d3ee";
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    animated: options?.animated ?? true,
    style: { stroke, strokeWidth: options?.strokeWidth ?? 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
  };
}

export function createDefaultSwarmEdges(): Edge[] {
  return DEFAULT_SWARM_EDGES.map(({ source, target }) => createSwarmEdge(source, target));
}

/** Highlight the agent node active during an execution step */
export function highlightActiveAgent(nodes: Node[], activeAgent: AgentType | null): Node[] {
  return nodes.map((node) => {
    const type = node.data?.agentType as AgentType | undefined;
    if (!type) return node;
    return createAgentNode(type, node.id, node.position, { active: type === activeAgent });
  });
}

/** Offset drop position to reduce overlap when multiple agents land nearby */
export function offsetDropPosition(
  position: { x: number; y: number },
  existingNodes: Node[]
): { x: number; y: number } {
  const overlaps = existingNodes.filter(
    (n) => Math.abs(n.position.x - position.x) < 60 && Math.abs(n.position.y - position.y) < 40
  ).length;
  return {
    x: position.x + overlaps * 24,
    y: position.y + overlaps * 18,
  };
}

/** Pulse edge connected to the active agent during execution */
export function pulseEdgesForAgent(edges: Edge[], activeAgent: AgentType | null): Edge[] {
  if (!activeAgent) return edges;
  const nodeId = agentNodeId(activeAgent);
  return edges.map((edge) => {
    const connected = edge.source === nodeId || edge.target === nodeId;
    return {
      ...edge,
      animated: connected,
      style: {
        ...edge.style,
        stroke: connected ? AGENT_COLORS[activeAgent] : "#22d3ee",
        strokeWidth: connected ? 3 : 2,
      },
    };
  });
}
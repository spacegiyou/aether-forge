"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AgentType } from "@/lib/generators/goal-processor";

const AGENT_POSITIONS: Record<AgentType, { x: number; y: number }> = {
  researcher: { x: 80, y: 80 },
  designer: { x: 320, y: 80 },
  coder: { x: 80, y: 280 },
  analyst: { x: 320, y: 280 },
};

const AGENT_COLORS: Record<AgentType, string> = {
  researcher: "#22d3ee",
  designer: "#a78bfa",
  coder: "#34d399",
  analyst: "#fbbf24",
};

function createAgentNode(type: AgentType, id: string): Node {
  return {
    id,
    type: "default",
    position: AGENT_POSITIONS[type],
    data: { label: type.charAt(0).toUpperCase() + type.slice(1) },
    style: {
      background: "rgba(255,255,255,0.06)",
      border: `1px solid ${AGENT_COLORS[type]}55`,
      borderRadius: 12,
      padding: 12,
      color: AGENT_COLORS[type],
      fontSize: 13,
      fontWeight: 600,
      backdropFilter: "blur(12px)",
      minWidth: 120,
    },
  };
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

interface FlowCanvasProps {
  executing?: boolean;
}

export function FlowCanvas({ executing }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeCount, setNodeCount] = useState(0);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#22d3ee", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("agent-type") as AgentType;
      if (!type || !AGENT_POSITIONS[type]) return;

      const id = `${type}-${nodeCount}`;
      setNodeCount((c) => c + 1);
      setNodes((nds) => [...nds, createAgentNode(type, id)]);
    },
    [nodeCount, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div
      className="h-full w-full rounded-xl overflow-hidden border border-white/10"
      onDrop={onDrop}
      onDragOver={onDragOver}
      data-testid="flow-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className={executing ? "executing-pulse" : ""}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ffffff15" />
        <Controls className="!bg-white/5 !border-white/10 !rounded-lg" />
        <MiniMap
          nodeColor={(n) => AGENT_COLORS[(n.data?.label as string)?.toLowerCase() as AgentType] ?? "#22d3ee"}
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-white/5 !border-white/10 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
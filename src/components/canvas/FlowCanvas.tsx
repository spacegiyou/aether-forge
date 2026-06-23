"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AgentType } from "@/lib/generators/goal-processor";
import {
  createAgentNode,
  createDefaultSwarmNodes,
  createDefaultSwarmEdges,
  highlightActiveAgent,
  offsetDropPosition,
  pulseEdgesForAgent,
  AGENT_COLORS,
} from "@/lib/flow/swarm-layout";

interface FlowCanvasProps {
  executing?: boolean;
  /** Agent highlighted during current execution step */
  activeAgent?: AgentType | null;
  /** Agent being dragged from sidebar — dims others */
  draggingAgent?: AgentType | null;
  /** Keyboard "Add to canvas" request from sidebar */
  addAgentRequest?: { type: AgentType; key: number } | null;
}

function FlowCanvasInner({ executing, activeAgent, draggingAgent, addAgentRequest }: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(createDefaultSwarmNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(createDefaultSwarmEdges());
  const [dropCount, setDropCount] = useState(0);

  // Keyboard accessibility: add agent to canvas center (A6)
  useEffect(() => {
    if (!addAgentRequest) return;
    setNodes((nds) => {
      const position = offsetDropPosition({ x: 200, y: 180 }, nds);
      const id = `${addAgentRequest.type}-kb-${addAgentRequest.key}`;
      return [...nds, createAgentNode(addAgentRequest.type, id, position)];
    });
  }, [addAgentRequest, setNodes]);

  // Tie execution steps to canvas: highlight active agent + pulse its edges
  useEffect(() => {
    setNodes((nds) => {
      let updated = highlightActiveAgent(nds, activeAgent ?? null);
      if (draggingAgent) {
        updated = updated.map((n) => {
          const type = n.data?.agentType as AgentType;
          return createAgentNode(type, n.id, n.position, {
            active: type === activeAgent,
            dragging: type === draggingAgent,
          });
        });
      }
      return updated;
    });
    setEdges((eds) => pulseEdgesForAgent(eds, activeAgent ?? null));
  }, [activeAgent, draggingAgent, setNodes, setEdges]);

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
      if (!type) return;

      const rawPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setNodes((nds) => {
        const position = offsetDropPosition(rawPosition, nds);
        const id = `${type}-drop-${dropCount}`;
        return [...nds, createAgentNode(type, id, position)];
      });
      setDropCount((c) => c + 1);
    },
    [dropCount, screenToFlowPosition, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const nodeColor = useCallback((n: Node) => {
    const type = (n.data?.agentType ?? n.data?.label) as string;
    return AGENT_COLORS[type?.toLowerCase() as AgentType] ?? "#22d3ee";
  }, []);

  const swarmStats = useMemo(
    () => ({ nodes: nodes.length, edges: edges.length }),
    [nodes.length, edges.length]
  );

  return (
    <div
      className="relative h-full w-full rounded-xl overflow-hidden border border-white/10"
      onDrop={onDrop}
      onDragOver={onDragOver}
      data-testid="flow-canvas"
      data-node-count={swarmStats.nodes}
      data-edge-count={swarmStats.edges}
    >
      {draggingAgent && (
        <div
          className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] text-cyan-300"
          data-testid="drag-hint"
        >
          Drop {draggingAgent} onto the canvas
        </div>
      )}
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
          nodeColor={nodeColor}
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-white/5 !border-white/10 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
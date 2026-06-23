import { describe, it, expect } from "vitest";
import {
  createDefaultSwarmNodes,
  createDefaultSwarmEdges,
  createAgentNode,
  highlightActiveAgent,
  offsetDropPosition,
  pulseEdgesForAgent,
  agentNodeId,
} from "./swarm-layout";

describe("swarm-layout", () => {
  it("createDefaultSwarmNodes returns 4 connected agent nodes", () => {
    const nodes = createDefaultSwarmNodes();
    expect(nodes).toHaveLength(4);
    expect(nodes.map((n) => n.id).sort()).toEqual(
      ["analyst-0", "coder-0", "designer-0", "researcher-0"].sort()
    );
    nodes.forEach((n) => {
      expect(n.position.x).toBeGreaterThan(0);
      expect(n.data.agentType).toBeTruthy();
    });
  });

  it("createDefaultSwarmEdges forms collaboration ring", () => {
    const edges = createDefaultSwarmEdges();
    expect(edges.length).toBeGreaterThanOrEqual(4);
    expect(edges.every((e) => e.animated)).toBe(true);
  });

  it("highlightActiveAgent marks only the active agent", () => {
    const nodes = createDefaultSwarmNodes();
    const highlighted = highlightActiveAgent(nodes, "coder");
    const coder = highlighted.find((n) => n.id === agentNodeId("coder"));
    const researcher = highlighted.find((n) => n.id === agentNodeId("researcher"));
    expect(coder?.style?.boxShadow).toBeTruthy();
    expect(researcher?.style?.boxShadow).toBeUndefined();
  });

  it("offsetDropPosition shifts when nodes overlap", () => {
    const existing = [createAgentNode("coder", "coder-0", { x: 100, y: 100 })];
    const pos = offsetDropPosition({ x: 110, y: 105 }, existing);
    expect(pos.x).toBeGreaterThan(110);
    expect(pos.y).toBeGreaterThan(105);
  });

  it("pulseEdgesForAgent thickens edges for active agent", () => {
    const edges = createDefaultSwarmEdges();
    const pulsed = pulseEdgesForAgent(edges, "researcher");
    const connected = pulsed.filter(
      (e) => e.source === "researcher-0" || e.target === "researcher-0"
    );
    expect(connected.length).toBeGreaterThan(0);
    connected.forEach((e) => expect(e.style?.strokeWidth).toBe(3));
  });
});
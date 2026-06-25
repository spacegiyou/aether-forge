/** @vitest-environment jsdom */
import { useState } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoalExecutor } from "./GoalExecutor";

vi.mock("./FlowCanvas", () => ({
  FlowCanvas: () => <div data-testid="flow-canvas-mock" />,
}));

vi.mock("./OutputPanel", () => ({
  OutputPanel: () => null,
}));

vi.mock("@/lib/storage/supabase-mock", () => ({
  saveSession: vi.fn(),
}));

function GoalExecutorHarness() {
  const [goal, setGoal] = useState("");
  return <GoalExecutor goal={goal} onGoalChange={setGoal} />;
}

describe("GoalExecutor error handling", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Goal is required" }),
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows role=alert error when API returns 400", async () => {
    render(<GoalExecutorHarness />);

    fireEvent.change(screen.getByTestId("goal-input"), { target: { value: "test goal" } });
    fireEvent.click(screen.getByTestId("execute-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("execute-error").textContent).toContain("Goal is required");
    });

    const alert = screen.getByTestId("execute-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("Goal is required");
  });
});
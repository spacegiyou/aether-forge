/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GoalExecutor } from "./GoalExecutor";

vi.mock("@/actions/execute-goal", () => ({
  executeGoalAction: vi.fn(),
}));

vi.mock("@/lib/storage/supabase-mock", () => ({
  saveSession: vi.fn(),
}));

vi.mock("./FlowCanvas", () => ({
  FlowCanvas: () => <div data-testid="flow-canvas-mock" />,
}));

vi.mock("./OutputPanel", () => ({
  OutputPanel: () => <div data-testid="output-panel-mock" />,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { executeGoalAction } from "@/actions/execute-goal";

describe("GoalExecutor error UI", () => {
  beforeEach(() => {
    vi.mocked(executeGoalAction).mockReset();
  });

  it("renders role=alert when server action returns error", async () => {
    vi.mocked(executeGoalAction).mockResolvedValue({
      error: "Goal exceeds maximum length of 2000 characters.",
    });

    const onGoalChange = vi.fn();
    render(
      <GoalExecutor
        goal="Valid-looking goal text"
        onGoalChange={onGoalChange}
      />
    );

    fireEvent.click(screen.getByTestId("execute-btn"));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("data-testid", "execute-error");
      expect(alert).toHaveTextContent("2000");
    });

    expect(executeGoalAction).toHaveBeenCalledWith("Valid-looking goal text");
  });
});
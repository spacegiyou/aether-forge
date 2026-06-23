/** Server-side goal validation — shared between action and tests */
export const MAX_GOAL_LENGTH = 2000;

export function validateGoal(goal: string): { ok: true; trimmed: string } | { ok: false; error: string } {
  const trimmed = goal.trim();
  if (!trimmed) {
    return { ok: false, error: "Please set a goal before executing." };
  }
  if (trimmed.length > MAX_GOAL_LENGTH) {
    return { ok: false, error: `Goal exceeds maximum length of ${MAX_GOAL_LENGTH} characters.` };
  }
  return { ok: true, trimmed };
}

/** Extract error message from a server action result */
export function extractExecuteError(
  result: { error?: string } | Record<string, unknown>
): string | null {
  if (result && "error" in result && typeof result.error === "string" && result.error) {
    return result.error;
  }
  return null;
}
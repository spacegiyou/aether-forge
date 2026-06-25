import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { join } from "path";

/** Ensures shipped scripts/xai-oauth-lib.test.mjs stays green in npm test */
describe("oauth script integration", () => {
  it("runs node --test on shipped xai-oauth-lib.test.mjs", () => {
    const script = join(process.cwd(), "scripts/xai-oauth-lib.test.mjs");
    const result = spawnSync("node", ["--test", script], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("manualPasteFlow drives exchangeCode");
  });
});
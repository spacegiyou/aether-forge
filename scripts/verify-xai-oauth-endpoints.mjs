#!/usr/bin/env node
/** Thin wrapper — all endpoint logic lives in oauth-contract.mjs */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { verifyOAuthContract } from "./oauth-contract.mjs";

const SCRATCH = process.env.SCRATCH_DIR;
const { lines } = await verifyOAuthContract();

for (const line of lines) {
  console.log(line);
}

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "oauth-endpoints.log"), lines.join("\n") + "\n");
}
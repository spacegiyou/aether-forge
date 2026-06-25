#!/usr/bin/env node

import { existsSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const paths = [
  join(homedir(), ".aetherforge", "xai-auth.json"),
  join(process.cwd(), ".xai-auth.json"),
];

let deleted = false;
for (const path of paths) {
  if (existsSync(path)) {
    unlinkSync(path);
    console.log(`Deleted ${path}`);
    deleted = true;
  }
}

if (!deleted) {
  console.log("No OAuth token file found.");
}
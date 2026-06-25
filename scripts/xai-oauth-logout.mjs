#!/usr/bin/env node

import { existsSync } from "fs";
import { deleteTokenFiles, tokenSearchPaths } from "./xai-oauth-lib.mjs";

const paths = tokenSearchPaths();
const existing = paths.filter((p) => existsSync(p));
const deleted = deleteTokenFiles(paths);

if (deleted) {
  for (const path of existing) {
    console.log(`Deleted ${path}`);
  }
} else {
  console.log("No OAuth token file found.");
}
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The generator resolves its own supported TypeScript 5 compiler. Installation
// is explicit: npm ci --prefix tools/api-codegen. Never install during generation.
execFileSync(
  process.execPath,
  [fileURLToPath(new URL("../tools/api-codegen/generate.mjs", import.meta.url))],
  { stdio: "inherit" },
);

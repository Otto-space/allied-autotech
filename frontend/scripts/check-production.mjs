import { spawnSync } from "node:child_process";

// Use the same release checks with Vercel's production output and validation.
// Next.js loads local env files during the build; CI supplies variables directly.
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "check"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, VERCEL: "1", VERCEL_ENV: "production" },
  },
);
if (result.error) console.error("Unable to run production checks:", result.error.message);
process.exit(result.status ?? 1);

import { execFileSync } from "node:child_process";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
process.chdir(root);
let existing = "";
try {
  existing = execFileSync(
    "git",
    ["config", "--local", "--get", "core.hooksPath"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
} catch {
  // No repository-specific hooks path is configured.
}
if (existing && existing !== ".githooks") {
  throw new Error(
    `Existing hooks path '${existing}' was preserved. Integrate the hook manually.`,
  );
}
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
});
console.log("Git pre-push checks enabled for this checkout.");

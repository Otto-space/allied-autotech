import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function requiresFrontendChecks(paths) {
  return paths.some(
    (file) =>
      file.startsWith("frontend/") ||
      file === "package.json" ||
      file === ".github/workflows/frontend-release.yml" ||
      file.startsWith("scripts/git-hooks/") ||
      file === ".githooks/pre-push",
  );
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

async function run() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  const updates = input.trim().split("\n").filter(Boolean);
  let frontendChanged = false;
  for (const update of updates) {
    const [localRef, localSha, , remoteSha] = update.trim().split(/\s+/);
    if (!localRef.startsWith("refs/heads/") || /^0+$/.test(localSha)) continue;
    const newBranch = /^0+$/.test(remoteSha);
    const commits = git(
      newBranch
        ? ["rev-list", localSha, "--not", "--remotes"]
        : ["rev-list", `${remoteSha}..${localSha}`],
    )
      .split("\n")
      .filter(Boolean);
    for (const commit of commits) {
      if (!/^gpgsig /m.test(git(["cat-file", "-p", commit]))) {
        throw new Error(
          `Unsigned commit ${commit.slice(0, 12)}. Use your verified signing key.`,
        );
      }
    }
    const changed = newBranch
      ? commits.flatMap((commit) =>
          git([
            "diff-tree",
            "--root",
            "--no-commit-id",
            "--name-only",
            "-r",
            commit,
          ])
            .split("\n")
            .filter(Boolean),
        )
      : git(["diff", "--name-only", remoteSha, localSha])
          .split("\n")
          .filter(Boolean);
    frontendChanged ||= requiresFrontendChecks(changed);
  }
  if (!frontendChanged) {
    console.log("Pre-push: no frontend changes; frontend checks skipped.");
    return;
  }
  console.log("Pre-push: running the complete frontend checks.");
  execFileSync("npm", ["--prefix", "frontend", "run", "check"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

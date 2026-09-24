import { access, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.VERCEL === "1") {
  console.log("Vercel packages Next.js output; standalone preparation is not needed.");
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
await access(path.join(standalone, "server.js"));
await Promise.all([
  cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
    recursive: true,
  }),
  cp(path.join(root, "public"), path.join(standalone, "public"), {
    recursive: true,
    // Preserve the original worktree asset, but exclude unapproved generated imagery
    // from the release artifact. No current component references this file.
    filter: (source) => path.basename(source) !== "allied-workshop-hero.png",
  }),
]);
console.log("Standalone server prepared with static assets and approved public files.");

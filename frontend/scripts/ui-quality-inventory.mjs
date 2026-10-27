import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

// Source discovery, never a claim of rendered or accessibility coverage.
const root = fileURLToPath(new URL("../", import.meta.url));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const name = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(name) : [name];
    }),
  );
  return nested.flat().sort();
}
const files = (await walk(path.join(root, "app"))).filter((name) =>
  name.endsWith(".tsx"),
);
const source = await Promise.all(
  files.map(async (file) => ({
    file: path.relative(root, file).replaceAll("\\", "/"),
    text: await readFile(file, "utf8"),
  })),
);
const auth = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/mfa",
  "/staff/accept-invitation",
]);
const routes = source
  .filter(({ file }) => file.endsWith("/page.tsx"))
  .map(({ file }) => {
    const segments = file
      .slice(4, -9)
      .split("/")
      .filter((part) => part && !part.startsWith("(") && !part.startsWith("@"));
    const route = `/${segments.join("/")}`;
    const family = auth.has(route)
      ? "authentication"
      : route.startsWith("/admin")
        ? "work"
        : route.startsWith("/dashboard")
          ? "customer"
          : "public";
    return {
      route,
      source: file,
      family,
      dynamic: route.includes("["),
      access:
        family === "work"
          ? "server-enforced role and capability; per-route confirmation required"
          : family === "customer"
            ? "authenticated customer; per-route confirmation required"
            : "public; launch mode and token conditions may restrict actions",
      review: "source inventoried; see register for sampled rendered evidence",
    };
  });
const patterns = {
  form: /<form\b/,
  dialog: /<dialog\b|role=["']dialog["']|showModal\(/,
  disclosure: /<details\b|aria-expanded/,
  tabs: /role=["']tab(?:list)?["']/,
  table: /<table\b/,
  fileInput: /type=["']file["']/,
  nativeSelect: /<select\b/,
  feedback: /role=["'](?:alert|status)["']|aria-live/,
  loadingBoundary: /\/(?:loading|error|not-found)\.tsx$/,
};
const surfaces = source.flatMap(({ file, text }) => {
  const kinds = Object.entries(patterns)
    .filter(([key, pattern]) => pattern.test(key === "loadingBoundary" ? file : text))
    .map(([key]) => key);
  return kinds.length
    ? [
        {
          source: file,
          sourceSignals: kinds,
          review: "not independently rendered unless recorded in register",
        },
      ]
    : [];
});
const inventory = {
  scope:
    "Source routes and interaction signals, not runtime permissions or test coverage. Regenerate after route/component changes.",
  command: "node scripts/ui-quality-inventory.mjs",
  routes,
  surfaces,
};
const output = path.join(root, "docs/ui-quality-inventory.json");
await writeFile(
  output,
  await format(JSON.stringify(inventory), {
    ...(await resolveConfig(output)),
    parser: "json",
  }),
);
console.log(
  `Inventoried ${routes.length} routes and ${surfaces.length} interaction/boundary source files.`,
);

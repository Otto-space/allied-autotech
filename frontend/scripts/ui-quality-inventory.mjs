import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

// Source discovery, never a claim of rendered or accessibility coverage.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "docs/ui-quality-inventory.json");
const previous = JSON.parse(await readFile(output, "utf8"));
const previousCoverage = new Map(
  previous.routes.map((entry) => [entry.route, entry.coverage]),
);
const previousEvidence = new Map(
  previous.routes.map((entry) => [entry.route, entry.coverageEvidence]),
);
const checklist = [
  "headings",
  "labels",
  "helpers",
  "errors",
  "placeholders",
  "inputs",
  "selects",
  "checkboxes",
  "radios",
  "actions",
  "toolbars",
  "tables",
  "cards",
  "empty",
  "permissions",
  "loading",
  "longContent",
  "mobile",
];
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
      coverage:
        previousCoverage.get(route) ??
        Object.fromEntries(checklist.map((item) => [item, "not-inspected"])),
      ...(previousEvidence.get(route)
        ? { coverageEvidence: previousEvidence.get(route) }
        : {}),
    };
  });
const patterns = {
  nativeButton: /<button\b/,
  nativeAnchor: /<a\s/,
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
    "Source discovery plus manually recorded scoped coverage. Source signals alone do not prove runtime permissions or acceptance; consult coverageEvidence and the quality register. Regenerate after route/component changes.",
  command: "node scripts/ui-quality-inventory.mjs",
  coverageLegend: {
    "not-inspected":
      "No per-page acceptance claim; earlier sampled evidence remains in the register.",
    inspected: "Reviewed, without a repair or completed acceptance claim.",
    repaired: "Changed, awaiting rendered acceptance.",
    verified:
      "See the page evidence and quality register for exact role, state and device limits.",
    blocked: "Concrete external dependency recorded in page evidence.",
    "not-applicable": "Explicitly absent from the selected page/task region.",
  },
  controls: source.flatMap(({ file, text }) => {
    const nativeButtons = [...text.matchAll(/<button\b/g)].length;
    const nativeAnchors = [...text.matchAll(/<a\s/g)].length;
    const textLinkButtons = [
      ...text.matchAll(/<button\b[^>]*className="[^"]*text-link[^\"]*"/gs),
    ].length;
    return nativeButtons || nativeAnchors
      ? [
          {
            source: file,
            nativeButtons,
            nativeAnchors,
            textLinkButtons,
            review:
              "source census; semantics and utility duplication require per-consumer review",
          },
        ]
      : [];
  }),
  routes,
  surfaces,
};
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

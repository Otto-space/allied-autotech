import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  learningArticles,
  learningGuides,
  practiceDefinitions,
} from "../src/modules/learning/learning.content.js";

// A coverage overlay of the maintained source inventory, never another route list.
const root = fileURLToPath(new URL("../../", import.meta.url));
const inventoryFile = root + "frontend/docs/ui-quality-inventory.json";
const matrixFile = root + "docs/help-learn/REVISION_4_COVERAGE.json";
const inventory = z
  .object({
    routes: z.array(
      z.object({
        route: z.string(),
        source: z.string(),
        family: z.string(),
        access: z.string(),
      }),
    ),
  })
  .parse(JSON.parse(readFileSync(inventoryFile, "utf8")));
const entrySchema = z.object({
  source: z.string(),
  audience: z.string(),
  accessPredicate: z.string(),
  decision: z.enum([
    "pending",
    "explanation",
    "article",
    "walkthrough",
    "simulation",
    "excluded",
  ]),
  purpose: z.string().nullable(),
  contextualAnswer: z.string().nullable(),
  articleIds: z.array(z.string()),
  guideIds: z.array(z.string()),
  practiceIds: z.array(z.string()),
  statusDefinitions: z.array(z.string()),
  recovery: z.array(z.string()),
  releaseRestrictions: z.string(),
  fixture: z.string(),
  verification: z.enum(["pending", "source-only", "isolated", "hosted", "excluded"]),
  evidence: z.array(z.string()),
  gaps: z.array(z.string()),
  subviews: z.array(
    z.object({ pattern: z.string(), task: z.string(), verification: z.string() }),
  ),
});
const matrixSchema = z.object({
  revision: z.literal(4),
  inventorySource: z.literal("frontend/docs/ui-quality-inventory.json"),
  routes: z.record(z.string(), entrySchema),
});
if (process.argv.includes("--initialise")) {
  const routes = Object.fromEntries(
    inventory.routes.map((route) => [
      route.route,
      {
        source: route.source,
        audience: route.family,
        accessPredicate: route.access,
        decision: "pending",
        purpose: null,
        contextualAnswer: null,
        articleIds: learningArticles
          .filter((a) => a.href === route.route)
          .map((a) => a.id),
        guideIds: learningGuides.filter((g) => g.href === route.route).map((g) => g.id),
        practiceIds: [],
        statusDefinitions: [],
        recovery: [],
        releaseRestrictions:
          "Review actual route and PUBLIC_LAUNCH_MODE before accepting coverage.",
        fixture: "Identify the permitted role/scope and realistic state for this route.",
        verification: "pending",
        evidence: [],
        gaps: [
          "Exact page purpose, effective access, contextual instructions, modes and rendered acceptance are not verified for Revision 4.",
        ],
        subviews:
          route.route === "/admin/workforce/[[...section]]"
            ? [
                {
                  pattern: "/admin/workforce/access",
                  task: "Scoped workforce account directory",
                  verification: "W1 implementation; tests pending",
                },
                {
                  pattern: "/admin/workforce/access/[userId]",
                  task: "Existing reviewed position/responsibility editor",
                  verification: "W1 integration; full foundation gate pending",
                },
              ]
            : [],
      },
    ]),
  );
  writeFileSync(
    matrixFile,
    JSON.stringify(
      matrixSchema.parse({
        revision: 4,
        inventorySource: "frontend/docs/ui-quality-inventory.json",
        routes,
      }),
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
}
const matrix = matrixSchema.parse(JSON.parse(readFileSync(matrixFile, "utf8")));
const discovered = new Set(inventory.routes.map((r) => r.route));
const errors: string[] = [];
function pageSources(directory: string, prefix = "app"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pageSources(directory + "/" + entry.name, prefix + "/" + entry.name)
      : entry.name === "page.tsx"
        ? [prefix + "/" + entry.name]
        : [],
  );
}
const actualSources = new Set(pageSources(root + "frontend/app"));
const inventoriedSources = new Set(inventory.routes.map((route) => route.source));
for (const source of actualSources)
  if (!inventoriedSources.has(source))
    errors.push(
      "Route inventory is missing " +
        source +
        "; regenerate it before accepting coverage.",
    );
for (const source of inventoriedSources)
  if (!actualSources.has(source))
    errors.push("Route inventory contains removed source " + source);

const articles = new Set(learningArticles.map((a) => a.id)),
  guides = new Set(learningGuides.map((g) => g.id)),
  practices = new Set(practiceDefinitions.map((p) => p.id));
for (const route of inventory.routes) {
  const entry = matrix.routes[route.route];
  if (!entry) {
    errors.push(`Unmapped discovered route ${route.route}`);
    continue;
  }
  if (entry.source !== route.source) errors.push(`Changed route source ${route.route}`);
  for (const [kind, ids, known] of [
    ["article", entry.articleIds, articles],
    ["guide", entry.guideIds, guides],
    ["practice", entry.practiceIds, practices],
  ] as const)
    for (const id of ids)
      if (!known.has(id)) errors.push(`Broken ${kind} reference ${id} on ${route.route}`);
  if (
    entry.verification === "excluded" &&
    (entry.decision !== "excluded" || !entry.purpose || !entry.evidence.length)
  )
    errors.push(`Unexplained exclusion ${route.route}`);
  if (
    ["isolated", "hosted"].includes(entry.verification) &&
    (!entry.purpose || !entry.contextualAnswer || !entry.evidence.length)
  )
    errors.push(`Unsupported verification claim ${route.route}`);
}
for (const route of Object.keys(matrix.routes))
  if (!discovered.has(route)) errors.push(`Coverage references a removed route ${route}`);
for (const guide of learningGuides)
  if (!articles.has(guide.articleId)) errors.push(`Orphaned guide ${guide.id}`);
for (const practice of practiceDefinitions)
  if (!articles.has(practice.articleId)) errors.push(`Orphaned practice ${practice.id}`);
if (errors.length) throw Error(errors.join("\n"));
const unfinished = Object.values(matrix.routes).filter(
  (r) =>
    r.decision === "pending" ||
    !["isolated", "hosted", "excluded"].includes(r.verification) ||
    r.gaps.length > 0,
);
console.log(
  `Coverage structure valid: ${inventory.routes.length} discovered routes; ${unfinished.length} still await Revision 4 acceptance. Structural validity is not completion.`,
);
if (process.argv.includes("--require-complete") && unfinished.length)
  throw Error(
    `Revision 4 is incomplete: ${unfinished.length} routes still have unverified coverage or recorded gaps.`,
  );

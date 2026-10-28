import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
const relative = (p) => path.relative(root, p).replaceAll("\\", "/");
const files = walk(path.join(root, "app"));
const cache = new Map();
function dependencies(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const src = cache.get(file) ?? fs.readFileSync(file, "utf8");
  cache.set(file, src);
  if (file.endsWith(".css")) {
    for (const match of src.matchAll(/@import\s*["'](\.[^"']+)["']/g)) {
      const imported = path.resolve(path.dirname(file), match[1]);
      if (fs.existsSync(imported)) dependencies(imported, seen);
    }
    return seen;
  }
  for (const match of src.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
    const name = match[1];
    if (!name.startsWith(".") && !name.startsWith("@/")) continue;
    const base = name.startsWith("@/")
      ? path.join(root, name.slice(2))
      : path.resolve(path.dirname(file), name);
    const resolved = [
      base,
      ...[".tsx", ".ts", "/index.tsx", "/index.ts"].map((ext) => base + ext),
    ].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (resolved && !resolved.includes("node_modules")) dependencies(resolved, seen);
  }
  return seen;
}
const routes = files
  .filter((f) => f.endsWith(`${path.sep}page.tsx`))
  .map((file) => {
    const source = relative(file);
    const route =
      "/" +
      source
        .replace(/^app\//, "")
        .replace(/\/page.tsx$/, "")
        .replace(/^page.tsx$/, "")
        .replace(/\([^/]+\)\//g, "");
    const deps = dependencies(file);
    let parent = path.dirname(file);
    while (parent.startsWith(path.join(root, "app"))) {
      const layout = path.join(parent, "layout.tsx");
      if (fs.existsSync(layout)) dependencies(layout, deps);
      parent = path.dirname(parent);
    }
    const own = fs.readFileSync(file, "utf8");
    return {
      route,
      source,
      audience: route.startsWith("/admin")
        ? "Authorised workforce / Admin / Super Admin; existing capability guards"
        : route.startsWith("/dashboard")
          ? "Authenticated customer; existing guards"
          : "Public / authentication; existing guards",
      components: [...deps]
        .filter((f) => /components.*\.tsx$/.test(f))
        .map(relative)
        .sort(),
      styles: [...deps]
        .filter((f) => f.endsWith(".css"))
        .map(relative)
        .sort(),
      surfaces: ["Light content", "Shared inverse navigation / overlays where rendered"],
      sourceStates: [
        "focus",
        "hover",
        "disabled",
        "checked",
        "selected",
        "invalid",
        "loading",
        "error",
        "empty",
        "dialog",
      ].filter((s) => own.toLowerCase().includes(s)),
      implementation:
        "Shared token and source focus/accent migration applied; local styles listed for review",
      evidence:
        "Source inspected by dependency census. Runtime acceptance is separate: see COLOUR_AND_STATE_REPORT.md and retained Playwright report. No all-role acceptance claim.",
    };
  });
const cssFiles = files.filter((f) => f.endsWith(".css"));
const colourDebt = cssFiles.map((file) => {
  const text = fs.readFileSync(file, "utf8");
  return {
    source: relative(file),
    literalColours: [...new Set(text.match(/#[a-f\d]{3,8}\b/gi) ?? [])].sort(),
    focusRules: (text.match(/:focus(?:-visible|-within)?/g) ?? []).length,
  };
});
const tokens = Object.fromEntries(
  [
    ...fs
      .readFileSync(path.join(root, "app/colour-tokens.css"), "utf8")
      .matchAll(/(--[\w-]+):\s*(#[a-f\d]{6}|var\(--[\w-]+\));/gi),
  ].map((m) => [m[1], m[2]]),
);
function resolve(name, seen = new Set()) {
  if (seen.has(name)) throw Error(`Token cycle: ${name}`);
  seen.add(name);
  const value = tokens[name];
  if (!value) throw Error(`Unknown token: ${name}`);
  return value.startsWith("var(") ? resolve(value.slice(4, -1), seen) : value;
}
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((n) => parseInt(n, 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const pairs = [
  ["on-primary", "action-primary"],
  ["on-primary", "action-hover"],
  ["on-primary", "action-pressed"],
  ["on-secondary", "action-secondary"],
  ["on-secondary", "action-secondary-hover"],
  ["on-secondary", "action-secondary-pressed"],
  ["on-destructive", "destructive"],
  ["on-destructive", "destructive-hover"],
  ["on-destructive", "destructive-pressed"],
  ["text-body", "surface-raised"],
  ["muted", "surface-raised"],
  ["muted", "surface"],
  ["link", "surface-raised"],
  ["link-hover", "surface-raised"],
  ["selection-ink", "selection-fill"],
  ["readonly-ink", "readonly-fill"],
  ["disabled-ink", "disabled-fill"],
  ...["success", "warning", "error", "info", "neutral"].map((t) => [
    `${t}-ink`,
    `${t}-fill`,
  ]),
  ...["palette-black", "palette-red-deep"].flatMap((bg) => [
    ["text-inverse", bg],
    ["text-inverse-muted", bg],
    ["link-inverse", bg],
  ]),
  ["border-control", "surface-raised", 3],
  ["border-control", "surface", 3],
];
const contrast = pairs.map(([foreground, background, minimum = 4.5]) => {
  const fg = resolve(`--${foreground}`),
    bg = resolve(`--${background}`);
  const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  const ratio = (values[0] + 0.05) / (values[1] + 0.05);
  return {
    foreground,
    background,
    fg,
    bg,
    ratio: +ratio.toFixed(2),
    minimum,
    pass: ratio >= minimum,
  };
});
const output = path.join(root, "docs/colour-state-inventory.json");
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      scope:
        "Static route, dependency and CSS census. Does not certify rendered coverage.",
      routes,
      colourDebt,
    },
    null,
    2,
  ) + "\n",
);
fs.writeFileSync(
  path.join(root, "docs/colour-contrast-report.json"),
  JSON.stringify(
    {
      scope:
        "Opaque sRGB token pairs and conservative brand-gradient endpoints. Actual image scrims, native controls, compositing and focus need browser review.",
      contrast,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${routes.length} routes, ${cssFiles.length} stylesheets, ${contrast.length} contrast pairs (${contrast.filter((c) => c.pass).length} passed).`,
);
const config = await resolveConfig(output);
for (const name of ["colour-state-inventory.json", "colour-contrast-report.json"]) {
  const destination = path.join(root, "docs", name);
  fs.writeFileSync(
    destination,
    await format(fs.readFileSync(destination, "utf8"), {
      ...config,
      filepath: destination,
    }),
  );
}
if (contrast.some((c) => !c.pass)) process.exitCode = 1;

import { Router } from "express";
import type { RequestHandler } from "express";

type StackRouter = {
  stack?: Array<{
    route?: { path: string; methods: Record<string, boolean> };
    handle: StackRouter;
  }>;
};
const mounts = new WeakMap<object, Map<object, string>>();
const original = Router.prototype.use;
Router.prototype.use = function (...args: unknown[]) {
  const path = typeof args[0] === "string" ? args[0] : "";
  const handles = (path ? args.slice(1) : args).flat();
  const children = mounts.get(this) ?? new Map<object, string>();
  for (const handle of handles)
    if (typeof handle === "function" && "stack" in handle) children.set(handle, path);
  mounts.set(this, children);
  return original.apply(this, args as Parameters<typeof original>);
};
try {
  const { createApiRouter } = await import("../src/routes/index.js");
  const { createOpenApiDocument } = await import("../src/openapi/document.js");
  const router = createApiRouter({ checkReadiness: async () => undefined });
  const documented = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });
  const normalize = (path: string) =>
    path.replaceAll(/:[^/]+|\{[^}]+\}/g, "{}").replace(/\/$/, "");
  const spec = new Set(
    Object.entries(documented.paths ?? {}).flatMap(([path, methods]) =>
      Object.keys(methods ?? {})
        .filter((method) => ["get", "post", "put", "patch", "delete"].includes(method))
        .map((method) => `${method} ${normalize(path)}`),
    ),
  );
  const actual = new Set<string>();
  function walk(current: StackRouter, prefix: string) {
    for (const layer of current.stack ?? []) {
      if (layer.route) {
        const path = `${prefix}${layer.route.path === "/" ? "" : layer.route.path}`;
        const paths =
          path === "/staff/disputes/:id/:action"
            ? [
                "assign",
                "acknowledge",
                "evidence-upload",
                "evidence",
                "evidence-access",
                "submission",
              ].map((action) => path.replace(":action", action))
            : [path];
        for (const method of Object.keys(layer.route.methods))
          for (const routePath of paths) actual.add(`${method} ${normalize(routePath)}`);
      } else if (layer.handle?.stack)
        walk(layer.handle, prefix + (mounts.get(current)?.get(layer.handle) ?? ""));
    }
  }
  walk(router as RequestHandler as StackRouter, "");
  const infrastructure = new Set([
    "get /health",
    "get /health/live",
    "get /health/ready",
    "get /openapi.json",
  ]);
  const missing = [...actual].filter(
    (route) => !spec.has(route) && !infrastructure.has(route),
  );
  const unwired = [...spec].filter((route) => !actual.has(route));
  if (missing.length || unwired.length)
    throw new Error(
      `Route coverage mismatch. Missing: ${missing.join(", ")}. Unwired: ${unwired.join(", ")}`,
    );
  process.stdout.write(
    `Route coverage passed: ${spec.size} documented operations match mounted routes; ${[...actual].filter((route) => infrastructure.has(route)).length} explicit infrastructure routes.\n`,
  );
} finally {
  Router.prototype.use = original;
}

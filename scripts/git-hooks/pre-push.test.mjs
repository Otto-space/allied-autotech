import assert from "node:assert/strict";
import test from "node:test";
import { requiresFrontendChecks } from "./pre-push.mjs";

test("frontend source and quality configuration trigger checks", () => {
  assert.equal(requiresFrontendChecks(["frontend/app/page.tsx"]), true);
  assert.equal(requiresFrontendChecks(["frontend/package.json"]), true);
  assert.equal(
    requiresFrontendChecks([".github/workflows/frontend-release.yml"]),
    true,
  );
  assert.equal(
    requiresFrontendChecks(["scripts/git-hooks/pre-push.mjs"]),
    true,
  );
});

test("unrelated backend changes skip expensive frontend checks", () => {
  assert.equal(
    requiresFrontendChecks(["backend/src/server.ts", "README.md"]),
    false,
  );
  assert.equal(requiresFrontendChecks([]), false);
});

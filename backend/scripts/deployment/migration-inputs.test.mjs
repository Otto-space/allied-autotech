import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
  verifyMigrationInputs,
  verifyPackagedMigrationInputs,
} from "./migration-inputs.mjs";

const directory = mkdtempSync(path.join(tmpdir(), "aat-migration-inputs-"));
after(() => {
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
  assert.ok(path.basename(directory).startsWith("aat-migration-inputs-"));
  rmSync(directory, { recursive: true });
});
const backend = path.join(directory, "backend");
const migration = "20261113000000_synthetic";
const relative = `backend/prisma/migrations/${migration}/migration.sql`;
const file = path.join(directory, relative);
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(path.join(directory, ".gitattributes"), "*.sql text eol=crlf\n");
writeFileSync(file, "SELECT 1;\n");
const git = (args, encoding = "utf8") =>
  execFileSync("git", args, {
    cwd: directory,
    encoding,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
git(["init", "--quiet"]);
git(["add", "."]);
// A tree object supplies real Git filtering without making a fixture commit or
// changing the owner's commit-signing configuration.
const tree = git(["write-tree"]).trim();
const expected = git(["cat-file", "--filters", `${tree}:${relative}`], null);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const imageId = `sha256:${"a".repeat(64)}`;

test("normalized Git content can match while the actual migration checksum is wrong", () => {
  writeFileSync(file, "SELECT 1;\n");
  assert.equal(git(["diff", "--name-only"]).trim(), "");
  assert.notEqual(hash(readFileSync(file)), hash(expected));
  assert.throws(
    () => verifyMigrationInputs(backend, tree),
    /Migration checkout bytes differ/,
  );
});

test("established filtered checkout bytes pass without changing the SQL blob", () => {
  writeFileSync(file, expected);
  const before = git(["rev-parse", `${tree}:${relative}`]).trim();
  assert.deepEqual(verifyMigrationInputs(backend, tree), { checked: 1 });
  assert.equal(git(["hash-object", `--path=${relative}`, relative]).trim(), before);
  assert.deepEqual(readFileSync(file), expected);
});

test("a previously built image with wrong bytes is rejected even after checkout repair", () => {
  writeFileSync(file, expected);
  assert.throws(
    () =>
      verifyPackagedMigrationInputs(backend, tree, imageId, () => [
        { name: migration, sha256: hash(Buffer.from("SELECT 1;\n")) },
      ]),
    /Packaged migration checksum differs/,
  );
});

test("the packaged migration set and checksums must both match", () => {
  const valid = { name: migration, sha256: hash(expected) };
  assert.deepEqual(
    verifyPackagedMigrationInputs(backend, tree, imageId, () => [valid]),
    { checked: 1, imageId },
  );
  for (const actual of [[], [valid, valid], [{ ...valid, name: "foreign" }]])
    assert.throws(
      () => verifyPackagedMigrationInputs(backend, tree, imageId, () => actual),
      /Packaged migration/,
    );
});

test("a mutable tag cannot select the image for the push guard", () => {
  assert.throws(
    () =>
      verifyPackagedMigrationInputs(backend, tree, "migrate:latest", () => {
        assert.fail("A mutable image reference must not reach Docker.");
      }),
    /immutable image ID/,
  );
});

import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function expectedInputs(backend, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Expected a full source commit.");
  const git = (args, encoding = "utf8") =>
    execFileSync("git", args, { cwd: backend, encoding, windowsHide: true });
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  const prefix = `${path.relative(root, backend).replaceAll("\\", "/")}/prisma/migrations/`;
  const files = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", commit, "--", prefix],
    { cwd: root, encoding: "utf8", windowsHide: true },
  )
    .trim()
    .split(/\r?\n/)
    .filter((file) => file.endsWith("/migration.sql"));
  if (!files.length) throw new Error("No committed migration inputs were found.");
  return files.map((file) => ({
    name: file.slice(prefix.length, -"/migration.sql".length),
    file: path.join(root, file),
    sha256: sha256(git(["cat-file", "--filters", `${commit}:${file}`], null)),
  }));
}

export function verifyMigrationInputs(backend, commit) {
  const inputs = expectedInputs(backend, commit);
  for (const input of inputs) {
    if (sha256(readFileSync(input.file)) !== input.sha256)
      throw new Error(
        `Migration checkout bytes differ from the established Git filters: ${input.name}. Restore the expected checkout bytes; do not edit applied SQL or migration history.`,
      );
  }
  return { checked: inputs.length };
}

function inspectMigrationImage(imageId) {
  const name = `aat-migration-inputs-${randomBytes(6).toString("hex")}`;
  const label = "migration-input-integrity";
  const code = `const fs=require('node:fs'),crypto=require('node:crypto');console.log(JSON.stringify(fs.readdirSync('prisma/migrations',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>({name:d.name,sha256:crypto.createHash('sha256').update(fs.readFileSync('prisma/migrations/'+d.name+'/migration.sql')).digest('hex')}))));`;
  let result;
  let failure;
  try {
    result = JSON.parse(
      execFileSync(
        "docker",
        [
          "run",
          "--rm",
          "--name",
          name,
          "--label",
          `allied.task=${label}`,
          "--network",
          "none",
          "--read-only",
          "--entrypoint",
          "node",
          imageId,
          "-e",
          code,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 120_000, maxBuffer: 2_000_000 },
      ),
    );
  } catch (error) {
    failure = error;
  }
  {
    // A timed-out Docker client can leave its container running. Touch only this
    // unique, labelled, immutable-image probe; it has no network or data volumes.
    const inspected = spawnSync("docker", ["container", "inspect", name], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 20_000,
    });
    if (
      inspected.status !== 0 &&
      (inspected.error || !/No such (object|container)/i.test(inspected.stderr ?? ""))
    )
      throw new Error("Migration probe cleanup could not be verified.");
    if (inspected.status === 0) {
      const [container] = JSON.parse(inspected.stdout);
      if (container.Image !== imageId || container.Config.Labels["allied.task"] !== label)
        throw new Error("Migration probe ownership changed; cleanup stopped.");
      const removed = spawnSync(
        "docker",
        [container.State.Running ? "stop" : "rm", name],
        {
          windowsHide: true,
          timeout: 30_000,
          stdio: "ignore",
        },
      );
      if (removed.status !== 0)
        throw new Error("Migration probe cleanup requires review.");
    }
  }
  if (failure) throw failure;
  return result;
}

export function verifyPackagedMigrationInputs(
  backend,
  commit,
  imageId,
  inspect = inspectMigrationImage,
) {
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId))
    throw new Error("Migration verification requires the recorded immutable image ID.");
  const expected = expectedInputs(backend, commit);
  const actual = inspect(imageId);
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    new Set(actual.map((entry) => entry.name)).size !== expected.length
  )
    throw new Error("Packaged migration set differs from the committed source.");
  for (const input of expected) {
    if (actual.find((entry) => entry.name === input.name)?.sha256 !== input.sha256)
      throw new Error(
        `Packaged migration checksum differs from the committed checkout: ${input.name}. Rebuild from verified inputs; do not overwrite a published source tag.`,
      );
  }
  return { checked: expected.length, imageId };
}

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  images,
  keyNames,
  parseTemplate,
  renderSpec,
  validateManifest,
} from "./spec.mjs";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const privateDirectory = path.join(backend, "ops/digitalocean/.private");
const inputPath = path.join(privateDirectory, "inputs.json");
const keysPath = path.join(privateDirectory, "keys.json");
const manifestPath = path.join(privateDirectory, "release.json");
const buildPath = path.join(privateDirectory, "build.json");
const specPath = path.join(privateDirectory, "staging.app.yaml");
const portableDoctl = path.join(
  process.env.LOCALAPPDATA || "",
  "AlliedAutoTech/tools/doctl/doctl.exe",
);
const doctl =
  process.env.AAT_DOCTL || (existsSync(portableDoctl) ? portableDoctl : "doctl");
const context = process.env.AAT_DO_CONTEXT || "allied-autotech-staging";

function run(program, args, { visible = false, allowedFailure = false } = {}) {
  const result = spawnSync(program, args, {
    cwd: backend,
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: visible ? "inherit" : "pipe",
  });
  if ((result.error || result.status !== 0) && !allowedFailure) {
    // Never include child stderr, arguments, or parsed provider responses: those
    // can contain populated specs, credentials, or connection strings.
    throw new Error(
      `${path.basename(program)} failed (exit ${result.status ?? "unavailable"}). Check installation/access; provider output was withheld.`,
    );
  }
  return result;
}

function cloud(args) {
  return run(doctl, ["--context", context, ...args]).stdout.trim();
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`Missing or invalid JSON: ${path.basename(file)}.`);
  }
}

function protectDirectory() {
  const relative = "ops/digitalocean/.private/probe";
  if (
    run("git", ["check-ignore", "-q", relative], { allowedFailure: true }).status !== 0 ||
    run("git", ["ls-files", "--", "ops/digitalocean/.private"]).stdout.trim()
  ) {
    throw new Error(
      "Private deployment directory must be ignored and contain no tracked files.",
    );
  }
  mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
  if (
    lstatSync(privateDirectory).isSymbolicLink() ||
    realpathSync(privateDirectory).toLowerCase() !== privateDirectory.toLowerCase()
  ) {
    throw new Error("Private deployment directory must not be a link or junction.");
  }
  if (process.platform === "win32") {
    const identity = run("whoami.exe", ["/user", "/fo", "csv", "/nh"]).stdout;
    const sid = identity.match(/S-1-5-(?:\d+-)*\d+/)?.[0];
    if (!sid)
      throw new Error("Cannot determine current Windows user for private file ACL.");
    run("icacls.exe", [
      privateDirectory,
      "/inheritance:r",
      "/grant:r",
      `*${sid}:(OI)(CI)F`,
      "*S-1-5-18:(OI)(CI)F",
    ]);
  } else {
    chmodSync(privateDirectory, 0o700);
  }
}

function writePrivate(file, value) {
  protectDirectory();
  // Exclusive creation prevents accidental key rotation or evidence replacement.
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Wrote private ${path.basename(file)}; contents withheld.`);
}

function revision() {
  return run("git", ["rev-parse", "HEAD"]).stdout.trim();
}

function clean() {
  return (
    run("git", [
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      ".",
      "../.gitattributes",
      "../.gitignore",
    ]).stdout.trim() === ""
  );
}

function checkAuth() {
  const check = run(
    doctl,
    ["--context", context, "account", "get", "--format", "Status", "--no-header"],
    { allowedFailure: true },
  );
  if (check.status !== 0)
    throw new Error(
      `DigitalOcean authentication/access is unavailable. Run doctl auth init --context ${context} in your terminal; do not paste the token into chat.`,
    );
  console.log("DigitalOcean account access verified.");
}

function assertNew(file) {
  if (existsSync(file))
    throw new Error(
      `${path.basename(file)} already exists. Archive the previous release evidence before continuing; preserve keys.json.`,
    );
}

function assertCleanCommit(manifest) {
  if (!clean() || !manifest.sourceTreeClean || manifest.commit !== revision()) {
    throw new Error(
      "Push requires a clean backend checkout at the recorded build commit. Commit reviewed changes, archive build.json, and build again.",
    );
  }
}

const action = process.argv[2];
try {
  if (process.argv.length !== 3)
    throw new Error(
      "Provide one action: preflight, init, keys, build, push, spec, validate.",
    );
  switch (action) {
    case "preflight": {
      run("git", ["--version"]);
      run("docker", ["info", "--format", "{{.OSType}}"]);
      checkAuth();
      // Explicit projections avoid doctl's full app specs and DB credentials.
      for (const [label, args, select] of [
        ["projects", ["projects", "list"], (item) => ({ id: item.id, name: item.name })],
        [
          "registries",
          ["registries", "list"],
          (item) => ({ name: item.name, region: item.region }),
        ],
        [
          "apps",
          ["apps", "list"],
          (item) => ({
            id: item.id,
            name: item.spec?.name,
            ingress: item.default_ingress,
          }),
        ],
        [
          "databases",
          ["databases", "list"],
          (item) => ({
            id: item.id,
            name: item.name,
            engine: item.engine,
            region: item.region,
          }),
        ],
        [
          "VPCs",
          ["vpcs", "list"],
          (item) => ({ id: item.id, name: item.name, region: item.region }),
        ],
      ]) {
        const entries = JSON.parse(cloud([...args, "--output", "json"]));
        if (!Array.isArray(entries))
          throw new Error(`Unexpected ${label} response; no resource action taken.`);
        console.log(`${label}: ${JSON.stringify(entries.map(select))}`);
      }
      console.log(
        "Spaces bucket inventory requires scoped Spaces credentials; inspect the control panel before supplying inputs.",
      );
      break;
    }
    case "init":
      writePrivate(
        inputPath,
        readJson(path.join(backend, "ops/digitalocean/inputs.example.json")),
      );
      break;
    case "keys":
      writePrivate(
        keysPath,
        Object.fromEntries(
          keyNames.map((name) => [name, randomBytes(32).toString("base64")]),
        ),
      );
      break;
    case "build": {
      assertNew(buildPath);
      const commit = revision();
      const sourceTreeClean = clean();
      for (const image of images) {
        console.log(`Building ${image.name} at ${commit}.`);
        run(
          "docker",
          [
            "build",
            "--platform",
            "linux/amd64",
            "--target",
            image.target,
            "--build-arg",
            `VCS_REF=${commit}`,
            "-t",
            `${image.repository}:${commit}`,
            ".",
          ],
          { visible: true },
        );
      }
      if (revision() !== commit || clean() !== sourceTreeClean)
        throw new Error(
          "Source state changed during build; build evidence was not recorded.",
        );
      const built = images.map((image) => ({
        ...image,
        tag: commit,
        imageId: run("docker", [
          "image",
          "inspect",
          `${image.repository}:${commit}`,
          "--format",
          "{{.Id}}",
        ]).stdout.trim(),
      }));
      writePrivate(buildPath, {
        commit,
        sourceTreeClean,
        builtAt: new Date().toISOString(),
        images: built,
      });
      if (!sourceTreeClean)
        console.log(
          "Local verification build only: commit reviewed changes before building a pushable release.",
        );
      break;
    }
    case "push": {
      assertNew(manifestPath);
      const built = readJson(buildPath);
      assertCleanCommit(built);
      const { registry } = readJson(inputPath);
      if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(registry))
        throw new Error("Supply the verified existing registry name.");
      checkAuth();
      cloud(["registries", "get", registry]);
      cloud(["registries", "login", registry, "--expiry-seconds", "3600"]);
      const released = [];
      for (const image of images) {
        assertCleanCommit(built);
        const local = `${image.repository}:${built.commit}`;
        const imageId = run("docker", [
          "image",
          "inspect",
          local,
          "--format",
          "{{.Id}}",
        ]).stdout.trim();
        if (built.images.find((item) => item.name === image.name)?.imageId !== imageId)
          throw new Error("A local image changed since the recorded build.");
        const remote = `registry.digitalocean.com/${registry}/${image.repository}:${built.commit}`;
        run("docker", ["tag", local, remote]);
        run("docker", ["push", remote], { visible: true });
        // Resolve the registry manifest (not the local image configuration ID).
        const tags = JSON.parse(
          cloud([
            "registries",
            "repository",
            "list-tags",
            registry,
            image.repository,
            "--output",
            "json",
          ]),
        );
        const digest = tags.find((entry) => entry.tag === built.commit)?.manifest_digest;
        if (!/^sha256:[a-f0-9]{64}$/.test(digest))
          throw new Error(`No remote digest for ${image.name}; no spec generated.`);
        released.push({ ...image, tag: built.commit, digest });
        console.log(`${image.name}: ${remote} @ ${digest}`);
      }
      const manifest = {
        commit: built.commit,
        sourceTreeClean: true,
        registry,
        pushedAt: new Date().toISOString(),
        images: released,
      };
      validateManifest(manifest, registry);
      writePrivate(manifestPath, manifest);
      break;
    }
    case "spec": {
      assertNew(specPath);
      const template = parseTemplate(
        readFileSync(
          path.join(backend, "ops/digitalocean/staging.app.yaml.template"),
          "utf8",
        ),
      );
      const spec = renderSpec(
        template,
        readJson(inputPath),
        readJson(manifestPath),
        readJson(keysPath),
      );
      writePrivate(specPath, spec);
      console.log(
        "Spec generated; not submitted. Validate it before creating or updating the staging app.",
      );
      break;
    }
    case "validate":
      checkAuth();
      cloud(["apps", "spec", "validate", specPath]);
      console.log(
        "DigitalOcean App Spec validation passed. No app was created or updated.",
      );
      break;
    default:
      throw new Error(
        "Unknown action. Use preflight, init, keys, build, push, spec, or validate.",
      );
  }
} catch (error) {
  // Our own messages contain field names only; filesystem/JSON errors may echo
  // sensitive values, so do not print arbitrary exception messages or stacks.
  const safe = error instanceof Error && !error.code && error.name !== "SyntaxError";
  console.error(
    safe
      ? error.message
      : "Release action failed. Check private input files, permissions, and prerequisite tools; details withheld.",
  );
  process.exitCode = 1;
}

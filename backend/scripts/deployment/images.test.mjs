import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { images } from "./spec.mjs";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: backend,
  encoding: "utf8",
  windowsHide: true,
}).trim();
// Explicit local tags allow dirty preparation builds to be tested without
// overwriting a commit-tagged release. The release helper still refuses dirty pushes.
const imageTag = process.env.AAT_IMAGE_TEST_TAG || commit;
const expectedRevision = process.env.AAT_IMAGE_TEST_REVISION || commit;
const directory = mkdtempSync(path.join(tmpdir(), "aat-image-ca-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const windowsOpenSsl = "C:/Program Files/Git/usr/bin/openssl.exe";
const openssl =
  process.platform === "win32" && existsSync(windowsOpenSsl) ? windowsOpenSsl : "openssl";
execFileSync(
  openssl,
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=synthetic-image-test",
    "-keyout",
    path.join(directory, "key.pem"),
    "-out",
    path.join(directory, "ca.pem"),
  ],
  { stdio: "ignore", windowsHide: true },
);
const ca = readFileSync(path.join(directory, "ca.pem")).toString("base64");

for (const image of images) {
  test(`${image.name} image keeps its command, non-root user and secure CA entrypoint`, () => {
    const reference = `${image.repository}:${imageTag}`;
    const [metadata] = JSON.parse(
      execFileSync("docker", ["image", "inspect", reference], {
        encoding: "utf8",
        windowsHide: true,
      }),
    );
    assert.equal(metadata.Config.User, "node");
    assert.equal(
      metadata.Config.Labels["org.opencontainers.image.revision"],
      expectedRevision,
    );
    assert.deepEqual(metadata.Config.Entrypoint, ["aat-with-database-ca"]);
    const commands = {
      api: ["node", "dist/server.js"],
      "identity-worker": ["node", "dist/workers/outbox.worker.js"],
      "general-worker": ["node", "dist/workers/worker-runtime.js"],
      migrate: ["node", "--import", "tsx", "scripts/migrate-safely.ts"],
    };
    assert.deepEqual(metadata.Config.Cmd, commands[image.name]);
    if (image.name !== "api")
      assert.equal(Object.keys(metadata.Config.ExposedPorts ?? {}).length, 0);
    assert.ok(
      metadata.Config.Env.every(
        (entry) =>
          !/^(DB_PASSWORD|DB_SSL_CA_BASE64|.*SECRET.*|TOKEN_HASH_KEY|MFA_ENCRYPTION_KEY|OUTBOX_ENCRYPTION_KEY|ASSET_TICKET_KEY)=/.test(
            entry,
          ),
      ),
    );
    const probe = `const fs = require('node:fs'); const file = process.env.DB_SSL_CA_FILE; const target = ${JSON.stringify(image.name === "migrate" ? "scripts/migrate-safely.ts" : commands[image.name][1])}; fs.accessSync(target); if (fs.existsSync('/app/.env')) process.exit(8); console.log(JSON.stringify({uid:process.getuid(), mode:fs.statSync(file).mode & 511, ca:fs.readFileSync(file,'utf8').startsWith('-----BEGIN CERTIFICATE-----'), helperRemoved:process.env.DB_SSL_CA_BASE64 === undefined}));`;
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "-e",
        "DB_SSL_MODE=verify-full",
        "-e",
        "DB_SSL_CA_FILE=/tmp/allied-autotech-secrets/database-ca.pem",
        "-e",
        "DB_SSL_CA_BASE64",
        reference,
        "node",
        "-e",
        probe,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 60_000,
        env: { ...process.env, DB_SSL_CA_BASE64: ca },
      },
    );
    assert.equal(result.status, 0, "CA bootstrap probe must succeed without a database.");
    assert.deepEqual(JSON.parse(result.stdout), {
      uid: 1000,
      mode: 0o400,
      ca: true,
      helperRemoved: true,
    });
  });
}

test("CA entrypoint rejects private keys and unsafe paths before starting Node", () => {
  const privateKey = readFileSync(path.join(directory, "key.pem"), "utf8");
  for (const [material, file] of [
    [
      Buffer.from(privateKey).toString("base64"),
      "/tmp/allied-autotech-secrets/database-ca.pem",
    ],
    [ca, "/tmp/unsafe-ca.pem"],
    [
      Buffer.from("invalid certificate").toString("base64"),
      "/tmp/allied-autotech-secrets/database-ca.pem",
    ],
  ]) {
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "-e",
        "DB_SSL_MODE=verify-full",
        "-e",
        `DB_SSL_CA_FILE=${file}`,
        "-e",
        "DB_SSL_CA_BASE64",
        `${images[0].repository}:${imageTag}`,
        "node",
        "-e",
        "console.log('unexpected-start')",
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 60_000,
        env: { ...process.env, DB_SSL_CA_BASE64: material },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Database CA (material is invalid|destination is not configured correctly)/,
    );
    assert.ok(!result.stdout.includes("unexpected-start"));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(material));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(privateKey));
  }
});

const runtimeProbes = [
  ...["api", "general-worker"].map((name) => ({
    name,
    description: "loads Sharp and decodes/encodes media",
    file: "media-runtime-probe.mjs",
    expected: { format: "webp", width: 32, height: 32 },
  })),
  {
    name: "api",
    description:
      "imports the application and workers, verifies passwords and includes document fonts",
    file: "application-runtime-probe.mjs",
    expected: { imports: 3, passwordHashVerified: true, fonts: 2 },
  },
];
for (const { name, description, file, expected } of runtimeProbes) {
  test(`${name} image ${description} without network or database access`, () => {
    const image = images.find((i) => i.name === name);
    const probe = readFileSync(path.join(backend, "scripts/deployment", file), "utf8");
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "-e",
        "DB_SSL_MODE=verify-full",
        "-e",
        "DB_SSL_CA_FILE=/tmp/allied-autotech-secrets/database-ca.pem",
        "-e",
        "DB_SSL_CA_BASE64",
        `${image.repository}:${imageTag}`,
        "node",
        "--input-type=module",
        "-e",
        probe,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 60000,
        env: { ...process.env, DB_SSL_CA_BASE64: ca },
      },
    );
    assert.equal(result.status, 0, `Runtime image probe failed: ${description}.`);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  });
}

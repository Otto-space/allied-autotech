// cspell:words AKIA baprs bxox PAYSTACK
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

interface CredentialPattern {
  category: string;
  pattern: RegExp;
}

const isPlaceholderExampleValue = (value: string): boolean => {
  const trimmedValue = value.trim();
  if (trimmedValue === "") return true;

  const normalizedValue = trimmedValue.toLowerCase();
  if (
    normalizedValue === "change" ||
    normalizedValue === "replace" ||
    normalizedValue === "example" ||
    normalizedValue === "placeholder"
  ) {
    return true;
  }

  if (
    normalizedValue.startsWith("change me") ||
    normalizedValue.startsWith("change-me") ||
    normalizedValue.startsWith("change_me") ||
    normalizedValue.startsWith("change-") ||
    normalizedValue.startsWith("change_") ||
    normalizedValue.startsWith("replace ") ||
    normalizedValue.startsWith("replace-") ||
    normalizedValue.startsWith("replace_") ||
    normalizedValue.startsWith("example ") ||
    normalizedValue.startsWith("example-") ||
    normalizedValue.startsWith("example_") ||
    normalizedValue.startsWith("placeholder ") ||
    normalizedValue.startsWith("placeholder-") ||
    normalizedValue.startsWith("placeholder_")
  ) {
    return true;
  }

  return /^<[^>\r\n]*>$/.test(trimmedValue);
};

const parseEnvironmentAssignment = (
  line: string,
): readonly [name: string, value: string] | undefined => {
  const separatorIndex = line.indexOf("=");
  if (separatorIndex < 0) return undefined;

  const name = line.slice(0, separatorIndex).trim();
  if (!/^\w+$/u.test(name)) return undefined;

  return [name, line.slice(separatorIndex + 1).trim()];
};

const resolveGitBinary = (): string => {
  const programW6432 = process.env["ProgramW6432"];
  const programFiles = process.env["ProgramFiles"];
  const programFilesX86 = process.env["ProgramFiles(x86)"];

  const gitCandidates = [
    programW6432 ? resolve(programW6432, "Git", "bin", "git.exe") : undefined,
    programFiles ? resolve(programFiles, "Git", "bin", "git.exe") : undefined,
    programFilesX86 ? resolve(programFilesX86, "Git", "bin", "git.exe") : undefined,
    programW6432 ? resolve(programW6432, "Git", "cmd", "git.exe") : undefined,
    programFiles ? resolve(programFiles, "Git", "cmd", "git.exe") : undefined,
    programFilesX86 ? resolve(programFilesX86, "Git", "cmd", "git.exe") : undefined,
    "git",
  ];

  for (const candidate of gitCandidates) {
    if (candidate === undefined) continue;
    if (candidate === "git") return candidate;
    if (existsSync(candidate)) return candidate;
  }

  return "git";
};

const credentialPatterns: readonly CredentialPattern[] = [
  {
    category: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  },
  { category: "DigitalOcean token", pattern: /\bdop_v1_[a-f0-9]{64}\b/u },
  { category: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  {
    category: "GitHub token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_\w{30,}\b|github_pat_\w{40,}/u,
  },
  { category: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u },
  { category: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/u },
  { category: "Resend API key", pattern: /\bre_[A-Za-z0-9_-]{20,}\b/u },
  {
    category: "live/test provider secret",
    pattern: /\b(?:sk_(?:live|test)|rk_live)_[0-9A-Za-z]{16,}\b/u,
  },
  {
    category: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  },
  {
    category: "credential URL",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/iu,
  },
];

const sensitiveExampleVariables = new Set([
  "OPENAI_API_KEY",
  "PRIVATE_TESTING_PASSWORD",
  "DIGITALOCEAN_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "DB_PASSWORD",
  "TOKEN_HASH_KEY",
  "MFA_ENCRYPTION_KEY",
  "OUTBOX_ENCRYPTION_KEY",
  "ASSET_TICKET_KEY",
  "RESEND_API_KEY",
  "PAYSTACK_SECRET_KEY",
  "MONNIFY_API_KEY",
  "MONNIFY_SECRET_KEY",
  "TERMII_API_KEY",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "DB_SSL_CA_BASE64",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
const gitBinary = resolveGitBinary();
const listed = spawnSync(
  gitBinary,
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  },
);
if (listed.error !== undefined) {
  throw new Error("Unable to start Git for repository enumeration", {
    cause: listed.error,
  });
}
if (listed.status !== 0 || !Buffer.isBuffer(listed.stdout)) {
  throw new Error("Git repository enumeration failed");
}

const paths = listed.stdout.toString("utf8").split("\0").filter(Boolean);
const findings: string[] = [];

for (const relativePath of paths) {
  const fileName = basename(relativePath);
  const isEnvironmentExample = [
    ".env.example",
    ".env.staging.example",
    ".env.production.example",
  ].includes(fileName);
  if (/^\.env(?:\..+)?$/u.test(fileName) && !isEnvironmentExample) {
    findings.push(`environment file: ${relativePath}`);
    continue;
  }

  const absolutePath = resolve(repositoryRoot, relativePath);
  if (!absolutePath.startsWith(`${repositoryRoot}${sep}`)) {
    findings.push(`path outside repository: ${relativePath}`);
    continue;
  }
  // Tracked deletions may still appear in git ls-files; scan only present working files.
  if (!existsSync(absolutePath)) continue;
  if (statSync(absolutePath).size > 5_000_000) continue;
  const value = readFileSync(absolutePath);
  if (value.includes(0)) continue;
  const text = value.toString("utf8");

  for (const { category, pattern } of credentialPatterns) {
    if (pattern.test(text)) findings.push(`${category}: ${relativePath}`);
  }

  if (isEnvironmentExample) {
    for (const line of text.split(/\r?\n/u)) {
      const assignment = parseEnvironmentAssignment(line);
      if (assignment === undefined || !sensitiveExampleVariables.has(assignment[0])) {
        continue;
      }
      const exampleValue = assignment[1];
      if (exampleValue !== "" && !isPlaceholderExampleValue(exampleValue)) {
        findings.push(`literal sensitive example value: ${relativePath}`);
      }
    }
  }
}

if (process.argv.includes("--history")) {
  // Stream patches: available history exceeds spawnSync's buffer limit.
  const history = spawn(
    gitBinary,
    ["log", "--all", "-p", "--no-color", "--no-ext-diff", "--format=commit:%H"],
    { cwd: repositoryRoot, stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
  );
  const completed = new Promise<void>((resolveHistory, reject) => {
    history.once("error", () => reject(new Error("Unable to start history scan")));
    history.once("close", (code) =>
      code === 0 ? resolveHistory() : reject(new Error("Git history scan failed")),
    );
  });
  let commit = "unknown";
  let path = "unknown";
  for await (const line of createInterface({
    input: history.stdout,
    crlfDelay: Infinity,
  })) {
    if (line.startsWith("commit:")) commit = line.slice(7);
    if (line.startsWith("diff --git ")) path = line.slice(line.lastIndexOf(" b/") + 3);
    if (
      (line.startsWith("+") && !line.startsWith("+++")) ||
      (line.startsWith("-") && !line.startsWith("---"))
    ) {
      for (const { category, pattern } of credentialPatterns) {
        if (pattern.test(line))
          findings.push("historical " + category + ": " + commit + " " + path);
      }
    }
    if (line.startsWith("+++ b/") || line.startsWith("--- a/")) {
      const historicalPath = line.slice(6);
      const name = basename(historicalPath);
      if (
        /^\.env(?:\..+)?$/u.test(name) &&
        ![".env.example", ".env.staging.example", ".env.production.example"].includes(
          name,
        )
      ) {
        findings.push("historical environment file: " + commit + " " + historicalPath);
      }
    }
  }
  await completed;
}

if (findings.length > 0) {
  for (const finding of [...new Set(findings)].sort((left, right) =>
    left.localeCompare(right),
  )) {
    process.stderr.write(`Potential secret detected (${finding})\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Secret guard passed for ${String(paths.length)} non-ignored files${process.argv.includes("--history") ? " and Git history" : ""}.\n`,
  );
}

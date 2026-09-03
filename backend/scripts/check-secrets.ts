import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

interface CredentialPattern {
  category: string;
  pattern: RegExp;
}

const credentialPatterns: readonly CredentialPattern[] = [
  {
    category: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  },
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
  "DB_PASSWORD",
  "TOKEN_HASH_KEY",
  "MFA_ENCRYPTION_KEY",
  "OUTBOX_ENCRYPTION_KEY",
  "RESEND_API_KEY",
  "PAYSTACK_SECRET_KEY",
  "CLOUDINARY_API_SECRET",
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
const listed = spawnSync(
  "git",
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
  if (/^\.env(?:\..+)?$/u.test(fileName) && fileName !== ".env.example") {
    findings.push(`environment file: ${relativePath}`);
    continue;
  }

  const absolutePath = resolve(repositoryRoot, relativePath);
  if (!absolutePath.startsWith(`${repositoryRoot}${sep}`)) {
    findings.push(`path outside repository: ${relativePath}`);
    continue;
  }
  if (statSync(absolutePath).size > 5_000_000) continue;
  const value = readFileSync(absolutePath);
  if (value.indexOf(0) !== -1) continue;
  const text = value.toString("utf8");

  for (const { category, pattern } of credentialPatterns) {
    if (pattern.test(text)) findings.push(`${category}: ${relativePath}`);
  }

  if (fileName === ".env.example") {
    for (const line of text.split(/\r?\n/u)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
      if (match === null || !sensitiveExampleVariables.has(match[1] ?? "")) continue;
      const exampleValue = (match[2] ?? "").trim();
      if (
        exampleValue !== "" &&
        !/(?:change[-_ ]?me|replace|example|placeholder|<[^>\r\n]*>)/iu.test(exampleValue)
      ) {
        findings.push(`literal sensitive example value: ${relativePath}`);
      }
    }
  }
}

if (findings.length > 0) {
  for (const finding of [...new Set(findings)].sort()) {
    process.stderr.write(`Potential secret detected (${finding})\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Secret guard passed for ${String(paths.length)} non-ignored files.\n`,
  );
}

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { z } from "zod";

import { hashPassword, isCommonPassword } from "../src/common/security/passwords.js";
import { normalizeEmail } from "../src/common/security/session-tokens.js";
import { prisma } from "../src/config/database.js";
import { env } from "../src/config/env.js";

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("A secure interactive terminal is required to read the password");
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const cleanup = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Bootstrap cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (value.length < 128) {
          value += character;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    if (env.NODE_ENV === "production") {
      const confirmation = await prompt.question(
        'Type "CREATE INITIAL SUPER ADMIN" to continue in production: ',
      );
      if (confirmation !== "CREATE INITIAL SUPER ADMIN") {
        throw new Error("Production confirmation was not provided");
      }
    }

    const email = normalizeEmail(await prompt.question("Verified email: "));
    z.email().max(254).parse(email);
    prompt.pause();
    const password = await readHidden("Password (12-128 characters, input hidden): ");
    if (password.length < 12 || password.length > 128 || isCommonPassword(password)) {
      throw new Error("Password does not meet the secure password policy");
    }
    const passwordConfirmation = await readHidden("Confirm password (input hidden): ");
    prompt.resume();
    if (password !== passwordConfirmation) throw new Error("Passwords do not match");
    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(421337, 1)`;
        if ((await tx.user.count({ where: { role: "SUPER_ADMIN" } })) > 0) {
          throw new Error("An initial super administrator already exists");
        }
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
          select: { id: true, email: true },
        });
        await tx.auditLog.create({
          data: {
            userId: created.id,
            action: "CREATE",
            entityType: "USER",
            entityId: created.id,
            newValues: {
              role: "SUPER_ADMIN",
              source: "guarded_initial_bootstrap",
              mfaEnrollmentRequired: true,
            },
          },
        });
        return created;
      },
      { isolationLevel: "Serializable" },
    );
    stdout.write(
      `Initial super administrator ${user.email} created. Login and enroll MFA before privileged access.\n`,
    );
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Bootstrap failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

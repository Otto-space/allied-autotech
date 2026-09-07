import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { ConnectionOptions } from "node:tls";

import { z } from "zod";

export type DatabaseSslMode = "disable" | "verify-full";

export interface DatabaseTlsConfiguration {
  mode: DatabaseSslMode;
  caFile?: string;
}

const optionalPath = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const databaseTlsEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DB_SSL_MODE: z.enum(["disable", "verify-full"]).optional(),
  DB_SSL_CA_FILE: optionalPath,
});

export function parseDatabaseTlsEnvironment(
  source: NodeJS.ProcessEnv,
): DatabaseTlsConfiguration {
  const parsed = databaseTlsEnvironmentSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid database TLS configuration: ${fields}`);
  }

  const mode = parsed.data.DB_SSL_MODE ?? "disable";
  const caFile = parsed.data.DB_SSL_CA_FILE;

  if (parsed.data.NODE_ENV === "production" && mode !== "verify-full") {
    throw new Error("DB_SSL_MODE must be verify-full in production");
  }
  if (mode === "verify-full" && caFile === undefined) {
    throw new Error("DB_SSL_CA_FILE is required when DB_SSL_MODE is verify-full");
  }
  if (mode === "disable" && caFile !== undefined) {
    throw new Error("DB_SSL_CA_FILE must be unset when DB_SSL_MODE is disable");
  }
  if (caFile !== undefined && !isAbsolute(caFile)) {
    throw new Error("DB_SSL_CA_FILE must be an absolute path");
  }
  if (caFile !== undefined) {
    readCertificateAuthority(caFile);
  }

  return { mode, ...(caFile === undefined ? {} : { caFile }) };
}

function readCertificateAuthority(caFile: string): string {
  try {
    const stats = statSync(caFile);
    if (!stats.isFile() || stats.size < 1 || stats.size > 1_048_576) {
      throw new Error("invalid certificate authority file");
    }
    const certificateAuthority = readFileSync(caFile, "utf8");
    if (
      !certificateAuthority.includes("-----BEGIN CERTIFICATE-----") ||
      !certificateAuthority.includes("-----END CERTIFICATE-----") ||
      certificateAuthority.includes("PRIVATE KEY")
    ) {
      throw new Error("invalid certificate authority contents");
    }
    return certificateAuthority;
  } catch (error: unknown) {
    throw new Error("Unable to read the database certificate authority file", {
      cause: error,
    });
  }
}

export function createNodePostgresSslConfiguration(
  configuration: DatabaseTlsConfiguration,
): false | ConnectionOptions {
  if (configuration.mode === "disable") return false;

  if (configuration.caFile === undefined) {
    throw new Error("Database certificate verification is not configured");
  }

  return {
    ca: readCertificateAuthority(configuration.caFile),
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  };
}

export function addPrismaTlsParameters(
  url: URL,
  configuration: DatabaseTlsConfiguration,
): void {
  if (configuration.mode === "disable") {
    url.searchParams.set("sslmode", "disable");
    return;
  }

  if (configuration.caFile === undefined) {
    throw new Error("Database certificate verification is not configured");
  }

  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslaccept", "strict");
  // Prisma's PostgreSQL connector uses `sslcert` for the trusted server CA.
  // This differs from libpq, where the similarly named option identifies a
  // client certificate.
  url.searchParams.set("sslcert", configuration.caFile);
}

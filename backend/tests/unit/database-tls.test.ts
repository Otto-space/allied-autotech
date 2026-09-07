import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  addPrismaTlsParameters,
  createNodePostgresSslConfiguration,
  parseDatabaseTlsEnvironment,
} from "../../src/config/database-tls.js";

describe("database TLS policy", () => {
  it("allows an explicit plaintext connection only outside production", () => {
    expect(
      parseDatabaseTlsEnvironment({ NODE_ENV: "test", DB_SSL_MODE: "disable" }),
    ).toEqual({ mode: "disable" });
    expect(createNodePostgresSslConfiguration({ mode: "disable" })).toBe(false);
  });

  it("fails closed when production certificate verification is incomplete", () => {
    expect(() =>
      parseDatabaseTlsEnvironment({ NODE_ENV: "production", DB_SSL_MODE: "disable" }),
    ).toThrow(/verify-full/u);
    expect(() =>
      parseDatabaseTlsEnvironment({
        NODE_ENV: "production",
        DB_SSL_MODE: "verify-full",
      }),
    ).toThrow(/DB_SSL_CA_FILE/u);
    expect(() =>
      parseDatabaseTlsEnvironment({
        NODE_ENV: "production",
        DB_SSL_MODE: "verify-full",
        DB_SSL_CA_FILE: "relative/ca.pem",
      }),
    ).toThrow(/absolute/u);
  });

  it("uses strict Prisma TLS parameters without permitting invalid certificates", () => {
    const url = new URL("postgresql://database.example:5432/app");
    addPrismaTlsParameters(url, {
      mode: "verify-full",
      caFile: resolve("private-database-ca.pem"),
    });
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("sslaccept")).toBe("strict");
    expect(url.searchParams.get("sslcert")).toBe(resolve("private-database-ca.pem"));
    expect(url.searchParams.has("sslrootcert")).toBe(false);
  });
});

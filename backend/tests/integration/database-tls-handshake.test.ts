import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, createServer, type ConnectionOptions } from "node:tls";
import { describe, expect, it } from "vitest";
import { createNodePostgresSslConfiguration } from "../../src/config/database-tls.js";

describe("runtime PostgreSQL TLS handshake policy against a disposable local TLS server", () => {
  it("accepts its trusted hostname and rejects both a wrong hostname and untrusted certificate", async () => {
    const directory = mkdtempSync(join(tmpdir(), "aat-tls-contract-"));
    const windowsOpenSsl = "C:/Program Files/Git/usr/bin/openssl.exe";
    const openssl =
      process.platform === "win32" && existsSync(windowsOpenSsl)
        ? windowsOpenSsl
        : "openssl";
    const cert = join(directory, "server.pem"),
      key = join(directory, "server-key.pem");
    try {
      execFileSync(
        openssl,
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          key,
          "-out",
          cert,
          "-days",
          "1",
          "-subj",
          "/CN=localhost",
          "-addext",
          "subjectAltName=DNS:localhost",
        ],
        { stdio: "ignore", windowsHide: true },
      );
      const server = createServer(
        { cert: readFileSync(cert), key: readFileSync(key) },
        (socket) => socket.end(),
      );
      server.on("tlsClientError", () => undefined);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      try {
        const address = server.address();
        if (!address || typeof address === "string")
          throw new Error("Missing TLS test port");
        const ssl = createNodePostgresSslConfiguration({
          mode: "verify-full",
          caFile: cert,
        });
        if (!ssl) throw new Error("TLS unexpectedly disabled");
        const handshake = (options: ConnectionOptions) =>
          new Promise<void>((resolve, reject) => {
            const socket = connect({ host: "127.0.0.1", port: address.port, ...options });
            socket.setTimeout(5_000, () => socket.destroy(new Error("TLS test timeout")));
            socket.once("secureConnect", () => {
              socket.end();
              resolve();
            });
            socket.once("error", reject);
          });
        await expect(
          handshake({ ...ssl, servername: "localhost" }),
        ).resolves.toBeUndefined();
        await expect(
          handshake({ ...ssl, servername: "incorrect.example.test" }),
        ).rejects.toMatchObject({ code: "ERR_TLS_CERT_ALTNAME_INVALID" });
        await expect(
          handshake({ ...ssl, ca: [], servername: "localhost" }),
        ).rejects.toMatchObject({ code: "DEPTH_ZERO_SELF_SIGNED_CERT" });
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

// Loopback-only TLS transport for the unchanged production build. WebKit honors
// upgrade-insecure-requests on HTTP loopback; serve HTTPS rather than bypass CSP.
import http from "node:http";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let openssl = "openssl";
if (process.platform === "win32") {
  // Git for Windows already ships OpenSSL; reuse it without changing PATH or
  // requiring a second installation for the existing local test workflow.
  const gitDirectory = execFileSync("git", ["--exec-path"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  const bundled = path.resolve(gitDirectory, "../../../usr/bin/openssl.exe");
  if (existsSync(bundled)) openssl = bundled;
}
const directory = mkdtempSync(path.join(tmpdir(), "allied-runtime-tls-"));
const keyPath = path.join(directory, "key.pem");
const certPath = path.join(directory, "cert.pem");
let server;
try {
  execFileSync(
    openssl,
    [
      "req",
      "-x509",
      "-nodes",
      "-newkey",
      "rsa:2048",
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
      "-keyout",
      keyPath,
      "-out",
      certPath,
    ],
    { stdio: "ignore", timeout: 15_000, windowsHide: true },
  );
  server = https.createServer(
    { key: readFileSync(keyPath), cert: readFileSync(certPath) },
    (request, response) => {
      if (request.url === "/__runtime_tls_health") {
        response.writeHead(200, { "cache-control": "no-store" });
        response.end("Isolated runtime TLS ready");
        return;
      }
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: 3103,
          path: request.url,
          method: request.method,
          headers: request.headers,
        },
        (result) => {
          // Preserve CSP and all other application response headers unchanged.
          response.writeHead(result.statusCode ?? 502, result.headers);
          result.pipe(response);
        },
      );
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end("Isolated runtime upstream unavailable");
      });
      request.on("aborted", () => upstream.destroy());
      request.pipe(upstream);
    },
  );
} finally {
  // These exact files belong to this process; retain no private key on disk.
  for (const file of [keyPath, certPath]) {
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  rmdirSync(directory);
}
server.listen(3104, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}

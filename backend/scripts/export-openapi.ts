import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createOpenApiDocument } from "../src/openapi/document.js";
import { createApiHandbook } from "../src/openapi/handbook.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(
  scriptDirectory,
  "..",
  "docs",
  "api",
  "allied-autotech.openapi.json",
);
const handbookPath = resolve(
  scriptDirectory,
  "..",
  "docs",
  "api",
  "endpoint-handbook.md",
);
const document = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o644,
});
await writeFile(handbookPath, createApiHandbook(document), {
  encoding: "utf8",
  mode: 0o644,
});
process.stdout.write("Exported the private OpenAPI artifact and endpoint handbook.\n");

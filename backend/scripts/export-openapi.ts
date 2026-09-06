import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createOpenApiDocument } from "../src/openapi/document.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(
  scriptDirectory,
  "..",
  "docs",
  "api",
  "allied-autotech.openapi.json",
);
const document = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o644,
});
process.stdout.write("Exported the private OpenAPI handover artifact.\n");

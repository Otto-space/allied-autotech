import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import openapiTS, { astToString } from "openapi-typescript";

const source = new URL(
  "../../../../backend/docs/api/allied-autotech.openapi.json",
  import.meta.url,
);
// Input is exclusively the committed local artifact; never fetch hosted documentation.
const relative = "backend/docs/api/allied-autotech.openapi.json";
const sha = execFileSync("git", ["log", "-1", "--format=%H", "--", relative], {
  cwd: new URL("../../../../", import.meta.url),
  encoding: "utf8",
}).trim();
const document = JSON.parse(await readFile(source, "utf8"));
const output = astToString(await openapiTS(document));
await writeFile(
  new URL("../../src/api/contracts/generated.d.ts", import.meta.url),
  `// Source: ${relative}\n// Source file git commit: ${sha}\n${output}`,
);

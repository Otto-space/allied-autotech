import fs from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";

// Consolidate completed cases, including successful cases in interrupted batches.
// Never count unexecuted/skipped cases as passing or double-count a rerun.
const directory = process.argv[2];
if (!directory)
  throw new Error("Pass the retained isolated Playwright evidence directory");
const sources = [
  "route-results.json",
  "core-results.json",
  "remaining-results.json",
  "corrected-results.json",
  "contracts-results.json",
  "final-public.log",
  "accepted-public.log",
  "accepted-core.json",
  "shop-final.json",
  "shop-recovery.json",
  "native-final.json",
  "about-final.json",
];
const cases = new Map();
const runs = [];
function add(file, title, status, evidence, notes = []) {
  const key = `${file}|${title}`;
  const item = cases.get(key) ?? { file, title, attempts: [] };
  item.attempts.push({ status, evidence, notes });
  if (status !== "skipped" && status !== "interrupted") item.latestExecuted = status;
  cases.set(key, item);
}
for (const source of sources) {
  const bytes = await fs.readFile(path.join(directory, source));
  const text = bytes
    .toString(bytes[0] === 255 && bytes[1] === 254 ? "utf16le" : "utf8")
    .replace(/^\uFEFF/, "");
  if (source.endsWith(".json")) {
    const report = JSON.parse(text);
    runs.push({ evidence: source, ...report.stats });
    function walk(suite) {
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests ?? [])
          add(
            spec.file,
            spec.title,
            test.status,
            source,
            (test.annotations ?? []).map((entry) => entry.description).filter(Boolean),
          );
      for (const child of suite.suites ?? []) walk(child);
    }
    walk(report);
  } else {
    let completed = 0;
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(
        /\s+(ok|x)\s+\d+\s+tests[\\/]e2e[\\/]([^:]+):\d+:\d+\s+›\s+(.+)\s+\([^)]+\)\s*$/,
      );
      if (match) {
        add(match[2], match[3], match[1] === "ok" ? "expected" : "unexpected", source);
        completed++;
      }
    }
    runs.push({
      evidence: source,
      completed,
      qualification: "Interrupted batch; only individually completed cases counted",
    });
  }
}
const entries = [...cases.values()].sort((a, b) =>
  `${a.file}|${a.title}`.localeCompare(`${b.file}|${b.title}`),
);
const accepted = entries.filter((item) => item.latestExecuted === "expected");
const unresolved = entries.filter(
  (item) => item.latestExecuted && item.latestExecuted !== "expected",
);
const skipped = entries.filter((item) => !item.latestExecuted);
const report = {
  scope:
    "Synthetic browser fixtures on local optimized builds, not production or all-role certification. Full-mode route sample and final browse_enquiries checks are separate configurations.",
  browser: "Microsoft Edge 156.0.4314.42 (Chromium), Windows, headless",
  unavailable: [
    "Firefox executable",
    "WebKit executable",
    "Physical-device and complete screen-reader acceptance",
  ],
  acceptedCases: accepted.length,
  acceptedSpecFiles: new Set(accepted.map((item) => item.file)).size,
  unresolvedCases: unresolved.length,
  unexecutedCases: skipped.length,
  runs,
  cases: entries,
};
await fs.writeFile(
  "docs/colour-browser-coverage.json",
  await prettier.format(JSON.stringify(report), { parser: "json" }),
);
console.log(
  `${accepted.length} distinct accepted cases across ${report.acceptedSpecFiles} specifications; ${unresolved.length} unresolved; ${skipped.length} unexecuted.`,
);
for (const item of [...unresolved, ...skipped])
  console.log(item.file, item.title, item.latestExecuted ?? "unexecuted");
if (unresolved.length) process.exitCode = 1;

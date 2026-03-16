import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const url = process.argv[2];
const outputPath = process.argv[3];

if (!url || !outputPath) {
  console.error("Usage: node scripts/lighthouse-run.mjs <url> <outputPath>");
  process.exit(1);
}

const command = `npx lighthouse "${url}" --output json --output-path "${outputPath}" --quiet --chrome-flags="--headless"`;

let hadCliError = false;

try {
  execSync(command, { stdio: "pipe" });
} catch (error) {
  hadCliError = true;
  const stderr = error?.stderr?.toString?.() ?? "";
  const stdout = error?.stdout?.toString?.() ?? "";
  const merged = `${stdout}\n${stderr}`;
  if (!merged.includes("EPERM")) {
    throw error;
  }
  console.warn("[lighthouse-run] Non-fatal EPERM cleanup error detected. Using produced JSON output.");
}

if (!existsSync(outputPath)) {
  console.error("[lighthouse-run] Output JSON not found:", outputPath);
  process.exit(1);
}

const report = JSON.parse(readFileSync(outputPath, "utf8"));
const categories = report.categories ?? {};
const audits = report.audits ?? {};

const summary = {
  url,
  performance: Math.round((categories.performance?.score ?? 0) * 100),
  accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
  bestPractices: Math.round((categories["best-practices"]?.score ?? 0) * 100),
  seo: Math.round((categories.seo?.score ?? 0) * 100),
  lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
  tbt: audits["total-blocking-time"]?.displayValue ?? null,
  fcp: audits["first-contentful-paint"]?.displayValue ?? null,
  unusedJs: audits["unused-javascript"]?.displayValue ?? null,
  cliHadNonFatalError: hadCliError,
};

console.log(JSON.stringify(summary, null, 2));

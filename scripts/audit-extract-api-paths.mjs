#!/usr/bin/env node
/**
 * Lists unique string literals matching /api/v1/... found under js/
 * (helps cross-check client paths vs backend mounts).
 * Usage: node scripts/audit-extract-api-paths.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jsDir = join(root, "js");

const files = readdirSync(jsDir).filter((f) => f.endsWith(".js"));
const paths = new Set();

// Backtick, single, double quoted paths starting with /api/v1/
const re = /[`'"](\/api\/v1\/[^`'"]+)[`'"]/g;

for (const f of files) {
  const text = readFileSync(join(jsDir, f), "utf8");
  let m;
  while ((m = re.exec(text))) {
    const p = m[1];
    if (!p.includes("${")) paths.add(p);
  }
}

console.log([...paths].sort().join("\n"));
console.error(`(${paths.size} unique paths from ${files.length} files)`);

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Browser artifact audit for OVANTO-DEPLOY-01.
 *
 * This deliberately scans only files that can be sent to a browser: every
 * file under .next/static, serialized App Router output, and client/build
 * manifests. Server JavaScript and server dependency traces are excluded so
 * that legitimate server-side env-name references do not create false hits.
 */

export const PRIVATE_ENV_NAMES = [
  "REPLICATE_API_TOKEN",
  "FAL_KEY",
  "TURNSTILE_SECRET_KEY",
  "REDIS_URL",
  "IP_HASH_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "REPLICATE_API_KEY",
  "FAL_API_KEY",
  "TURNSTILE_HOSTNAME",
];

const PRIVATE_PUBLIC_NAMES = PRIVATE_ENV_NAMES.map((name) => `NEXT_PUBLIC_${name}`);
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const SERIALIZED_EXTENSIONS = new Set([
  ".body",
  ".data",
  ".flight",
  ".html",
  ".json",
  ".meta",
  ".rsc",
  ".txt",
]);

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...walkFiles(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function relativePosix(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function isServerBrowserArtifact(relative) {
  const normalized = relative.toLowerCase();
  const base = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized);

  // .nft.json and source maps are server/dependency metadata, not browser
  // payloads. They are intentionally excluded from this audit.
  if (base.endsWith(".nft.json") || base.endsWith(".js.map")) return false;
  if (SERIALIZED_EXTENSIONS.has(extension)) return true;

  // Next emits some client reference manifests as JavaScript files. They are
  // serialized manifests rather than executable server route code.
  return /(?:client-reference-manifest|client-manifest|build-manifest|app-paths-manifest)/i.test(base);
}

/** Return absolute paths for browser-facing files in a Next build. */
export function collectBrowserArtifactFiles(buildDir) {
  const result = new Set();
  const staticDir = path.join(buildDir, "static");
  for (const file of walkFiles(staticDir)) result.add(file);

  const serverDir = path.join(buildDir, "server");
  for (const file of walkFiles(serverDir)) {
    const relative = relativePosix(serverDir, file);
    if (isServerBrowserArtifact(relative)) result.add(file);
  }
  return [...result].sort();
}

function countLiterals(text, literals) {
  const counts = {};
  for (const literal of literals) {
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = text.match(new RegExp(escaped, "g"));
    if (matches?.length) counts[literal] = matches.length;
  }
  return counts;
}

function readUtf8(file) {
  return readFileSync(file).toString("utf8");
}

/** Scan an explicit file list and report only relative paths and counts. */
export function scanFilesForLiterals(files, literals, relativeRoot) {
  const matches = [];
  for (const file of files) {
    const counts = countLiterals(readUtf8(file), literals);
    if (Object.keys(counts).length) {
      matches.push({
        file: relativePosix(relativeRoot, file),
        counts,
      });
    }
  }
  return matches;
}

function collectSourceFiles(repoRoot) {
  const result = [];
  for (const directory of ["app", "components", "lib", "src"]) {
    const root = path.join(repoRoot, directory);
    for (const file of walkFiles(root)) {
      if (SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) result.push(file);
    }
  }
  return result.sort();
}

function isClientFile(text) {
  // A client directive must be in the module prologue. This intentionally
  // avoids guessing at the full Next module graph.
  return /^\s*["']use client["']\s*;?/m.test(text.slice(0, 4096));
}

/**
 * Source checks complement the artifact scan. The client dependency graph is
 * intentionally not inferred here: Next's graph is compiler/runtime driven,
 * so this report only makes the reliable direct checks explicit.
 */
export function auditClientSource(repoRoot) {
  const files = collectSourceFiles(repoRoot);
  const clientFiles = files.filter((file) => isClientFile(readUtf8(file)));
  const clientPrivateMatches = scanFilesForLiterals(clientFiles, PRIVATE_ENV_NAMES, repoRoot);
  const publicPrefixMatches = scanFilesForLiterals(files, PRIVATE_PUBLIC_NAMES, repoRoot);
  return {
    filesScanned: files.length,
    clientFilesScanned: clientFiles.length,
    privateNameMatchesInClientSource: clientPrivateMatches,
    forbiddenPublicPrefixMatches: publicPrefixMatches,
    clientDependencyGraph: {
      status: "not-inferred",
      reason: "Next compiler dependency graph is not reconstructed by this static audit.",
    },
  };
}

export function auditClientArtifacts({ repoRoot = process.cwd(), buildDir = path.join(repoRoot, ".next") } = {}) {
  const files = collectBrowserArtifactFiles(buildDir);
  const artifactMatches = scanFilesForLiterals(files, PRIVATE_ENV_NAMES, buildDir);
  const source = auditClientSource(repoRoot);
  const buildPresent = existsSync(buildDir);
  return {
    ok: buildPresent && files.length > 0 && artifactMatches.length === 0
      && source.privateNameMatchesInClientSource.length === 0
      && source.forbiddenPublicPrefixMatches.length === 0,
    buildDir: path.relative(repoRoot, buildDir).split(path.sep).join("/") || ".",
    buildPresent,
    browserArtifactFilesScanned: files.length,
    artifactMatches,
    source,
  };
}

function parseArgs(argv) {
  const options = { repoRoot: process.cwd(), buildDir: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo-root") options.repoRoot = path.resolve(argv[++index]);
    else if (argument === "--build-dir") options.buildDir = path.resolve(argv[++index]);
    else if (argument === "--help") options.help = true;
  }
  if (!options.buildDir) options.buildDir = path.join(options.repoRoot, ".next");
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/audit-client-secrets.mjs [--repo-root DIR] [--build-dir DIR]\n");
    return;
  }
  const report = auditClientArtifacts(options);
  // Deliberately do not print matching lines or file contents. The report only
  // contains relative paths and counts, suitable for CI logs.
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();


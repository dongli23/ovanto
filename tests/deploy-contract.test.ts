import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { transformSync } from "esbuild";
import { tmpdir } from "node:os";

type ModelConfig = Record<string, Record<string, unknown>>;

const REQUIRED_KEYS = [
  "edit.free",
  "edit.paid",
  "image.free",
  "image.paid",
  "video.free",
  "video.paid",
];

// These are contract fields, not provider slugs. Slugs remain single-sourced
// in src/lib/models.ts and are checked only for presence below.
const CONTRACT = {
  "image.free": { provider: "replicate", unit: "image", cost: 0.003 },
  "image.paid": { provider: "replicate", unit: "image", cost: 0.025 },
  "edit.free": { provider: "replicate", unit: "image", cost: 0.023 },
  "edit.paid": { provider: "fal", unit: "image", cost: 0.04 },
  "video.free": { provider: "fal", unit: "second", cost: 0.05 },
  "video.paid": { provider: "fal", unit: "second", cost: 0.07 },
} as const;

function repoRoot() {
  if (process.env.OVANTO_REPO_ROOT) return path.resolve(process.env.OVANTO_REPO_ROOT);
  let current = path.resolve(process.cwd());
  while (true) {
    if (existsSync(path.join(current, "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(process.cwd());
    current = parent;
  }
}

function modelsPath(root: string) {
  return path.join(root, "src", "lib", "models.ts");
}

function loadModels(file: string): ModelConfig {
  const source = readFileSync(file, "utf8");
  const transformed = transformSync(source, {
    loader: "ts",
    format: "cjs",
    platform: "node",
    target: "es2020",
  });
  const modelModule: { exports: Record<string, unknown> } = { exports: {} };
  const requireForModels = createRequire(pathToFileURL(file));
  const execute = new Function("module", "exports", "require", transformed.code);
  execute(modelModule, modelModule.exports, requireForModels);
  const models = modelModule.exports.MODELS;
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    throw new Error("src/lib/models.ts does not export an object named MODELS");
  }
  return models as ModelConfig;
}

function walkSourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const directory of ["app", "components", "lib", "src"]) {
    const absoluteRoot = path.join(root, directory);
    if (!existsSync(absoluteRoot)) continue;
    const visit = (directoryPath: string) => {
      for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        const absolute = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (/\.(?:js|jsx|mjs|cjs|ts|tsx)$/.test(entry.name)) result.push(absolute);
      }
    };
    visit(absoluteRoot);
  }
  return result;
}

function clientPaidConfigReferences(root: string) {
  const references: string[] = [];
  for (const file of walkSourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    if (!/^\s*["']use client["']\s*;?/m.test(source.slice(0, 4096))) continue;
    if (/\b(?:image|edit|video)\.paid\b/.test(source)) {
      references.push(path.relative(root, file).split(path.sep).join("/"));
    }
  }
  return references;
}

const root = repoRoot();
const file = modelsPath(root);

test("client secret audit counts browser artifact fixture hits and skips server JS", async () => {
  // Keep this fixture isolated from the real build and real environment.
  const { auditClientArtifacts } = await import(pathToFileURL(path.join(root, "scripts", "audit-client-secrets.mjs")).href);
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ovanto-deploy-01-audit-"));
  const staticDir = path.join(fixtureRoot, ".next", "static", "chunks");
  const serverDir = path.join(fixtureRoot, ".next", "server", "app");
  const clientSourceDir = path.join(fixtureRoot, "components");
  mkdirSync(staticDir, { recursive: true });
  mkdirSync(serverDir, { recursive: true });
  mkdirSync(clientSourceDir, { recursive: true });
  writeFileSync(
    path.join(staticDir, "client.js"),
    "REPLICATE_API_TOKEN FAL_KEY REDIS_URL REDIS_URL IP_HASH_SECRET UPSTASH_REDIS_REST_TOKEN UPSTASH_REDIS_REST_URL REPLICATE_API_KEY FAL_API_KEY TURNSTILE_HOSTNAME",
  );
  writeFileSync(path.join(serverDir, "page.rsc"), "TURNSTILE_SECRET_KEY");
  writeFileSync(path.join(serverDir, "page.js"), "REPLICATE_API_TOKEN");
  writeFileSync(path.join(clientSourceDir, "client.tsx"), '"use client"; const key = process.env.NEXT_PUBLIC_FAL_KEY;');

  try {
    const report = auditClientArtifacts({
      repoRoot: fixtureRoot,
      buildDir: path.join(fixtureRoot, ".next"),
    });
    assert.equal(report.ok, false);
    assert.equal(report.browserArtifactFilesScanned, 2);
    assert.deepEqual(
      report.artifactMatches.map((entry: { file: string; counts: Record<string, number> }) => ({ file: entry.file, counts: entry.counts })),
      [
        { file: "server/app/page.rsc", counts: { TURNSTILE_SECRET_KEY: 1 } },
        {
          file: "static/chunks/client.js",
          counts: {
            REPLICATE_API_TOKEN: 1,
            FAL_KEY: 1,
            REDIS_URL: 2,
            IP_HASH_SECRET: 1,
            UPSTASH_REDIS_REST_TOKEN: 1,
            UPSTASH_REDIS_REST_URL: 1,
            REPLICATE_API_KEY: 1,
            FAL_API_KEY: 1,
            TURNSTILE_HOSTNAME: 1,
          },
        },
      ],
    );
    assert.equal(report.artifactMatches.some((entry: { file: string }) => entry.file.endsWith("page.js")), false);
    assert.deepEqual(report.source.forbiddenPublicPrefixMatches, [
      { file: "components/client.tsx", counts: { NEXT_PUBLIC_FAL_KEY: 1 } },
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

if (!existsSync(file)) {
  test("OVANTO-DEPLOY-01 model contract (PENDING src/lib/models.ts)", {
    skip: "PENDING: production model configuration has not been created yet",
  }, () => {});
} else {
  test("MODELS contains exactly the six deployment contract entries", () => {
    const models = loadModels(file);
    assert.deepEqual(Object.keys(models).sort(), REQUIRED_KEYS);
  });

  test("MODELS provider, unit, cost, slug, and fixed video fields match the contract", () => {
    const models = loadModels(file);
    for (const key of REQUIRED_KEYS) {
      const actual = models[key];
      assert.ok(actual && typeof actual === "object", `${key} must be an object`);
      assert.equal(actual.provider, CONTRACT[key as keyof typeof CONTRACT].provider, `${key}.provider`);
      assert.equal(actual.unit, CONTRACT[key as keyof typeof CONTRACT].unit, `${key}.unit`);
      assert.equal(actual.cost, CONTRACT[key as keyof typeof CONTRACT].cost, `${key}.cost`);
      assert.equal(typeof actual.slug, "string", `${key}.slug must be present in models.ts`);
      assert.ok(String(actual.slug).length > 0, `${key}.slug must not be empty`);
    }

    assert.equal(models["video.free"].fixedSeconds, 5, "video.free.fixedSeconds");
    assert.equal(models["video.free"].resolution, "480p", "video.free.resolution");
    assert.equal(models["video.paid"].fixedSeconds, 5, "video.paid.fixedSeconds");
    assert.equal(models["video.paid"].price, null, "video.paid.price");
    for (const key of REQUIRED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(models[key], "price")) {
        assert.ok(models[key].price === null || typeof models[key].price === "number", `${key}.price must be a number or null`);
      }
    }
  });

  test("paid model keys are not referenced by client components", () => {
    assert.deepEqual(clientPaidConfigReferences(root), []);
  });
}


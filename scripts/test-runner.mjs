import { buildSync } from "esbuild";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, ".test-build");
mkdirSync(outDir, { recursive: true });

const entries = [
  [path.join(root, "tests", "lua-reservation.test.cjs"), "lua-reservation.test.cjs"],
  [path.join(root, "tests", "generation.test.ts"), "generation.test.cjs"],
  [path.join(root, "tests", "payments.test.ts"), "payments.test.cjs"],
  [path.join(root, "tests", "payment-sql.test.ts"), "payment-sql.test.cjs"],
  [path.join(root, "tests", "paid-generation.test.ts"), "paid-generation.test.cjs"],
];
const outputs = [];
for (const [entry, name] of entries) {
  const outfile = path.join(outDir, name);
  buildSync({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    sourcemap: false,
    logLevel: "silent",
  });
  if (!existsSync(outfile)) throw new Error(`Test bundle was not created: ${name}`);
  outputs.push(outfile);
}

const result = spawnSync(process.execPath, ["--test", ...outputs], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

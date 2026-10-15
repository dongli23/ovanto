#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_URL = "https://www.ovanto.ai/";
const DEFAULT_COUNT = 5;

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

async function measureRequest(url, attempt) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      accept: "text/html",
      "user-agent": "ovanto-phase5-ttfb/1.0",
    },
  });
  const ttfbMs = Number((performance.now() - start).toFixed(2));

  // Drain the response so the connection can be reused for the subsequent
  // requests. This does not affect the time recorded above, which is taken as
  // soon as response headers arrive.
  await response.arrayBuffer();
  const totalMs = Number((performance.now() - start).toFixed(2));
  const headers = {};
  for (const name of [
    "x-vercel-cache",
    "server-timing",
    "age",
    "location",
    "cache-control",
    "cdn-cache-control",
    "vercel-cdn-cache-control",
    "x-matched-path",
    "content-type",
    "content-length",
    "date",
  ]) {
    const value = response.headers.get(name);
    if (value !== null) headers[name] = value;
  }

  return {
    attempt,
    startedAt,
    status: response.status,
    ttfbMs,
    totalMs,
    headers,
  };
}

const url = argumentValue("--url", DEFAULT_URL);
const count = positiveInteger(argumentValue("--count", String(DEFAULT_COUNT)), DEFAULT_COUNT);
const outputPath = argumentValue("--output", "");
const label = argumentValue("--label", "production");

if (count < 5) {
  throw new Error("TTFB evidence requires at least 5 GET requests; use --count 5 or greater.");
}

const measurements = [];
for (let attempt = 1; attempt <= count; attempt += 1) {
  try {
    measurements.push(await measureRequest(url, attempt));
  } catch (error) {
    measurements.push({
      attempt,
      startedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const successful = measurements.filter((measurement) => typeof measurement.ttfbMs === "number");
const ttfbValues = successful.map((measurement) => measurement.ttfbMs);
const report = {
  measuredAt: new Date().toISOString(),
  label,
  url,
  method: "GET",
  cookiesSent: false,
  requestCount: count,
  measurements,
  summary: {
    successfulRequests: successful.length,
    firstRequestTtfbMs: measurements[0]?.ttfbMs ?? null,
    subsequentTtfbMs: successful.slice(1).map((measurement) => measurement.ttfbMs),
    medianTtfbMs: percentile(ttfbValues, 0.5),
    p95TtfbMs: percentile(ttfbValues, 0.95),
    minTtfbMs: ttfbValues.length ? Math.min(...ttfbValues) : null,
    maxTtfbMs: ttfbValues.length ? Math.max(...ttfbValues) : null,
  },
};

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));

if (successful.length !== count) process.exitCode = 1;

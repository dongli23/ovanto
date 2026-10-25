#!/usr/bin/env node

/*
 * Gallery asset planner and bounded native-fetch runner.
 *
 * This file deliberately does not import the application's TypeScript
 * providers and never calls an Ovanto API route. The only network operations
 * in execution mode are the explicitly selected provider calls below.
 */

import { readFile, writeFile, access, mkdir, rename, rm, stat, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const MODELS_FILE = join(ROOT, "src", "lib", "models.ts");
const ENV_FILE = join(ROOT, ".env.local");
const PLAN_FILE = join(ROOT, "docs", "gallery-plan.json");
const MANIFEST_FILE = join(ROOT, "docs", "gallery-manifest.json");
const GALLERY_DIR = join(ROOT, "public", "gallery");
const JOURNAL_FILE = join(GALLERY_DIR, ".generation-journal.json");
const LOCK_FILE = join(GALLERY_DIR, ".generation.lock");
const APPROVED_PLAN_SHA256 = "a81e3bdd4b2897b03392797a3aaab75bb531b9a60ab3b6375ccc0a02eacc40d4";
const MAX_TOTAL_USD = 7;
const MAX_RETRIES = 2;
const MAX_POLL_ATTEMPTS = 90;
const POLL_INTERVAL_MS = 2000;
const FETCH_TIMEOUT_MS = 30_000;
const APPROVED_EFFECTIVE_PRICES = Object.freeze({ image: 0.003, edit: 0.025, video: 0.05 });

// These are intentionally a verbatim, reviewable copy of the four models used
// by the gallery.  The dry-run compares every field with src/lib/models.ts.
const SCRIPT_MODELS = Object.freeze({
  image: Object.freeze({
    key: "image.free",
    provider: "replicate",
    slug: "black-forest-labs/flux-schnell",
    unit: "image",
    cost: 0.003,
  }),
  edit: Object.freeze({
    key: "edit.free",
    provider: "replicate",
    slug: "black-forest-labs/flux-kontext-dev",
    unit: "image",
    cost: 0.023,
  }),
  video: Object.freeze({
    key: "video.free",
    provider: "fal",
    slug: "fal-ai/wan-25-preview/text-to-video",
    queueSlug: "fal-ai/wan-25-preview",
    unit: "second",
    cost: 0.05,
    fixedSeconds: 5,
    resolution: "480p",
  }),
  pro: Object.freeze({
    key: "video.paid",
    provider: "fal",
    slug: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    queueSlug: "fal-ai/kling-video",
    unit: "second",
    cost: 0.07,
    fixedSeconds: 5,
  }),
});

const SAFETY =
  "No identifiable real people, celebrity faces, brand logos, trademarks, readable text, captions, dialogue, or watermark; use original generic content only.";

const IMAGE_VARIANTS = [
  "soft side lighting, centered square composition, tactile editorial detail",
  "cool window rim light, balanced off-center composition, tactile editorial detail",
];
const EDIT_VARIANTS = [
  "camera centered with gentle left-side light",
  "camera slightly elevated with broad diffused light",
];
const VIDEO_VARIANTS = [
  "a locked opening composition followed by a slow lateral movement",
  "a low-angle opening followed by gentle parallax movement",
];

const IMAGE_THEMES = [
  ["pet-portrait", "A gentle portrait of a fictional rescue dog beside a sleepy cat in soft window light"],
  ["product-still-life", "A sculptural ceramic cup and folded linen on a quiet sunlit table"],
  ["interior-space", "A calm European coffee shop interior with warm morning light and empty tables"],
  ["food-close-up", "A close-up of a rustic fruit tart with fresh berries on a handmade plate"],
  ["landscape", "Misty alpine hills and a clear lake at dawn, wide cinematic landscape"],
  ["architecture", "A contemporary stone courtyard with arches, plants, and long afternoon shadows"],
  ["ecommerce-product", "A neutral studio product photograph of a woven travel backpack with no markings"],
  ["flat-illustration", "A flat geometric illustration of a bicycle, leaves, and a bright sun"],
  ["three-d-render", "A small translucent glass terrarium rendered in polished 3D on a plain pedestal"],
  ["vintage-film-portrait", "A fictional person seen from behind in a wool coat on a quiet street, vintage film grain"],
  ["seasonal-landscape", "An autumn forest path with amber leaves, distant hills, and soft overcast light"],
  ["abstract-texture", "An abstract macro texture of layered mineral pigments in teal, ochre, and cream"],
];

const EDIT_THEMES = [
  ["background-solid", "A studio photo of a plain ceramic vase on a small table", "Remove the background and replace it with a single warm ivory solid color while preserving the vase, framing, and shadows."],
  ["day-to-dusk", "A quiet European courtyard with a stone arch and leafy plants in clear daylight", "Change the daylight to a warm blue-and-amber dusk while preserving the exact architecture, camera angle, and composition."],
  ["photo-restoration", "A softly faded picnic scene with anonymous distant figures shown only from behind; no faces or identifying features", "Restore gentle contrast, remove dust and scratches, and preserve the original framing and anonymous silhouettes without adding any faces."],
  ["summer-to-winter", "A mountain cabin beside green trees under a clear summer sky", "Turn the season into a snowy winter scene while preserving the cabin, camera position, and composition."],
  ["watercolor", "A still life of pears, a linen cloth, and a ceramic bowl on a plain table", "Transform the same composition into a delicate watercolor illustration while preserving object placement and proportions."],
  ["product-background", "A generic unmarked glass bottle on a neutral studio surface", "Place the same unmarked bottle on a soft pale-blue studio background while preserving its silhouette, position, and lighting direction."],
];

const VIDEO_THEMES = [
  ["waves", "Slow ocean waves rolling over smooth stones at a quiet northern coastline"],
  ["cloud-timelapse", "Soft clouds moving across a wide alpine valley in a peaceful time-lapse"],
  ["product-rotation", "A generic unmarked ceramic object rotating slowly on a neutral studio plinth"],
  ["raindrop-particles", "Rain drops falling through a beam of light above a dark reflective surface"],
  ["fluid-abstract", "Silky abstract teal and gold fluid forms folding and flowing in macro view"],
  ["city-glide", "A smooth evening camera glide along a quiet European street with no readable signs"],
];

const PRO_THEMES = [
  ["camera-push", "A slow cinematic camera push toward a misty mountain lake at blue hour"],
  ["animal-motion", "A fictional fox moving gracefully through tall grass at sunrise, viewed from a distance"],
  ["night-pan", "A slow nighttime camera move through a quiet European city street with glowing windows and no readable signage"],
  ["macro-detail", "A cinematic macro drift over dew drops on a green leaf in soft morning light"],
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function parseArgs(argv) {
  const args = { dryRun: false, generate: false, groups: ["image", "edit"], limit: null, resume: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--generate") args.generate = true;
    else if (arg === "--resume") args.resume = true;
    else if (arg === "--no-resume") args.resume = false;
    else if (arg === "--group") args.groups = argv[++i]?.split(",").filter(Boolean) ?? [];
    else if (arg.startsWith("--group=")) args.groups = arg.slice("--group=".length).split(",").filter(Boolean);
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length));
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const valid = new Set(["image", "edit", "video", "pro"]);
  if (!args.groups.length || args.groups.some((group) => !valid.has(group))) {
    throw new Error("--group must contain only image, edit, video, and/or pro");
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return args;
}

function printHelp() {
  console.log("Usage: node scripts/gen-gallery.mjs [--group=image,edit|video --limit=N] [--resume]");
  console.log("--dry-run reads the approved plan without writing or calling providers.");
  console.log("Execution scope: image/edit full approved batch, or video with --limit=1|2. Pro is blocked.");
}

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function quoteRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readLiteral(block, name) {
  const match = block.match(new RegExp(`(?:['"]${quoteRegex(name)}['"]|\\b${quoteRegex(name)}\\b)\\s*:\\s*([^,\\n}]+)`, "m"));
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) return raw.slice(1, -1);
  const number = Number(raw);
  return Number.isNaN(number) ? raw : number;
}

function parseModelsSource(source) {
  const parsed = {};
  for (const model of Object.values(SCRIPT_MODELS)) {
    const entry = new RegExp(`['"]${quoteRegex(model.key)}['"]\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`, "m").exec(source);
    if (!entry) {
      parsed[model.key] = null;
      continue;
    }
    const block = entry[1];
    parsed[model.key] = {
      provider: readLiteral(block, "provider"),
      slug: readLiteral(block, "slug"),
      queueSlug: readLiteral(block, "queueSlug"),
      unit: readLiteral(block, "unit"),
      cost: readLiteral(block, "cost"),
    };
  }
  return parsed;
}

function compareModels(sourceModels) {
  const fields = ["provider", "slug", "queueSlug", "unit", "cost"];
  const comparisons = [];
  for (const model of Object.values(SCRIPT_MODELS)) {
    const source = sourceModels[model.key];
    const scriptValues = Object.fromEntries(fields.map((field) => [field, model[field]]));
    const sourceValues = source ? Object.fromEntries(fields.map((field) => [field, source[field]])) : null;
    const matches = Boolean(source) && fields.every((field) => source[field] === model[field]);
    const row = { key: model.key, script: scriptValues, modelsTs: sourceValues, matches };
    comparisons.push(row);
    console.log(`MODEL_COMPARE ${JSON.stringify(row)}`);
  }
  return comparisons;
}

function withSafety(text) {
  return `${text}; ${SAFETY}`;
}

function makeImageGroups() {
  const groups = [];
  IMAGE_THEMES.forEach(([theme, subject], themeIndex) => {
    for (let variant = 0; variant < 2; variant += 1) {
      const number = themeIndex * 2 + variant + 1;
      groups.push({
        id: `image-${String(number).padStart(2, "0")}`,
        theme,
        variant: variant + 1,
        prompt: withSafety(`${subject}, ${IMAGE_VARIANTS[variant]}, natural color`),
        model: SCRIPT_MODELS.image.slug,
        slug: SCRIPT_MODELS.image.slug,
        provider: SCRIPT_MODELS.image.provider,
        unit: SCRIPT_MODELS.image.unit,
        unitPrice: SCRIPT_MODELS.image.cost,
        width: 1280,
        height: 1280,
        seed: 17000100 + number,
        retain: variant === 0,
      });
    }
  });
  return groups;
}

function makeEditGroups() {
  const groups = [];
  EDIT_THEMES.forEach(([theme, beforeSubject, instruction], themeIndex) => {
    for (let variant = 0; variant < 2; variant += 1) {
      const number = themeIndex * 2 + variant + 1;
      const seed = 17000200 + number;
      groups.push({
        id: `edit-${String(number).padStart(2, "0")}`,
        theme,
        variant: variant + 1,
        count: 1,
        before_prompt: withSafety(`${beforeSubject}, ${EDIT_VARIANTS[variant]}, preserve the same subject placement`),
        edit_instruction: withSafety(`${instruction} Apply the ${EDIT_VARIANTS[variant]} treatment while preserving the original composition. Keep the same seed semantics.`),
        beforePrompt: withSafety(`${beforeSubject}, ${EDIT_VARIANTS[variant]}, preserve the same subject placement`),
        editInstruction: withSafety(`${instruction} Apply the ${EDIT_VARIANTS[variant]} treatment while preserving the original composition. Keep the same seed semantics.`),
        model: SCRIPT_MODELS.edit.slug,
        slug: SCRIPT_MODELS.edit.slug,
        provider: SCRIPT_MODELS.edit.provider,
        beforeModel: SCRIPT_MODELS.image.slug,
        beforeSlug: SCRIPT_MODELS.image.slug,
        beforeProvider: SCRIPT_MODELS.image.provider,
        beforeUnitPrice: SCRIPT_MODELS.image.cost,
        unit: SCRIPT_MODELS.edit.unit,
        unitPrice: SCRIPT_MODELS.edit.cost,
        width: 1280,
        height: 1280,
        seed,
        beforeSeed: seed,
        editSeed: seed,
        input_image_source: "replicate.delivery URL returned by the paired before image",
        inputImageSource: "replicate.delivery URL returned by the paired before image",
        editParameters: {
          aspect_ratio: "match_input_image",
          output_format: "webp",
          output_quality: 78,
          num_inference_steps: 28,
          go_fast: false,
        },
        retain: variant === 0,
      });
    }
  });
  return groups;
}

function makeVideoGroups() {
  const groups = [];
  VIDEO_THEMES.forEach(([theme, subject], themeIndex) => {
    for (let variant = 0; variant < 2; variant += 1) {
      const number = themeIndex * 2 + variant + 1;
      groups.push({
        id: `video-${String(number).padStart(2, "0")}`,
        theme,
        variant: variant + 1,
        prompt: withSafety(`${subject}, ${VIDEO_VARIANTS[variant]}, smooth cinematic motion, no audio`),
        model: SCRIPT_MODELS.video.slug,
        slug: SCRIPT_MODELS.video.slug,
        queueSlug: SCRIPT_MODELS.video.queueSlug,
        provider: SCRIPT_MODELS.video.provider,
        unit: SCRIPT_MODELS.video.unit,
        unitPrice: SCRIPT_MODELS.video.cost,
        durationSec: SCRIPT_MODELS.video.fixedSeconds,
        resolution: SCRIPT_MODELS.video.resolution,
        audio: false,
        retain: variant === 0,
      });
    }
  });
  return groups;
}

function makeProGroups() {
  return PRO_THEMES.map(([theme, subject], index) => ({
    id: `pro-${String(index + 1).padStart(2, "0")}`,
    theme,
    variant: index + 1,
    prompt: withSafety(`${subject}, premium cinematic movement, no audio`),
    model: SCRIPT_MODELS.pro.slug,
    slug: SCRIPT_MODELS.pro.slug,
    queueSlug: SCRIPT_MODELS.pro.queueSlug,
    provider: SCRIPT_MODELS.pro.provider,
    unit: SCRIPT_MODELS.pro.unit,
    unitPrice: SCRIPT_MODELS.pro.cost,
    durationSec: SCRIPT_MODELS.pro.fixedSeconds,
    resolution: "480p",
    audio: false,
    retain: index < 2,
  }));
}

function buildAllGroups() {
  return { image: makeImageGroups(), edit: makeEditGroups(), video: makeVideoGroups(), pro: makeProGroups() };
}

function groupRepositoryEstimate(groupName, entries) {
  if (groupName === "image") return entries.length * SCRIPT_MODELS.image.cost;
  if (groupName === "edit") return entries.length * (SCRIPT_MODELS.image.cost + SCRIPT_MODELS.edit.cost);
  if (groupName === "video") return entries.length * SCRIPT_MODELS.video.fixedSeconds * SCRIPT_MODELS.video.cost;
  if (groupName === "pro") return entries.length * SCRIPT_MODELS.pro.fixedSeconds * SCRIPT_MODELS.pro.cost;
  return 0;
}

function groupOfficialEstimate(groupName, entries, officialPrices) {
  const requiredKeys = groupName === "image"
    ? ["image.free"]
    : groupName === "edit"
      ? ["image.free", "edit.free"]
      : groupName === "video"
        ? ["video.free"]
        : groupName === "pro"
          ? ["video.paid"]
          : [];
  if (requiredKeys.some((key) => !Number.isFinite(officialPrices[key]))) return null;
  const imagePrice = officialPrices["image.free"];
  const editPrice = officialPrices["edit.free"];
  const videoPrice = officialPrices["video.free"];
  const proPrice = officialPrices["video.paid"];
  if (groupName === "image") return entries.length * imagePrice;
  if (groupName === "edit") return entries.length * (imagePrice + editPrice);
  if (groupName === "video") return entries.length * SCRIPT_MODELS.video.fixedSeconds * videoPrice;
  if (groupName === "pro") return entries.length * SCRIPT_MODELS.pro.fixedSeconds * proPrice;
  return 0;
}

function nullableFixed(value) {
  return value === null || value === undefined ? null : Number(value.toFixed(6));
}

function addNullable(left, right) {
  return left === null || right === null || left === undefined || right === undefined ? null : left + right;
}

function parseUsd(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function findModelBilling(value, slug) {
  if (!value || typeof value !== "object") return null;
  if (value.modelName === slug && value.billingConfig?.current_tiers) return value.billingConfig;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findModelBilling(item, slug);
      if (found) return found;
    }
  } else {
    for (const child of Object.values(value)) {
      const found = findModelBilling(child, slug);
      if (found) return found;
    }
  }
  return null;
}

function extractReplicateOfficialPrice(html, slug) {
  const section = html.match(/<section\b[^>]*\bid=["']pricing["'][^>]*>([\s\S]*?)<\/section>/i)?.[1];
  if (!section) return { status: "UNVERIFIED", reason: "pricing_section_missing" };
  const scripts = [...section.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const billing = findModelBilling(JSON.parse(match[1]), slug);
      if (!billing) continue;
      for (const tier of billing.current_tiers ?? []) {
        if (tier.criteria && Object.keys(tier.criteria).length > 0) continue;
        for (const price of tier.prices ?? []) {
          if (price.metric !== "image_output_count" || price.type !== "per-unit") continue;
          if (typeof price.price !== "string" || !/^\$[0-9]+(?:\.[0-9]+)?$/.test(price.price)) continue;
          const numeric = parseUsd(price.price);
          if (numeric === null) continue;
          const title = String(price.title ?? "").toLowerCase();
          if (!["per thousand output images", "per output image"].includes(title)) continue;
          return { status: "FOUND", price: title === "per thousand output images" ? numeric / 1000 : numeric, rawPrice: numeric, title, source: "billingConfig.current_tiers" };
        }
      }
    } catch {
      // Ignore unrelated JSON blobs inside the pricing section.
    }
  }
  return { status: "UNVERIFIED", reason: "matching_billing_tier_missing" };
}

async function fetchGet(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, method: "GET", redirect: "error", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "error" });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function responseBytes(response, maxBytes = 32 * 1024 * 1024) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* already closed */ }
    return null;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function safeProviderCategory(status, payload) {
  const marker = [payload?.error, payload?.detail, payload?.error_type, payload?.code, payload?.message]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (status === 401 || status === 403 || /auth|token|credential|unauthor/.test(marker)) return "authentication";
  if (status === 402 || /billing|credit|payment|balance/.test(marker)) return "billing";
  if (status === 400 || status === 422 || /invalid|malformed|schema|validation|parameter/.test(marker)) return "invalid_request";
  if (status === 408 || status === 429 || (status !== null && status >= 500)) return "transient_upstream";
  return marker ? "provider_rejection" : "unknown_provider_error";
}

function diagnostic(stage, provider, model, status, category, requestId) {
  const entry = { stage, provider, model, httpStatus: status ?? null, category };
  if (requestId) entry.requestId = requestId;
  console.error(`GALLERY_DIAGNOSTIC ${JSON.stringify(entry)}`);
}

function validRequestId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value);
}

function inputSchemaProperties(metadata) {
  const candidates = [
    metadata?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties,
    metadata?.latest_version?.openapi_schema?.properties,
    metadata?.latest_version?.schema?.components?.schemas?.Input?.properties,
    metadata?.latest_version?.schema?.properties,
    metadata?.openapi_schema?.components?.schemas?.Input?.properties,
    metadata?.openapi_schema?.properties,
  ];
  return candidates.find((value) => value && typeof value === "object") ?? null;
}

function metadataDiagnostics(metadata) {
  const properties = inputSchemaProperties(metadata);
  const goFastPresent = Boolean(properties && Object.prototype.hasOwnProperty.call(properties, "go_fast"));
  const goFastType = goFastPresent ? properties.go_fast?.type ?? null : null;
  return {
    metadataPricingPresent: Boolean(metadata?.pricing || metadata?.latest_version?.pricing),
    metadataSchemaAvailable: Boolean(properties),
    metadataGoFastPresent: goFastPresent,
    metadataGoFastType: goFastType,
    metadataGoFastStatus: goFastPresent && goFastType === "boolean" ? "SUPPORTED_BOOLEAN" : "UNKNOWN_MISSING",
  };
}

function resolveSchemaNode(node, document, seen = new Set()) {
  if (!node || typeof node !== "object") return node;
  if (typeof node.$ref === "string" && node.$ref.startsWith("#/")) {
    if (seen.has(node.$ref)) return node;
    const target = node.$ref.slice(2).split("/").reduce((current, part) => current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], document);
    const nextSeen = new Set(seen).add(node.$ref);
    return resolveSchemaNode(target, document, nextSeen);
  }
  if (Array.isArray(node.allOf)) {
    return node.allOf.reduce((merged, item) => ({ ...merged, ...resolveSchemaNode(item, document, seen) }), { ...node, allOf: undefined });
  }
  return node;
}

function schemaProperty(properties, name, document = properties) {
  return properties && Object.prototype.hasOwnProperty.call(properties, name) ? resolveSchemaNode(properties[name], document) : null;
}

function schemaEnumIncludes(properties, name, value, document) {
  const property = schemaProperty(properties, name, document);
  return Array.isArray(property?.enum) && property.enum.includes(value);
}

function schemaNumberAllows(properties, name, value, document) {
  const property = schemaProperty(properties, name, document);
  if (!property) return false;
  if (typeof property.minimum === "number" && value < property.minimum) return false;
  if (typeof property.maximum === "number" && value > property.maximum) return false;
  return property.type === "integer" || property.type === "number";
}

async function getReplicateSchema(model, token, cache) {
  if (cache.has(model.slug)) return cache.get(model.slug);
  const url = `https://api.replicate.com/v1/models/${model.slug}`;
  const response = await fetchGet(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const body = await responseJson(response);
  if (!response.ok) {
    const category = safeProviderCategory(response.status, body);
    diagnostic("schema", "replicate", model.slug, response.status, category);
    throw new Error(`REPLICATE_SCHEMA_${category}`);
  }
  const properties = inputSchemaProperties(body);
  if (!properties) {
    diagnostic("schema", "replicate", model.slug, response.status, "schema_missing");
    throw new Error("REPLICATE_SCHEMA_MISSING");
  }
  const document = body?.latest_version?.openapi_schema ?? body?.latest_version?.schema ?? body;
  const schema = { properties, document, metadata: metadataDiagnostics(body) };
  cache.set(model.slug, schema);
  return schema;
}

function setRequiredInput(input, properties, name, value, document) {
  if (!schemaProperty(properties, name, document)) throw new Error(`REPLICATE_SCHEMA_REQUIRED_FIELD_MISSING_${name}`);
  input[name] = value;
}

function buildImageInput(entry, properties, document) {
  const input = {};
  setRequiredInput(input, properties, "prompt", entry.prompt, document);
  if (schemaNumberAllows(properties, "seed", entry.seed, document) && Number.isInteger(entry.seed)) input.seed = entry.seed;
  if (schemaProperty(properties, "num_outputs", document) && schemaNumberAllows(properties, "num_outputs", 1, document)) input.num_outputs = 1;
  if (schemaProperty(properties, "output_format", document) && (!Array.isArray(schemaProperty(properties, "output_format", document)?.enum) || schemaEnumIncludes(properties, "output_format", "webp", document))) input.output_format = "webp";
  if (schemaNumberAllows(properties, "output_quality", 78, document)) input.output_quality = 78;
  // Do not transmit go_fast or any field not present in the live schema.
  return input;
}

function buildEditInput(entry, properties, document, sourceUrl) {
  const input = {};
  setRequiredInput(input, properties, "prompt", entry.edit_instruction, document);
  setRequiredInput(input, properties, "input_image", sourceUrl, document);
  if (schemaNumberAllows(properties, "seed", entry.seed, document) && Number.isInteger(entry.seed)) input.seed = entry.seed;
  if (schemaEnumIncludes(properties, "aspect_ratio", "match_input_image", document)) input.aspect_ratio = "match_input_image";
  if (schemaProperty(properties, "output_format", document) && (!Array.isArray(schemaProperty(properties, "output_format", document)?.enum) || schemaEnumIncludes(properties, "output_format", "webp", document))) input.output_format = "webp";
  if (schemaNumberAllows(properties, "output_quality", 78, document)) input.output_quality = 78;
  if (schemaNumberAllows(properties, "num_inference_steps", 28, document)) input.num_inference_steps = 28;
  // go_fast is intentionally never sent, even when another schema exposes it.
  return input;
}

function firstOutputUrl(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstOutputUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    for (const key of ["url", "image", "image_url", "video", "video_url", "download_url", "output", "data", "images", "videos"]) {
      if (typeof value[key] === "string") return value[key];
      const found = firstOutputUrl(value[key]);
      if (found) return found;
    }
  }
  return undefined;
}

function exactlyOne(params, name) {
  const values = params.getAll(name);
  return values.length === 1 && values[0] !== "" ? values[0] : undefined;
}

function isAllowedReplicateOutputUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.pathname.length <= 1) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "replicate.delivery" || host.endsWith(".replicate.delivery")) return true;
    const labels = host.split(".");
    if (labels.length !== 5) return false;
    const [bucket, account, provider, storage, tld] = labels;
    if (provider !== "r2" || storage !== "cloudflarestorage" || tld !== "com") return false;
    if (!/^[a-f0-9]{32}$/.test(account) || bucket.length < 3 || bucket.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(bucket)) return false;
    if (exactlyOne(parsed.searchParams, "X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" || exactlyOne(parsed.searchParams, "X-Amz-SignedHeaders") !== "host") return false;
    const signature = exactlyOne(parsed.searchParams, "X-Amz-Signature");
    const amzDate = exactlyOne(parsed.searchParams, "X-Amz-Date");
    const expires = exactlyOne(parsed.searchParams, "X-Amz-Expires");
    const credential = exactlyOne(parsed.searchParams, "X-Amz-Credential");
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || !amzDate || !/^\d{8}T\d{6}Z$/.test(amzDate) || !expires || !/^\d+$/.test(expires)) return false;
    const expiresSeconds = Number(expires);
    if (!Number.isSafeInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 604800) return false;
    return Boolean(credential?.match(/^([A-Za-z0-9]+)\/(\d{8})\/auto\/s3\/aws4_request$/)?.[2] === amzDate.slice(0, 8));
  } catch {
    return false;
  }
}

function isReplicateDeliveryUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port && (parsed.hostname.toLowerCase() === "replicate.delivery" || parsed.hostname.toLowerCase().endsWith(".replicate.delivery")) && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

function isAllowedFalOutputUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.pathname.length <= 1) return false;
    const host = parsed.hostname.toLowerCase();
    return host === "fal.media" || host.endsWith(".fal.media") || host === "storage.googleapis.com";
  } catch {
    return false;
  }
}

async function submitReplicate(model, input, token, assetId, attempt) {
  const url = `https://api.replicate.com/v1/models/${model.slug}/predictions`;
  let response;
  try {
    response = await fetchWithTimeout(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ input }) });
  } catch (error) {
    diagnostic("submit", "replicate", model.slug, null, error?.name === "AbortError" ? "timeout_unknown" : "network_unknown", assetId);
    return { kind: "unknown", category: error?.name === "AbortError" ? "timeout_unknown" : "network_unknown" };
  }
  const payload = await responseJson(response);
  if (!response.ok) {
    const category = safeProviderCategory(response.status, payload);
    diagnostic("submit", "replicate", model.slug, response.status, category);
    return { kind: "rejected", status: response.status, category };
  }
  const requestId = validRequestId(payload?.id) ? payload.id : null;
  if (!requestId) {
    diagnostic("submit", "replicate", model.slug, response.status, "protocol");
    return { kind: "unknown", category: "protocol" };
  }
  return { kind: "submitted", requestId, attempt };
}

async function pollReplicate(requestId, model, token) {
  const url = `https://api.replicate.com/v1/predictions/${encodeURIComponent(requestId)}`;
  for (let index = 0; index < MAX_POLL_ATTEMPTS; index += 1) {
    let response;
    try {
      response = await fetchGet(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (error) {
      diagnostic("poll", "replicate", model.slug, null, error?.name === "AbortError" ? "timeout" : "network", requestId);
      return { state: "unknown", category: error?.name === "AbortError" ? "timeout" : "network" };
    }
    const payload = await responseJson(response);
    if (!response.ok) {
      const category = safeProviderCategory(response.status, payload);
      diagnostic("poll", "replicate", model.slug, response.status, category, requestId);
      return { state: "unknown", category };
    }
    const state = typeof payload?.status === "string" ? payload.status.toLowerCase() : "";
    if (["succeeded", "successful", "completed"].includes(state)) {
      const outputUrl = firstOutputUrl(payload.output);
      if (!outputUrl || !isAllowedReplicateOutputUrl(outputUrl)) {
        diagnostic("result", "replicate", model.slug, response.status, "invalid_output", requestId);
        return { state: "failed", category: "invalid_output" };
      }
      return { state: "succeeded", outputUrl, payloadStatus: state };
    }
    if (["failed", "canceled", "cancelled"].includes(state)) {
      const category = safeProviderCategory(response.status, payload);
      diagnostic("poll", "replicate", model.slug, response.status, category, requestId);
      return { state: "failed", category };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_INTERVAL_MS));
  }
  diagnostic("poll", "replicate", model.slug, null, "poll_timeout", requestId);
  return { state: "unknown", category: "poll_timeout" };
}

function falQueueUrl(requestId, kind, queueSlug) {
  const encoded = encodeURIComponent(requestId);
  return kind === "status"
    ? `https://queue.fal.run/${queueSlug}/requests/${encoded}/status`
    : `https://queue.fal.run/${queueSlug}/requests/${encoded}`;
}

function validateFalQueueUrl(value, requestId, kind, queueSlug) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "queue.fal.run" || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return undefined;
    const expected = new URL(falQueueUrl(requestId, kind, queueSlug));
    return parsed.pathname === expected.pathname ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function submitFalVideo(entry, token, assetId) {
  const model = SCRIPT_MODELS.video;
  const queueSlug = model.queueSlug;
  const url = `https://queue.fal.run/${model.slug}`;
  const input = { prompt: entry.prompt, duration: String(model.fixedSeconds), resolution: model.resolution, aspect_ratio: "16:9", enable_prompt_expansion: false, enable_safety_checker: true };
  let response;
  try {
    response = await fetchWithTimeout(url, { method: "POST", headers: { Authorization: `Key ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(input) });
  } catch (error) {
    diagnostic("submit", "fal", model.slug, null, error?.name === "AbortError" ? "timeout_unknown" : "network_unknown", assetId);
    return { kind: "unknown", category: error?.name === "AbortError" ? "timeout_unknown" : "network_unknown" };
  }
  const payload = await responseJson(response);
  if (!response.ok) {
    const category = safeProviderCategory(response.status, payload);
    diagnostic("submit", "fal", model.slug, response.status, category);
    return { kind: "rejected", status: response.status, category };
  }
  const requestId = validRequestId(payload?.request_id) ? payload.request_id : validRequestId(payload?.requestId) ? payload.requestId : null;
  if (!requestId) {
    diagnostic("submit", "fal", model.slug, response.status, "protocol");
    return { kind: "unknown", category: "protocol" };
  }
  const statusUrl = validateFalQueueUrl(payload?.status_url, requestId, "status", queueSlug) ?? falQueueUrl(requestId, "status", queueSlug);
  const responseUrl = validateFalQueueUrl(payload?.response_url, requestId, "response", queueSlug) ?? falQueueUrl(requestId, "response", queueSlug);
  return { kind: "submitted", requestId, statusUrl, responseUrl };
}

async function pollFalVideo(requestId, statusUrl, responseUrl, token, assetId) {
  const model = SCRIPT_MODELS.video;
  for (let index = 0; index < MAX_POLL_ATTEMPTS; index += 1) {
    let response;
    try {
      response = await fetchGet(statusUrl, { headers: { Authorization: `Key ${token}`, Accept: "application/json" } });
    } catch (error) {
      diagnostic("status", "fal", model.slug, null, error?.name === "AbortError" ? "timeout" : "network", requestId);
      return { state: "unknown", category: error?.name === "AbortError" ? "timeout" : "network" };
    }
    const payload = await responseJson(response);
    if (!response.ok) {
      const category = safeProviderCategory(response.status, payload);
      diagnostic("status", "fal", model.slug, response.status, category, requestId);
      return { state: "unknown", category };
    }
    const state = String(payload?.status ?? payload?.data?.status ?? "").toUpperCase();
    if (["FAILED", "CANCELED", "CANCELLED"].includes(state)) {
      const category = safeProviderCategory(response.status, payload);
      diagnostic("status", "fal", model.slug, response.status, category, requestId);
      return { state: "failed", category };
    }
    if (["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(state)) {
      return fetchFalVideoResult(responseUrl, token, requestId);
    }
    const directUrl = firstOutputUrl(payload);
    if (directUrl && isAllowedFalOutputUrl(directUrl)) return { state: "succeeded", outputUrl: directUrl };
    await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_INTERVAL_MS));
  }
  diagnostic("status", "fal", model.slug, null, "poll_timeout", requestId);
  return { state: "unknown", category: "poll_timeout" };
}

async function fetchFalVideoResult(responseUrl, token, requestId) {
  let response;
  try {
    response = await fetchGet(responseUrl, { headers: { Authorization: `Key ${token}`, Accept: "application/json" } });
  } catch (error) {
    diagnostic("result", "fal", SCRIPT_MODELS.video.slug, null, error?.name === "AbortError" ? "timeout" : "network", requestId);
    return { state: "unknown", category: error?.name === "AbortError" ? "timeout" : "network" };
  }
  const payload = await responseJson(response);
  if (!response.ok) {
    const category = safeProviderCategory(response.status, payload);
    diagnostic("result", "fal", SCRIPT_MODELS.video.slug, response.status, category, requestId);
    return { state: response.status === 422 ? "failed" : "unknown", category };
  }
  const outputUrl = firstOutputUrl(payload);
  if (!outputUrl || !isAllowedFalOutputUrl(outputUrl)) {
    diagnostic("result", "fal", SCRIPT_MODELS.video.slug, response.status, "invalid_output", requestId);
    return { state: "failed", category: "invalid_output" };
  }
  return { state: "succeeded", outputUrl };
}

function promptHash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function relativeAssetPath(file) {
  return file.slice(ROOT.length + 1).replaceAll("\\", "/");
}

async function contentExists(file) {
  try {
    const info = await stat(file);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(file, fallback) {
  if (!(await fileExists(file))) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error(`INVALID_JSON_STATE_${relativeAssetPath(file)}`);
  }
  return parsed;
}

async function atomicWriteJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, file);
  } catch {
    // Never remove the prior cost ledger to emulate atomic replacement.
    // Preserve both files and stop before another paid submission.
    throw new Error("ATOMIC_STATE_REPLACEMENT_FAILED_PRESERVED");
  }
}

async function acquireGenerationLock() {
  await mkdir(GALLERY_DIR, { recursive: true });
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await writeFile(LOCK_FILE, token, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("GALLERY_GENERATION_LOCKED");
    throw error;
  }
  return async () => {
    try {
      const current = await readFile(LOCK_FILE, "utf8");
      if (current === token) await rm(LOCK_FILE, { force: false });
    } catch {
      // The lock may already have been removed by a clean owner shutdown.
    }
  };
}

function assertPrivateJournal(value, pathName = "journal") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPrivateJournal(item, `${pathName}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/url/i.test(key) || /token|secret|prompt$/i.test(key)) throw new Error(`PRIVATE_JOURNAL_FIELD_REJECTED_${pathName}.${key}`);
    assertPrivateJournal(child, `${pathName}.${key}`);
  }
}

async function loadJournal() {
  if (!(await fileExists(JOURNAL_FILE))) {
    const entries = await readdir(GALLERY_DIR, { withFileTypes: true });
    if (entries.some((entry) => entry.name !== ".generation.lock") || await fileExists(MANIFEST_FILE)) {
      throw new Error("MISSING_COST_JOURNAL_WITH_EXISTING_STATE");
    }
  }
  const value = await readJsonIfPresent(JOURNAL_FILE, { version: 1, updatedAt: null, requests: [], assets: {} });
  if (!value || typeof value !== "object" || !Array.isArray(value.requests) || !value.assets || typeof value.assets !== "object") throw new Error("INVALID_GENERATION_JOURNAL");
  assertPrivateJournal(value);
  return value;
}

async function saveJournal(journal) {
  journal.updatedAt = new Date().toISOString();
  assertPrivateJournal(journal);
  await atomicWriteJson(JOURNAL_FILE, journal);
}

async function loadManifest() {
  const value = await readJsonIfPresent(MANIFEST_FILE, []);
  if (!Array.isArray(value)) throw new Error("INVALID_GALLERY_MANIFEST");
  return value;
}

async function saveManifestRecord(record) {
  const manifest = await loadManifest();
  const index = manifest.findIndex((item) => item && item.id === record.id);
  if (index >= 0) manifest[index] = { ...manifest[index], ...record, generatedAt: manifest[index].generatedAt ?? record.generatedAt };
  else manifest.push(record);
  await atomicWriteJson(MANIFEST_FILE, manifest);
}

function ensureJournalAsset(journal, assetId, fields) {
  const existing = journal.assets[assetId];
  if (existing) {
    for (const key of ["group", "model", "seed", "promptHash", "editInstructionHash"]) {
      if (fields[key] !== undefined && existing[key] !== undefined && existing[key] !== fields[key]) throw new Error(`JOURNAL_PLAN_MISMATCH_${assetId}_${key}`);
    }
    return existing;
  }
  const asset = { id: assetId, ...fields, state: "planned", attempts: [] };
  journal.assets[assetId] = asset;
  return asset;
}

function totalReservedCost(journal) {
  return journal.requests.reduce((sum, request) => sum + (Number.isFinite(request.costUsd) ? request.costUsd : 0), 0);
}

async function reserveRequest(journal, asset, role, provider, model, costUsd) {
  const alreadyReserved = totalReservedCost(journal);
  if (alreadyReserved + costUsd > MAX_TOTAL_USD + 1e-9) throw new Error(`GALLERY_COST_CAP_EXCEEDED_${alreadyReserved.toFixed(6)}_${costUsd.toFixed(6)}`);
  const request = { attemptId: `${asset.id}-${role}-${asset.attempts.length + 1}`, assetId: asset.id, role, provider, model, costUsd, status: "reserved", requestId: null, createdAt: new Date().toISOString() };
  journal.requests.push(request);
  asset.attempts.push(request.attemptId);
  asset.state = "reserved";
  await saveJournal(journal);
  return request;
}

async function updateRequest(journal, request, fields) {
  Object.assign(request, fields, { updatedAt: new Date().toISOString() });
  await saveJournal(journal);
}

function requestsFor(journal, assetId, role) {
  return journal.requests.filter((request) => request.assetId === assetId && request.role === role);
}

function latestKnownRequest(journal, assetId, role) {
  return [...requestsFor(journal, assetId, role)].reverse().find((request) => request.requestId && ["submitted", "processing", "unknown", "succeeded", "failed"].includes(request.status));
}

function hasTerminalRetryableFailure(request) {
  return request?.status === "failed" && !["authentication", "billing", "invalid_request", "invalid_output"].includes(request.errorCategory);
}

function attemptsFor(journal, assetId, role) {
  return requestsFor(journal, assetId, role).length;
}

let sharpFactory;
async function getSharp() {
  if (!sharpFactory) {
    const module = await import("sharp");
    sharpFactory = module.default ?? module;
  }
  return sharpFactory;
}

async function encodeWebp(rawBytes, options = {}) {
  const sharp = await getSharp();
  const source = sharp(rawBytes).rotate();
  const resize = options.target
    ? source.resize(options.target.width, options.target.height, { fit: "cover" })
    : source.resize({ width: options.maxDimension ?? 1280, height: options.maxDimension ?? 1280, fit: "inside", withoutEnlargement: true });
  // The approved post-process quality is fixed at 82. Size pressure is
  // handled by reducing dimensions, never by silently changing quality.
  return resize.webp({ quality: 82 }).toBuffer();
}

async function outputDimensions(bytes) {
  const sharp = await getSharp();
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error("IMAGE_DIMENSIONS_MISSING");
  return { width: metadata.width, height: metadata.height };
}

async function normalizeBefore(rawBytes) {
  for (const maxDimension of [1280, 1152, 1024, 896, 768, 640, 512, 384, 320]) {
    const bytes = await encodeWebp(rawBytes, { maxDimension });
    if (bytes.byteLength <= 150_000) return { bytes, dimensions: await outputDimensions(bytes) };
  }
  throw new Error("IMAGE_OUTPUT_OVER_150KB_AT_QUALITY_82");
}

async function normalizeAfter(rawBytes, dimensions) {
  const bytes = await encodeWebp(rawBytes, { target: dimensions });
  const actual = await outputDimensions(bytes);
  if (actual.width !== dimensions.width || actual.height !== dimensions.height) throw new Error("EDIT_DIMENSIONS_MISMATCH");
  if (bytes.byteLength > 150_000) throw new Error("EDIT_OUTPUT_OVER_150KB_AT_QUALITY_82");
  return bytes;
}

async function normalizeEditPair(beforeRawBytes, afterRawBytes) {
  const sharp = await getSharp();
  const beforeMetadata = await sharp(beforeRawBytes).rotate().metadata();
  if (!beforeMetadata.width || !beforeMetadata.height) throw new Error("BEFORE_IMAGE_DIMENSIONS_MISSING");
  for (const maxDimension of [1280, 1152, 1024, 896, 768, 640, 512, 384, 320]) {
    const scale = Math.min(1, maxDimension / Math.max(beforeMetadata.width, beforeMetadata.height));
    const target = { width: Math.max(1, Math.round(beforeMetadata.width * scale)), height: Math.max(1, Math.round(beforeMetadata.height * scale)) };
    const beforeBytes = await encodeWebp(beforeRawBytes, { target });
    const afterBytes = await encodeWebp(afterRawBytes, { target });
    const beforeDimensions = await outputDimensions(beforeBytes);
    const afterDimensions = await outputDimensions(afterBytes);
    if (beforeBytes.byteLength <= 150_000 && afterBytes.byteLength <= 150_000 && beforeDimensions.width === afterDimensions.width && beforeDimensions.height === afterDimensions.height) {
      return { beforeBytes, afterBytes, dimensions: beforeDimensions };
    }
  }
  throw new Error("EDIT_PAIR_OVER_150KB_AT_QUALITY_82");
}

async function downloadProviderAsset(url, provider) {
  const allowed = provider === "replicate" ? isAllowedReplicateOutputUrl(url) : isAllowedFalOutputUrl(url);
  if (!allowed) throw new Error("PROVIDER_OUTPUT_URL_REJECTED");
  let response;
  try {
    response = await fetchGet(url, { headers: { Accept: provider === "fal" ? "video/mp4,application/octet-stream,*/*" : "image/*,*/*" } });
  } catch (error) {
    throw new Error(error?.name === "AbortError" ? "PROVIDER_OUTPUT_TIMEOUT" : "PROVIDER_OUTPUT_NETWORK");
  }
  if (!response.ok) throw new Error(`PROVIDER_OUTPUT_HTTP_${response.status}`);
  const bytes = await responseBytes(response, provider === "fal" ? 100 * 1024 * 1024 : 32 * 1024 * 1024);
  if (!bytes || bytes.byteLength === 0) throw new Error("PROVIDER_OUTPUT_EMPTY");
  return bytes;
}

async function obtainReplicateOutput({ journal, asset, role, model, token, input, costUsd }) {
  let previous = latestKnownRequest(journal, asset.id, role);
  const lastAttempt = () => [...requestsFor(journal, asset.id, role)].reverse()[0];
  while (true) {
    if (!previous) {
      const orphan = lastAttempt();
      if (orphan && ["reserved", "unknown"].includes(orphan.status) && !orphan.requestId) throw new Error(`UNKNOWN_SUBMIT_OUTCOME_${asset.id}_${role}`);
      if (orphan && orphan.status === "failed" && !orphan.requestId) throw new Error(`PROVIDER_SUBMIT_REJECTED_${asset.id}_${role}`);
      if (attemptsFor(journal, asset.id, role) >= MAX_RETRIES + 1) throw new Error("REPLICATE_RETRY_LIMIT_REACHED");
      const request = await reserveRequest(journal, asset, role, "replicate", model.slug, costUsd);
      const submitted = await submitReplicate(model, input, token, asset.id, request.attemptId);
      if (submitted.kind !== "submitted") {
        await updateRequest(journal, request, { status: submitted.kind === "rejected" ? "failed" : "unknown", errorCategory: submitted.category });
        throw new Error(`REPLICATE_SUBMIT_${submitted.kind}_${submitted.category}`);
      }
      await updateRequest(journal, request, { status: "submitted", requestId: submitted.requestId });
      previous = request;
    }
    const result = await pollReplicate(previous.requestId, model, token);
    if (result.state === "succeeded") {
      await updateRequest(journal, previous, { status: "succeeded", errorCategory: null });
      asset.state = "provider_succeeded";
      await saveJournal(journal);
      return { outputUrl: result.outputUrl, requestId: previous.requestId };
    }
    if (result.state === "unknown") {
      await updateRequest(journal, previous, { status: "unknown", errorCategory: result.category });
      throw new Error(`REPLICATE_POLL_${result.category}`);
    }
    await updateRequest(journal, previous, { status: "failed", errorCategory: result.category });
    if (!hasTerminalRetryableFailure(previous) || attemptsFor(journal, asset.id, role) >= MAX_RETRIES + 1) throw new Error(`REPLICATE_TERMINAL_${result.category}`);
    previous = null;
  }
}

async function obtainFalVideoOutput({ journal, asset, token, entry, costUsd }) {
  let previous = latestKnownRequest(journal, asset.id, "video");
  const lastAttempt = () => [...requestsFor(journal, asset.id, "video")].reverse()[0];
  while (true) {
    if (!previous) {
      const orphan = lastAttempt();
      if (orphan && ["reserved", "unknown"].includes(orphan.status) && !orphan.requestId) throw new Error(`UNKNOWN_SUBMIT_OUTCOME_${asset.id}_video`);
      if (orphan && orphan.status === "failed" && !orphan.requestId) throw new Error(`PROVIDER_SUBMIT_REJECTED_${asset.id}_video`);
      if (attemptsFor(journal, asset.id, "video") >= MAX_RETRIES + 1) throw new Error("FAL_RETRY_LIMIT_REACHED");
      const request = await reserveRequest(journal, asset, "video", "fal", SCRIPT_MODELS.video.slug, costUsd);
      const submitted = await submitFalVideo(entry, token, asset.id);
      if (submitted.kind !== "submitted") {
        await updateRequest(journal, request, { status: submitted.kind === "rejected" ? "failed" : "unknown", errorCategory: submitted.category });
        throw new Error(`FAL_SUBMIT_${submitted.kind}_${submitted.category}`);
      }
      await updateRequest(journal, request, { status: "submitted", requestId: submitted.requestId });
      // Queue URLs are deliberately not journaled; if a process restarts they
      // are reconstructed from the model queue slug and request id.
      previous = request;
    }
    const statusUrl = falQueueUrl(previous.requestId, "status", SCRIPT_MODELS.video.queueSlug);
    const responseUrl = falQueueUrl(previous.requestId, "response", SCRIPT_MODELS.video.queueSlug);
    const result = await pollFalVideo(previous.requestId, statusUrl, responseUrl, token, asset.id);
    if (result.state === "succeeded") {
      await updateRequest(journal, previous, { status: "succeeded", errorCategory: null });
      asset.state = "provider_succeeded";
      await saveJournal(journal);
      return { outputUrl: result.outputUrl, requestId: previous.requestId };
    }
    if (result.state === "unknown") {
      await updateRequest(journal, previous, { status: "unknown", errorCategory: result.category });
      throw new Error(`FAL_POLL_${result.category}`);
    }
    await updateRequest(journal, previous, { status: "failed", errorCategory: result.category });
    if (!hasTerminalRetryableFailure(previous) || attemptsFor(journal, asset.id, "video") >= MAX_RETRIES + 1) throw new Error(`FAL_TERMINAL_${result.category}`);
    previous = null;
  }
}

function planPricingEntry(plan, key) {
  return Array.isArray(plan.pricing) ? plan.pricing.find((entry) => entry?.key === key) : null;
}

function validateApprovedPlan(plan) {
  if (!plan || typeof plan !== "object" || !plan.groups || !Array.isArray(plan.groups.image) || !Array.isArray(plan.groups.edit)) throw new Error("APPROVED_PLAN_MISSING");
  const imagePricing = planPricingEntry(plan, SCRIPT_MODELS.image.key);
  const editPricing = planPricingEntry(plan, SCRIPT_MODELS.edit.key);
  if (!imagePricing || imagePricing.model !== SCRIPT_MODELS.image.slug || imagePricing.unit !== "image" || imagePricing.source !== "models.ts" || imagePricing.unitPrice !== SCRIPT_MODELS.image.cost || imagePricing.officialPrice !== APPROVED_EFFECTIVE_PRICES.image || imagePricing.status !== "MATCH") throw new Error("APPROVED_IMAGE_PRICE_GATE_FAILED");
  if (!editPricing || editPricing.model !== SCRIPT_MODELS.edit.slug || editPricing.unit !== "image" || editPricing.source !== "models.ts" || editPricing.unitPrice !== SCRIPT_MODELS.edit.cost || editPricing.officialPrice !== APPROVED_EFFECTIVE_PRICES.edit || editPricing.status !== "MISMATCH") throw new Error("APPROVED_EDIT_PRICE_GATE_FAILED");
  if (plan.estimates?.official?.imageEdit !== 0.408) throw new Error("APPROVED_FIRST_BATCH_ESTIMATE_GATE_FAILED");
  if (plan.groups.image.some((entry) => entry.model !== SCRIPT_MODELS.image.slug) || plan.groups.edit.some((entry) => entry.model !== SCRIPT_MODELS.edit.slug)) throw new Error("APPROVED_PLAN_MODEL_GATE_FAILED");
}

function validateExecutionScope(args) {
  const groups = new Set(args.groups);
  if ([...groups].some((group) => !["image", "edit", "video"].includes(group))) throw new Error("BLOCKED_SCOPE_PRO_ONLY_OR_UNKNOWN_GROUP");
  if (groups.has("video") && (args.limit === null || args.limit > 2)) throw new Error("BLOCKED_SCOPE_VIDEO_REQUIRES_LIMIT_1_OR_2");
  if (!groups.size) throw new Error("BLOCKED_SCOPE_EMPTY");
}

function assertSafePlanId(group, id) {
  const pattern = group === "image" ? /^image-\d{2}$/ : group === "edit" ? /^edit-\d{2}$/ : group === "video" ? /^video-\d{2}$/ : null;
  if (!pattern || !pattern.test(id)) throw new Error(`BLOCKED_PLAN_ID_${group}`);
}

async function verifyApprovedLivePrices(env, groups) {
  const models = [];
  if (groups.includes("image") || groups.includes("edit")) models.push(SCRIPT_MODELS.image);
  if (groups.includes("edit")) models.push(SCRIPT_MODELS.edit);
  const seen = new Set();
  for (const model of models) {
    if (seen.has(model.key)) continue;
    seen.add(model.key);
    const check = await replicatePriceCheck(model, env);
    console.log(`PRICE_DRIFT_RECHECK ${JSON.stringify({ model: model.slug, status: check.status, officialPrice: check.officialPrice, approvedPrice: APPROVED_EFFECTIVE_PRICES[model === SCRIPT_MODELS.image ? "image" : "edit"], differenceUsd: check.differenceUsd })}`);
    const expected = model === SCRIPT_MODELS.image ? APPROVED_EFFECTIVE_PRICES.image : APPROVED_EFFECTIVE_PRICES.edit;
    if (check.officialPrice !== expected || !["MATCH", "MISMATCH"].includes(check.status)) throw new Error(`LIVE_PRICE_GATE_FAILED_${model.key}`);
  }
}

function selectPlanEntries(plan, group, limit) {
  const entries = Array.isArray(plan.groups[group]) ? plan.groups[group] : [];
  entries.forEach((entry) => assertSafePlanId(group, entry?.id));
  return limit === null ? entries : entries.slice(0, limit);
}

function imageOutputFile(entry) {
  assertSafePlanId("image", entry.id);
  return join(GALLERY_DIR, "image", `${entry.id}.webp`);
}

function editBeforeFile(entry) {
  assertSafePlanId("edit", entry.id);
  return join(GALLERY_DIR, "edit", `${entry.id}-before.webp`);
}

function editAfterFile(entry) {
  assertSafePlanId("edit", entry.id);
  return join(GALLERY_DIR, "edit", `${entry.id}-after.webp`);
}

function videoOutputFile(entry) {
  assertSafePlanId("video", entry.id);
  return join(GALLERY_DIR, "video", `${entry.id}.mp4`);
}

function manifestRecordBase(id, group, entry, prompt, editInstruction, beforePrompt, model, provider, files, bytes, requestId, costUsd, dimensions) {
  return {
    id,
    parentId: group === "edit" ? entry.id : undefined,
    group,
    files: files.map(relativeAssetPath),
    prompt,
    editInstruction: group === "edit" ? editInstruction : undefined,
    beforePrompt: group === "edit" ? beforePrompt : undefined,
    model,
    slug: model,
    provider,
    width: dimensions?.width ?? entry.width,
    height: dimensions?.height ?? entry.height,
    duration: entry.durationSec,
    bytes,
    generatedAt: new Date().toISOString(),
    costUsd,
    costBasis: "estimated_provider_cost_no_invoice",
    requestId,
  };
}

function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

async function recordImageManifest(entry, file, requestId, costUsd) {
  const info = await stat(file);
  const dimensions = await outputDimensions(await readFile(file));
  await saveManifestRecord(stripUndefined(manifestRecordBase(entry.id, "image", entry, entry.prompt, undefined, undefined, entry.model, "replicate", [file], info.size, requestId, costUsd, dimensions)));
}

async function recordEditManifest(entry, role, file, requestId, costUsd) {
  const info = await stat(file);
  const dimensions = await outputDimensions(await readFile(file));
  const id = `${entry.id}-${role}`;
  const model = role === "before" ? entry.beforeModel : entry.model;
  const prompt = role === "before" ? entry.before_prompt : entry.edit_instruction;
  await saveManifestRecord(stripUndefined(manifestRecordBase(id, "edit", entry, prompt, entry.edit_instruction, entry.before_prompt, model, "replicate", [file], info.size, requestId, costUsd, dimensions)));
}

async function recordVideoManifest(entry, file, requestId, costUsd) {
  const info = await stat(file);
  await saveManifestRecord(stripUndefined(manifestRecordBase(entry.id, "video", entry, entry.prompt, undefined, undefined, entry.model, "fal", [file], info.size, requestId, costUsd, undefined)));
}

async function recoverReplicateOutput(request, model, token) {
  if (!request?.requestId) throw new Error("MISSING_PROVIDER_REQUEST_ID");
  const result = await pollReplicate(request.requestId, model, token);
  if (result.state !== "succeeded") throw new Error(`RECOVER_EXISTING_PREDICTION_${result.category ?? result.state}`);
  return { outputUrl: result.outputUrl, requestId: request.requestId };
}

async function processImageEntry(entry, context) {
  const file = imageOutputFile(entry);
  const asset = ensureJournalAsset(context.journal, entry.id, { group: "image", model: entry.model, seed: entry.seed, promptHash: promptHash(entry.prompt) });
  if (await contentExists(file)) {
    const existing = latestKnownRequest(context.journal, entry.id, "image");
    await recordImageManifest(entry, file, existing?.requestId ?? null, APPROVED_EFFECTIVE_PRICES.image);
    asset.state = "completed";
    await saveJournal(context.journal);
    console.log(`GALLERY_SKIP ${entry.id} existing_file`);
    return;
  }
  const schema = await getReplicateSchema(SCRIPT_MODELS.image, context.env.REPLICATE_API_TOKEN, context.schemaCache);
  const input = buildImageInput(entry, schema.properties, schema.document);
  const result = await obtainReplicateOutput({ journal: context.journal, asset, role: "image", model: SCRIPT_MODELS.image, token: context.env.REPLICATE_API_TOKEN, input, costUsd: APPROVED_EFFECTIVE_PRICES.image });
  const raw = await downloadProviderAsset(result.outputUrl, "replicate");
  const normalized = await normalizeBefore(raw);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, normalized.bytes);
  await recordImageManifest(entry, file, result.requestId, APPROVED_EFFECTIVE_PRICES.image);
  asset.state = "completed";
  await saveJournal(context.journal);
  context.successes.push({ id: entry.id, estimatedProviderCostUsd: APPROVED_EFFECTIVE_PRICES.image });
  console.log(`GALLERY_COMPLETE ${entry.id} ${normalized.bytes.byteLength}B`);
}

function totalReservedCostForAsset(journal, assetId) {
  return journal.requests.filter((request) => request.assetId === assetId).reduce((sum, request) => sum + (Number.isFinite(request.costUsd) ? request.costUsd : 0), 0);
}

async function processEditEntry(entry, context) {
  const beforeFile = editBeforeFile(entry);
  const afterFile = editAfterFile(entry);
  const beforeId = `${entry.id}-before`;
  const afterId = `${entry.id}-after`;
  const beforeAsset = ensureJournalAsset(context.journal, beforeId, { group: "edit", model: entry.beforeModel, seed: entry.beforeSeed, promptHash: promptHash(entry.before_prompt), editInstructionHash: promptHash(entry.edit_instruction) });
  const afterAsset = ensureJournalAsset(context.journal, afterId, { group: "edit", model: entry.model, seed: entry.editSeed, promptHash: promptHash(entry.before_prompt), editInstructionHash: promptHash(entry.edit_instruction) });
  const bothExist = await contentExists(beforeFile) && await contentExists(afterFile);
  if (bothExist) {
    await recordEditManifest(entry, "before", beforeFile, latestKnownRequest(context.journal, beforeId, "before")?.requestId ?? null, APPROVED_EFFECTIVE_PRICES.image);
    await recordEditManifest(entry, "after", afterFile, latestKnownRequest(context.journal, afterId, "after")?.requestId ?? null, APPROVED_EFFECTIVE_PRICES.edit);
    beforeAsset.state = "completed";
    afterAsset.state = "completed";
    await saveJournal(context.journal);
    console.log(`GALLERY_SKIP ${entry.id} existing_pair`);
    return;
  }
  const imageSchema = await getReplicateSchema(SCRIPT_MODELS.image, context.env.REPLICATE_API_TOKEN, context.schemaCache);
  const editSchema = await getReplicateSchema(SCRIPT_MODELS.edit, context.env.REPLICATE_API_TOKEN, context.schemaCache);
  let beforeOutput;
  if (await contentExists(beforeFile)) {
    const beforeRequest = latestKnownRequest(context.journal, beforeId, "before");
    if (!beforeRequest?.requestId) throw new Error(`STOP_MISSING_BEFORE_PROVIDER_ID_${entry.id}`);
    beforeOutput = await recoverReplicateOutput(beforeRequest, SCRIPT_MODELS.image, context.env.REPLICATE_API_TOKEN);
  } else {
    const beforeInput = buildImageInput({ ...entry, prompt: entry.before_prompt }, imageSchema.properties, imageSchema.document);
    beforeOutput = await obtainReplicateOutput({ journal: context.journal, asset: beforeAsset, role: "before", model: SCRIPT_MODELS.image, token: context.env.REPLICATE_API_TOKEN, input: beforeInput, costUsd: APPROVED_EFFECTIVE_PRICES.image });
    const beforeRaw = await downloadProviderAsset(beforeOutput.outputUrl, "replicate");
    const normalized = await normalizeBefore(beforeRaw);
    await mkdir(dirname(beforeFile), { recursive: true });
    await writeFile(beforeFile, normalized.bytes);
    await recordEditManifest(entry, "before", beforeFile, beforeOutput.requestId, APPROVED_EFFECTIVE_PRICES.image);
    beforeAsset.state = "completed";
    await saveJournal(context.journal);
    context.successes.push({ id: beforeId, estimatedProviderCostUsd: APPROVED_EFFECTIVE_PRICES.image });
    console.log(`GALLERY_COMPLETE ${beforeId} ${normalized.bytes.byteLength}B`);
  }
  if (await contentExists(afterFile)) {
    await recordEditManifest(entry, "after", afterFile, latestKnownRequest(context.journal, afterId, "after")?.requestId ?? null, APPROVED_EFFECTIVE_PRICES.edit);
    afterAsset.state = "completed";
    await saveJournal(context.journal);
    return;
  }
  if (!isAllowedReplicateOutputUrl(beforeOutput.outputUrl)) throw new Error(`STOP_BEFORE_URL_NOT_PROVIDER_OUTPUT_${entry.id}`);
  const afterInput = buildEditInput(entry, editSchema.properties, editSchema.document, beforeOutput.outputUrl);
  const afterOutput = await obtainReplicateOutput({ journal: context.journal, asset: afterAsset, role: "after", model: SCRIPT_MODELS.edit, token: context.env.REPLICATE_API_TOKEN, input: afterInput, costUsd: APPROVED_EFFECTIVE_PRICES.edit });
  const afterRaw = await downloadProviderAsset(afterOutput.outputUrl, "replicate");
  const beforeRaw = await readFile(beforeFile);
  const pair = await normalizeEditPair(beforeRaw, afterRaw);
  if (Buffer.compare(Buffer.from(pair.beforeBytes), Buffer.from(beforeRaw)) !== 0) {
    await writeFile(beforeFile, pair.beforeBytes);
    await recordEditManifest(entry, "before", beforeFile, beforeOutput.requestId, APPROVED_EFFECTIVE_PRICES.image);
  }
  await mkdir(dirname(afterFile), { recursive: true });
  await writeFile(afterFile, pair.afterBytes);
  await recordEditManifest(entry, "after", afterFile, afterOutput.requestId, APPROVED_EFFECTIVE_PRICES.edit);
  afterAsset.state = "completed";
  await saveJournal(context.journal);
  context.successes.push({ id: afterId, estimatedProviderCostUsd: APPROVED_EFFECTIVE_PRICES.edit });
  console.log(`GALLERY_COMPLETE ${afterId} ${pair.afterBytes.byteLength}B`);
}

async function processVideoEntry(entry, context) {
  const file = videoOutputFile(entry);
  const asset = ensureJournalAsset(context.journal, entry.id, { group: "video", model: entry.model, seed: entry.seed, promptHash: promptHash(entry.prompt) });
  if (await contentExists(file)) {
    const existing = latestKnownRequest(context.journal, entry.id, "video");
    await recordVideoManifest(entry, file, existing?.requestId ?? null, entry.durationSec * SCRIPT_MODELS.video.cost);
    asset.state = "completed";
    await saveJournal(context.journal);
    console.log(`GALLERY_SKIP ${entry.id} existing_file`);
    return;
  }
  if (!context.env.FAL_KEY) throw new Error("FAL_KEY_MISSING_BEFORE_PROVIDER_CALL");
  const result = await obtainFalVideoOutput({ journal: context.journal, asset, token: context.env.FAL_KEY, entry, costUsd: entry.durationSec * SCRIPT_MODELS.video.cost });
  const bytes = await downloadProviderAsset(result.outputUrl, "fal");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  await recordVideoManifest(entry, file, result.requestId, entry.durationSec * SCRIPT_MODELS.video.cost);
  asset.state = "completed";
  await saveJournal(context.journal);
  context.successes.push({ id: entry.id, estimatedProviderCostUsd: entry.durationSec * SCRIPT_MODELS.video.cost });
  console.log(`GALLERY_COMPLETE ${entry.id} ${bytes.byteLength}B raw_mp4_no_compression`);
}

async function replicatePriceCheck(model, env) {
  const base = { key: model.key, model: model.slug, unit: model.unit, unitPrice: model.cost, source: "models.ts", provider: model.provider, officialPrice: null };
  if (!env.REPLICATE_API_TOKEN) return { ...base, status: "UNVERIFIED", reason: "missing_REPLICATE_API_TOKEN", metadataHttpStatus: null, officialHttpStatus: null, metadataPricingPresent: false, metadataGoFastPresent: false, metadataGoFastStatus: "UNKNOWN_MISSING" };
  const metadataUrl = `https://api.replicate.com/v1/models/${model.slug}`;
  const officialUrl = `https://replicate.com/${model.slug}`;
  let metadataHttpStatus = null;
  let officialHttpStatus = null;
  let diagnostics = { metadataPricingPresent: false, metadataSchemaAvailable: false, metadataGoFastPresent: false, metadataGoFastType: null, metadataGoFastStatus: "UNKNOWN_MISSING" };
  try {
    const metadata = await fetchGet(metadataUrl, { headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`, Accept: "application/json" } });
    metadataHttpStatus = metadata.status;
    if (!metadata.ok) return { ...base, status: "UNVERIFIED", reason: "metadata_request_failed", metadataHttpStatus, officialHttpStatus, sourceUrl: officialUrl, ...diagnostics };
    const metadataJson = await metadata.json();
    diagnostics = metadataDiagnostics(metadataJson);
    const page = await fetchGet(officialUrl, { headers: { Accept: "text/html" } });
    officialHttpStatus = page.status;
    if (!page.ok) return { ...base, status: "UNVERIFIED", reason: "official_pricing_request_failed", metadataHttpStatus, officialHttpStatus, sourceUrl: officialUrl, ...diagnostics };
    const extracted = extractReplicateOfficialPrice(await page.text(), model.slug);
    if (extracted.status !== "FOUND") return { ...base, status: "UNVERIFIED", reason: extracted.reason, metadataHttpStatus, officialHttpStatus, sourceUrl: officialUrl, ...diagnostics };
    const differenceUsd = Number((extracted.price - model.cost).toFixed(6));
    return { ...base, status: Math.abs(differenceUsd) < 0.000001 ? "MATCH" : "MISMATCH", repoPrice: model.cost, officialPrice: extracted.price, differenceUsd, metadataHttpStatus, officialHttpStatus, sourceUrl: officialUrl, evidence: extracted, ...diagnostics };
  } catch (error) {
    return { ...base, status: "UNVERIFIED", reason: error?.name === "AbortError" ? "request_timeout" : "network_error", metadataHttpStatus, officialHttpStatus, sourceUrl: officialUrl, errorType: error instanceof Error ? error.name : "unknown", ...diagnostics };
  }
}

async function falPriceCheck(model, env) {
  return { key: model.key, model: model.slug, unit: model.unit, unitPrice: model.cost, source: "models.ts", provider: model.provider, status: env.FAL_KEY ? "PENDING_OPERATOR_VERIFICATION" : "PENDING_MISSING_LOCAL_FAL_KEY", officialPrice: null, reason: "No safe official pricing parser is enabled for this dry-run; no Fal request is made." };
}

async function fileExists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildPlan(allGroups, selectedGroups, comparisons, pricingChecks, selectionLimit = null) {
  const officialPrices = Object.fromEntries(pricingChecks.filter((item) => Number.isFinite(item.officialPrice)).map((item) => [item.key, item.officialPrice]));
  // Keep every prompt in the plan even when a batch selector is used.  The
  // selector controls what a future generation run may process; it must not
  // make the review artifact lose the pending video/pro prompts.
  const selected = clone(allGroups);
  const repoByGroup = Object.fromEntries(Object.entries(allGroups).map(([name, entries]) => [name, groupRepositoryEstimate(name, entries)]));
  const officialByGroup = Object.fromEntries(Object.entries(allGroups).map(([name, entries]) => [name, groupOfficialEstimate(name, entries, officialPrices)]));
  const firstBatchRepo = repoByGroup.image + repoByGroup.edit;
  const secondBatchRepo = repoByGroup.video + repoByGroup.pro;
  const firstBatchOfficial = addNullable(officialByGroup.image, officialByGroup.edit);
  const secondBatchOfficial = addNullable(officialByGroup.video, officialByGroup.pro);
  const officialTotal = addNullable(firstBatchOfficial, secondBatchOfficial);
  const editCheck = pricingChecks.find((item) => item.key === SCRIPT_MODELS.edit.key);
  const plannedSelected = Object.fromEntries(selectedGroups.map((group) => {
    const entries = selectionLimit === null ? allGroups[group] : allGroups[group].slice(0, selectionLimit);
    return [group, { count: entries.length, ids: entries.map((entry) => entry.id) }];
  }));
  const firstPriceBlocked = firstBatchOfficial === null || pricingChecks.some((item) => ["MISMATCH", "UNVERIFIED"].includes(item.status) && ["image.free", "edit.free"].includes(item.key));
  return {
    generatedAt: new Date().toISOString(),
    selectedGroups,
    plannedSelected: { limitPerGroup: selectionLimit, groups: plannedSelected },
    groups: selected,
    allGroupCounts: Object.fromEntries(Object.entries(allGroups).map(([name, entries]) => [name, entries.length])),
    pricing: pricingChecks,
    modelComparison: comparisons,
    estimates: {
      repository: { imageEdit: Number(firstBatchRepo.toFixed(6)), videoPro: Number(secondBatchRepo.toFixed(6)), totalAllGroups: Number((firstBatchRepo + secondBatchRepo).toFixed(6)) },
      official: { imageEdit: nullableFixed(firstBatchOfficial), videoPro: nullableFixed(secondBatchOfficial), totalAllGroups: nullableFixed(officialTotal) },
      difference: { imageEdit: firstBatchOfficial === null ? null : Number((firstBatchOfficial - firstBatchRepo).toFixed(6)), videoPro: secondBatchOfficial === null ? null : Number((secondBatchOfficial - secondBatchRepo).toFixed(6)) },
    },
    estimateUsdTotal: Number(selectedGroups.reduce((sum, name) => sum + repoByGroup[name], 0).toFixed(6)),
    generation: { mode: "dry-run-only", enabled: false, requiresExplicitApproval: true, hardCapUsd: MAX_TOTAL_USD, hardCapEnforcedForGeneration: false, maxRetriesPerPrompt: MAX_RETRIES, resumeDefault: true, note: "Budget is planning metadata only; no generator is implemented or callable." },
    outputPolicy: { image: { format: "webp", longEdgeMaxPx: 1280, quality: 82, maxBytes: 150000 }, edit: { format: "webp", dimensionsMustMatch: true }, video: { format: "mp4", codec: "h264", durationSec: 5, audio: false, maxBytes: 800000, compression: "not-run: ffmpeg unavailable" }, poster: { format: "webp", maxBytes: 60000 } },
    parameterDiagnostics: { edit: { go_fast: { requested: false, presentInMetadata: editCheck?.metadataGoFastPresent ?? false, metadataType: editCheck?.metadataGoFastType ?? null, status: editCheck?.metadataGoFastStatus ?? "UNKNOWN_MISSING", action: "retain_requested_false_and_block_until_confirmed" }, metadataPricingPresent: editCheck?.metadataPricingPresent ?? false } },
    safety: { promptPolicy: SAFETY, externalImages: false, externalUrls: false, realPeople: false, brandsOrReadableText: false, videoAudio: false },
    batch: { first: { groups: ["image", "edit"], repositoryEstimateUsd: Number(firstBatchRepo.toFixed(6)), officialEstimateUsd: nullableFixed(firstBatchOfficial), status: firstPriceBlocked ? "BLOCKED_PRICE_VERIFICATION" : editCheck?.metadataGoFastStatus !== "SUPPORTED_BOOLEAN" ? "BLOCKED_PARAMETER_VERIFICATION" : "READY_FOR_APPROVAL" }, second: { groups: ["video", "pro"], repositoryEstimateUsd: Number(secondBatchRepo.toFixed(6)), officialEstimateUsd: nullableFixed(secondBatchOfficial), status: "PENDING_FAL_PRICING_AND_KEY" } },
  };
}

async function dryRunReport(plan, args) {
  validateApprovedPlan(plan);
  validateExecutionScope(args);
  console.log(`DRY_RUN_ONLY ${JSON.stringify({ groups: args.groups, limit: args.limit, planFile: relativeAssetPath(PLAN_FILE), planBytes: (await stat(PLAN_FILE)).size })}`);
  console.log(`PLAN_COUNTS ${JSON.stringify(Object.fromEntries(Object.entries(plan.groups).map(([name, entries]) => [name, entries.length])))}`);
  console.log(`PLAN_ESTIMATES ${JSON.stringify(plan.estimates)}`);
  console.log(`NO_PROVIDER_CALLS true`);
  console.log(`NO_PLAN_WRITE true`);
}

async function executePlan(plan, args) {
  validateApprovedPlan(plan);
  validateExecutionScope(args);
  if (!args.resume) throw new Error("BLOCKED_NO_RESUME_UNSAFE_FOR_PROVIDER_ASSETS");
  const env = await fileExists(ENV_FILE) ? parseEnv(await readFile(ENV_FILE, "utf8")) : {};
  const source = await readFile(MODELS_FILE, "utf8");
  if (/openrouter\//i.test(source)) throw new Error("BLOCKED_OPENROUTER_MODEL_SLUG");
  const comparisons = compareModels(parseModelsSource(source));
  if (comparisons.some((row) => !row.matches)) throw new Error("MODEL_COMPARISON_FAILED");
  if (args.groups.some((group) => ["image", "edit"].includes(group)) && !env.REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN_MISSING_BEFORE_PROVIDER_CALL");
  if (args.groups.includes("video") && !env.FAL_KEY) throw new Error("FAL_KEY_MISSING_BEFORE_PROVIDER_CALL");
  if (args.groups.some((group) => ["image", "edit"].includes(group))) await verifyApprovedLivePrices(env, args.groups);
  const releaseLock = await acquireGenerationLock();
  try {
    const journal = await loadJournal();
    const context = { env, journal, schemaCache: new Map(), successes: [] };
    for (const group of args.groups) {
      const entries = selectPlanEntries(plan, group, args.limit);
      for (const entry of entries) {
        if (group === "image") await processImageEntry(entry, context);
        else if (group === "edit") await processEditEntry(entry, context);
        else if (group === "video") await processVideoEntry(entry, context);
      }
    }
    const successfulEstimatedCostUsd = context.successes.reduce((sum, item) => sum + item.estimatedProviderCostUsd, 0);
    console.log(`GALLERY_COMPLETE_RUN ${JSON.stringify({ groups: args.groups, limit: args.limit, successfulEstimatedCostUsd: Number(successfulEstimatedCostUsd.toFixed(6)), reservedOrSpentUsd: Number(totalReservedCost(journal).toFixed(6)), hardCapUsd: MAX_TOTAL_USD, actualInvoiceVerified: false, costLabel: "successful_units_times_approved_official_unit_prices" })}`);
  } finally {
    await releaseLock();
  }
}

async function readApprovedPlan() {
  let raw;
  try {
    raw = await readFile(PLAN_FILE);
  } catch {
    throw new Error("APPROVED_PLAN_MISSING");
  }
  const actualHash = createHash("sha256").update(raw).digest("hex");
  if (actualHash !== APPROVED_PLAN_SHA256) throw new Error("APPROVED_PLAN_HASH_MISMATCH");
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("APPROVED_PLAN_INVALID_JSON");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  const plan = await readApprovedPlan();
  if (args.dryRun) return dryRunReport(plan, args);
  await executePlan(plan, args);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export {
  buildAllGroups,
  buildEditInput,
  buildImageInput,
  buildPlan,
  compareModels,
  extractReplicateOfficialPrice,
  isAllowedFalOutputUrl,
  isAllowedReplicateOutputUrl,
  isReplicateDeliveryUrl,
  normalizeBefore,
  normalizeEditPair,
  parseArgs,
  parseModelsSource,
  SCRIPT_MODELS,
};

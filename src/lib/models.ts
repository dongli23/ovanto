// cost: upstream procurement cost in USD per unit (image or second).
// price: independent customer price in USD per complete generation.
// Quota pools and cost accounting use cost only; price is never a cost input.
export const MODELS = {
  'image.free': {
    provider: 'replicate',
    slug: 'black-forest-labs/flux-schnell',
    unit: 'image',
    cost: 0.003,
  },
  'image.paid': {
    provider: 'replicate',
    slug: 'black-forest-labs/flux-dev',
    unit: 'image',
    cost: 0.025,
  },
  'edit.free': {
    provider: 'replicate',
    slug: 'black-forest-labs/flux-kontext-dev',
    unit: 'image',
    cost: 0.023,
  },
  'edit.paid': {
    provider: 'fal',
    slug: 'fal-ai/flux-pro/kontext',
    unit: 'image',
    cost: 0.04,
  },
  'video.free': {
    provider: 'fal',
    slug: 'fal-ai/wan-25-preview/text-to-video',
    unit: 'second',
    cost: 0.05,
    fixedSeconds: 5,
    resolution: '480p',
  },
  'video.paid': {
    provider: 'fal',
    slug: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    unit: 'second',
    cost: 0.07,
    fixedSeconds: 5,
    price: 0.99, // Customer price for the full fixed 5-second generation.
  },
} as const;

export type GenerationTask = 'image' | 'edit' | 'video';
export type GenerationTier = 'free' | 'paid';
export type ModelKey = `${GenerationTask}.${GenerationTier}`;
export type ModelDefinition = {
  readonly provider: 'replicate' | 'fal';
  readonly slug: string;
  readonly unit: 'image' | 'second';
  readonly cost: number;
  readonly fixedSeconds?: number;
  readonly resolution?: string;
  readonly price?: number | null;
};

export function modelKey(task: GenerationTask, tier: GenerationTier): ModelKey {
  return `${task}.${tier}` as ModelKey;
}

export function modelFor(task: GenerationTask, tier: GenerationTier): ModelDefinition {
  return MODELS[modelKey(task, tier)];
}

export interface KieProviderOptions {
  prompt: string;
  sourceImageUrl?: string;
}

export interface KieProvider {
  generate(options: KieProviderOptions): Promise<never>;
}

export class KieNotImplementedError extends Error {
  constructor() {
    super("KIE provider is not implemented");
    this.name = "NotImplemented";
  }
}

export function generateKie(_options: KieProviderOptions): Promise<never> {
  throw new KieNotImplementedError();
}

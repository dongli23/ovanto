import { PAID_PRODUCTS, MAX_PAID_QUANTITY, retailPriceCents } from "../../../../lib/payments/config";
import { assertPaymentConfiguration, noStore } from "../../../../lib/payments/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { assertPaymentConfiguration(); } catch { return noStore({ enabled: false, products: [] }); }
  const products = Object.values(PAID_PRODUCTS).flatMap((product) => {
    try {
      const unitAmountCents = retailPriceCents(product.key);
      const minQuantity = Math.max(1, Math.ceil(50 / unitAmountCents));
      if (minQuantity > MAX_PAID_QUANTITY || !process.env[product.provider === "replicate" ? "REPLICATE_API_KEY" : "FAL_API_KEY"]) return [];
      if (product.key === "edit" && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN || !process.env.IP_HASH_SECRET)) return [];
      return [{ key: product.key, model: product.model, unitAmountCents, minQuantity, maxQuantity: MAX_PAID_QUANTITY }];
    } catch { return []; }
  });
  return noStore({ enabled: products.length > 0, products });
}

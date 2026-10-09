import { waffoCatalog } from "../../../../lib/payments/config";
import { assertPaymentConfiguration, noStore } from "../../../../lib/payments/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertPaymentConfiguration();
  } catch {
    // Fail closed when any required environment value is missing.
    return noStore({ enabled: false, products: [] });
  }
  return noStore({ enabled: true, products: waffoCatalog() });
}

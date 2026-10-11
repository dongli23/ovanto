import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { assertPaymentConfiguration } from "../../lib/payments/errors";
import styles from "../legal.module.css";

export const dynamic = "force-dynamic";

function paymentIsAvailable(): boolean {
  try {
    assertPaymentConfiguration();
    return true;
  } catch {
    return false;
  }
}

export const metadata: Metadata = {
  title: "Pricing | Ovanto",
  description: "See Ovanto's current free limits and the Ovanto Pro Video Pack availability.",
  alternates: { canonical: "/pricing/" },
  openGraph: {
    title: "Pricing | Ovanto",
    description: "See Ovanto's current free limits and the Ovanto Pro Video Pack availability.",
    url: "https://www.ovanto.ai/pricing/",
  },
};

export default function PricingPage() {
  const paidAvailable = paymentIsAvailable();

  return (
    <LegalPage title="Pricing" date="9 October 2026" dateTime="2026-10-09" eyebrow="Pricing">
      <p className={styles.lead}>
        Free tools are available subject to regional eligibility, daily limits, and capacity. {paidAvailable
          ? "The Ovanto Pro Video Pack is available through the English video workspace."
          : "The Ovanto Pro Video Pack is not yet available for purchase."}
      </p>

      <section className={styles.pricingStatus} aria-labelledby="pricing-status-title">
        <p className={styles.statusLabel}>{paidAvailable ? "Available now" : "Current availability"}</p>
        <h2 id="pricing-status-title">
          {paidAvailable ? "Ovanto Pro Video Pack is available for purchase." : "Ovanto Pro Video Pack is not yet available for purchase."}
        </h2>
        <p>
          {paidAvailable
            ? <>Open the <a href="/video/">English video workspace</a> to start a purchase. The pack includes 3 Pro AI video generations.</>
            : "The pack details and checkout will be shown here when paid purchase becomes available."}
        </p>
      </section>

      <section className={styles.pricingSection} aria-labelledby="free-pricing-title">
        <div className={styles.sectionHeading}>
          <p className={styles.statusLabel}>Included</p>
          <h2 id="free-pricing-title">Free access</h2>
          <p>Free limits reset daily at 00:00 UTC and apply to anonymous use. They may be shared across the same device or IP network and are not per-account allowances.</p>
        </div>
        <div className={styles.pricingGrid}>
          <article className={styles.pricingCard}>
            <h3>AI image</h3>
            <p className={styles.pricingPrice}>$0</p>
            <p className={styles.pricingUnit}>3 generations per UTC day</p>
          </article>
          <article className={styles.pricingCard}>
            <h3>AI photo edit</h3>
            <p className={styles.pricingPrice}>$0</p>
            <p className={styles.pricingUnit}>1 edit per UTC day</p>
          </article>
          <article className={styles.pricingCard}>
            <h3>AI video</h3>
            <p className={styles.pricingPrice}>$0</p>
            <p className={styles.pricingUnit}>1 generation per UTC day</p>
          </article>
        </div>
      </section>

      <section className={styles.pricingSection} aria-labelledby="paid-pricing-title">
        <div className={styles.sectionHeading}>
          <p className={styles.statusLabel}>{paidAvailable ? "Available paid product" : "Planned paid product"}</p>
          <h2 id="paid-pricing-title">Ovanto Pro Video Pack</h2>
          <p>Get 3 Pro AI video generations for US$4.99. Each generation creates one 5-second video using Kling 2.5 Turbo Pro. This is a one-time purchase with no subscription or automatic renewal.</p>
        </div>
        <article className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
          <h3>Ovanto Pro Video Pack</h3>
          <p className={styles.pricingPrice}>US$4.99</p>
          <p className={styles.pricingUnit}>per pack · 3 Pro video generations · 5 seconds each</p>
        </article>
        <p className={styles.pricingNote}>
          {paidAvailable
            ? "The pack is available through the English video workspace. One pack includes three Pro video generations, has no cash value, and does not renew or recharge automatically. The pack has no scheduled expiry at present."
            : "This is a planned product; paid purchase is not currently available. One pack includes three Pro video generations, has no cash value, and does not renew or recharge automatically. The pack has no scheduled expiry at present."}
        </p>
      </section>

      <section className={styles.pricingSection} aria-labelledby="free-video-faq-title">
        <div className={styles.sectionHeading}>
          <p className={styles.statusLabel}>After free access</p>
          <h2 id="free-video-faq-title">What happens after I use my free video?</h2>
        </div>
        <p>
          {paidAvailable
            ? "Free users can create one 5-second AI video in 480p per day per IP. You can purchase an Ovanto Pro Video Pack through the English video workspace for US$4.99, which includes 3 Pro video generations. It is a one-time purchase with no subscription or automatic renewal."
            : "Free users can create one 5-second AI video in 480p per day per IP. When paid purchase becomes available, you can purchase an Ovanto Pro Video Pack for US$4.99, which includes 3 Pro video generations. It is a one-time purchase with no subscription or automatic renewal."}
        </p>
      </section>

      <section className={styles.pricingSection} aria-labelledby="purchase-details-title">
        <div className={styles.sectionHeading}>
          <p className={styles.statusLabel}>Purchase details</p>
          <h2 id="purchase-details-title">What to expect</h2>
        </div>
        <p>
          Free allowances are product-specific. The Ovanto Pro Video Pack includes three Pro video generations, with one 5-second video created per generation. Any required taxes and the final amount will be displayed at checkout before payment; this page does not take a charge.
        </p>
        <p>
          An entirely unused purchase qualifies for a full refund when requested within 7 days, under the <a href="/terms/#refunds">refund policy</a>. Mandatory consumer rights continue to apply.
        </p>
      </section>

      <section className={styles.pricingSection} aria-labelledby="pricing-help-title">
        <div className={styles.sectionHeading}>
          <p className={styles.statusLabel}>Before purchase</p>
          <h2 id="pricing-help-title">Questions and policies</h2>
        </div>
        <ul className={styles.pricingLinks}>
          <li><a href="/terms/#refunds">Read the refund policy</a></li>
          <li><a href="/terms/#content-safety">Read the content safety rules</a></li>
          <li><a href="mailto:hello@ovanto.ai">Contact support at hello@ovanto.ai</a></li>
        </ul>
      </section>
    </LegalPage>
  );
}

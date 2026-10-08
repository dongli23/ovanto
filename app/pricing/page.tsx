import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Pricing | Ovanto",
  description: "See Ovanto's current free limits and planned paid video price.",
  alternates: { canonical: "/pricing/" },
  openGraph: {
    title: "Pricing | Ovanto",
    description: "See Ovanto's current free limits and planned paid video price.",
    url: "https://www.ovanto.ai/pricing/",
  },
};

export default function PricingPage() {
  return (
    <LegalPage title="Pricing" date="9 October 2026" dateTime="2026-10-09" eyebrow="Pricing">
      <p className={styles.lead}>
        Free tools are available subject to regional eligibility, daily limits, and capacity. Paid credits are not yet available for purchase.
      </p>

      <section className={styles.pricingStatus} aria-labelledby="pricing-status-title">
        <p className={styles.statusLabel}>Current availability</p>
        <h2 id="pricing-status-title">Paid credits are not yet available for purchase.</h2>
        <p>
          The paid offer and checkout will be shown here when they become available.
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
          <p className={styles.statusLabel}>Planned paid price</p>
          <h2 id="paid-pricing-title">Paid video</h2>
          <p>The planned paid video price is listed per fixed five-second generation.</p>
        </div>
        <article className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
          <h3>AI video · 5 seconds</h3>
          <p className={styles.pricingPrice}>US$0.99</p>
          <p className={styles.pricingUnit}>per generation · one-time purchase</p>
        </article>
        <p className={styles.pricingNote}>
          US$0.99 is a planned price; checkout is not currently available. Paid image and paid photo edit prices will be shown before those options open. One paid credit covers one operation for its product. Credits have no cash value, and there is no automatic renewal or automatic top-up. Paid credits have no scheduled expiry at present.
        </p>
      </section>

      <section className={styles.pricingSection} aria-labelledby="purchase-details-title">
        <div className={styles.sectionHeading}>
          <p className={styles.statusLabel}>Purchase details</p>
          <h2 id="purchase-details-title">What to expect</h2>
        </div>
        <p>
          Free allowances are product-specific. Paid credits will also be product-specific and apply to the corresponding operation. Any required taxes and the final amount will be displayed at checkout before payment; this page does not take a charge.
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

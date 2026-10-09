import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Ovanto",
  description: "How Ovanto collects, uses, shares, and protects information when you use its AI creative services.",
  alternates: { canonical: "/privacy/" },
  openGraph: {
    title: "Privacy Policy | Ovanto",
    description: "How Ovanto collects, uses, shares, and protects information when you use its AI creative services.",
    url: "https://www.ovanto.ai/privacy/",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" date="9 October 2026" dateTime="2026-10-09">
      <p><strong>Version 1.1 · Updated and effective 9 October 2026</strong></p>

      <p>
        This Privacy Policy explains how Li Dong, an individual operator of Ovanto
        (“Ovanto”, “we”, “us”, or “our”), handles information when you use
        {" "}<a href="https://www.ovanto.ai/">https://www.ovanto.ai/</a>, including its
        AI image generation, short video generation, and image editing tools (the
        “Service”). It should be read together with our
        {" "}<a href="/terms/">Terms of Service</a>.
      </p>
      <p>
        We do not sell personal information and do not share it for cross-context
        behavioral advertising. We collect and use information only for the purposes
        described below, or as otherwise permitted or required by applicable law.
      </p>

      <h2>1. Who is responsible for your information</h2>
      <p>
        The operator responsible for the Service is Li Dong. For privacy questions,
        access or deletion requests, complaints, and other data requests, contact{" "}
        <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>. Li Dong handles privacy
        requests through this email address.
      </p>

      <h2>2. Information we collect</h2>
      <h3>2.1 Information you submit</h3>
      <ul>
        <li>Prompts, instructions, and settings used to request an image, video, or edit.</li>
        <li>Photos or other image files you choose to upload for an editing request, together with their upload metadata.</li>
        <li>Your email address and account or login information when you use paid account features.</li>
        <li>Order identifiers, product, quantity, price, currency, payment status, and credit ledger information. We do not receive or store full payment card numbers on our servers.</li>
        <li>Messages and other information you include when you contact support.</li>
        <li>Content safety reports sent by email, such as a job or report ID, category, brief description, and related correspondence. Please do not send CSAM attachments, secrets, or another person’s sensitive personal information.</li>
      </ul>

      <h3>2.2 Information generated or collected automatically</h3>
      <ul>
        <li>Generation identifiers, provider and model identifiers, processing status, output URLs, and error or audit records needed to operate a request.</li>
        <li>A keyed hash of the trusted network IP address used for anonymous quotas, rate limiting, abuse prevention, request ownership, and security. We do not use this hash to identify you by name.</li>
        <li>The country signal supplied by the hosting infrastructure for regional availability and abuse controls. We do not intentionally collect precise location through the Service.</li>
        <li>Necessary cookies and opaque identifiers, such as the anonymous owner cookie, account session cookie, and checkout claim cookie.</li>
        <li>Request, security, and diagnostic information such as timestamps, response status, browser and device details made available to our hosting infrastructure, and failure information.</li>
        <li>The result of Cloudflare Turnstile verification. We do not retain the Turnstile token as a user profile.</li>
      </ul>

      <h3>2.3 Information from payment and email providers</h3>
      <p>
        Waffo Pancake may provide payment status, transaction identifiers, email, and
        related fraud or reconciliation information. Resend may provide delivery and
        failure information for activation, login, and other transactional email. We do
        not ask you to send card details by email.
      </p>

      <h2>3. How we use information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>provide, process, display, and deliver requested generations and edits;</li>
        <li>send prompts and, when needed, uploaded images to the provider that performs the requested operation;</li>
        <li>maintain quotas, credits, reservations, job status, downloads, and account access;</li>
        <li>process checkout, reconcile payments, issue credits, investigate refunds, and answer billing questions;</li>
        <li>authenticate users, send login or account emails, and provide support;</li>
        <li>review content safety reports, coordinate with a provider where possible, and take actions within our capability and the law;</li>
        <li>protect the Service against fraud, abuse, automated attacks, unauthorized access, and unsafe use;</li>
        <li>diagnose errors, maintain reliability, and improve the Service without using your inputs to train a general AI model without separate permission; and</li>
        <li>comply with legal obligations, enforce our Terms, and respond to valid legal requests.</li>
      </ul>
      <p>
        The legal basis depends on the purpose and applicable law: contract performance
        for requested generations, edits, payment and credit fulfillment, and account or
        login service; legitimate interests for security, abuse prevention, diagnostics,
        and support; legal obligations for payment records, compliance, and valid legal
        requests; and consent where the law requires consent for a particular optional
        processing activity. We may create aggregated or de-identified information for
        reliability and service analysis when it no longer reasonably identifies you.
      </p>

      <h2>4. Cookies and tracking</h2>
      <p>
        The Service uses necessary cookies for anonymous quota ownership, account
        sessions, checkout continuity, security, and request operation.
        The anonymous owner cookie and checkout claim cookie are currently configured to
        last up to 2 days; a paid account session is currently configured to last up to
        30 days. Login codes and activation links have separate short validity periods.
      </p>
      <p>
        We do not currently use analytics tools, advertising pixels, ad-tech identifiers, or
        cross-site behavioral tracking. Cloudflare Turnstile and our infrastructure may
        use their own security mechanisms subject to their policies. You can control
        cookies through your browser, but disabling necessary cookies may prevent the
        Service from working.
      </p>

      <h2>5. When we share information</h2>
      <p>
        We share only the information reasonably needed for the purpose and service
        involved. Depending on the request, recipients may include:
      </p>
      <ul>
        <li><strong>Hosting and storage:</strong> Vercel hosts the application and Upstash stores operational records such as jobs, quotas, reservations, and security hashes.</li>
        <li><strong>Safety and verification:</strong> Cloudflare Turnstile verifies that a request is not automated abuse.</li>
        <li><strong>AI providers:</strong> Replicate and fal receive prompts, settings, and an uploaded image where needed to provide the requested generation or edit. Their processing is also subject to their own terms and privacy policies.</li>
        <li><strong>Payment:</strong> Waffo Pancake acts as the merchant of record or reseller for a checkout presented through Waffo.</li>
        <li><strong>Email:</strong> Resend sends login, activation, and other transactional email.</li>
        <li><strong>Legal and safety recipients:</strong> We may disclose information when required by law, court order, valid governmental request, or to protect users, the Service, or our rights.</li>
      </ul>
      <p>
        We do not sell your information. We do not share it with another party for
        cross-context behavioral advertising. If the Service or its assets are involved
        in a merger, acquisition, financing, or sale, information may be transferred as
        part of that transaction subject to continued protection and any notice required
        by law.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        The following links identify principal third-party services used by the Service
        or identified in a checkout we offer. Their policies govern their own processing:
      </p>
      <ul>
        <li><a href="https://vercel.com/legal/privacy-notice" rel="noreferrer">Vercel Privacy Notice</a></li>
        <li><a href="https://upstash.com/static/trust/privacy.pdf" rel="noreferrer">Upstash Privacy Policy</a></li>
        <li><a href="https://www.cloudflare.com/policies/privacy/" rel="noreferrer">Cloudflare Privacy Policy</a></li>
        <li><a href="https://replicate.com/privacy" rel="noreferrer">Replicate Privacy Policy</a></li>
        <li><a href="https://fal.ai/legal/privacy-policy" rel="noreferrer">fal Privacy Policy</a></li>
        <li><a href="https://www.waffo.ai/privacy" rel="noreferrer">Waffo Pancake Privacy Policy</a></li>
        <li><a href="https://resend.com/legal/privacy-policy" rel="noreferrer">Resend Privacy Policy</a></li>
      </ul>

      <h2>7. Security</h2>
      <p>
        We use HTTPS/TLS for transmission, signed secure cookies, keyed hashes for
        anonymous network controls, hashed credentials and tokens where stored, access
        controls, and bounded provider requests. We limit provider URLs and inputs to
        the formats needed by the Service. Where required by applicable law, we will
        notify the relevant regulator within 72 hours after becoming aware of a personal
        data breach and notify affected users without undue delay when the law requires
        it. No internet service can guarantee absolute security, so please protect your
        account and tell us promptly about suspected misuse or a security issue.
      </p>

      <h2>8. How long we keep information</h2>
      <p>
        We keep information only for as long as it is needed for the purpose collected,
        service operation, security, dispute handling, or legal obligations. Current
        operational retention settings are:
      </p>
      <ul>
        <li>Free generation job records: up to 24 hours from the last write.</li>
        <li>Generation audit records: up to 30 days.</li>
        <li>Anonymous daily quota records: up to 2 days.</li>
        <li>Uploaded asset metadata and validated upload records: up to 1 hour; provider upload objects may have the same one-hour lifecycle where configured.</li>
        <li>Anonymous owner and checkout claim cookies: up to 2 days; account session cookies: up to 30 days. Login codes are valid for 10 minutes and activation links for 7 days; those validity periods control use of the credential, while related records may be retained longer where needed for security or legal purposes.</li>
        <li>Provider output URLs: according to the relevant provider’s availability and expiration behavior. We do not promise that a provider URL will remain available indefinitely.</li>
        <li>Paid account, credit, order, and transaction records: no scheduled automatic expiry is currently applied. We keep them while needed to provide the account or credits, complete refunds and disputes, and meet applicable legal obligations. We will consider deletion requests subject to those requirements.</li>
        <li>Support and content-safety correspondence: ordinarily up to 12 months, or longer where needed for a dispute, security investigation, or legal obligation.</li>
      </ul>
      <p>
        Third-party providers may keep prompts, uploads, outputs, or logs under their own
        policies and contractual settings. Their retention is outside our control.
      </p>

      <h2>9. Your rights and choices</h2>
      <p>
        Subject to applicable law, you may ask us to confirm whether we process your
        information and request access, correction, deletion, restriction, portability,
        or information about our processing. You may object to processing based on
        legitimate interests and withdraw consent where our processing relies on consent.
        Withdrawal affects future consent-based processing and does not affect processing
        already carried out lawfully.
      </p>
      <p>
        To make a request, email <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>{" "}
        from the relevant account email where possible, include enough information for
        us to locate the request, and do not send card details, passwords, API keys, or
        Turnstile tokens. We aim to respond within 30 calendar days or the shorter or
        longer deadline required by applicable law; we may extend or refuse a request
        where the law permits after explaining why. We may need to verify identity before
        disclosing or deleting information.
      </p>
      <p>
        If you believe we have not handled a request properly, you may contact the data
        protection authority or other regulator in the place where you live or work.
        Simply continuing to use the Service is not intended to be affirmative consent
        where applicable law requires a separate consent choice.
      </p>

      <h2>10. International processing</h2>
      <p>
        Ovanto and its providers may process information in the United States and other
        regions where those providers operate. When applicable law requires safeguards
        for an international transfer, we use the contractual, organizational, or other
        lawful mechanism available for that transfer. The relevant provider may also
        process information under its own cross-border terms.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is for people aged 18 or older. We do not knowingly collect personal
        information from anyone under 18. If you believe a person under 18 has provided
        information, contact <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>{" "}and
        we will review and delete it where required.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We may update this Policy when the Service, providers, or legal requirements
        change. For a material change, we aim to give at least 15 days’ notice through
        the Service or another appropriate channel before it takes effect, unless a
        shorter period is required for law, security, or an urgent operational reason.
        We will update the effective date at the top of this page. Where applicable law
        requires consent for a change, we will ask for it separately.
      </p>

      <h2>13. Contact</h2>
      <p>
        For privacy requests, support, billing questions, security reports, or
        content-safety reports, contact{" "}
        <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>. The operator is Li Dong.
        Please do not include payment card details or other secrets in email.
      </p>

      <p><strong>Li Dong · https://www.ovanto.ai/ · Version 1.1</strong></p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Ovanto",
  description: "The terms that apply when you use Ovanto's AI image, video, and photo editing services.",
  alternates: { canonical: "/terms/" },
  openGraph: {
    title: "Terms of Service | Ovanto",
    description: "The terms that apply when you use Ovanto's AI image, video, and photo editing services.",
    url: "https://www.ovanto.ai/terms/",
  },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" date="9 October 2026" dateTime="2026-10-09">
      <p><strong>Version 1.1 · Updated and effective 9 October 2026</strong></p>

      <p>
        These Terms of Service (the “Terms”) govern your access to and use of Ovanto,
        an AI-powered creative service operated by Li Dong, an individual operator
        (“Ovanto”, “we”, “us”, or “our”). Ovanto is available at
        {" "}<a href="https://www.ovanto.ai/">https://www.ovanto.ai/</a> (the “Service”).
      </p>

      <h2>1. Acceptance and eligibility</h2>
      <p>
        By using the Service, creating an account, or buying credits, you confirm that
        you are at least 18 years old, that you can enter into a binding agreement, and
        that you have read and agree to these Terms and our
        {" "}<a href="/privacy/">Privacy Policy</a>. If you do not agree, do not use
        the Service. If you use the Service for an organization, you confirm that you
        are authorized to bind that organization.
      </p>

      <h2>2. The Service</h2>
      <p>
        Ovanto provides browser-based AI image generation, short video generation, and
        image editing. The available tools, model choices, limits, resolutions, and
        prices are shown in the product interface, on our <a href="/pricing/">pricing
        page</a>, or at checkout and may change as the Service develops.
      </p>
      <p>
        The Service relies on third-party AI providers. For example, the current free
        image tool uses Replicate’s FLUX Schnell model, and the current free video tool
        uses fal’s Wan 2.5 model for a fixed five-second, 480p result. Provider
        availability, processing time, output quality, and model behavior are outside
        our control.
      </p>
      <p>
        The Service is a digital service. A generation may fail or be unavailable when
        a provider, network, safety system, or other dependency cannot complete it.
        We will not knowingly charge for a provider request that was not made, and the
        refund rules below apply where a paid service is not delivered due to a failure
        attributable to us.
      </p>

      <h2>3. Accounts and security</h2>
      <p>
        Free tools may be available without an account. Paid features require the
        account or checkout information requested by the Service. You must provide
        accurate information, keep your login and account details secure, and promptly
        tell us at <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a> if you suspect
        unauthorized access. You are responsible for activity carried out through your
        account, except where applicable law says otherwise.
      </p>

      <h2>4. Free use and credits</h2>
      <p>
        Free generations are subject to the daily limits displayed in the Service.
        Limits are technical access limits and are not a promise that a provider will
        always return a result. We may refuse, pause, or rate-limit requests to protect
        the Service, users, providers, or our systems.
      </p>
      <p>
        Paid credits are units that authorize use of the corresponding paid feature.
        They are not money, a deposit, a security, or a transferable payment method.
        Credits are non-transferable and may only be used through the account and
        product for which they were purchased. There is currently no scheduled expiry
        for purchased credits. We may retain account and credit
        records while they are needed to provide the Service, meet legal obligations,
        resolve disputes, or complete a refund or payment review.
      </p>

      <h2>5. Prices and payment</h2>
      <p>
        You authorize a one-time charge for the amount shown at checkout when you buy
        a credit package. There is no subscription, automatic renewal, or automatic
        top-up in the current Service. Applicable taxes, if any, are shown or calculated
        at the final checkout where required.
      </p>
      <p>
        Where checkout is provided through Waffo Pancake, Waffo Pancake may act as the
        merchant of record or reseller for that transaction, as identified at checkout.
        We do not store full payment card numbers on our servers. Payment providers may
        apply their own terms and privacy notices in addition to these Terms.
      </p>

      <section id="refunds">
        <h2>6. Refund policy</h2>
        <p>
          Refunds for one-time credit purchases follow these rules. This does not limit
          any refund, withdrawal, chargeback, or other consumer right that cannot
          lawfully be waived.
        </p>
        <h3>6.1 When a refund may be available</h3>
        <ul>
          <li>A credit purchase that is entirely unused qualifies for a full refund when requested within 7 days of purchase.</li>
          <li>Duplicate charges caused by a billing error are eligible for a refund of the duplicate amount.</li>
          <li>If a paid service is not delivered because of a failure attributable to us, we will refund the unused credits attributable to that service or the corresponding unused amount.</li>
          <li>Credits already consumed by a completed service are not refundable except where mandatory law requires otherwise.</li>
        </ul>
        <h3>6.2 How to request a refund</h3>
        <p>
          Email <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a> from the email
          associated with your account and include the order ID and a short explanation.
          Do not send card numbers, security codes, passwords, or other payment secrets.
          We aim to acknowledge requests within 2 business days. Approved refunds are
          normally initiated within 5–10 business days; the bank or payment provider
          may take additional time to post the funds.
        </p>
      </section>

      <h2>7. Billing questions and disputes</h2>
      <p>
        If you believe a charge or credit balance is incorrect, contact{" "}
        <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>{" "}before opening a payment
        dispute where reasonably possible. We aim to respond to billing questions within
        2 business days and will review confirmed billing errors. This request does not
        remove any right to contact your bank or card provider.
      </p>

      <h2>8. Your inputs and AI outputs</h2>
      <p>
        You retain your rights in prompts, photos, and other materials that you submit,
        subject to the rights needed to operate the Service. You grant us a limited,
        non-exclusive license to host, transmit, process, and provide those inputs and
        the resulting output only as needed to deliver, secure, and troubleshoot the
        Service. We do not use your inputs to train a general AI model without your
        separate permission.
      </p>
      <p>
        As between you and us, you retain any rights in your outputs, and we assign to
        you any rights we may have in them, subject to applicable law, third-party
        rights, and model terms. You may use the output returned to you for lawful
        purposes. AI output may not be unique, may contain errors, and may not qualify
        for copyright or other intellectual-property protection. We do not guarantee
        non-infringement, accuracy, availability, or suitability of any output. You are
        responsible for reviewing output and for obtaining any rights needed for people,
        brands, locations, artwork, or other material shown in it.
      </p>

      <section id="content-safety">
        <h2>9. Acceptable use and content safety</h2>
        <p>You may use the Service only for lawful purposes. You must not create, upload, request, or distribute:</p>
        <ul>
          <li><strong>Pornography / NSFW:</strong> pornographic or sexually explicit content, including sexualized depictions of real people.</li>
          <li><strong>Violence / gore:</strong> gratuitous graphic violence, gore, or content intended to glorify serious physical harm.</li>
          <li><strong>Hate:</strong> hateful or dehumanizing content targeting a protected group, or content that promotes discrimination or violence against such a group.</li>
          <li><strong>Child unsafe content / CSAM:</strong> any sexual or exploitative content involving a minor, or any other content that endangers children.</li>
          <li><strong>Deepfake / impersonation:</strong> deceptive synthetic media or impersonation intended to mislead people about identity, source, or authenticity, especially involving a real person without consent.</li>
          <li><strong>Copyright / trademark infringement:</strong> content that infringes copyright, trademark, publicity, privacy, or other rights.</li>
        </ul>
        <p>You must also not:</p>
        <ul>
          <li>create malware, phishing material, cyber-attack tooling, or instructions intended to cause harm;</li>
          <li>promote or assist terrorism, violent extremism, mass violence, or instructions for constructing weapons of mass destruction;</li>
          <li>bypass quotas, Turnstile, access controls, safety systems, or other security measures;</li>
          <li>resell, sublicense, share, or automate access in a way that burdens or abuses the Service;</li>
          <li>systematically scrape or extract outputs for bulk publication or a competing service;</li>
          <li>use inputs, outputs, model responses, or derived data to train, fine-tune, benchmark, distill, or develop a competing AI or machine-learning model; or</li>
          <li>present AI output as professional medical, legal, financial, or other regulated advice.</li>
        </ul>

        <h3 id="moderation">9.1 Safety checks and review</h3>
        <p>
          Provider checks vary by model. The current free Wan video path requests the
          provider safety checker. These checks are complemented by manual review of
          reported content and do not guarantee detection of every violation.
        </p>
        <p>
          Li Dong manually reviews content-safety reports sent to the address below.
          Depending on the available job record or logs, the provider response, and what
          we can lawfully do, review may include checking the report, escalating to the
          relevant provider, and taking an available action such as refusing a request,
          limiting access, or removing an available local job or output reference. We
          cannot control or promise deletion of copies retained by a provider.
        </p>

        <h3 id="reports">9.2 Content safety reports</h3>
        <p>
          Report a suspected violation by emailing{" "}
          <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a> with the subject{" "}
          <strong>“Content safety report”</strong>. Include the job ID if available, the
          relevant category, and a brief description. Do not send CSAM attachments,
          passwords, API keys, payment details, or other secrets, and do not send another
          person’s sensitive personal information unless it is strictly necessary to
          explain the report. For immediate danger, contact your local authorities. This
          mailbox is monitored, but it is not a 24/7 emergency service.
        </p>

        <h3>9.3 Review and appeals</h3>
        <p>
          If you believe a safety action was mistaken, email{" "}
          <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a> with the subject{" "}
          <strong>“Content safety appeal”</strong> and include the job or report ID if
          available. Li Dong will review the available information and aim to reply
          within 2 business days; urgent safety reports are prioritized. If a job has
          expired or provider information is no longer available, the review may be
          limited to the records we still have.
        </p>
      </section>

      <h2>10. Privacy and third-party services</h2>
      <p>
        Our <a href="/privacy/">Privacy Policy</a> explains how we handle personal
        information. The Service may use Vercel for hosting, Upstash for data storage,
        Cloudflare Turnstile for abuse prevention, Replicate and fal for AI processing,
        Waffo Pancake for checkout and payment handling, and Resend for
        transactional email. Their services may have separate terms and policies.
      </p>
      <p>
        We may link to third-party services for convenience. We do not control their
        content, availability, or data practices, and your use of them is governed by
        their applicable terms.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided “as is” and “as
        available”. We do not promise uninterrupted access, a particular processing
        time, a particular model, or a particular result. Do not rely on AI output as
        medical, legal, financial, safety-critical, or other professional advice.
      </p>

      <h2>12. Liability</h2>
      <p>
        To the maximum extent permitted by law, Li Dong will not be liable for indirect,
        incidental, special, consequential, exemplary, or punitive loss, or for loss of
        profits, data, goodwill, or business opportunity arising from use of the Service.
        Our total liability for claims relating to the Service will not exceed the
        amount you paid us for the Service in the 12 months before the event giving rise
        to the claim. Nothing in these Terms excludes or limits liability, rights, or
        remedies that cannot lawfully be excluded or limited.
      </p>

      <h2>13. Suspension and termination</h2>
      <p>
        You may stop using the Service at any time and may ask us to close an account by
        emailing <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>. We may suspend or
        terminate access when reasonably necessary for security, provider requirements,
        suspected fraud or abuse, a material breach of these Terms, or legal compliance.
        If we terminate a paid service for a reason not caused by your breach, we will
        refund the unused paid credits attributable to that service, subject to
        applicable law and the refund policy.
      </p>

      <h2>14. Mandatory consumer rights and disputes</h2>
      <p>
        These Terms operate alongside the mandatory consumer laws that apply to you and
        to us. Nothing here takes away a mandatory right to bring a claim, seek a remedy,
        withdraw from a digital purchase, or use a statutory dispute-resolution process.
        Before starting a formal dispute, please contact us at{" "}
        <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>{" "}so we can try to resolve it
        informally.
      </p>

      <h2>15. Changes and general terms</h2>
      <p>
        We may update these Terms as the Service changes. For material changes, we aim
        to provide at least 14 days’ notice through the Service before they take effect,
        unless a change is required sooner for law, security, or an urgent operational
        reason. The updated version date will appear at the top of this page. If any
        provision is unenforceable, the remaining provisions continue to apply. These
        Terms and the Privacy Policy describe the agreement for your use of the Service.
      </p>

      <h2>16. Contact</h2>
      <p>
        Questions about the Service, payments, refunds, privacy, or security can be
        sent to <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a>. Please do not
        include passwords, card details, API keys, or other secrets in your message.
      </p>

      <p><strong>Li Dong · https://www.ovanto.ai/ · Version 1.1</strong></p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Ovanto",
  description: "Content standards, prompt screening, reporting and enforcement for Ovanto's AI creative tools.",
  alternates: { canonical: "/aup/" },
  openGraph: { title: "Acceptable Use Policy | Ovanto", url: "https://www.ovanto.ai/aup/" },
};

export default function AcceptableUsePolicyPage() {
  return <LegalPage title="Acceptable Use Policy" date="15 October 2026" dateTime="2026-10-15">
    <p>This policy applies to prompts, uploaded material and outputs used with Ovanto. It forms part of our <a href="/terms/#content-safety">Terms of Service</a>.</p>
    <section id="content-standards">
      <h2>1. Content standards</h2>
      <p>Use the tools lawfully and only with material you are entitled to use. Do not request, upload, create or distribute:</p>
      <ul>
        <li>Pornography, sexually explicit or other NSFW content, including sexualized depictions of real people.</li>
        <li>Graphic violence, gore or content glorifying serious physical harm.</li>
        <li>Hate or dehumanization targeting protected groups, or incitement to discrimination or violence.</li>
        <li>Child sexual abuse material (CSAM), sexual exploitation of minors or other content endangering children.</li>
        <li>Deceptive deepfakes or impersonation, particularly synthetic depictions of a real person without consent.</li>
        <li>Material infringing copyright, trademarks, privacy, publicity or other third-party rights.</li>
      </ul>
      <p>Do not bypass safety checks, access controls or quotas, or use the Service for fraud, malware, terrorism or instructions intended to cause harm.</p>
    </section>
    <section id="moderation">
      <h2>2. Screening and review</h2>
      <p>Prompts are screened through Waffo's content-safety service before a generation is submitted to an AI provider. Only an allow verdict proceeds. Blocked prompts, prompts requiring review and unavailable screening do not proceed to generation or reserve a free allowance or paid credit. Screening records the time, interface language, reported categories and whether the request was allowed; we do not include the prompt text in these audit logs.</p>
      <p>Prompt screening does not guarantee detection of every violation and does not replace reviewing uploaded images or returned media. Provider checks vary by model. Li Dong also reviews reports and appeals using the information lawfully available, as described in the <a href="/terms/#moderation">Terms</a>.</p>
    </section>
    <section id="reporting">
      <h2>3. Report a concern</h2>
      <p>Email <a href="mailto:hello@ovanto.ai">hello@ovanto.ai</a> with the subject “Content safety report”, a job ID if available, the suspected category and a brief description. Do not attach CSAM or send passwords, API keys, payment details or unnecessary personal information. For an appeal, use the subject “Content safety appeal”.</p>
      <p>We aim to respond within two business days and prioritize urgent safety reports. The mailbox is not a 24-hour emergency service; contact local authorities for immediate danger.</p>
    </section>
    <section id="enforcement">
      <h2>4. Violations and enforcement</h2>
      <p>We may refuse requests, restrict or suspend access, remove available local job or output references, or escalate a report to the relevant provider or authorities where appropriate and lawful. We cannot promise deletion of copies retained by third parties. You may appeal a decision through the reporting address above. Mandatory consumer rights remain protected under the <a href="/terms/#refunds">refund terms</a>.</p>
    </section>
  </LegalPage>;
}

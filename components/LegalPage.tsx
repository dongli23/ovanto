import type { ReactNode } from "react";
import styles from "../app/legal.module.css";

export type LegalPageProps = {
  title: string;
  date: string;
  children: ReactNode;
  dateTime?: string;
  eyebrow?: string;
  dateLabel?: string;
  backHref?: string;
  backLabel?: string;
};

export function LegalPage({
  title,
  date,
  children,
  dateTime,
  eyebrow = "Legal",
  dateLabel = "Last updated",
  backHref = "/",
  backLabel = "Back to Ovanto",
}: LegalPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Ovanto home">
          <span className={styles.brandMark} aria-hidden="true" />
          <span>Ovanto</span>
        </a>
        <a className={styles.backLink} href={backHref}>{backLabel}</a>
      </header>

      <main className={styles.main}>
        <article className={styles.article}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.meta}>
            <span>{dateLabel}</span>
            <time dateTime={dateTime ?? date}>{date}</time>
          </p>
          <div className={styles.prose}>{children}</div>
        </article>
      </main>

      <footer className={styles.footer}>
        <span>Ovanto</span>
        <nav aria-label="Legal pages">
          <a href="/terms/">Terms</a>
          <a href="/privacy/">Privacy</a>
        </nav>
      </footer>
    </div>
  );
}

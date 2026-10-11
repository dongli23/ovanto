"use client";

import { Generator } from "./Generator";
import type { ToolKind } from "../lib/content";
import { toolRoute, type Locale } from "../lib/site";
import { WORKSPACE_COPY } from "../lib/workspace-copy";

export type GeneratorMode = ToolKind;

function routeForMode(locale: Locale, mode: GeneratorMode) {
  return toolRoute(locale, mode);
}

export function GeneratorWorkbench({
  locale,
  title,
  valueLine,
  mode,
  turnstileSiteKey,
}: {
  locale: Locale;
  title: string;
  valueLine: string;
  mode: GeneratorMode;
  turnstileSiteKey?: string;
}) {
  const localized = WORKSPACE_COPY[locale].workbench;

  return (
    <div className="workbench-shell" aria-label={title}>
      <nav className="workbench-modes" aria-label={localized.modeNavAria}>
        {(Object.keys(localized.modes) as GeneratorMode[]).map((nextMode) => (
          <a
            className={`workbench-mode${nextMode === mode ? " is-active" : ""}`}
            href={routeForMode(locale, nextMode)}
            key={nextMode}
            aria-current={nextMode === mode ? "page" : undefined}
          >
            {localized.modes[nextMode]}
          </a>
        ))}
      </nav>
      <Generator
        locale={locale}
        title={title}
        valueLine={valueLine}
        toolKind={mode}
        turnstileSiteKey={turnstileSiteKey}
        actionLabel={localized.actions[mode]}
        examples={localized.examples[mode]}
        showPaidAccess={mode === "video"}
      />
    </div>
  );
}

export default GeneratorWorkbench;

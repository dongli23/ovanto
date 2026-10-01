# Ovanto UI productization notes

## Scope

This pass follows `OVANTO_RAPHAEL_INSPIRED_UI_FUNCTIONAL_REBUILD_V1.md` and is limited to the product surface. It keeps the existing routes, page metadata, canonical/hreflang values, JSON-LD structure, internal links, and API flow intact. The approved FAQ answer synchronization and the specified mode/trust copy updates are reflected in their source data. The layout work is additive: a compact hero, a shared generator workbench surface, a tools summary row, and responsive states.

## Visual system

- Font: the existing self-hosted Manrope from `app/layout.tsx`.
- Palette: the existing Ovanto ink, muted gray, mint, coral, paper, and line colors. New semantic aliases live in `app/tokens.css`.
- Rhythm: 4-point spacing tokens from `--ovanto-space-1` through `--ovanto-space-8`.
- Surfaces: restrained borders, white workbench panels, soft mint utility surfaces, and the existing coral action color.
- Interaction: visible focus rings, hover and active states, disabled opacity, and reduced-motion support.
- Motion: small interaction transitions use the named `--ovanto-ease-out` token and only apply hover feedback on fine pointers.

## Structure

The page order is Header → compact Hero → shared Generator Workbench → localized tools summary and existing tool links → existing SEO sections → FAQ → footer. PageShell still owns the exact H1 and approved trust copy, while `GeneratorWorkbench` owns the mode controls, prompt flow, settings, result preview, before/after comparison, and prompt examples. The legacy image example helper is removed from PageShell so the workbench remains the single example surface.

## Responsive behavior

Desktop targets a 0.9 / 1.1 control-to-preview grid. At narrower widths it becomes a single column with mode → prompt → settings → CTA → result ordering. The styles target `minmax(0, 1fr)`, clipped horizontal overflow, wrapped descriptions, and 44px touch targets for the 320, 375, 414, and 768px layouts; visual browser testing was not run in this pass.

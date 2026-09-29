---
version: 1
slug: "src-app-site-apply-page-tsx"
primary_target: "src/app/(site)/apply/page.tsx"
related_targets: ["src/components/application-form.tsx","src/components/combobox.tsx"]
---

# Commissioner application (/apply)

Scope: redesign of the application form surface only; site header and footer unchanged. Mode: Operate. Audience: Thomasian students applying to join the commission (PRODUCT.md, audience 2). Task: complete a four-step application (About you, Your application, Documents, Review) and submit. States: field errors (client and server), full positions, pending submit, success.

User-pinned: "modern and sleek Apple clean design"; keep the four steps; Apple form conventions in the site's own black / white / gold with Geist.

## Direction contract

THESIS: A calm, single-column checkout-grade form, one question group at a time, in place of the current wide 12-column grid of boxed fields under a gray tracker band.

OWN-WORLD: Soft neutral page (#f5f5f7-family) with white rounded panels and no outlines; 56px rounded fields with floating labels that shrink on focus or fill; pill buttons in ink; gold marks only completion and selection (step segments, check discs); hairline-divided grouped lists for positions and review, in the style of iOS Settings.

STORY: The applicant sees exactly where they are, fills a short group, and moves on. Positions show open slots at a glance. Review reads like a receipt, with Edit links per group, before a single consent and Submit.

FIRST VIEWPORT: Centered 720px column. A large semibold title "Commissioner application", a one-line help email, then a four-segment progress bar with step names. Below it, the step title at about 32px, then the first white panel of floating-label fields. The primary action is a black pill in a sticky, translucent bottom bar.

FORM: user-pinned (Apple checkout and Settings grammar), no roll; seed key: none (pinned brief).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

These rules apply to every agent (Claude, Codex, Copilot and any other) and every person working in this repo. They describe the house style that already exists. Reuse it; don't invent a parallel one. If a rule here and the code disagree, follow the rule and fix the code, or ask.

## Brand

The site and portal are one brand: UST Central Comelec's "COMET" look. Think mission control under a night sky: deep-space black, glass panels lit along their top edge, hairline borders, film grain and stars, with UST gold marking what's live, current or primary. The public home page is the reference (`src/app/(site)/landing.css`). The portal (`src/app/(portal)/portal.css`) is the same look made calm for daily work.

- **Professional and plain, never "generic AI".** No tinted pills (a coloured border around a faded fill of the same colour), no gold glow rings on fields, no gradient-text gimmicks outside heading accent words, no decorative set pieces in working screens.
- **Inner pages are plain.** A short banner (`src/components/page-banner.tsx`, `src/app/(site)/banner-page.css`), then content people can scan, filter and link to. Heroes, landing sections, tickers and themed jargon belong to the home page only.
- **"X feel" or "X vibe" means a setting**, like a court hall for "constitution feel", not literal text or content.

## Colour

Always use tokens, never raw colours. Each surface has its own set:
- **Portal:** `--p-*` in `portal.css`
- **Site page families:** `--bp-*` (banner pages), `--ev-*` (events), `--ck-*` (cookies), `--lp-*` (landing), `--sh-*` (header)
- **Shared palette:** `--ui-*` in `src/app/theme-palette.css`

Never write `#fff` text, `rgba(255,255,255,…)` or a dark hex surface in new CSS. They break the light theme.

| Use | Portal token |
| --- | --- |
| Page, floating surfaces, a step up | `--p-bg`, `--p-surface`, `--p-raised` |
| Panels and cards (glass) | `--p-panel`, with `--p-shadow-card` |
| Menus, popovers, dialogs | `--p-surface`, with `--p-shadow-pop` |
| Lines | `--p-line` (hairline), `--p-line-strong` |
| Text, strongest to weakest | `--p-bright`, `--p-text`, `--p-soft`, `--p-muted`, `--p-faint`, `--p-placeholder`, `--p-dim` |
| Tints and wells | `rgba(var(--p-ink), .04–.1)` (ink is light on dark and dark on paper); `rgba(var(--p-base), …)` |
| Gold as a fill | `--p-gold` |
| Gold as text or an icon | `--p-gold-mark` (small text: `--p-gold-ink`) |
| Gold as an outline or underline | `--p-gold-edge` |
| Main button | `--p-action`, with `--p-on-action` |
| Status | `--p-ok`/`--p-ok-ink`, `--p-warn`/`--p-warn-ink`, `--p-danger`/`--p-danger-ink` |
| Behind a dialog | `--p-veil` |

Gold is scarce: the main action, the current tab, live markers, and accent words in headings. Don't use it for decoration, borders on everything, or field focus.

## Light and dark

- **Portal:** dark is the default; light is "Daylight", cool and neutral in the Apple manner. The sidebar and phone header, the dashboard hero, a settings page's status card and tooltips stay dark in both themes (the "Night" selector list at the top of `portal.css`). Light mode keeps three depth layers: a grey floor, white raised panels, and recessed fields that turn white in use.
- **Site:** the home page, every banner and landing section, the navbar, mega-menu, search and footer are always dark. Other pages follow the visitor's choice. Every site page belongs to one of the themed families:
  - banner pages (`.bp`, `banner-page.css`): News, Explainer, Statistics, Elections Code, Constitution, Magna Carta, About, Archive, Party Registration
  - Events (`.ev`)
  - Cookies and Privacy (`.ck`)
  - Apply (`.apply-page`): Become a Commissioner, Filing of Candidacy, and closed registrations
  A new page joins one of these families; never a plain white page.
- **Overrides:** anything a token can't express goes in the file's Daylight block as `:where([data-theme="light"]) <same selector>`. The `:where()` keeps it from outranking hover and state rules.
- **Check both themes**, at desktop and phone width (the portal switches to its phone layout at 860px), before calling UI work done.

## Type

- **Geist for everything**, through `var(--font-sans)` or the family's `--*-sans` token. Instrument Serif italic in gold (`--p-serif`, `--p-gold-serif`) only for one or two accent words in a heading: `<h1>Settings <em>here</em></h1>`.
- **No monospace anywhere**, including Geist Mono and system mono. `code`, `kbd`, `pre` and `textarea` get `font-family: inherit`. Figures use `font-variant-numeric: tabular-nums`.
- **Never add positive `letter-spacing`.** Large headings keep their existing slight negative tracking.
- **Portal sizes:** body 14px. Labels and meta 11.5–13px, weight 500. Headings weight 560–600. Page title `h1` is `clamp(30px, 2.4vw, 38px)`.

## Layout and page structure (portal)

- A page is `<main className="portal-page">` (`is-wide` for wide tables). It contains a `<header className="portal-page-head">` holding a `portal-eyebrow` (section name), a `TitleWithInfo` (title plus an "i" tip), an optional `portal-muted` line, and the page's main action on the right. Content follows in `portal-card`s.
- Explanations go behind `InfoTip` / `TitleWithInfo`, not in paragraphs on the page. Wrap read-only areas in `ViewOnly`, and show `ViewOnlyTag` in place of the main action.
- Radii: cards `--p-radius` (20px); dialogs and menus 14px; buttons and small controls 6px (`--ui-button-radius`); pills 999px.
- Layering: topbar 15, menus and pickers 60, the header pop-up stack 70, the session warning 100. Prefer the top layer (`popover`, `<dialog>`) to z-index for anything that floats.

## Buttons

- **Portal:** use `.portal-button` and its modifiers. Don't style a new button from scratch.
  - default: the gold main action, one per view
  - `is-ghost`: secondary
  - `is-small`
  - `is-block`
  - `is-danger`: confirm a destructive step
  - `is-danger-ghost`: start a destructive step
  - `is-ok`: approve
  - `.portal-icon-button`: icon only, with an `aria-label`
  - Buttons are 40px tall (32px small), weight 600, 6px radius. Hover darkens slightly (`filter: brightness(.94)`), press moves down 1px, disabled is 50% opacity.
- **Delete, Close, Dismiss and X buttons** are solid black and turn red on hover or focus, by the "Delete and dismiss controls" rule near the end of `portal.css`. It matches on `aria-label` / `title` starting "Close", "Dismiss" or "Delete", or an X or trash icon. Give such buttons those labels and let the rule style them; don't override it.
- **Destructive actions take two steps.** Use `DeleteButton` (`src/components/portal/delete-button.tsx`): the first click arms it, the second confirms, and "Keep" backs out. Use a confirmation `<dialog>` only when the consequence needs explaining (emails sent, records removed).
- **Labels** are a verb plus an object, in sentence case: "Save settings", "Add event", "Send announcement". While working they read "Saving…", "Sending…". After saving, an unchanged form's button reads "Saved" and is disabled.
- **Site:** each family has its own button: `.bp-button`, `.ev-button`, `.lp-button`, `.ck-button` (with `is-primary`, `is-ghost`). Main buttons use the family's `--*-action` token: UST gold in both themes.

## Fields and choices

- **Wrap inputs** in `Field` from `portal-form.tsx` (label, optional `hint` shown as an InfoTip, `error` shown underneath). Use `usePortalForm` for server actions.
- **Use the portal pickers, not native ones:** `Dropdown`, `MultiDropdown`, `DatePicker`, `TimePicker`, `DateTimePicker`.
- **Active field:** no gold ring and no glow. A field in use rises out of its recess with an ink edge and a soft lift (`--p-field-active-bg`, `--p-field-active-edge`, `--p-field-active-lift`). Never use `--p-ring` or a gold edge for focus on fields. Buttons and links keep a gold `:focus-visible` outline.
- **Selected choices fill solid** (ink and cream swapped, or solid green or red), never as a tinted pill. Unselected choices stay neutral: hairline border, faint fill. Status can be a dot plus words. Checkboxes use `accent-color: var(--p-text)`.
- **Settings forms** end in `.portal-settings-foot`: "Unsaved changes" on the left, then Discard (ghost), then Save.

## Names, numbers and emails (strict)

These hold on every form, on the site and in the portal, with no exceptions. Each is enforced twice: as people type, by `FormInputGuard` (`src/components/form-input-guard.tsx`, which reads the field's `name`) and the form builder's `cleanAnswer`; and again on the server. Never write a new regex or zod rule for these fields: build schemas from `src/lib/forms/fields.ts` (`personName`, `studentNumber`, `mobileNumber`, `optionalMobileNumber`, `email`), and the patterns and cleaners in `src/lib/forms/input.ts`.

1. **People's names** (last, first and middle names, full names, contact persons, witnesses): **letters only, always UPPERCASE.** Letters include Ñ and accented letters, and a single space may separate words (DELA CRUZ, MARIA CLARA). No digits, hyphens, apostrophes, periods or other symbols. The server refuses them rather than quietly removing them, and saves the name in capitals. Organization, party and event names are not people's names.
2. **Student numbers: numbers only, exactly 10 digits.**
3. **Emails must have a valid domain.** The address must be well formed (`name@domain.tld`), and the server checks that the domain takes mail (it has MX records) with `emailDomainProblem` / `emailDomainProblems` (`src/lib/forms/email-domain.ts`) before saving. Fields that need a UST account also require `@ust.edu.ph`. Only when DNS can't be reached at all is an address let through, so an outage doesn't block every form.
4. **Mobile numbers: numbers only.** Exactly 11 digits starting with 09 (09171234567). No dashes, spaces or +63, in what's typed, shown or saved.

When adding a field of one of these kinds:
- Name the input so the guard knows it: `lastName`, `firstName`, `middleName`, `fullName`, `contactPerson`, `submittedBy`, `witness1Name`; `studentNumber`; `contactNumber` or `mobileNumber`; `email`. A field inside a list keeps its last part (`officers.0.contactNumber`).
- Give it the matching box: `inputMode="numeric"`, `maxLength={10}` or `{11}` and a `pattern` for numbers; `type="email"` for emails.
- Clean any prefilled value (from Google, an application or an older record) with `tidyPersonName`, `cleanStudentNumber` or `cleanMobileNumber`. The guard only cleans what's typed.
- In the form builder, a question whose `identity` is a name or student number follows these rules whatever is ticked. Mobile numbers use the "Mobile number" answer rule.

## Status, tags and picked states

There are no tinted pills anywhere, on the portal or the site. A tinted pill is a coloured border around a faded fill of the same colour.
- **Status is a solid dot plus words.** The words stay neutral (`--p-soft` / the family's `--*-soft` or `--*-text`); only the 6px dot carries the colour. In the portal, use `.portal-tag` with a tone:
  - no class: neutral, dim dot (draft, closed)
  - `is-gold`: in progress or waiting
  - `is-ok`: done or sent
  - `is-warn`: failed, declined, cancelled
  - `is-danger`: removed
  - `is-local`: a Local unit's
  A tag that leads with its own icon shows the icon in the tone colour instead of the dot. The site's equivalents (`.ev-status`, `.lp-status`, `.sh-feat-tag`, `.ck-kind`) follow the same pattern, inside a neutral hairline.
- **Picked, finished or live states fill solid.** A picked choice card swaps ink and cream (`background: var(--p-text); color: var(--p-on-bright)`). A signed or confirmed mark is solid `--p-ok` with dark ink (`#04140c`). The view-only badge is solid gold. A picked icon in the site header is solid gold.
- **Information panels are neutral:** `--p-surface-2` with a `--p-line` / `--p-line-strong` border, with colour only in an icon or dot. Icon tiles are neutral with a gold icon.
- **No glows.** No coloured `box-shadow` halos on dots, icons, tags or hovers.

## Tabs, filters and segmented controls

Use the sliding components in `src/components/portal/sliding-filters.tsx` and `sliding-subtabs.tsx`. Never a static tab bar.
- `SlidingSubtabs`: page-level tabs that are routes. A 2px gold underline glides under the current tab (.32s).
- `SlidingFilters`: filters that are links (query string).
- `SlidingFilterButtons`: filters or views held in state, including the tabs inside dialogs.
- `SlidingSegments`: a radio group as a segmented control.

In each, one solid ink "thumb" (`.portal-filters-thumb`) slides to the picked item (.42s `--p-ease`), and the picked label turns `--p-on-bright`. Don't animate the background of each item separately.

## Dialogs, menus and popovers

- **Dialogs** are native `<dialog>` opened with `showModal()`:
  - the backdrop is `--p-veil` plus a 10–12px blur, and the page behind stops scrolling (`html:has(dialog[open]) { overflow: hidden }`)
  - they enter with `portal-help-in` (.22s `--p-ease`: rise 8px, scale from .98, fade)
  - surface `--p-surface`, `--p-line-strong` border, 14px radius, about 28px padding
  - title `h2` at 21px, text in `--p-muted`
  - actions bottom right: Cancel (ghost, autofocus) on the left, the action on the right
  - Escape and clicking the backdrop close it, except while saving
  - follow `.portal-registrant-confirmation` for confirmations, and `ReviewModalHeader` / `ReviewModalToolbar` (`review-modal-ui.tsx`) for record viewers
- **Menus, dropdowns and pickers** use the `popover` attribute, `--p-surface`, `--p-shadow-pop`, a 14px radius and the `portal-tip-in` entrance (.14s, 3px drop).
- **Explanations** go in `HelpDialog` or `InfoTip`. Tooltips stay dark in both themes.

## Motion

- **One easing: `--p-ease` (`cubic-bezier(.22, 1, .36, 1)`).** Families mirror it as `--bp-ease`, `--ev-ease`, `--sh-ease`.
- **Durations:**
  - .15s: hover and colour changes (`ease`)
  - .14–.22s: popovers, menus and dialogs
  - .3s: pop-ups and pills
  - .32s: tab underline
  - .42s: sliding thumbs
  - .55s: page content entering (`portal-page-in`, 12px rise, staggered)
- **Entrances** fade and rise a few pixels (6–12px), sometimes with a slight scale. No bounces, spins or long delays. Pressing moves at most 1px.
- **Animate `transform` and `opacity`**, not layout properties.
- **Reduced motion:** every new animation needs a `@media (prefers-reduced-motion: reduce)` rule that switches it off.

## Icons

`lucide-react`, 14–16px in buttons and 13–15px inline, `aria-hidden="true"` with the words beside them carrying the meaning. Animated nav icons come from `src/components/animate-ui/icons` through `portal-nav-icons.tsx`. Status uses `CheckCircle2` / `AlertTriangle` / `Info`; don't mix in other icon sets.

## Writing

- **Plain words a visitor or commissioner would use, in sentence case.** Curly apostrophes and quotes (’ “ ”), and "…" for an ellipsis.
- **Say what happened and what follows**, not just "Success": "Account added, and they’ve been emailed. They can now sign in…".
- **Errors say what to do:** "Couldn’t save the settings. Try again."

## Two people editing the same record

Nobody edits live together; each browser saves its whole form. So an edit form for an existing record is guarded (`src/lib/data/edit-guard.ts`, `src/components/portal/edit-guard.tsx`):
- **The page** passes `guard={{ stamp: stampFor(item.updatedAt, item), record: "<collection>/<id>" }}` (leave it out for view-only readers). Stamp the record exactly as the page loaded it.
- **The form** renders `<EditPresence guard={guard} />` at its top and `<EditConflict guard={guard} state={state} />` above its footer.
- **The action** saves with `saveGuarded(collection, id, data, email, readGuard(formData), { load })`, where `load` reads the record the same way the page did. It returns `{ saved, merged }`, `{ conflict }` (return `conflictState(…)` with the form's field labels) or `{ missing }`. Pass `merge: false` when fields are only valid together (accounts), `groups` for fields that change as one (a table's columns and rows), `check` to re-validate a merge (event times).
- Edits to different fields merge, and the notice says so (`…-merged`). The same field changed by both asks the second person to load the other version or save over it.
- **Records edited in a dialog or in place** (letters, minutes, calendar notes and highlights) send the `updatedAt` they opened. The store saves only over that and otherwise throws a conflict with the latest record (`RecordConflict`, `CalendarConflict`), which the action returns. The letters dialog merges different fields itself (`src/lib/letters/conflict.ts`). The calendar shows theirs and keeps the editor open, so saving again replaces it. A to-do rename checks the title instead, so ticking it done never blocks a rename.
- **Saves that set one value** (featured, registration open or closed, revoke or restore access, ticking a to-do) don't need the guard: they set what was clicked, so the last click wins.

## Action messages are header pop-ups

Every message that reports the outcome of something the user just did in the portal must be shown as the shared pop-up, centred on the portal header. Don't print it as a line in the page, a dialog, a card or a button label, and don't put it at the bottom of the screen. This covers success ("Saved.", "Email copied to clipboard.", "Announcement sent."), warnings (it worked, but the email didn't send) and failures ("Couldn't save. Try again.").

- **In client code:** call `toast(message, tone)` from `src/components/portal/toast.tsx`. `tone` is `"ok"` (default), `"warn"` or `"error"`.
- **In a form using `usePortalForm`:** `state.error` already pops up. Don't render it again.
- **In a form with its own `useActionState`:** call `useToast(state?.error, "error", state)`. For a success message, call `useToast(state?.saved ? "Saved." : null, "ok", state)`.
- **After a server action that redirects:** redirect with `?notice=<key>`, add the key's text to `src/components/portal/notice.tsx`, and render `<Notice notice={notice} />` on the page. It pops up and removes `?notice=` from the address.
- **On a server page with a one-off message:** render `<Toast message="…" param="notice" />`.

The pop-ups sit in the header stack in `src/components/portal/online-notices.tsx`, next to the Following pill, newest first. A one-line pop-up is a 36px pill 8px from the top, so it lines up with the middle of the 52px header. The stack re-raises itself above open dialogs, menus, popovers and the full-screen attendance booth. Don't build a second toast, snackbar or notice component.

These stay inline, beside what they're about:
- an error under a specific field
- a page's load error, or a "run this migration" or "not set up" banner
- persistent state: "Unsaved changes", "Saved" on a save button, "Uploading… 45%", empty states, result counts
- anything that needs an answer before it goes away: confirm dialogs, Undo bars
- the public website and the portal login page, which have no portal header

When you add or change an action anywhere in the portal, check its success and failure paths both go through `toast()`.

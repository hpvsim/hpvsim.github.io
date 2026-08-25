# HPVsim site redesign — design spec

Date: 2026-08-25
Status: approved, pending implementation plan

## Context

`hpvsim.github.io` is currently a single-page Quarto site (`index.qmd`), predating
the `stisim.github.io` migration to a static Eleventy site (hero, model links,
filterable research grid of study cards, per-study pages, build-time frontmatter
validation). HPVsim is a more mature project than STIsim — more publications,
ongoing country deployments, conference presentations, and (as of July 2026) a
released v3.0 built on the Starsim architecture — so this migration carries more
structure than the stisim baseline: research themes, a news feed, a
countries/deployments list, and a funding line.

This spec covers the target design. It does not cover HPVsim v3.0 itself, only
the public site describing the project.

## Goals

- Migrate `hpvsim.github.io` to the same Eleventy architecture as
  `stisim.github.io`: same build tooling, same study-card/collection pattern,
  same validation-at-build-time discipline, same visual system (reuse
  `public/site.css`, `public/site.js`, `src/includes/base.njk` etc. as a
  starting point, adapted for HPVsim branding).
- Add four "Research themes" as an explanatory/navigational layer above the
  study grid.
- Fold conference presentations into existing studies' `outputs` lists rather
  than inventing a separate content type.
- Add a News section (short, manually-authored, reverse-chronological items).
- Add a Countries/deployments list and a Funding/acknowledgements line.
- Rewrite the "HPVsim versions" section to reflect the real state: v3.0
  released, v2.2 frozen except critical bugfixes. Drop all "beta" language.

## Non-goals

- Redesigning the visual system from scratch — reuse stisim's CSS/JS/includes,
  retheme only where HPVsim-specific (logo, colors if needed, nav links).
- Building a generalized multi-theme filter UI — themes are static intro
  sections with links, not a new filter axis (decided explicitly: adding a
  4th navigation dimension on top of status filters was considered and
  rejected as more complexity than the content currently justifies).
- Sourcing or hosting the actual presentation PDFs as part of this spec — the
  content model is defined here, but dropping the PDF files into
  `public/presentations/` is a follow-up content task, not a structural one.
- A dedicated team/investigators page — not requested.

## Content architecture

### Study collection (`src/research/*.md`)

Same mechanism as stisim: one markdown file per study, `research.11tydata.js`
for defaults, `research-validation.js` for build-time schema checks,
`eleventy.config.js` collection + sort.

Schema, relative to stisim's:

- `status`: `peer-reviewed` | `write-up` | `in-flight` (same three values,
  same meaning — `write-up` is unused today since no HPVsim study is a
  standalone external page the way VMB/STI-NOTIFY are on stisim, but the value
  stays in the enum for consistency and in case one shows up later).
- `pathogens` field is dropped — HPVsim is single-pathogen, this field only
  makes sense in stisim's multi-STI context.
- `themes` (existing stisim field, free-text tags like "Point-of-care
  testing") is kept, shown on the study detail page as before.
- **New** `researchThemes: [slug, ...]`: references 1+ of the 4 fixed research
  theme slugs (below). Distinct from `themes` — `themes` is free-text display
  tags, `researchThemes` drives which homepage theme section a study is
  listed under. A study may belong to more than one theme.
- `outputs[].kind` gains `poster` alongside stisim's
  `paper | slides | code | dataset | other`.
- Forthcoming (accepted/in-press, not yet public) papers: `status: in-flight`,
  with an `outputs` entry of `kind: paper`, a `label` ending in "(forthcoming)",
  and no `href` — already legal today, since stisim's validator only checks
  `href` when it's present. When the paper is actually published, flip
  `status` to `peer-reviewed` and add the `href`.

### Research themes (`src/_data/researchThemes.js`)

A small static data file, not a content collection — four entries, each
`{ slug, name, blurb }`, in display order:

1. `vaccination-access` — **Extending vaccination access** — covers extending
   the vaccination age window (older-age catch-up / "HPVfaster"), infant
   vaccination, and single-dose schedules.
2. `screening-treatment` — **Optimizing screening and treatment** — covers
   test-and-vaccinate/screen-and-treat strategies (Rwanda, forthcoming England
   work).
3. `hiv` — **HPV in women living with HIV** — covers modeling the interaction
   between HIV/ART and cervical cancer burden (Zambia).
4. `modeling-calibration` — **Modeling technology and calibration** — covers
   the core HPVsim methods paper, calibration methodology, and general
   dissemination talks about the tool itself.

On the homepage, each theme renders its blurb followed by a short linked list
of the studies whose `researchThemes` includes that slug (link target = same
href logic already used for the card: `dashboardUrl` if present, else the
study's own page). No new filter chip, no JS changes — this is server-rendered
list, computed with a Nunjucks filter over `collections.studies`.

### Presentations

Not a separate content type or page. Each talk/poster becomes one entry in
the relevant study's `outputs` array (`kind: slides` or `kind: poster`,
`href` pointing at the PDF once hosted). One presentation has no matching
paper yet (the older-cohorts/transmission-blocking IPVS 2025 talk) — it
becomes the sole output on a new in-flight card (see inventory below).

PDF files: hosted in-repo under `public/presentations/`, one file per talk,
copied to the site root via the existing `addPassthroughCopy({ public: '.' })`
mechanism (same as stisim's logo/favicon handling). Actual PDF files are out
of scope for this spec (see Non-goals) — the `outputs[].href` values will
point at `/presentations/<slug>.pdf` paths that need real files dropped in
before merge, or can ship without `href` (chip renders as plain text, not a
link) until the files exist.

### News (`src/news/*.md`)

New collection, parallel to `src/research/`:

- `title` (string, required)
- `date` (date, required) — drives sort order (newest first) and display
- `blurb` (string, required) — one to two sentences
- `href` (string, optional) — link out (DOI, PDF, external article)
- `kind` (optional, one of `release | paper | press | talk | funding`) — purely
  cosmetic, e.g. a small label/icon; defaults to `other` styling if omitted
- `draft` (boolean, default false) — same drop-from-build convention as
  studies

Rendered as a plain reverse-chronological list (title, date, blurb, optional
"Read more ↗" link) in its own homepage section. No filtering, no pagination —
nine items today, revisit if it grows past ~30.

### Countries/deployments

A static list (data file or inline in `index.njk`, whichever is less
boilerplate for 3 items) of countries where HPVsim has been applied in a
published or forthcoming paper: **Tunisia, Zambia, Nigeria**. Each entry links
to its corresponding study card. Countries with active modeling work but no
paper yet (Rwanda; South Africa and Tanzania via the Quantium Health grant)
are intentionally excluded until they have an output — revisit this list
whenever a new study card is added.

### Funding/acknowledgements

One line crediting the Gates Foundation as funder, in the same tone/placement
as stisim's existing footer legal links — not a new page, just a sentence in
the footer or an "At a glance" style block.

### Version language

Replace the current "HPVsim versions" section (which describes v3.0 as
"mid-2025... beta") with: v3.0 released July 2026, built on the Starsim
architecture; v2.2 (the pre-Starsim line) is frozen aside from critical
bugfixes. The navbar/hero's two equal-weight "Code: v2.2" / "Code: v3.0
(beta)" buttons collapse into one primary "Code" link (→ `starsimhub/hpvsim`,
v3) plus a smaller secondary "Legacy v2.2" link (→ `starsimhub/hpvsim_orig`).

## Content inventory

Study cards (`*` = new card, no existing write-up to draw from — placeholder
copy needed, flagged for the user to correct before publishing):

| Card | Status | Theme(s) | Outputs |
|---|---|---|---|
| HPVsim methods (PLOS Comp Biol 2024) | peer-reviewed | modeling-calibration | paper; EUROGIN 2023 talk (slides); EUROGIN 2024 talk (slides) |
| Single-dose vaccination (Vaccine 2026) | peer-reviewed | vaccination-access | paper |
| Pruning & calibration (JTB 2025) | peer-reviewed | modeling-calibration | paper |
| Tunisia screening & vaccination (Sci Rep 2025) | peer-reviewed | vaccination-access, screening-treatment | paper |
| Global cancer-registry calibration (Sci Rep 2024) | peer-reviewed | modeling-calibration | paper; EPIDEMICS9 poster; IDM Symposium 2024 talk (slides) |
| Zambia: HIV/ART and cervical cancer burden (forthcoming, Nat Sci Rep) | in-flight | hiv | paper (forthcoming, no href) |
| Nigeria: infant HPV vaccination (forthcoming) | in-flight | vaccination-access | paper (forthcoming, no href); IPVS 2025 talk (slides) |
| *Extending vaccination to older cohorts ("HPVfaster") | in-flight | vaccination-access | IPVS 2025 talk (slides) only |
| *Rwanda: test-and-vaccinate | in-flight | screening-treatment | none yet |
| *England screening/treatment work | in-flight | screening-treatment | none yet |

News items (reverse-chronological):

| Date | Item | kind |
|---|---|---|
| 2026-07-24 | HPVsim v3.0 released | release |
| 2026-02-23 | New Yorker covers single-dose HPV vaccination work, citing our analysis | press |
| 2025-10-23 | Two talks at IPVS 2025, Bangkok (older-cohorts vaccination; Nigeria infant vaccination) | talk |
| 2024-10-01 | Talk at IDM Annual Symposium 2024, Seattle | talk |
| 2024-07-29 | Quantium Health receives multi-year Gates funding to apply HPVsim in South Africa, Tanzania, Nigeria | funding |
| 2024-03-13 | Talk at EUROGIN 2024, Stockholm | talk |
| 2023-11-28 | Poster at EPIDEMICS9, Bologna | talk |
| 2023-02-08 | Talk at EUROGIN 2023, Bilbao | talk |

Countries: Tunisia, Zambia, Nigeria (see rule above; Rwanda/South
Africa/Tanzania excluded pending a paper).

## Open items for the user (not blocking the implementation plan, but need
resolving before merge)

1. Lead/blurb/findings text for the three new placeholder cards (HPVfaster,
   Rwanda TxV, England work) — draft copy will be written but flagged
   inline for correction.
2. Actual presentation PDF files to drop into `public/presentations/`.
3. Exact citation details (authors, journal, DOI once assigned) for the two
   forthcoming papers, beyond the titles already given.
4. Confirm whether the New Yorker news item should also link from the
   single-dose paper's card (as an extra `outputs` entry, kind `other`) or
   stay solely in the News feed — current design keeps it News-only, but this
   is a small either-way decision.

## Testing

Same discipline as stisim: `npm run build` must succeed (frontmatter
validation runs at build time and fails the build on any inconsistency, e.g.
a `write-up` status without `dashboardUrl`, or a `researchThemes` slug that
doesn't match one of the four defined themes — this last check is new
validation to add). Spot-check rendered HTML for card `data-filter`, output
chips, and the new theme/news/countries sections, same way the stisim PR was
verified.

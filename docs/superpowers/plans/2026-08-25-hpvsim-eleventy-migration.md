# HPVsim Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `hpvsim.github.io` from its current single-page Quarto site to
the same Eleventy architecture as `stisim.github.io`, adding research themes,
a news feed, countries/deployments, and folding conference presentations into
existing study cards.

**Architecture:** Port stisim.github.io's Eleventy setup (collections,
frontmatter validation, includes, CSS/JS) file-for-file where it applies
unchanged, adapt where HPVsim's content model differs (no `pathogens` field,
adds `researchThemes`), and layer three new pieces on top: a `researchThemes`
static data file driving homepage intro sections, a `src/news/*.md`
collection, and small Countries/Funding additions.

**Tech Stack:** Eleventy 3.x (`@11ty/eleventy`), Nunjucks templates, plain CSS
(no framework), vanilla JS (theme toggle + client-side filter), GitHub Actions
→ GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-25-hpvsim-site-redesign-design.md`
(this plan implements it; read both — the spec has the full rationale behind
each decision, this plan has the exact files and content).

## Global Constraints

- `STATUSES` (study frontmatter): `peer-reviewed` | `write-up` | `in-flight`.
- `OUTPUT_KINDS`: `paper` | `slides` | `poster` | `code` | `dataset` | `other`.
- `status: write-up` and `dashboardUrl` must always both be present, or both
  absent — enforced at build time (no HPVsim study uses this today, but the
  rule ports over from stisim for consistency and future use).
- `researchThemes` (new field, distinct from the existing free-text `themes`
  tags): a non-empty array, every entry one of the four fixed slugs
  `vaccination-access`, `screening-treatment`, `hiv`, `modeling-calibration`.
- No `pathogens` field — HPVsim is single-pathogen; this field and its CSS
  (per-pathogen tag colors, the `.spectrum` bar, the `pathogenTag` macro) are
  dropped, not ported.
- Presentation PDFs live at `public/presentations/*.pdf` and are referenced
  from `outputs[].href` on the study they belong to — never a standalone
  "Presentations" page or collection.
- Countries list is strictly output-anchored: Tunisia, Zambia, Nigeria only
  (each has a published or forthcoming paper). Do not add Rwanda, South
  Africa, or Tanzania even though those have active HPVsim work — they don't
  have a paper yet.
- Any study card whose lead/findings text is drafted rather than sourced from
  a real paper/poster/abstract must say so visibly in the content itself
  (`DRAFT — please review and correct.` prefix) — never silently invent
  scientific claims.
- `npm run build` is the test suite for this project (no unit-test framework
  exists in either sister repo) — frontmatter validation runs at build time
  and must fail loudly on any malformed entry. Every task ends with a build
  and a grep/inspection of the generated `_site/index.html`.

---

## Task 1: Bootstrap the Eleventy skeleton and retire the Quarto site

**Files:**
- Create: `package.json`, `eleventy.config.js`, `.github/workflows/publish.yml`
- Modify: `.gitignore`
- Delete: `_quarto.yml`, `index.qmd`, `styles.css`, `starsim-logo-dark.png`, `_site/` (build output), `.quarto/` (cache), `CNAME` (moves to `public/CNAME` in Task 2)

**Interfaces:**
- Produces: `npm run build` / `npm run dev` / `npm run serve` scripts that every later task relies on to verify its work.

- [ ] **Step 1: Remove the Quarto site and its build artifacts**

```bash
git rm -r --cached _quarto.yml index.qmd styles.css starsim-logo-dark.png _site CNAME
rm -rf _quarto.yml index.qmd styles.css starsim-logo-dark.png _site .quarto CNAME
```

(`CNAME` is deleted here, not in Task 2 — it's replaced by `public/CNAME` in
Task 2 Step 2, but there's no reason to keep the stale root copy around
in between.)

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "hpvsim-site",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "eleventy --serve",
    "build": "eleventy",
    "serve": "npx --yes http-server _site -p 8081"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.1.0"
  }
}
```

- [ ] **Step 3: Write `eleventy.config.js`**

```js
import { validateStudies } from './src/research/research-validation.js';
import { validateNews } from './src/news/news-validation.js';

const statusRank = { 'peer-reviewed': 0, 'write-up': 1, 'in-flight': 2 };

const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  {%- for page in collections.all %}
  {%- if page.url %}
  <url>
    <loc>{{ site.url }}{{ page.url | url }}</loc>
  </url>
  {%- endif %}
  {%- endfor %}
</urlset>
`;

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ public: '.' });

  // Site metadata, available to every template as `site`
  eleventyConfig.addGlobalData('site', {
    title: 'HPVsim',
    description:
      'Agent-based modeling of HPV transmission and progression to cervical disease, built on Starsim.',
    url: process.env.SITE_URL || 'https://hpvsim.org',
  });

  eleventyConfig.addTemplate('sitemap.njk', sitemap, {
    permalink: '/sitemap.xml',
    eleventyExcludeFromCollections: true,
  });

  // Studies, validated at build time: a malformed entry fails the build
  // instead of shipping broken. Ordering is peer-reviewed, then write-up,
  // then in-flight, and by `order` within each group.
  eleventyConfig.addCollection('studies', (collectionApi) => {
    const studies = collectionApi
      .getFilteredByTag('study')
      .filter((item) => !item.data.draft);
    validateStudies(studies);
    return studies.sort(
      (a, b) =>
        statusRank[a.data.status] - statusRank[b.data.status] ||
        a.data.order - b.data.order
    );
  });

  // News, validated at build time, newest first.
  eleventyConfig.addCollection('news', (collectionApi) => {
    const items = collectionApi
      .getFilteredByTag('news')
      .filter((item) => !item.data.draft);
    validateNews(items);
    return items.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
  });

  eleventyConfig.addFilter('findStudy', (studies, slug) =>
    studies.find((s) => s.data.slug === slug)
  );

  eleventyConfig.addFilter('byTheme', (studies, slug) =>
    studies.filter((s) => (s.data.researchThemes || []).includes(slug))
  );

  eleventyConfig.addFilter('countPapers', (outputs) =>
    (outputs || []).filter((o) => (o.kind || 'other') === 'paper').length
  );

  eleventyConfig.addFilter('isoDate', (value) =>
    new Date(value).toISOString().slice(0, 10)
  );

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: 'includes',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}
```

This references `src/research/research-validation.js` and
`src/news/news-validation.js`, which don't exist yet — that's fine, they're
created in Tasks 3 and 8 respectively. The build will fail until then; that
failure is expected and gets resolved task-by-task, not in this one.

- [ ] **Step 4: Write `.github/workflows/publish.yml`**

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm install --no-audit --no-fund
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: ./_site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 5: Rewrite `.gitignore`**

```
node_modules
_site
.cache
package-lock.json
.worktrees/
```

(Drops the Quarto-specific `/.quarto/` and `**/*.quarto_ipynb` entries — no
longer relevant once Quarto is gone — but keeps `.worktrees/`, which has
nothing to do with Quarto: it's how isolated implementation branches like
this one avoid getting swept up by a stray `git add -A` from the main
checkout, and this file is the one that ends up on `main` once this branch
merges.)

- [ ] **Step 6: Install dependencies and confirm the build fails for the expected reason**

```bash
npm install
npm run build
```

Expected: fails with a module-not-found error on
`./src/research/research-validation.js` (or similar) — confirming the config
loads and only the not-yet-created modules are missing. If it fails for any
other reason, stop and fix that first.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Bootstrap Eleventy skeleton, retire Quarto site"
```

---

## Task 2: Port shared includes, styles, and client JS

**Files:**
- Create: `src/includes/base.njk`, `src/includes/header.njk`, `src/includes/footer.njk`, `src/includes/components.njk`, `src/includes/study.njk`
- Create: `public/site.css`, `public/site.js`, `public/robots.txt`, `public/CNAME`
- Copy: `public/favicon.ico`, `public/starsim-mark-light.png`, `public/starsim-mark-dark.png` (from `stisim.github.io/public/`)
- Create (stub, filled in Task 3): `src/index.njk`

**Interfaces:**
- Produces: `statusPill(status)`, `studyHref(study)`, `themeTag(name)` Nunjucks macros in `components.njk`, consumed by `study.njk` (this task) and `index.njk` (Tasks 3, 4, 7, 8, 9).
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Copy the ecosystem-wide brand assets verbatim**

These are Starsim-ecosystem marks, not stisim-specific, so they carry over
unchanged:

```bash
cd /Users/robynstuart/gf/hpvsim.github.io
mkdir -p public
cp /Users/robynstuart/gf/stisim.github.io/public/favicon.ico public/favicon.ico
cp /Users/robynstuart/gf/stisim.github.io/public/starsim-mark-light.png public/starsim-mark-light.png
cp /Users/robynstuart/gf/stisim.github.io/public/starsim-mark-dark.png public/starsim-mark-dark.png
```

- [ ] **Step 2: Write `public/CNAME` and `public/robots.txt`**

```
hpvsim.org
```
(→ `public/CNAME`; the old repo-root `CNAME` was already deleted in Task 1
Step 1, alongside the other Quarto artifacts)

```
User-agent: *
Allow: /

Sitemap: https://hpvsim.org/sitemap.xml
```
(→ `public/robots.txt`)

- [ ] **Step 3: Write `src/includes/base.njk`**

```njk
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{% if title %}{{ title }} · {{ site.title }}{% else %}{{ site.title }}{% endif %}</title>
  <meta name="description" content="{{ description or site.description }}" />
  <link rel="icon" href="{{ '/favicon.ico' | url }}" sizes="any" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="{{ '/site.css' | url }}" />
  <script>
    // Inline and first, so a saved theme applies before the page paints.
    (function () {
      var saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.dataset.theme = saved;
      }
    })();
  </script>
</head>
<body>
  {% include "header.njk" %}
  <main>
    {{ content | safe }}
  </main>
  {% include "footer.njk" %}
  <script src="{{ '/site.js' | url }}" defer></script>
</body>
</html>
```

(Identical to stisim's — no HPVsim-specific text in this file.)

- [ ] **Step 4: Write `src/includes/header.njk`**

```njk
<header class="top">
  <div class="wrap bar">
    <a class="brand" href="{{ '/' | url }}">
      <img class="mark mark-light" src="{{ '/starsim-mark-light.png' | url }}" alt="Starsim" width="28" height="28" />
      <img class="mark mark-dark" src="{{ '/starsim-mark-dark.png' | url }}" alt="Starsim" width="28" height="28" />
      <span class="name">HPVsim</span>
    </a>
    <nav class="nav">
      <a href="{{ '/' | url }}#model">Model</a>
      <a href="{{ '/' | url }}#research">Research</a>
      <a href="https://docs.hpvsim.org" target="_blank" rel="noopener">Docs ↗</a>
      <a href="https://github.com/starsimhub/hpvsim" target="_blank" rel="noopener">GitHub ↗</a>
      <button class="theme-toggle" type="button" aria-label="Toggle dark mode">
        <svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>
        <svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>
      </button>
    </nav>
  </div>
</header>
```

- [ ] **Step 5: Write `src/includes/footer.njk`**

Adds the funding line (spec requirement) alongside the existing copyright
line, same tone/placement:

```njk
<footer class="site-footer">
  <div class="wrap grid">
    <div class="col brandcol">
      <img class="mark mark-light" src="{{ '/starsim-mark-light.png' | url }}" alt="Starsim" width="30" height="30" />
      <img class="mark mark-dark" src="{{ '/starsim-mark-dark.png' | url }}" alt="Starsim" width="30" height="30" />
      <p class="legal">HPVsim development is supported by the Bill &amp; Melinda Gates Foundation.<br />
        © 2022–2026, Gates Foundation. All rights reserved.<br />
        <a href="https://www.gatesfoundation.org/Privacy-and-Cookies-Notice" target="_blank" rel="noopener">Privacy and Cookies Notice</a>
        <span aria-hidden="true">|</span>
        <a href="https://www.gatesfoundation.org/Terms-of-Use" target="_blank" rel="noopener">Terms of Use</a></p>
    </div>
    <div class="col">
      <span class="h">Community</span>
      <a href="https://github.com/starsimhub/hpvsim/discussions" target="_blank" rel="noopener">GitHub Discussions ↗</a>
      <a href="https://starsimhub.slack.com/" target="_blank" rel="noopener">Slack ↗</a>
      <a href="https://github.com/starsimhub/hpvsim/issues/new" target="_blank" rel="noopener">Open an issue ↗</a>
    </div>
    <div class="col">
      <span class="h">Project</span>
      <a href="https://starsim.org" target="_blank" rel="noopener">starsim.org ↗</a>
      <a href="https://docs.hpvsim.org" target="_blank" rel="noopener">Docs ↗</a>
      <a href="mailto:info@hpvsim.org">Contact</a>
    </div>
  </div>
</footer>
```

- [ ] **Step 6: Write `src/includes/components.njk`**

Ports stisim's `statusPill` and `studyCard` macros unchanged in structure,
but drops `pathogenTag`/`spectrum` (no `pathogens` field) in favor of a
generic `themeTag` for the existing free-text `themes` tags, and adds a
`studyHref` helper (needed later by the Research-themes and Countries
sections in Tasks 7 and 9, so they compute a study's link target the same way
the card does, in one place):

```njk
{#
  Shared UI pieces. Everything here is presentational: the caller passes data,
  the macro decides nothing that isn't derivable from it.
#}

{% macro statusPill(status) %}
{% set labels = { 'peer-reviewed': 'Peer-reviewed', 'in-flight': 'In flight', 'write-up': 'Write-up' } %}
{% set classes = { 'peer-reviewed': 'ok', 'in-flight': 'fly', 'write-up': 'pub' } %}
<span class="pill {{ classes[status] }}">{{ labels[status] }}</span>
{% endmacro %}

{% macro themeTag(name) %}
<span class="tag">{{ name }}</span>
{% endmacro %}

{#
  A study's link target: its own dashboardUrl if it has one (external page,
  no page of its own), otherwise its own study page.
#}
{% macro studyHref(study) %}{{ study.data.dashboardUrl if study.data.dashboardUrl else (study.url | url) }}{% endmacro %}

{% macro studyCard(study) %}
{% set d = study.data %}
{% set isDash = d.dashboardUrl %}
{% set papers = d.outputs | countPapers %}
<a class="card" href="{{ studyHref(study) }}"
   data-filter="{{ d.status }}{{ ' publications' if d.status != 'in-flight' }}"
   {% if isDash %}target="_blank" rel="noopener"{% endif %}>
  <div class="row">
    <span class="code">{{ d.code }}</span>
    {{ statusPill(d.status) }}
  </div>
  <h3 style="view-transition-name: t-{{ d.slug }}">{{ d.title }}</h3>
  <p class="blurb">{{ d.lead }}</p>
  <div class="tags">{% for t in d.themes %}{{ themeTag(t) }}{% endfor %}</div>
  <div class="foot">
    {% if isDash %}
      <span class="act accent">View page <i>↗</i></span>
    {% else %}
      <span class="act">Read writeup <i>→</i></span>
      {% if papers %}<span class="papers">{{ papers }} {{ 'paper' if papers == 1 else 'papers' }}</span>{% endif %}
    {% endif %}
  </div>
</a>
{% endmacro %}
```

- [ ] **Step 7: Write `src/includes/study.njk`**

Same as stisim's, minus the `pathogens` row (dropped field) and with the
status check updated to the new `peer-reviewed` value:

```njk
---
layout: base.njk
---
{% from "components.njk" import themeTag, statusPill %}
{% set findingsLabel = "Key findings" if status == "peer-reviewed" else "What we're tracking" %}

<article class="paper">
  <div class="wrap">
    <a class="back" href="{{ '/' | url }}#research">← All research</a>
    <p class="code">{{ code }} · {{ statusPill(status) }}</p>
    <h1 style="view-transition-name: t-{{ slug }}">{{ title }}</h1>
    <p class="lead">{{ lead }}</p>

    {% if findings.length %}
    <section class="block">
      <h2>{{ findingsLabel }}</h2>
      <ul>{% for f in findings %}<li>{{ f }}</li>{% endfor %}</ul>
    </section>
    {% endif %}

    {% if content %}<div class="body">{{ content | safe }}</div>{% endif %}

    {% if outputs.length %}
    <section class="block">
      <h2>Outputs</h2>
      <div class="chips">
        {% for o in outputs %}
          {% if o.href %}
            <a class="chip" href="{{ o.href | url }}" target="_blank" rel="noopener">{{ o.label }} ↗</a>
          {% else %}
            <span class="chip">{{ o.label }}</span>
          {% endif %}
        {% endfor %}
      </div>
    </section>
    {% endif %}

    <section class="block">
      <h2>At a glance</h2>
      <dl class="kv">
        {% if themes.length %}<dt>Themes</dt><dd class="tags">{% for t in themes %}{{ themeTag(t) }}{% endfor %}</dd>{% endif %}
        {% if setting %}<dt>Setting</dt><dd>{{ setting }}</dd>{% endif %}
      </dl>
    </section>

    {% if related.length %}
    <section class="block">
      <h2>Related study</h2>
      {% for relSlug in related %}
        {% set r = collections.studies | findStudy(relSlug) %}
        {% if r and r.url %}
        <a class="rel" href="{{ r.url | url }}">
          <span class="rc">{{ r.data.code }}</span>{{ r.data.title }}
        </a>
        {% endif %}
      {% endfor %}
    </section>
    {% endif %}
  </div>
</article>
```

- [ ] **Step 8: Write `public/site.js`**

Identical to stisim's current version (multi-value filter matching):

```js
// The only client-side JavaScript on the site: the theme toggle and the
// research filter.

document.addEventListener('click', function (e) {
  var btn = e.target.closest('.theme-toggle');
  if (!btn) return;
  var root = document.documentElement;
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var current = root.dataset.theme || (systemDark ? 'dark' : 'light');
  var next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});

var chips = document.querySelectorAll('#research .chip');
var cards = document.querySelectorAll('#research .card');
chips.forEach(function (chip) {
  chip.addEventListener('click', function () {
    chips.forEach(function (c) {
      c.classList.toggle('on', c === chip);
    });
    var f = chip.dataset.f;
    cards.forEach(function (card) {
      var filters = card.dataset.filter.split(' ');
      card.style.display = f === 'all' || filters.indexOf(f) !== -1 ? 'flex' : 'none';
    });
  });
});
```

- [ ] **Step 9: Write `public/site.css`**

Port stisim's `public/site.css` verbatim, with two removals (no `pathogens`
field means no per-pathogen coloring) and one addition (a neutral `.tag`
color, since `themeTag` needs a color and previously only `pathogenTag` had
one):

Remove the pathogen color variables from all three `:root` blocks (base,
`@media (prefers-color-scheme: dark)`, and `:root[data-theme="dark"]`) — the
lines matching:

```css
  --ng: #0f8f6a;  --ng-bg: #e1f5ee;  --ng-tx: #085041;
  --ct: #5f8f1c;  --ct-bg: #eaf3de;  --ct-tx: #27500a;
  --tv: #6b5cc4;  --tv-bg: #eeedfe;  --tv-tx: #3c3489;
  --syph:#c0563e; --syph-bg:#faece7; --syph-tx:#712b13;
  --hiv: #2f6fb0; --hiv-bg: #e6f1fb; --hiv-tx: #0c447c;
  --bv:  #b23c6a; --bv-bg:  #fbeaf0; --bv-tx:  #72243e;
```

and the dark-mode equivalents:

```css
    --ng-bg:#0e3630;--ct-bg:#243a12;--tv-bg:#26224a;--syph-bg:#3a1f16;--hiv-bg:#0f2c47;--bv-bg:#3a1626;
    --ng-tx:#7fe0c1;--ct-tx:#bfe08a;--tv-tx:#c3bbf6;--syph-tx:#f0b5a4;--hiv-tx:#a7cef2;--bv-tx:#f0a9c6;
```

(appears twice — once in the `@media` block, once in `:root[data-theme="dark"]`).

Remove the `.spectrum` section entirely (the pathogen-mix bar under the hero,
not meaningful for a single-pathogen model):

```css
/* ---------------------------------------------------------------- spectrum */

.spectrum { display: flex; height: 4px; border-radius: 999px; overflow: hidden; }
.spectrum span { flex: 1; }
.spectrum.animate span {
  transform: scaleX(0); transform-origin: left;
  animation: grow .5s cubic-bezier(.4,0,.1,1) forwards;
}
.spectrum.animate span:nth-child(1){ animation-delay:.05s }
.spectrum.animate span:nth-child(2){ animation-delay:.12s }
.spectrum.animate span:nth-child(3){ animation-delay:.19s }
.spectrum.animate span:nth-child(4){ animation-delay:.26s }
.spectrum.animate span:nth-child(5){ animation-delay:.33s }
.spectrum.animate span:nth-child(6){ animation-delay:.40s }
@keyframes grow { to { transform: scaleX(1); } }
```

Change the `.tag` rule to a single neutral color instead of relying on a
per-pathogen `var(--{code}-bg)`/`var(--{code}-tx)` (which no longer exist):

```css
.tag {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .02em;
  padding: 2.5px 7px; border-radius: 6px; font-weight: 500; white-space: nowrap;
  background: var(--surface-2); color: var(--muted); border: 1px solid var(--line-2);
}
```

Everything else in `site.css` (tokens, base, header, `.pill`, hero, `#model`,
`#research`, `.card`, `.paper`, `.site-footer`) carries over unchanged — copy
the rest of stisim's `public/site.css` verbatim. The three new sections added
in Tasks 7-9 (`.themes`, `.news-list`, `.countries`) get their own CSS blocks
appended at the end in those tasks, not here.

- [ ] **Step 10: Write a placeholder `src/index.njk`**

Just enough to make the build succeed and prove the includes wire up; the
real hero/model/research content is written in Task 3.

```njk
---
layout: base.njk
---
<section class="hero">
  <div class="wrap">
    <h1>HPVsim</h1>
  </div>
</section>
```

- [ ] **Step 11: Build and verify includes render**

```bash
npm run build
grep -q "HPVsim" _site/index.html && echo OK
grep -q "site.css" _site/index.html && echo OK
```

Expected: two `OK` lines. The build will still fail overall if
`research-validation.js`/`news-validation.js` don't exist yet and something
tries to import them — check the actual error; if it's still the same
not-found error from Task 1, that's expected and resolved in Task 3.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Port shared includes, styles, and client JS from stisim.github.io"
```

---

## Task 3: Research collection scaffolding and homepage/study templates

**Files:**
- Create: `src/research/research.11tydata.js`, `src/research/research-validation.js`
- Modify: `src/index.njk` (replace placeholder with real hero + model + research sections)

**Interfaces:**
- Consumes: `statusPill`, `studyCard`, `studyHref` macros from `components.njk` (Task 2).
- Produces: `validateStudies(studies)` (consumed by `eleventy.config.js`, already wired in Task 1); the `research` collection's frontmatter contract, consumed by every study file in Tasks 4-6 and by the theme/countries sections in Tasks 7 and 9.

- [ ] **Step 1: Write `src/research/research-validation.js`**

```js
// Frontmatter validation for src/research/*.md. Eleventy has no schema layer,
// so this stands in for one: it runs while the studies collection is built, and
// throwing here fails the build rather than shipping a broken card.

const STATUSES = ['peer-reviewed', 'write-up', 'in-flight'];
const OUTPUT_KINDS = ['paper', 'slides', 'poster', 'code', 'dataset', 'other'];
const RESEARCH_THEMES = [
  'vaccination-access',
  'screening-treatment',
  'hiv',
  'modeling-calibration',
];

const isString = (v) => typeof v === 'string' && v.length > 0;
// Accepts absolute URLs (DOIs, external links) and root-relative paths
// (local assets like /presentations/x.pdf) -- new URL() alone throws on the
// latter, which would wrongly fail every local presentation link.
const isUrl = (v) => {
  if (typeof v === 'string' && v.startsWith('/')) return true;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

export function validateStudies(studies) {
  const slugs = new Set(studies.map((s) => s.data.slug));
  const errors = [];

  for (const study of studies) {
    const d = study.data;
    const where = study.inputPath;
    const fail = (msg) => errors.push(`${where}: ${msg}`);

    if (!isString(d.code)) fail('`code` is required (string)');
    if (!isString(d.title)) fail('`title` is required (string)');
    if (!isString(d.lead)) fail('`lead` is required (string)');
    if (!STATUSES.includes(d.status))
      fail(`\`status\` must be one of ${STATUSES.join(', ')} (got ${d.status})`);
    if (typeof d.order !== 'number') fail('`order` must be a number');
    if (typeof d.featured !== 'boolean') fail('`featured` must be a boolean');
    if (typeof d.draft !== 'boolean') fail('`draft` must be a boolean');

    if (!Array.isArray(d.researchThemes) || d.researchThemes.length === 0) {
      fail('`researchThemes` must be a non-empty array');
    } else {
      for (const t of d.researchThemes) {
        if (!RESEARCH_THEMES.includes(t))
          fail(`unknown research theme \`${t}\` (expected one of ${RESEARCH_THEMES.join(', ')})`);
      }
    }

    for (const key of ['themes', 'findings']) {
      if (!Array.isArray(d[key])) fail(`\`${key}\` must be an array`);
      else if (!d[key].every(isString)) fail(`\`${key}\` must contain strings`);
    }

    if (d.setting !== undefined && !isString(d.setting))
      fail('`setting` must be a string');

    if (!Array.isArray(d.outputs)) {
      fail('`outputs` must be an array');
    } else {
      for (const o of d.outputs) {
        if (!isString(o.label)) fail('every output needs a `label`');
        if (o.href !== undefined && !isUrl(o.href))
          fail(`output href \`${o.href}\` is not a URL`);
        if (o.kind !== undefined && !OUTPUT_KINDS.includes(o.kind))
          fail(`unknown output kind \`${o.kind}\``);
      }
    }

    if (d.dashboardUrl !== undefined && !isUrl(d.dashboardUrl))
      fail(`\`dashboardUrl\` (${d.dashboardUrl}) is not a URL`);
    if (d.status === 'write-up' && d.dashboardUrl === undefined)
      fail('`status: write-up` requires `dashboardUrl` to be set');
    if (d.dashboardUrl !== undefined && d.status !== 'write-up')
      fail('`dashboardUrl` requires `status: write-up`');

    if (!Array.isArray(d.related)) {
      fail('`related` must be an array');
    } else {
      for (const slug of d.related) {
        if (!slugs.has(slug))
          fail(`\`related\` points at \`${slug}\`, which is not a known study`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Invalid study frontmatter:\n  ${errors.join('\n  ')}`);
  }
}
```

- [ ] **Step 2: Write `src/research/research.11tydata.js`**

```js
// Directory data for the studies in this folder. Card and page behaviour is
// derived from `dashboardUrl` and `draft`, never stored: a study with a
// dashboardUrl links straight out to it and gets no page of its own.
export default {
  layout: 'study.njk',
  tags: ['study'],

  // Schema defaults, mirroring what the validator expects.
  order: 0,
  themes: [],
  findings: [],
  outputs: [],
  related: [],
  featured: false,
  draft: false,

  eleventyComputed: {
    slug: (data) => data.page.fileSlug,
    description: (data) => data.lead,
    permalink: (data) =>
      data.draft || data.dashboardUrl
        ? false
        : `/research/${data.page.fileSlug}/`,
  },
};
```

- [ ] **Step 3: Try to build — confirm it now fails only on the missing news module**

```bash
npm run build
```

Expected: fails on `./src/news/news-validation.js` not found (Task 8 creates
it). If it fails for any other reason (e.g. a typo in the files just
written), fix that first — don't move on with an unexplained failure.

- [ ] **Step 4: Temporarily stub the news module so later steps in this task can verify studies work in isolation**

This stub is deleted in Task 8 once the real news collection exists — it
exists only so this task's own build check isn't blocked by a completely
separate collection.

```bash
mkdir -p src/news
cat > src/news/news-validation.js <<'EOF'
export function validateNews() {}
EOF
```

- [ ] **Step 5: Replace `src/index.njk` with the full homepage skeleton (hero + model, research grid empty for now)**

Research themes, countries, and news sections are added in Tasks 7, 9, and 8
respectively — this step only lays down the hero, model links, and the
filterable grid shell (no study cards exist yet, that's Tasks 4-6).

```njk
---
layout: base.njk
modelLinks:
  - [Docs, 'https://docs.hpvsim.org']
  - [Tutorials, 'https://docs.hpvsim.org/tutorials']
  - [Code, 'https://github.com/starsimhub/hpvsim']
  - [Legacy v2.2, 'https://github.com/starsimhub/hpvsim_orig']
filters:
  - [all, All]
  - [in-flight, In flight]
  - [peer-reviewed, Peer-reviewed]
  - [publications, Publications]
---
{% from "components.njk" import studyCard %}

<section id="model" class="hero">
  <div class="wrap">
    <p class="eyebrow">Agent-based HPV + cervical disease modeling · Built on Starsim</p>
    <h1>HPVsim</h1>
    <p class="lede">
HPVsim is an agent-based model of HPV transmission and progression through cervical disease to cancer. It supports country-specific vital dynamics, structured sexual networks, co-transmitting HPV genotypes, B- and T-cell mediated immunity, and high-resolution disease natural history, plus built-in tools for vaccination, screening, and treatment interventions. It is implemented in pure Python, extensively tested and documented, and runs in seconds to minutes on a laptop.
    </p>
    <p class="versions">
      <strong>v3.0</strong> (released July 2026) is built on the
      <a href="https://starsim.org" target="_blank" rel="noopener">Starsim</a>
      architecture and is the actively developed line. The pre-Starsim
      <strong>v2.2</strong> release is frozen aside from critical bugfixes.
    </p>
    <div class="installs">
      <div class="inst">
        <span class="lbl">Installation</span>
        <code>pip install hpvsim</code>
      </div>
    </div>
    <div class="links">
      {% for link in modelLinks %}
      <a href="{{ link[1] }}" target="_blank" rel="noopener">{{ link[0] }} <i>↗</i></a>
      {% endfor %}
    </div>
  </div>
</section>

<section id="research" class="sec">
  <div class="wrap">
    <p class="kicker">Research</p>
    <p class="sub">What has been done with the model, and what is under way.</p>
    <div class="chips" role="tablist">
      {% for f in filters %}
      <button class="chip{{ ' on' if loop.first }}" data-f="{{ f[0] }}">{{ f[1] }}</button>
      {% endfor %}
    </div>
    <div class="grid">
      {% for study in collections.studies %}{{ studyCard(study) }}{% endfor %}
    </div>
  </div>
</section>
```

- [ ] **Step 6: Build and verify the shell renders with zero studies**

```bash
npm run build
grep -q "HPVsim is an agent-based model" _site/index.html && echo OK
grep -q "pip install hpvsim" _site/index.html && echo OK
grep -c 'class="card"' _site/index.html
```

Expected: two `OK` lines, and the card count is `0` (no study files exist
yet — that's correct at this point).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add research collection scaffolding and homepage/study templates"
```

---

## Task 4: Add the five existing peer-reviewed study cards

**Files:**
- Create: `src/research/hpvsim-methods.md`, `src/research/single-dose-vaccination.md`, `src/research/pruning-calibration.md`, `src/research/tunisia-screening-vaccination.md`, `src/research/global-cancer-registry-calibration.md`

**Interfaces:**
- Consumes: the schema from Task 3's `research.11tydata.js`/`research-validation.js`.
- Produces: slugs `hpvsim-methods`, `single-dose-vaccination`,
  `pruning-calibration`, `tunisia-screening-vaccination`,
  `global-cancer-registry-calibration` — referenced by `related:` fields in
  Tasks 4-6 and by `outputs[].href` presentation links wired in Task 6.

Two of these five (`pruning-calibration`, `tunisia-screening-vaccination`)
have `lead`/`findings` text drafted from the paper's title alone, not the
full text — flagged inline below and in this task's final step. The other
three are grounded in the actual poster/paper content reviewed while writing
this plan.

- [ ] **Step 1: Write `src/research/hpvsim-methods.md`**

```markdown
---
code: HPVSIM
title: "HPVsim: an agent-based model of HPV and cervical disease"
status: peer-reviewed
order: 0
lead: >-
  The core methods paper describing HPVsim's agent-based model of HPV
  transmission, natural history, and progression to cervical disease, and the
  open-source software that implements it.
researchThemes: [modeling-calibration]
themes: [Model methods, Open-source software, Natural history]
setting: Cross-cutting / methods
findings:
  - >-
    Decouples the natural-history model from any single screening or
    classification system, modeling disease progression as a continuous
    process instead.
  - >-
    Array-based computation, parallelization, and a multi-scale modeling
    approach keep runtime under 10 seconds per country on a laptop.
  - >-
    Calibrated to cervical cancer age distributions in the 30 most populous
    Sub-Saharan African countries.
outputs:
  - label: Stuart et al. 2024 · PLOS Computational Biology
    href: https://doi.org/10.1371/journal.pcbi.1012181
    kind: paper
related:
  - global-cancer-registry-calibration
---
```

- [ ] **Step 2: Write `src/research/single-dose-vaccination.md`**

```markdown
---
code: SINGLE-DOSE
title: The role of single-dose HPV vaccination in expanding access
status: peer-reviewed
order: 1
lead: >-
  Sixteen country-specific HPVsim models quantify how much single-dose HPV
  vaccination schedules — endorsed by WHO in 2022 — have already expanded
  access across Gavi-supported countries facing vaccine supply constraints.
researchThemes: [vaccination-access]
themes: [Single-dose vaccination, GAVI, Supply constraints, LMIC]
setting: 16 Gavi-supported countries
findings:
  - >-
    Single-dose adoption reached an estimated 18.5 million additional girls
    across 16 Gavi-supported countries by the end of 2024.
  - >-
    Projected to prevent at least 297,000 future cervical cancers, using a
    conservative two-dose counterfactual.
  - >-
    Number needed to vaccinate per cancer case prevented: around 63, in line
    with previously published estimates.
outputs:
  - label: Stuart et al. 2026 · Vaccine
    href: https://doi.org/10.1016/j.vaccine.2025.128187
    kind: paper
---
```

- [ ] **Step 3: Write `src/research/pruning-calibration.md`**

```markdown
---
code: PRUNING-CALIB
title: Can pruning improve calibration for agent-based models?
status: peer-reviewed
order: 2
lead: >-
  Tests whether pruning — discarding unpromising parameter sets partway
  through a calibration run — can speed up HPVsim calibration without
  degrading fit quality. (Lead drafted from the paper's title only —
  please check against the full text before publishing.)
researchThemes: [modeling-calibration]
themes: [Calibration methods]
setting: Cross-cutting / methods
findings:
  - >-
    Placeholder — replace with the paper's actual results before publishing;
    not yet drafted from the full text.
outputs:
  - label: Sturman et al. 2025 · Journal of Theoretical Biology
    href: https://doi.org/10.1016/j.jtbi.2025.112130
    kind: paper
---
```

- [ ] **Step 4: Write `src/research/tunisia-screening-vaccination.md`**

```markdown
---
code: TUNISIA
title: HPV DNA screening and vaccination strategies in Tunisia
status: peer-reviewed
order: 3
lead: >-
  Models HPV DNA-based cervical screening alongside vaccination strategies to
  inform Tunisia's national cervical cancer prevention program. (Lead drafted
  from the paper's title only — please check against the full text before
  publishing.)
researchThemes: [vaccination-access, screening-treatment]
themes: [Screening, HPV DNA testing]
setting: Tunisia
findings:
  - >-
    Placeholder — replace with the paper's actual results before publishing;
    not yet drafted from the full text.
outputs:
  - label: Lahdhiri et al. 2025 · Scientific Reports
    href: https://doi.org/10.1038/s41598-025-13423-3
    kind: paper
---
```

- [ ] **Step 5: Write `src/research/global-cancer-registry-calibration.md`**

```markdown
---
code: REGISTRY-CALIB
title: Inferring HPV natural history from global cancer registries
status: peer-reviewed
order: 4
lead: >-
  A 30-country calibration exercise across Sub-Saharan Africa asking whether
  the observed differences in cervical cancer age distributions can be
  explained without varying HPV natural-history parameters.
researchThemes: [modeling-calibration]
themes: [Calibration methods, Natural history]
setting: 30 countries, Sub-Saharan Africa
findings:
  - >-
    A single shared natural-history parameter set cannot fit all 30
    countries' cervical cancer age distributions.
  - >-
    Adding one per-country "immunocompromise" parameter, calibrated
    separately, achieves a good fit across all 30 countries.
  - >-
    Derives multi-country estimates of HPV clearance and cancer probabilities
    over time from the calibrated models.
outputs:
  - label: Stuart et al. 2024 · Scientific Reports
    href: https://doi.org/10.1038/s41598-024-65842-3
    kind: paper
related:
  - hpvsim-methods
---
```

- [ ] **Step 6: Build and verify all five cards render correctly**

```bash
npm run build
grep -c 'class="card"' _site/index.html
grep -A2 'HPVSIM<' _site/index.html
grep -A2 'REGISTRY-CALIB<' _site/index.html
ls _site/research/
```

Expected: card count is `5`; both grepped cards show a `pill ok`
("Peer-reviewed") status; `_site/research/` contains a directory per slug
(`hpvsim-methods/`, `single-dose-vaccination/`, `pruning-calibration/`,
`tunisia-screening-vaccination/`, `global-cancer-registry-calibration/`) each
with an `index.html`.

- [ ] **Step 7: Commit, flagging the two draft-content cards**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add five existing peer-reviewed study cards

pruning-calibration.md and tunisia-screening-vaccination.md have
lead/findings text drafted from the paper title alone (no full-text access
during migration) -- flagged inline, needs review before publishing.
EOF
)"
```

---

## Task 5: Add the three new in-flight placeholder study cards

**Files:**
- Create: `src/research/zambia-hiv-cervical-cancer.md`, `src/research/nigeria-infant-vaccination.md`, `src/research/vaccination-older-cohorts.md`, `src/research/rwanda-test-and-vaccinate.md`, `src/research/england-screening-treatment.md`

**Interfaces:**
- Consumes: schema from Task 3.
- Produces: slugs `zambia-hiv-cervical-cancer`, `nigeria-infant-vaccination`,
  `vaccination-older-cohorts`, `rwanda-test-and-vaccinate`,
  `england-screening-treatment` — `nigeria-infant-vaccination` and
  `vaccination-older-cohorts` are referenced by Task 4's
  `single-dose-vaccination.md`, patched in Step 6 below (Task 4 couldn't
  reference them directly since they didn't exist yet); also referenced by
  Task 6's presentation outputs; all five get theme-list links in Task 7.

Three of these five (`vaccination-older-cohorts`, `rwanda-test-and-vaccinate`,
`england-screening-treatment`) are genuinely new cards invented during this
migration, not backed by any existing write-up — every visible field says so.
The other two (Zambia, Nigeria) are real forthcoming papers with real
titles, but no confirmed author list/DOI yet (Zambia) or a confirmed lead
author from the IPVC 2025 poster (Nigeria) — see Step 2.

- [ ] **Step 1: Write `src/research/zambia-hiv-cervical-cancer.md`**

```markdown
---
code: ZAMBIA-HIV
title: HIV, antiretroviral therapy, and cervical cancer burden in Zambia
status: in-flight
order: 5
lead: >-
  Models how HIV prevalence and antiretroviral therapy coverage shape
  cervical cancer burden in Zambia, where women living with HIV face
  substantially elevated risk.
researchThemes: [hiv]
themes: [HIV, Cervical cancer burden]
setting: Zambia
findings:
  - >-
    Forthcoming in Nature Scientific Reports — findings to be added once
    published.
outputs:
  - label: Stuart et al. (forthcoming) · Nature Scientific Reports
    kind: paper
---
```

- [ ] **Step 2: Write `src/research/nigeria-infant-vaccination.md`**

```markdown
---
code: NIGERIA-INFANT
title: Infant HPV prophylactic vaccination in Nigeria
status: in-flight
order: 6
lead: >-
  Evaluates a model-based case for an infant HPV prophylactic vaccination
  program in Nigeria, alongside the standard adolescent schedule.
researchThemes: [vaccination-access]
themes: [Infant vaccination, Nigeria]
setting: Nigeria
findings:
  - >-
    Forthcoming — findings to be added once published.
outputs:
  - label: Umeh et al. (forthcoming)
    kind: paper
related:
  - vaccination-older-cohorts
---
```

(Author order per the IPVC 2025 title slide: Umeh Ifeoma Blessing, Robyn M.
Stuart, Christopher Gill, Jamie A. Cohen — the eventual paper citation should
use whatever author order the journal submission uses, which may differ;
confirm before publishing.)

- [ ] **Step 3: Write `src/research/vaccination-older-cohorts.md`**

```markdown
---
code: HPVFASTER
title: Extending vaccination to older cohorts
status: in-flight
order: 7
lead: >-
  DRAFT — please review and correct. Explores extending HPV vaccination
  catch-up campaigns to older age cohorts, and the resulting
  transmission-blocking effect on top of the direct protection benefit.
researchThemes: [vaccination-access]
themes: [Catch-up vaccination, Transmission blocking]
findings:
  - >-
    DRAFT — please review and correct. Presented initial results on the
    impact of vaccinating older cohorts, focusing on the transmission-
    blocking effect, at IPVC 2025.
outputs:
  - label: IPVC 2025 talk (Bangkok)
    kind: slides
---
```

(The `outputs[].href` for the IPVC 2025 talk is added in Task 6, once the
PDF is in place — leave it href-less here, which is already valid per the
validator.)

- [ ] **Step 4: Write `src/research/rwanda-test-and-vaccinate.md`**

```markdown
---
code: RWANDA-TXV
title: Rwanda test-and-vaccinate strategy
status: in-flight
order: 8
lead: >-
  DRAFT — please review and correct. Modeling a test-and-vaccinate strategy
  for cervical cancer prevention in Rwanda, combining HPV testing with
  vaccination in a single visit.
researchThemes: [screening-treatment]
themes: [Test-and-vaccinate, Rwanda]
setting: Rwanda
findings:
  - >-
    DRAFT — please review and correct; no results summarized yet.
outputs: []
---
```

- [ ] **Step 5: Write `src/research/england-screening-treatment.md`**

```markdown
---
code: ENGLAND-SCREEN
title: England screening and treatment strategies
status: in-flight
order: 9
lead: >-
  DRAFT — please review and correct. Forthcoming work modeling cervical
  screening and treatment strategy options for England.
researchThemes: [screening-treatment]
themes: [Screening, Treatment]
setting: England
findings:
  - >-
    DRAFT — please review and correct; no results summarized yet.
outputs: []
---
```

- [ ] **Step 6: Patch `single-dose-vaccination.md`'s `related` field now that its targets exist**

Task 4 deliberately left this out, since `nigeria-infant-vaccination` and
`vaccination-older-cohorts` didn't exist until this task — pointing `related`
at a nonexistent slug fails the build-time validator. Now that both exist,
add the cross-reference. In `src/research/single-dose-vaccination.md`, change:

```yaml
outputs:
  - label: Stuart et al. 2026 · Vaccine
    href: https://doi.org/10.1016/j.vaccine.2025.128187
    kind: paper
---
```

to:

```yaml
outputs:
  - label: Stuart et al. 2026 · Vaccine
    href: https://doi.org/10.1016/j.vaccine.2025.128187
    kind: paper
related:
  - nigeria-infant-vaccination
  - vaccination-older-cohorts
---
```

- [ ] **Step 7: Build and verify all ten cards now render**

```bash
npm run build
grep -c 'class="card"' _site/index.html
grep -c 'pill fly' _site/index.html
```

Expected: card count `10`; five cards show the `fly` ("In flight") pill
class (Zambia, Nigeria, older-cohorts, Rwanda, England). Build must succeed
with no validation errors — this is also the check that Step 6's `related`
patch resolved correctly.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add five in-flight study cards (2 forthcoming papers, 3 new placeholders)

vaccination-older-cohorts.md, rwanda-test-and-vaccinate.md, and
england-screening-treatment.md are new cards with no existing write-up to
draw from -- every visible field says DRAFT, needs review before publishing.
EOF
)"
```

---

## Task 6: Move presentation PDFs into `public/presentations/` and wire them into outputs

**Files:**
- Move: 6 files from `/Users/robynstuart/gf/hpvsim.github.io/pdfs/*.pdf` to `public/presentations/*.pdf` (renamed)
- Modify: `src/research/hpvsim-methods.md`, `src/research/global-cancer-registry-calibration.md`, `src/research/nigeria-infant-vaccination.md`, `src/research/vaccination-older-cohorts.md`

**Interfaces:**
- Consumes: the `pdfs/` files already placed locally by the user; the study files created in Tasks 4-5.
- Produces: nothing consumed by later tasks — this is the last piece of content each affected card needs.

Verified against each PDF's own title slide while writing this plan (not
just the filenames, which turned out to be misleading in two cases — see
below):

| Source file | Verified content | Destination |
|---|---|---|
| `pdfs/stuart_eurogin_2023.pdf` | "HPVsim: A new tool for..." — Eurogin 2023, 10 Feb 2023 | `public/presentations/eurogin-2023.pdf` |
| `pdfs/stuart_epidemics_2023.pdf` | "Inferring the natural history of HPV from global cancer registries" poster | `public/presentations/epidemics9-2023.pdf` |
| `pdfs/stuart_idm_2024.pdf` | Title slide says **"IDM symposium 2023"**, 23 May 2023 — despite the filename saying 2024 | `public/presentations/idm-symposium-2023.pdf` |
| `pdfs/stuart_eurogin_2024.pdf` | "Open-source software for HPV modeling" — Eurogin 2024 | `public/presentations/eurogin-2024.pdf` |
| `pdfs/stuart_ipvc_2025.pdf` | "Evaluating the impact vaccinating older cohorts..." — Robyn Stuart only, IPVC 2025, 25 Oct 2025 | `public/presentations/ipvc-2025-older-cohorts.pdf` |
| `pdfs/blessing_ipvc_2025.pdf` | "Model-based evaluation of an infant HPV prophylactic vaccination program in Nigeria" — Umeh Ifeoma Blessing et al., IPVC 2025, 25 Oct 2025 | `public/presentations/ipvc-2025-nigeria-infant-vaccination.pdf` |

- [ ] **Step 1: Move and rename the PDFs**

```bash
cd /Users/robynstuart/gf/hpvsim.github.io
mkdir -p public/presentations
mv pdfs/stuart_eurogin_2023.pdf public/presentations/eurogin-2023.pdf
mv pdfs/stuart_epidemics_2023.pdf public/presentations/epidemics9-2023.pdf
mv pdfs/stuart_idm_2024.pdf public/presentations/idm-symposium-2023.pdf
mv pdfs/stuart_eurogin_2024.pdf public/presentations/eurogin-2024.pdf
mv pdfs/stuart_ipvc_2025.pdf public/presentations/ipvc-2025-older-cohorts.pdf
mv pdfs/blessing_ipvc_2025.pdf public/presentations/ipvc-2025-nigeria-infant-vaccination.pdf
rmdir pdfs
```

- [ ] **Step 2: Add the two EUROGIN talks to `hpvsim-methods.md`'s outputs**

In `src/research/hpvsim-methods.md`, change:

```yaml
outputs:
  - label: Stuart et al. 2024 · PLOS Computational Biology
    href: https://doi.org/10.1371/journal.pcbi.1012181
    kind: paper
```

to:

```yaml
outputs:
  - label: Stuart et al. 2024 · PLOS Computational Biology
    href: https://doi.org/10.1371/journal.pcbi.1012181
    kind: paper
  - label: EUROGIN 2023 talk (Bilbao)
    href: /presentations/eurogin-2023.pdf
    kind: slides
  - label: EUROGIN 2024 talk (Stockholm)
    href: /presentations/eurogin-2024.pdf
    kind: slides
```

- [ ] **Step 3: Add the poster and IDM talk to `global-cancer-registry-calibration.md`'s outputs**

Change:

```yaml
outputs:
  - label: Stuart et al. 2024 · Scientific Reports
    href: https://doi.org/10.1038/s41598-024-65842-3
    kind: paper
```

to:

```yaml
outputs:
  - label: Stuart et al. 2024 · Scientific Reports
    href: https://doi.org/10.1038/s41598-024-65842-3
    kind: paper
  - label: EPIDEMICS9 poster (Bologna)
    href: /presentations/epidemics9-2023.pdf
    kind: poster
  - label: IDM Symposium 2023 talk (Seattle)
    href: /presentations/idm-symposium-2023.pdf
    kind: slides
```

- [ ] **Step 4: Add the IPVC 2025 talk to `nigeria-infant-vaccination.md`'s outputs**

Change:

```yaml
outputs:
  - label: Umeh et al. (forthcoming)
    kind: paper
```

to:

```yaml
outputs:
  - label: Umeh et al. (forthcoming)
    kind: paper
  - label: IPVC 2025 talk (Bangkok)
    href: /presentations/ipvc-2025-nigeria-infant-vaccination.pdf
    kind: slides
```

- [ ] **Step 5: Add the href to `vaccination-older-cohorts.md`'s output**

Change:

```yaml
outputs:
  - label: IPVC 2025 talk (Bangkok)
    kind: slides
```

to:

```yaml
outputs:
  - label: IPVC 2025 talk (Bangkok)
    href: /presentations/ipvc-2025-older-cohorts.pdf
    kind: slides
```

- [ ] **Step 6: Build and verify the output chips resolve**

```bash
npm run build
grep -o 'href="/presentations/[a-z0-9-]*\.pdf"' _site/research/hpvsim-methods/index.html
grep -o 'href="/presentations/[a-z0-9-]*\.pdf"' _site/research/global-cancer-registry-calibration/index.html
ls _site/presentations/
```

Expected: the two `hpvsim-methods` grep hits are `eurogin-2023.pdf` and
`eurogin-2024.pdf`; the `global-cancer-registry-calibration` hits are
`epidemics9-2023.pdf` and `idm-symposium-2023.pdf`; `_site/presentations/`
contains all six PDFs (passthrough-copied via the `addPassthroughCopy({
public: '.' })` already configured in Task 1).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move presentation PDFs into public/presentations/, wire into outputs"
```

---

## Task 7: Research themes data and homepage sections

**Files:**
- Create: `src/_data/researchThemeIntros.js`
- Modify: `src/index.njk` (insert the themes block into the `#research` section, above the filter chips)
- Modify: `public/site.css` (append `.themes` styles)

**Interfaces:**
- Consumes: `byTheme` filter and `studyHref` macro (both already wired in Tasks 1 and 2); `collections.studies` (Tasks 3-6 must be complete so every card has a `researchThemes` value to filter on).
- Produces: `researchThemeIntros` global data array, consumed nowhere else (this is the last place it's read).

- [ ] **Step 1: Write `src/_data/researchThemeIntros.js`**

Eleventy auto-loads any file under `src/_data/` as global template data keyed
by filename — no manual registration needed in `eleventy.config.js`. The
filename (and therefore the global data key) is deliberately NOT
`researchThemes.js`: that would collide with the per-study frontmatter field
of the same name (defined in Task 3) — Eleventy's data cascade deep-merges
global data and frontmatter data under matching keys, so every study's own
`researchThemes: [slug]` array would get concatenated with these four theme
objects, corrupting the field the validator and `byTheme` filter both rely
on. Keep the two names visibly distinct.

```js
export default [
  {
    slug: 'vaccination-access',
    name: 'Extending vaccination access',
    blurb:
      'Reaching more girls and women with HPV vaccination: catch-up campaigns for older cohorts, infant vaccination, and single-dose schedules that stretch limited vaccine supply further.',
  },
  {
    slug: 'screening-treatment',
    name: 'Optimizing screening and treatment',
    blurb:
      'Modeling screen-and-treat and test-and-vaccinate strategies that combine diagnosis and intervention into fewer clinic visits.',
  },
  {
    slug: 'hiv',
    name: 'HPV in women living with HIV',
    blurb:
      'Modeling how HIV and antiretroviral therapy shape cervical cancer risk and burden.',
  },
  {
    slug: 'modeling-calibration',
    name: 'Modeling technology and calibration',
    blurb:
      'The HPVsim software itself, and the calibration methodology behind fitting it to real-world cervical cancer data.',
  },
];
```

- [ ] **Step 2: Insert the themes block into `src/index.njk`**

In the `#research` section, add the themes block right after the `<p
class="sub">` line and before the `<div class="chips">` line:

```njk
{% from "components.njk" import studyCard, studyHref %}

<section id="research" class="sec">
  <div class="wrap">
    <p class="kicker">Research</p>
    <p class="sub">What has been done with the model, and what is under way.</p>

    <div class="themes">
      {% for theme in researchThemeIntros %}
      <div class="theme">
        <h3>{{ theme.name }}</h3>
        <p>{{ theme.blurb }}</p>
        <ul class="theme-links">
          {% for study in collections.studies | byTheme(theme.slug) %}
          <li><a href="{{ studyHref(study) }}">{{ study.data.code }} — {{ study.data.title }}</a></li>
          {% endfor %}
        </ul>
      </div>
      {% endfor %}
    </div>

    <div class="chips" role="tablist">
      {% for f in filters %}
      <button class="chip{{ ' on' if loop.first }}" data-f="{{ f[0] }}">{{ f[1] }}</button>
      {% endfor %}
    </div>
    <div class="grid">
      {% for study in collections.studies %}{{ studyCard(study) }}{% endfor %}
    </div>
  </div>
</section>
```

(Note the `from "components.njk" import` line now also imports `studyHref`
alongside `studyCard` — update that line, don't just add the block below
it.)

- [ ] **Step 3: Append theme styles to `public/site.css`**

```css
/* ---------------------------------------------------------------- research themes */

.themes { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px; margin: 0 0 32px; }
.theme h3 { font-family: var(--font-display); font-weight: 600; font-size: 16px;
  margin: 0 0 6px; }
.theme p { font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0 0 10px; }
.theme-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.theme-links a { font-size: 13px; color: var(--teal-d); text-decoration: none; }
.theme-links a:hover { text-decoration: underline; }
```

- [ ] **Step 4: Build and verify each theme lists the right cards**

```bash
npm run build
grep -A6 'Extending vaccination access' _site/index.html
grep -A6 'Modeling technology and calibration' _site/index.html
```

Expected: "Extending vaccination access" lists SINGLE-DOSE, NIGERIA-INFANT,
HPVFASTER, and TUNISIA (4 links — Tunisia is cross-listed, per its two
`researchThemes` values); "Modeling technology and calibration" lists
HPVSIM, PRUNING-CALIB, and REGISTRY-CALIB (3 links).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add research themes data and homepage intro sections"
```

---

## Task 8: News collection and homepage section

**Files:**
- Create: `src/news/news-validation.js` (replaces Task 3's stub), `src/news/news.11tydata.js`
- Create: 8 files under `src/news/`
- Modify: `src/index.njk` (add the News section), `public/site.css` (append `.news-list` styles)

**Interfaces:**
- Consumes: `collections.news` and the `isoDate` filter, both wired in Task 1's `eleventy.config.js`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace the Task 3 stub with the real `src/news/news-validation.js`**

```js
// Frontmatter validation for src/news/*.md — same build-time-fail-loudly
// discipline as src/research/research-validation.js.

const KINDS = ['release', 'paper', 'press', 'talk', 'funding', 'other'];

const isString = (v) => typeof v === 'string' && v.length > 0;
// Accepts absolute URLs (DOIs, external links) and root-relative paths
// (local assets like /presentations/x.pdf) -- new URL() alone throws on the
// latter, which would wrongly fail every local presentation link.
const isUrl = (v) => {
  if (typeof v === 'string' && v.startsWith('/')) return true;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

export function validateNews(items) {
  const errors = [];

  for (const item of items) {
    const d = item.data;
    const where = item.inputPath;
    const fail = (msg) => errors.push(`${where}: ${msg}`);

    if (!isString(d.title)) fail('`title` is required (string)');
    if (!d.date || isNaN(new Date(d.date)))
      fail('`date` is required and must be a valid date');
    if (!isString(d.blurb)) fail('`blurb` is required (string)');
    if (d.href !== undefined && !isUrl(d.href))
      fail(`\`href\` (${d.href}) is not a URL`);
    if (d.kind !== undefined && !KINDS.includes(d.kind))
      fail(`unknown kind \`${d.kind}\` (expected one of ${KINDS.join(', ')})`);
    if (typeof d.draft !== 'boolean') fail('`draft` must be a boolean');
  }

  if (errors.length) {
    throw new Error(`Invalid news frontmatter:\n  ${errors.join('\n  ')}`);
  }
}
```

- [ ] **Step 2: Write `src/news/news.11tydata.js`**

```js
// Directory data for src/news/*.md. Items are list entries only -- no
// individual page -- so permalink is always false.
export default {
  tags: ['news'],
  draft: false,
  permalink: false,
  eleventyComputed: {
    slug: (data) => data.page.fileSlug,
  },
};
```

- [ ] **Step 3: Write the 8 news items**

`src/news/2026-07-24-v3-release.md`:

```markdown
---
title: HPVsim v3.0 released
date: 2026-07-24
blurb: >-
  HPVsim v3.0 is out, rebuilt on the Starsim modeling architecture. The v2.2
  line is now frozen aside from critical bugfixes.
href: https://github.com/starsimhub/hpvsim
kind: release
---
```

`src/news/2026-02-23-new-yorker.md`:

```markdown
---
title: New Yorker covers single-dose HPV vaccination
date: 2026-02-23
blurb: >-
  The New Yorker's coverage of the case for single-dose HPV vaccination cites
  our analysis of Gavi-supported countries' rollout.
href: https://www.newyorker.com/news/the-lede/one-vaccine-schedule-change-that-actually-makes-sense
kind: press
---
```

`src/news/2025-10-25-ipvc-2025-talks.md`:

```markdown
---
title: Two talks at IPVC 2025, Bangkok
date: 2025-10-25
blurb: >-
  Presented on extending vaccination to older cohorts (transmission-blocking
  effects) and on a model-based case for infant HPV vaccination in Nigeria,
  at the 37th Annual Conference of the International Papillomavirus Society.
kind: talk
---
```

(No `href` — this item covers two talks with two different PDFs, both
already linked from their respective study cards' outputs; a single link
here would be misleading about which one it points to.)

`src/news/2024-07-29-quantium-funding.md`:

```markdown
---
title: Quantium Health receives multi-year funding to apply HPVsim
date: 2024-07-29
blurb: >-
  Quantium Health (South Africa) receives multi-year Gates Foundation funding
  to apply HPVsim modeling to inform national HPV immunization programs and
  health policy across South Africa, Tanzania, and Nigeria.
href: https://gcgh.grandchallenges.org/grant/modeling-support-decision-making-cervical-cancer-prevention
kind: funding
---
```

`src/news/2024-03-13-eurogin-2024.md`:

```markdown
---
title: Talk at EUROGIN 2024, Stockholm
date: 2024-03-13
blurb: >-
  Presented on the development and dissemination of HPVsim as open-source
  software for HPV modeling.
kind: talk
---
```

`src/news/2023-11-28-epidemics9.md`:

```markdown
---
title: Poster at EPIDEMICS9, Bologna
date: 2023-11-28
blurb: >-
  Presented a multi-country calibration study inferring the natural history
  of HPV from global cancer registries, at the 9th International Conference
  on Infectious Disease Dynamics.
kind: talk
---
```

`src/news/2023-05-23-idm-symposium.md`:

```markdown
---
title: Talk at IDM Symposium 2023, Seattle
date: 2023-05-23
blurb: >-
  Presented the multi-country calibration exercise inferring HPV natural
  history from global cancer registries.
kind: talk
---
```

`src/news/2023-02-10-eurogin-2023.md`:

```markdown
---
title: Talk at EUROGIN 2023, Bilbao
date: 2023-02-10
blurb: >-
  Introduced HPVsim as a new tool for rapid assessments of intervention
  impact on the pathway towards global cervical cancer elimination.
kind: talk
---
```

- [ ] **Step 4: Add the News section to `src/index.njk`**

Insert after the `#research` section, before the closing of the file:

```njk
<section id="news" class="sec">
  <div class="wrap">
    <p class="kicker">News</p>
    <ul class="news-list">
      {% for item in collections.news %}
      <li class="news-item">
        <span class="news-date">{{ item.data.date | isoDate }}</span>
        <div>
          <h4>{% if item.data.href %}<a href="{{ item.data.href }}" target="_blank" rel="noopener">{{ item.data.title }} <i>↗</i></a>{% else %}{{ item.data.title }}{% endif %}</h4>
          <p>{{ item.data.blurb }}</p>
        </div>
      </li>
      {% endfor %}
    </ul>
  </div>
</section>
```

- [ ] **Step 5: Append news styles to `public/site.css`**

```css
/* ---------------------------------------------------------------- news */

.news-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.news-item { display: grid; grid-template-columns: 90px 1fr; gap: 16px; }
.news-date { font-family: var(--font-mono); font-size: 11px; color: var(--muted); padding-top: 2px; }
.news-item h4 { font-family: var(--font-display); font-weight: 500; font-size: 15px; margin: 0 0 4px; }
.news-item h4 a { color: inherit; text-decoration: none; }
.news-item h4 a:hover { color: var(--teal-d); }
.news-item p { font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0; }
@media (max-width: 480px) { .news-item { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Build and verify News renders in date order**

```bash
npm run build
grep -o '<span class="news-date">[0-9-]*</span>' _site/index.html
```

Expected output, in this exact order (newest first):
```
<span class="news-date">2026-07-24</span>
<span class="news-date">2026-02-23</span>
<span class="news-date">2025-10-25</span>
<span class="news-date">2024-07-29</span>
<span class="news-date">2024-03-13</span>
<span class="news-date">2023-11-28</span>
<span class="news-date">2023-05-23</span>
<span class="news-date">2023-02-10</span>
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add news collection and homepage News section"
```

---

## Task 9: Countries/deployments section

**Files:**
- Create: `src/_data/countries.js`
- Modify: `src/index.njk` (add the Countries section)
- Modify: `public/site.css` (append `.countries` styles)

**Interfaces:**
- Consumes: `findStudy` filter (Task 1) and `studyHref` macro (Task 2); requires `tunisia-screening-vaccination`, `zambia-hiv-cervical-cancer`, and `nigeria-infant-vaccination` to already exist (Tasks 4-5).

- [ ] **Step 1: Write `src/_data/countries.js`**

```js
// Strictly output-anchored: only countries with a published or forthcoming
// paper appear here. Countries with active HPVsim work but no paper yet
// (e.g. Rwanda, or South Africa/Tanzania via the Quantium Health grant) are
// intentionally excluded -- add them once they have a study to link to.
export default [
  { name: 'Tunisia', studySlug: 'tunisia-screening-vaccination' },
  { name: 'Zambia', studySlug: 'zambia-hiv-cervical-cancer' },
  { name: 'Nigeria', studySlug: 'nigeria-infant-vaccination' },
];
```

- [ ] **Step 2: Add the Countries section to `src/index.njk`**

Insert between the `#research` and `#news` sections. `studyHref` is already
imported at the top of the file (Task 7 Step 2) — don't add a second import
line, just insert this block:

```njk
<section id="countries" class="sec">
  <div class="wrap">
    <p class="kicker">Countries</p>
    <p class="sub">Settings where HPVsim has informed policy through a published or forthcoming study.</p>
    <ul class="countries">
      {% for c in countries %}
      {% set study = collections.studies | findStudy(c.studySlug) %}
      <li><a href="{{ studyHref(study) }}">{{ c.name }}</a></li>
      {% endfor %}
    </ul>
  </div>
</section>
```

- [ ] **Step 3: Append countries styles to `public/site.css`**

```css
/* ---------------------------------------------------------------- countries */

.countries { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.countries a { font-size: 14px; padding: 8px 16px; border-radius: 999px; text-decoration: none;
  border: 1px solid var(--line); color: var(--teal-d); background: var(--surface); }
.countries a:hover { border-color: var(--teal); }
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
grep -A5 'class="countries"' _site/index.html
```

Expected: three links — Tunisia, Zambia, Nigeria — each pointing at
`/research/<slug>/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add countries/deployments section"
```

---

## Task 10: Final verification and README

**Files:**
- Modify: `README.md`
- Verify: entire site

**Interfaces:**
- Consumes: everything from Tasks 1-9.

- [ ] **Step 1: Write `README.md`**

```markdown
# hpvsim.github.io

Public front door for HPVsim: a static [Eleventy](https://www.11ty.dev) site that positions the model, points at the docs, and navigates the research done with it. It is not the docs. Tutorials and the API reference stay in Quarto at docs.hpvsim.org; this site links out to them.

## Run locally

```bash
npm install
npm run dev        # http://localhost:8080, with live reload
npm run build      # static output to ./_site
npm run serve      # serve the built ./_site
```

## Add or edit a study

Every study is one file in `src/research/`. Frontmatter is validated at build time by `src/research/research-validation.js`, so a malformed entry fails the build instead of shipping broken. Defaults for the optional fields live in `src/research/research.11tydata.js`.

Card behaviour is derived, never stored:

| `dashboardUrl` | `status`      | Renders as     | Click target       | Study page? |
| -------------- | ------------- | -------------- | ------------------- | ----------- |
| set            | write-up      | Write-up card  | the external URL    | no          |
| unset          | peer-reviewed | Writeup card   | /research/{slug}/   | yes         |
| unset          | in-flight     | Writeup card   | /research/{slug}/   | yes         |

`researchThemes` is a separate field from `themes`: `themes` is free-text
display tags shown on the study page, `researchThemes` drives which of the
four homepage theme sections (defined in `src/_data/researchThemeIntros.js`
— note the different filename, deliberately not `researchThemes.js`, so it
doesn't collide with this frontmatter field in Eleventy's data cascade) a
study is listed under. A study can belong to more than one theme.

Conference presentations aren't a separate content type — add them as an
extra entry in a study's `outputs` array (`kind: slides` or `kind: poster`),
with the PDF placed in `public/presentations/` and referenced by an absolute
path (`/presentations/<file>.pdf`).

Each output with `kind: paper` counts toward the paper count shown on the card.

## Add a news item

One file per item in `src/news/`, validated by `src/news/news-validation.js`.
Fields: `title`, `date`, `blurb`, optional `href` and `kind`
(`release`/`paper`/`press`/`talk`/`funding`/`other`). Sorted newest first,
rendered as a plain list on the homepage — no pagination.

## Layout

```
eleventy.config.js          collections, filters, passthrough copy, site metadata, sitemap
public/                     copied to the site root: site.css, site.js, CNAME, favicon, logos, presentations/
src/index.njk               the single-page front door: hero, model, research (+ themes), countries, news
src/research/*.md           one file per study, with the frontmatter schema alongside
src/news/*.md               one file per news item
src/_data/                  researchThemeIntros.js, countries.js -- static data available to every template
src/includes/                base.njk, study.njk, and header, footer, component macros
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/publish.yml` builds and deploys on every push to `main`. It needs Settings → Pages → Build and deployment → Source set to **GitHub Actions**.

Custom domain: `public/CNAME` holds `hpvsim.org`. In Settings → Pages set the custom domain to `hpvsim.org` and add the matching DNS record with your provider.

If the site is ever served from a subpath instead (e.g. `hpvsim.github.io/hpvsim.github.io`), pass the prefix at build time — every internal link already goes through Eleventy's `url` filter:

```bash
npx eleventy --pathprefix=/subpath/
```

## Notes

- Styling is plain CSS with tokens at the top of `public/site.css`, not Tailwind, so the look is bespoke and the dependency list stays at one package.
- The only client-side JavaScript is the theme toggle and the research filter (`public/site.js`), plus a tiny inline script that applies a saved theme before first paint. Page transitions use the browser's native cross-document view transitions where supported, so there is no router.
- Dark mode follows the OS setting via `prefers-color-scheme`, overridable by the toggle and remembered in `localStorage`.
```

- [ ] **Step 2: Full build from a clean state**

```bash
rm -rf _site node_modules
npm install
npm run build
```

Expected: build succeeds, no validation errors from either
`research-validation.js` or `news-validation.js`.

- [ ] **Step 3: Manual QA checklist against the generated site**

```bash
grep -c 'class="card"' _site/index.html            # expect 10
grep -c 'DRAFT — please review' _site/index.html   # expect > 0: confirms placeholder cards are visibly flagged, not silently blended in
grep -o '<span class="news-date">[0-9-]*</span>' _site/index.html | wc -l   # expect 8
grep -A5 'class="countries"' _site/index.html       # expect Tunisia, Zambia, Nigeria
ls _site/presentations/                             # expect all 6 PDFs
grep 'starsimhub/hpvsim_orig' _site/index.html      # expect the Legacy v2.2 link present
grep -i 'beta' _site/index.html                     # expect NO matches -- old version language fully removed
```

- [ ] **Step 4: Note remaining open items for the user (not blocking, but don't lose track of them)**

Print this list at the end of the task — these are the spec's open items,
now concrete:

1. `pruning-calibration.md` and `tunisia-screening-vaccination.md` have
   lead/findings text drafted from titles only — verify against the papers.
2. `vaccination-older-cohorts.md`, `rwanda-test-and-vaccinate.md`,
   `england-screening-treatment.md` are entirely placeholder — every
   "DRAFT — please review and correct" string needs real content.
3. Zambia paper (`zambia-hiv-cervical-cancer.md`) cites "Stuart et al." with
   no confirmed author list or DOI yet.
4. Nigeria paper (`nigeria-infant-vaccination.md`) cites "Umeh et al." based
   on the IPVC 2025 poster's author order — confirm against the eventual
   journal submission's author order.
5. Whether the New Yorker news item should also link from
   `single-dose-vaccination.md`'s outputs (currently News-only, per spec
   default) is still an open either-way call for the user.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add README for the new Eleventy site"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the spec (data model, research themes,
  presentations-as-outputs, news, countries, funding, version-language
  rewrite, content inventory) maps to a task above. The spec's four "open
  items for the user" are surfaced as Task 10 Step 4, not silently resolved.
- **Corrections found while writing this plan** (from actually reading the
  6 PDFs, not just trusting filenames/descriptions): EUROGIN 2023 talk date
  (Feb 10, not Feb 8), both IPVC 2025 talk dates (Oct 25, not Oct 23), and
  the IDM talk's year (2023, not 2024, confirmed with the user) — the spec
  file was corrected in place before this plan was written, so both
  documents now agree.
- **Type/name consistency:** the frontmatter field `researchThemes` and the
  filter `byTheme` are spelled and cased consistently across every task.
  Study slugs referenced by `related:` fields in Tasks 4-5 match the
  filenames created in those same tasks. Output hrefs added in Task 6 match
  the exact filenames moved in Task 6 Step 1.
- **Correction found during Task 7 implementation, not caught by this
  self-review pass:** the homepage's global-data file was originally
  planned as `src/_data/researchThemes.js`. Eleventy's data cascade
  deep-merges global data into frontmatter data under matching key names, so
  that filename collided with the per-study `researchThemes` frontmatter
  field and silently corrupted it (each study's `[slug]` array got
  concatenated with the four theme objects, which the validator then
  correctly rejected). The Task 7 implementer hit this at build time,
  diagnosed it precisely, and stopped rather than guessing at a fix outside
  their task's file scope — exactly the right call, since the fix choice
  (rename the new file vs. rename the already-reviewed frontmatter field
  vs. disable Eleventy's deep-merge globally) has consequences for closed
  tasks. Ruled: rename the new file/key to `researchThemeIntros`
  (`src/_data/researchThemeIntros.js`) — keeps the fix entirely inside
  Task 7's own files, touches nothing in Tasks 3-6. Fixed in the plan text
  (Task 7 Steps 1-2, and the Task 10 README section) before resuming the
  implementer. This is the kind of interface-naming collision the pre-flight
  scan's pairwise table did not think to check (it wasn't yet a file that
  existed) — worth remembering for future plans that add global `_data`
  files alongside a content collection using a similarly-named frontmatter
  field.
- **Ordering bug caught and fixed:** Task 4's `single-dose-vaccination.md`
  originally pointed `related:` at `nigeria-infant-vaccination` and
  `vaccination-older-cohorts`, both created in Task 5 — that would have
  failed Task 4's own build-verification step (the validator checks
  `related` against every known slug at build time, and those slugs wouldn't
  exist yet). Fixed by dropping the field from Task 4 and adding it back as
  Task 5 Step 6, once both target files exist.

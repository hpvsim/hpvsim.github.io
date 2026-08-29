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

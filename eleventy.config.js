import { validateStudies } from './src/research/research-validation.js';
import { validateNews } from './src/news/news-validation.js';
import countries from './src/_data/countries.js';

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
    const studySlugs = new Set(studies.map((s) => s.data.slug));
    for (const c of countries) {
      for (const a of c.analyses) {
        if (a.studySlug !== undefined && !studySlugs.has(a.studySlug)) {
          throw new Error(
            `countries.js: ${c.name}'s \`studySlug\` "${a.studySlug}" does not match any known study`
          );
        }
      }
    }
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

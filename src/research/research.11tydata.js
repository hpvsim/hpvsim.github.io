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

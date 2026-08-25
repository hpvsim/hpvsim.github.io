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

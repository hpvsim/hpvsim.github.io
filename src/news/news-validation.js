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

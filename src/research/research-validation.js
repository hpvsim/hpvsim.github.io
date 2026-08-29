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

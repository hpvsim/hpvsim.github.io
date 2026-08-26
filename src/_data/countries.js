// Shared analysis definitions, reused across every country they cover --
// defined once here rather than repeated in each country's `analyses` array.
const MULTICAL = {
  label: 'Natural-history calibration to cervical cancer registries (30-country study)',
  studySlug: 'global-cancer-registry-calibration',
  partners: 'Gates Foundation',
  pubLabel: 'Stuart et al. 2024',
  pubHref: 'https://doi.org/10.1038/s41598-024-65842-3',
  codeLabel: 'hpvsim_multical',
  codeHref: 'https://github.com/hpvsim/hpvsim_multical',
};

const ONE_DOSE = {
  label: 'Single-dose vaccination impact (16 Gavi-supported countries)',
  studySlug: 'single-dose-vaccination',
  partners: 'Gavi, Gates Foundation',
  pubLabel: 'Stuart et al. 2026',
  pubHref: 'https://doi.org/10.1016/j.vaccine.2025.128187',
  codeLabel: 'hpvsim_1dose',
  codeHref: 'https://github.com/hpvsim/hpvsim_1dose',
};

export default [
  { name: 'Angola', analyses: [MULTICAL] },
  { name: 'Bangladesh', analyses: [ONE_DOSE] },
  { name: 'Benin', analyses: [MULTICAL] },
  { name: 'Burkina Faso', analyses: [ONE_DOSE, MULTICAL] },
  { name: 'Burundi', analyses: [MULTICAL] },
  { name: 'Cambodia', analyses: [ONE_DOSE] },
  { name: 'Cameroon', analyses: [ONE_DOSE, MULTICAL] },
  { name: 'Chad', analyses: [MULTICAL] },
  { name: 'Congo', analyses: [MULTICAL] },
  { name: "Côte d'Ivoire", analyses: [ONE_DOSE, MULTICAL] },
  { name: 'DR Congo', analyses: [MULTICAL] },
  {
    name: 'England',
    analyses: [{ partners: 'University of Oxford' }],
  },
  {
    name: 'Ethiopia',
    analyses: [ONE_DOSE, MULTICAL],
  },
  {
    name: 'Gabon',
    analyses: [
      {
        label: 'Cervical cancer burden and screening/vaccination scenarios',
        partners: 'LSHTM, Gabon Ministry of Health',
        codeLabel: 'hpvsim_gabon',
        codeHref: 'https://github.com/hpvsim/hpvsim_gabon',
      },
    ],
  },
  { name: 'Gambia', analyses: [ONE_DOSE] },
  { name: 'Ghana', analyses: [MULTICAL] },
  { name: 'Guinea', analyses: [MULTICAL] },
  {
    name: 'India',
    analyses: [
      {
        label: "Country model reproducing the HPVsim methods paper's India figures",
        studySlug: 'hpvsim-methods',
        partners: 'National Disease Modeling Consortium',
        pubLabel: 'Stuart et al. 2024',
        pubHref: 'https://doi.org/10.1371/journal.pcbi.1012181',
        codeLabel: 'hpvsim_india',
        codeHref: 'https://github.com/hpvsim/hpvsim_india',
      },
    ],
  },
  {
    name: 'Kazakhstan',
    analyses: [
      {
        label: 'Cervical cancer burden model',
        partners: 'LSHTM',
        codeLabel: 'hpvsim_kazakhstan',
        codeHref: 'https://github.com/hpvsim/hpvsim_kazakhstan',
      },
    ],
  },
  { name: 'Kenya', analyses: [MULTICAL] },
  { name: 'Lao PDR', analyses: [ONE_DOSE] },
  { name: 'Madagascar', analyses: [MULTICAL] },
  { name: 'Malawi', analyses: [MULTICAL] },
  { name: 'Mali', analyses: [ONE_DOSE, MULTICAL] },
  { name: 'Mozambique', analyses: [ONE_DOSE, MULTICAL] },
  { name: 'Myanmar', analyses: [ONE_DOSE] },
  { name: 'Nepal', analyses: [ONE_DOSE] },
  { name: 'Niger', analyses: [MULTICAL] },
  {
    name: 'Nigeria',
    analyses: [
      ONE_DOSE,
      MULTICAL,
      {
        label: 'Infant HPV prophylactic vaccination',
        studySlug: 'nigeria-infant-vaccination',
        partners: 'Gates Foundation, Nnamdi Azikiwe University, Awka, Nigeria',
        codeLabel: 'hpvsim_pxv_younger',
        codeHref: 'https://github.com/hpvsim/hpvsim_pxv_younger',
      },
    ],
  },
  {
    name: 'Rwanda',
    analyses: [
      MULTICAL,
      {
        label: 'Strategies to accelerate cervical cancer elimination',
        studySlug: 'rwanda-cervical-cancer-elimination',
        partners:
          'Albert Einstein College of Medicine, Einstein-Rwanda Research and Capacity Building Program, International Agency for Research on Cancer (IARC/WHO), Gates Foundation',
        codeLabel: 'hpvsim_rwanda',
        codeHref: 'https://github.com/hpvsim/hpvsim_rwanda',
      },
    ],
  },
  { name: 'Senegal', analyses: [MULTICAL] },
  { name: 'Sierra Leone', analyses: [ONE_DOSE, MULTICAL] },
  { name: 'Somalia', analyses: [MULTICAL] },
  { name: 'South Africa', analyses: [MULTICAL] },
  { name: 'South Sudan', analyses: [MULTICAL] },
  { name: 'Tanzania', analyses: [ONE_DOSE, MULTICAL] },
  { name: 'Togo', analyses: [ONE_DOSE, MULTICAL] },
  {
    name: 'Tunisia',
    analyses: [
      {
        label: 'Cost-effectiveness of HPV screening and vaccination strategies',
        studySlug: 'tunisia-screening-vaccination',
        partners: 'Pasteur Institute of Tunis',
        pubLabel: 'Lahdhiri et al. 2025',
        pubHref: 'https://doi.org/10.1038/s41598-025-13423-3',
      },
    ],
  },
  { name: 'Uganda', analyses: [MULTICAL] },
  {
    name: 'Zambia',
    analyses: [
      ONE_DOSE,
      MULTICAL,
      {
        label: 'HIV, antiretroviral therapy, and cervical cancer burden',
        studySlug: 'zambia-hiv-cervical-cancer',
        partners:
          'University of Bern, Centre for Infectious Disease Research in Zambia, SACEMA, Gates Foundation',
        pubLabel: 'Forthcoming, Nature Scientific Reports',
        codeLabel: 'HPVSim_Zambia',
        codeHref: 'https://github.com/AndohJ0/HPVSim_Zambia',
      },
    ],
  },
  { name: 'Zimbabwe', analyses: [MULTICAL] },
];

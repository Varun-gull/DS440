import type { InternshipPosting, Profile } from "./types";

type FitProfile = Pick<
  Profile,
  "resumeText" | "resumeKeywords" | "targetRoles" | "targetLocations"
>;

type JobSection = "title" | "required" | "responsibility" | "preferred" | "context" | "tags";

type EvidenceRule = {
  pattern: RegExp;
  strength: number;
};

type ConceptDefinition = {
  id: string;
  label: string;
  specificity: number;
  jobRules: RegExp[];
  resumeRules: EvidenceRule[];
};

export type FitEvidence = {
  concept: string;
  label: string;
  section: JobSection;
  requirementWeight: number;
  evidenceStrength: number;
  contribution: number;
  status: "confirmed" | "partial" | "missing";
};

export type FitScoreBreakdown = {
  score: number;
  matched: FitEvidence[];
  partial: FitEvidence[];
  missing: FitEvidence[];
  analyzedResumeText: boolean;
  analyzedJobDescription: boolean;
};

const SECTION_WEIGHTS: Record<JobSection, number> = {
  title: 1.05,
  required: 1.35,
  responsibility: 1.1,
  preferred: 0.75,
  context: 0.5,
  tags: 0.7,
};

function rule(pattern: RegExp, strength = 1): EvidenceRule {
  return { pattern, strength };
}

const CONCEPTS: ConceptDefinition[] = [
  {
    id: "machine-learning",
    label: "Machine learning",
    specificity: 1.3,
    jobRules: [
      /\bmachine learning\b/i,
      /\bdeep learning\b/i,
      /\bneural networks?\b/i,
      /\bpredictive model(?:ing|s)?\b/i,
      /\b(?:classification|regression|forecasting) models?\b/i,
      /\bmodel (?:training|evaluation|deployment)\b/i,
      /\bfeature engineering\b/i,
      /\b(?:scikit[ -]?learn|sklearn|tensorflow|pytorch|xgboost)\b/i,
    ],
    resumeRules: [
      rule(/\bmachine learning\b/i),
      rule(/\bdeep learning\b/i),
      rule(/\bneural networks?\b/i),
      rule(/\bpredictive model(?:ing|s)?\b/i),
      rule(/\b(?:classification|regression|forecasting) models?\b/i),
      rule(/\bmodel (?:training|evaluation|deployment)\b/i),
      rule(/\bfeature engineering\b/i),
      rule(/\b(?:scikit[ -]?learn|sklearn|tensorflow|pytorch|xgboost)\b/i),
      rule(/\bmodels?.{0,45}\b(?:forecast|predict|classif|regress)/i, 0.9),
      rule(/\b(?:designed|built|developed|created|implemented)\s+(?:an?\s+)?(?:statistical\s+)?models?\b/i, 0.5),
    ],
  },
  {
    id: "data-analysis",
    label: "Data analysis",
    specificity: 1,
    jobRules: [
      /\bdata analys(?:is|t|ytics)\b/i,
      /\banaly[sz](?:e|ed|ing) (?:large )?(?:data|datasets?)\b/i,
      /\bexploratory data analysis\b/i,
      /\bdata cleaning\b/i,
      /\bdata wrangling\b/i,
    ],
    resumeRules: [
      rule(/\bdata analys(?:is|t|ytics)\b/i),
      rule(/\banaly[sz](?:e|ed|ing) (?:large )?(?:data|datasets?)\b/i),
      rule(/\bexploratory data analysis\b/i),
      rule(/\bdata (?:cleaning|wrangling|preparation)\b/i),
      rule(/\b(?:cleaned|transformed|processed) (?:large )?(?:data|datasets?)\b/i, 0.9),
    ],
  },
  {
    id: "python",
    label: "Python",
    specificity: 1.15,
    jobRules: [/\bpython\b/i],
    resumeRules: [rule(/\bpython\b/i), rule(/\b(?:pandas|numpy|jupyter)\b/i, 0.8)],
  },
  {
    id: "sql",
    label: "SQL",
    specificity: 1.15,
    jobRules: [/\bsql\b/i, /\bpostgres(?:ql)?\b/i, /\bmysql\b/i],
    resumeRules: [rule(/\bsql\b/i), rule(/\bpostgres(?:ql)?\b/i), rule(/\bmysql\b/i)],
  },
  {
    id: "data-visualization",
    label: "Data visualization",
    specificity: 1,
    jobRules: [/\bdata visuali[sz]ation\b/i, /\bdashboards?\b/i, /\btableau\b/i, /\bpower bi\b/i],
    resumeRules: [
      rule(/\bdata visuali[sz]ation\b/i),
      rule(/\b(?:built|created|designed|developed) dashboards?\b/i),
      rule(/\btableau\b/i),
      rule(/\bpower bi\b/i),
    ],
  },
  {
    id: "statistics",
    label: "Statistics",
    specificity: 1.1,
    jobRules: [/\bstatistic(?:al|s)\b/i, /\bhypothesis testing\b/i, /\ba\/b testing\b/i, /\bexperimental design\b/i],
    resumeRules: [
      rule(/\bstatistic(?:al|s)\b/i),
      rule(/\bhypothesis testing\b/i),
      rule(/\ba\/b testing\b/i),
      rule(/\bexperimental design\b/i),
    ],
  },
  {
    id: "spreadsheets",
    label: "Spreadsheet analysis",
    specificity: 0.85,
    jobRules: [/\bexcel\b/i, /\bspreadsheets?\b/i, /\bpivot tables?\b/i],
    resumeRules: [rule(/\bexcel\b/i), rule(/\bspreadsheets?\b/i), rule(/\bpivot tables?\b/i)],
  },
  {
    id: "java",
    label: "Java",
    specificity: 1.15,
    jobRules: [/\bjava\b/i],
    resumeRules: [rule(/\bjava\b/i)],
  },
  {
    id: "javascript-typescript",
    label: "JavaScript or TypeScript",
    specificity: 1.1,
    jobRules: [/\bjavascript\b/i, /\btypescript\b/i, /\bnode(?:\.js|js)?\b/i],
    resumeRules: [rule(/\bjavascript\b/i), rule(/\btypescript\b/i), rule(/\bnode(?:\.js|js)?\b/i, 0.85)],
  },
  {
    id: "react",
    label: "React",
    specificity: 1.15,
    jobRules: [/\breact(?:\.js|js)?\b/i, /\bnext(?:\.js|js)?\b/i],
    resumeRules: [rule(/\breact(?:\.js|js)?\b/i), rule(/\bnext(?:\.js|js)?\b/i, 0.9)],
  },
  {
    id: "backend-api",
    label: "Backend and APIs",
    specificity: 1,
    jobRules: [/\bbackend\b/i, /\bback end\b/i, /\brest(?:ful)? apis?\b/i, /\bgraphql\b/i, /\bapi development\b/i],
    resumeRules: [
      rule(/\bbackend\b/i),
      rule(/\bback end\b/i),
      rule(/\brest(?:ful)? apis?\b/i),
      rule(/\bgraphql\b/i),
      rule(/\b(?:built|developed|designed|implemented) (?:an? )?apis?\b/i),
    ],
  },
  {
    id: "databases",
    label: "Databases",
    specificity: 0.95,
    jobRules: [/\bdatabases?\b/i, /\bmongodb\b/i, /\bsupabase\b/i, /\brelational data(?:base| model)\b/i],
    resumeRules: [
      rule(/\bdatabases?\b/i),
      rule(/\bmongodb\b/i),
      rule(/\bsupabase\b/i),
      rule(/\brelational data(?:base| model)\b/i),
    ],
  },
  {
    id: "cloud",
    label: "Cloud platforms",
    specificity: 1,
    jobRules: [/\baws\b/i, /\bamazon web services\b/i, /\bazure\b/i, /\bgoogle cloud\b/i, /\bgcp\b/i],
    resumeRules: [
      rule(/\baws\b/i),
      rule(/\bamazon web services\b/i),
      rule(/\bazure\b/i),
      rule(/\bgoogle cloud\b/i),
      rule(/\bgcp\b/i),
    ],
  },
  {
    id: "containers",
    label: "Containers",
    specificity: 1.1,
    jobRules: [/\bdocker\b/i, /\bkubernetes\b/i, /\bcontaineri[sz]ation\b/i],
    resumeRules: [rule(/\bdocker\b/i), rule(/\bkubernetes\b/i), rule(/\bcontaineri[sz]ation\b/i)],
  },
  {
    id: "version-control",
    label: "Version control",
    specificity: 0.8,
    jobRules: [/\bgit\b/i, /\bgithub\b/i, /\bversion control\b/i],
    resumeRules: [rule(/\bgit\b/i), rule(/\bgithub\b/i), rule(/\bversion control\b/i)],
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    specificity: 1.1,
    jobRules: [/\bcybersecurity\b/i, /\binformation security\b/i, /\bthreat detection\b/i, /\bvulnerability assessment\b/i],
    resumeRules: [
      rule(/\bcybersecurity\b/i),
      rule(/\binformation security\b/i),
      rule(/\bthreat detection\b/i),
      rule(/\bvulnerability assessment\b/i),
    ],
  },
  {
    id: "product-management",
    label: "Product management",
    specificity: 1,
    jobRules: [/\bproduct management\b/i, /\bproduct roadmap\b/i, /\bproduct requirements\b/i, /\buser stories\b/i],
    resumeRules: [
      rule(/\bproduct management\b/i),
      rule(/\bproduct roadmap\b/i),
      rule(/\bproduct requirements\b/i),
      rule(/\buser stories\b/i),
    ],
  },
  {
    id: "project-management",
    label: "Project management",
    specificity: 0.9,
    jobRules: [/\bproject management\b/i, /\bagile\b/i, /\bscrum\b/i, /\bstakeholder management\b/i],
    resumeRules: [
      rule(/\bproject management\b/i),
      rule(/\bagile\b/i),
      rule(/\bscrum\b/i),
      rule(/\bstakeholder management\b/i),
      rule(/\bmanaged (?:a |the )?(?:project|initiative|program)\b/i, 0.9),
    ],
  },
  {
    id: "user-research",
    label: "User research",
    specificity: 1,
    jobRules: [/\buser research\b/i, /\busability testing\b/i, /\buser interviews?\b/i, /\bqualitative research\b/i],
    resumeRules: [
      rule(/\buser research\b/i),
      rule(/\busability testing\b/i),
      rule(/\buser interviews?\b/i),
      rule(/\bqualitative research\b/i),
    ],
  },
  {
    id: "design",
    label: "Digital design",
    specificity: 0.95,
    jobRules: [/\bui design\b/i, /\bux design\b/i, /\buser experience design\b/i, /\bfigma\b/i, /\bprototyping\b/i],
    resumeRules: [
      rule(/\bui design\b/i),
      rule(/\bux design\b/i),
      rule(/\buser experience design\b/i),
      rule(/\bfigma\b/i),
      rule(/\bprototyping\b/i),
    ],
  },
  {
    id: "communication",
    label: "Communication",
    specificity: 0.7,
    jobRules: [/\bcommunication skills?\b/i, /\bcommunicat(?:e|ion|ing) (?:technical )?(?:results|findings|insights)\b/i, /\bpresent(?:ed|ing|ations?)\b/i],
    resumeRules: [
      rule(/\bcommunication skills?\b/i),
      rule(/\bcommunicat(?:e|ed|ing) (?:technical )?(?:results|findings|insights)\b/i),
      rule(/\bpresent(?:ed|ing) (?:results|findings|insights)\b/i),
      rule(/\bpresentations?\b/i, 0.75),
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    specificity: 0.8,
    jobRules: [/\bleadership\b/i, /\blead (?:a |the )?team\b/i, /\bmentor(?:ing|ship)?\b/i],
    resumeRules: [rule(/\bleadership\b/i), rule(/\bled (?:a |the )?team\b/i), rule(/\bmentor(?:ed|ing|ship)?\b/i)],
  },
  {
    id: "sales",
    label: "Sales",
    specificity: 1,
    jobRules: [/\bsales\b/i, /\bcrm\b/i, /\bsalesforce\b/i, /\bquota\b/i, /\blead generation\b/i],
    resumeRules: [rule(/\bsales\b/i), rule(/\bcrm\b/i), rule(/\bsalesforce\b/i), rule(/\bquota\b/i), rule(/\blead generation\b/i)],
  },
  {
    id: "customer-service",
    label: "Customer service",
    specificity: 0.9,
    jobRules: [/\bcustomer service\b/i, /\bcustomer support\b/i, /\bclient support\b/i, /\bcustomer success\b/i],
    resumeRules: [
      rule(/\bcustomer service\b/i),
      rule(/\bcustomer support\b/i),
      rule(/\bclient support\b/i),
      rule(/\bcustomer success\b/i),
    ],
  },
  {
    id: "finance-accounting",
    label: "Finance and accounting",
    specificity: 1,
    jobRules: [/\bfinancial analysis\b/i, /\baccounting\b/i, /\bfinancial statements?\b/i, /\bbudgeting\b/i, /\bfinancial forecast(?:ing|s)?\b/i],
    resumeRules: [
      rule(/\bfinancial analysis\b/i),
      rule(/\baccounting\b/i),
      rule(/\bfinancial statements?\b/i),
      rule(/\bbudgeting\b/i),
      rule(/\bfinancial forecast(?:ing|s)?\b/i),
    ],
  },
  {
    id: "legal-research",
    label: "Legal research",
    specificity: 1.1,
    jobRules: [/\blegal research\b/i, /\bcase law\b/i, /\blegal writing\b/i, /\bcontract review\b/i],
    resumeRules: [rule(/\blegal research\b/i), rule(/\bcase law\b/i), rule(/\blegal writing\b/i), rule(/\bcontract review\b/i)],
  },
  {
    id: "healthcare",
    label: "Healthcare experience",
    specificity: 1,
    jobRules: [/\bpatient care\b/i, /\bclinical research\b/i, /\bhealthcare\b/i, /\bmedical records?\b/i],
    resumeRules: [rule(/\bpatient care\b/i), rule(/\bclinical research\b/i), rule(/\bhealthcare\b/i), rule(/\bmedical records?\b/i)],
  },
  {
    id: "education",
    label: "Teaching and education",
    specificity: 0.95,
    jobRules: [/\bteaching\b/i, /\bcurriculum\b/i, /\binstructional design\b/i, /\bclassroom management\b/i],
    resumeRules: [rule(/\bteaching\b/i), rule(/\bcurriculum\b/i), rule(/\binstructional design\b/i), rule(/\bclassroom management\b/i)],
  },
];

const FALLBACK_STOP_WORDS = new Set(
  "a an and are as at be been being by can could did do does doing for from had has have having if in into is it its of on or our required role team that the their them these they this those to use used using was we were what when where which while who will with work working you your".split(" ")
);

const BROAD_TERMS = new Set([
  "ai",
  "data",
  "model",
  "models",
  "technology",
  "business",
  "design",
  "product",
  "software",
  "analysis",
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("c++", "cplusplus")
    .replaceAll("c#", "csharp")
    .replaceAll(".net", "dotnet")
    .replace(/[^a-z0-9+#.\n]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function getSectionFromHeader(value: string): JobSection | null {
  const header = value.toLowerCase().replace(/[^a-z ]/g, " ").trim();
  if (/^(required|required qualifications|minimum qualifications|requirements|what you need)$/.test(header)) return "required";
  if (/^(preferred|preferred qualifications|nice to have|bonus qualifications)$/.test(header)) return "preferred";
  if (/^(responsibilities|job responsibilities|what you will do|what you ll do|the role|your role)$/.test(header)) return "responsibility";
  return null;
}

function inferSection(value: string, current: JobSection): JobSection {
  if (/\b(required|must have|minimum qualification|minimum requirement)\b/i.test(value)) return "required";
  if (/\b(preferred|nice to have|bonus|ideally)\b/i.test(value)) return "preferred";
  if (/\b(responsibilities|you will|you ll|responsible for|day to day)\b/i.test(value)) return "responsibility";
  return current;
}

function buildJobSegments(job: Pick<InternshipPosting, "title" | "description" | "tags">) {
  const segments: Array<{ text: string; section: JobSection }> = [];
  if (job.title.trim()) segments.push({ text: normalize(job.title), section: "title" });
  if (job.tags.length) segments.push({ text: normalize(job.tags.join(" ")), section: "tags" });

  let currentSection: JobSection = "context";
  const lines = job.description.split(/\r?\n/).flatMap((line) => line.split(/(?<=[.!?])\s+/));

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const headerSection = getSectionFromHeader(line.replace(/:$/, ""));
    if (headerSection) {
      currentSection = headerSection;
      return;
    }
    const section = inferSection(line, currentSection);
    segments.push({ text: normalize(line), section });
  });

  return segments;
}

function getJobConcepts(job: Pick<InternshipPosting, "title" | "description" | "tags">) {
  const concepts = new Map<string, { concept: ConceptDefinition; section: JobSection; rawWeight: number }>();

  buildJobSegments(job).forEach((segment) => {
    CONCEPTS.forEach((concept) => {
      if (!matchesAny(segment.text, concept.jobRules)) return;
      const rawWeight = SECTION_WEIGHTS[segment.section] * concept.specificity;
      const existing = concepts.get(concept.id);
      if (!existing || rawWeight > existing.rawWeight) {
        concepts.set(concept.id, { concept, section: segment.section, rawWeight });
      }
    });
  });

  return Array.from(concepts.values());
}

function getResumeEvidenceStrength(resumeText: string, concept: ConceptDefinition) {
  return concept.resumeRules.reduce(
    (maximum, evidenceRule) => evidenceRule.pattern.test(resumeText) ? Math.max(maximum, evidenceRule.strength) : maximum,
    0
  );
}

function getFallbackTerms(value: string) {
  const words = normalize(value)
    .match(/\b[a-z][a-z0-9+#.]{2,}\b/g)
    ?.filter((word) => !FALLBACK_STOP_WORDS.has(word) && !BROAD_TERMS.has(word)) ?? [];
  const phrases = words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`);
  return new Set([...words, ...phrases]);
}

function getFallbackScore(resumeText: string, jobText: string) {
  const resumeTerms = getFallbackTerms(resumeText);
  const jobTerms = Array.from(getFallbackTerms(jobText));
  if (!resumeTerms.size || !jobTerms.length) return 0;
  const matched = jobTerms.filter((term) => resumeTerms.has(term)).length;
  return Math.min(70, Math.round((matched / Math.min(jobTerms.length, 30)) * 100));
}

export function getFitScoreBreakdown(
  job: Pick<InternshipPosting, "title" | "location" | "description" | "tags">,
  profile?: FitProfile
): FitScoreBreakdown {
  const resumeText = normalize(
    profile?.resumeText?.trim() || profile?.resumeKeywords.join(" ") || ""
  );
  const analyzedResumeText = Boolean(profile?.resumeText?.trim());
  const analyzedJobDescription = Boolean(job.description.trim());

  if (!resumeText) {
    return {
      score: 0,
      matched: [],
      partial: [],
      missing: [],
      analyzedResumeText,
      analyzedJobDescription,
    };
  }

  const jobConcepts = getJobConcepts(job);

  if (!jobConcepts.length) {
    return {
      score: getFallbackScore(resumeText, `${job.title} ${job.description} ${job.tags.join(" ")}`),
      matched: [],
      partial: [],
      missing: [],
      analyzedResumeText,
      analyzedJobDescription,
    };
  }

  const totalRawWeight = jobConcepts.reduce((total, item) => total + item.rawWeight, 0);
  const evidence = jobConcepts.map(({ concept, section, rawWeight }): FitEvidence => {
    const requirementWeight = (rawWeight / totalRawWeight) * 100;
    const evidenceStrength = getResumeEvidenceStrength(resumeText, concept);
    const contribution = requirementWeight * evidenceStrength;
    const status = evidenceStrength >= 0.85 ? "confirmed" : evidenceStrength > 0 ? "partial" : "missing";

    return {
      concept: concept.id,
      label: concept.label,
      section,
      requirementWeight: Number(requirementWeight.toFixed(1)),
      evidenceStrength,
      contribution: Number(contribution.toFixed(1)),
      status,
    };
  });
  const score = Math.round(evidence.reduce((total, item) => total + item.contribution, 0));

  return {
    score: Math.min(100, Math.max(0, score)),
    matched: evidence.filter((item) => item.status === "confirmed").sort((left, right) => right.contribution - left.contribution),
    partial: evidence.filter((item) => item.status === "partial").sort((left, right) => right.contribution - left.contribution),
    missing: evidence.filter((item) => item.status === "missing").sort((left, right) => right.requirementWeight - left.requirementWeight),
    analyzedResumeText,
    analyzedJobDescription,
  };
}

export function getFitScore(
  job: Pick<InternshipPosting, "title" | "location" | "description" | "tags">,
  profile?: FitProfile
) {
  return getFitScoreBreakdown(job, profile).score;
}

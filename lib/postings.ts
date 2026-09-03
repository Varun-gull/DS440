import type { InternshipPosting, Profile } from "./types";
import { getSupabaseServerClient } from "./supabase/server";

type SearchPostingsOptions = {
  query?: string;
  location?: string;
  profile?: Profile;
  kind?: PostingKind;
};

export type PostingKind = "internship" | "new-grad";
export type PostingSort = "fit" | "newest" | "company";
export type PostingProvider = "Cached postings" | "Jobright / Intern-list" | "Jobright / Intern-list + GitHub" | "Curated GitHub" | "CareerUp sample";

export type PostingSearchResult = {
  postings: InternshipPosting[];
  provider: PostingProvider;
  usingFallback: boolean;
  cached?: boolean;
};

type CachedPostingRow = {
  posting_key: string;
  kind: PostingKind;
  company: string;
  title: string;
  location: string;
  source: string;
  source_url: string;
  work_mode: InternshipPosting["workMode"];
  remote: boolean;
  posted_at_label: string;
  recency_score: number;
  tags: string[] | null;
  description: string;
};

export type CachedPostingSearchOptions = SearchPostingsOptions & {
  remote?: "all" | InternshipPosting["workMode"];
  minFit?: number;
  sort?: PostingSort;
  limit?: number;
};

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function stripHtml(value: string) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function getFirstHref(value: string) {
  const match = value.match(/href=["']([^"']+)["']/i);
  return match ? decodeHtml(match[1]) : "";
}

function getMarkdownHref(value: string) {
  const match = value.match(/\[[^\]]+\]\(([^)]+)\)/);
  return match ? decodeHtml(match[1]) : "";
}

function stripMarkdown(value: string) {
  return decodeHtml(value)
    .replace(/\*\*/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function makePostingId(source: string, company: string, title: string, url: string) {
  const value = `${source}-${company}-${title}-${url}`;
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return `${source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash.toString(36)}`;
}

function getFitScore(job: Pick<InternshipPosting, "title" | "location" | "description" | "tags">, profile?: Profile) {
  if (!profile) {
    return 72;
  }

  let score = 62;
  const haystack = `${job.title} ${job.description} ${job.tags.join(" ")}`;

  if (profile.targetRoles.length && includesAny(haystack, profile.targetRoles)) {
    score += 20;
  }

  if (profile.targetLocations.length && includesAny(job.location, profile.targetLocations)) {
    score += 12;
  }

  if (job.location.toLowerCase().includes("remote") && profile.targetLocations.some((location) => location.toLowerCase().includes("remote"))) {
    score += 8;
  }

  const resumeMatches = profile.resumeKeywords.filter((keyword) => includesAny(haystack, [keyword]));

  if (resumeMatches.length > 0) {
    score += Math.min(18, resumeMatches.length * 4);
  }

  return Math.min(98, score);
}

function getWorkMode(value: string): InternshipPosting["workMode"] {
  if (/hybrid/i.test(value)) {
    return "hybrid";
  }

  if (/remote|work from home|wfh/i.test(value)) {
    return "remote";
  }

  return "onsite";
}

function getRoleTags(title: string, source: string) {
  const tags = new Set<string>([source]);
  const normalized = title.toLowerCase();

  if (/software|frontend|backend|full stack|developer|firmware|embedded|cloud|systems/.test(normalized)) {
    tags.add("Software Engineering");
  }

  if (/data|analytics|scientist|machine learning|ml|ai|artificial intelligence|research/.test(normalized)) {
    tags.add("Data/AI");
  }

  if (/product/.test(normalized)) {
    tags.add("Product");
  }

  if (/quant|trading|finance/.test(normalized)) {
    tags.add("Quant/Finance");
  }

  if (/hardware|electrical|mechanical|robotics/.test(normalized)) {
    tags.add("Hardware");
  }

  return Array.from(tags).slice(0, 5);
}

function normalizeQuery(searchQuery: string, kind: PostingKind = "internship") {
  if (kind === "new-grad") {
    const query = /new grad|new graduate|entry level|university grad|college grad/i.test(searchQuery) ? searchQuery : `${searchQuery} new grad`;
    return query.trim();
  }

  const query = searchQuery.toLowerCase().includes("intern") ? searchQuery : `${searchQuery} internship`;
  return query.trim();
}

function buildPostingQueryVariants(searchQuery: string, kind: PostingKind = "internship") {
  const cleanQuery = searchQuery.trim();
  const variants = [
    cleanQuery,
    kind === "new-grad"
      ? /new grad|new graduate|entry level|university grad|college grad/i.test(cleanQuery)
        ? cleanQuery
        : `${cleanQuery} new grad`
      : cleanQuery.toLowerCase().includes("intern")
        ? cleanQuery
        : `${cleanQuery} intern`,
    normalizeQuery(cleanQuery, kind)
  ];

  if (/data scientist/i.test(cleanQuery)) {
    variants.push(cleanQuery.replace(/data scientist/gi, kind === "new-grad" ? "data analyst new grad" : "data intern"));
    variants.push(kind === "new-grad" ? "data analyst new grad" : "data analyst intern");
  }

  if (/software engineer/i.test(cleanQuery)) {
    variants.push(cleanQuery.replace(/software engineer/gi, kind === "new-grad" ? "software engineer new grad" : "software intern"));
    variants.push(kind === "new-grad" ? "software engineer new grad" : "software engineering intern");
  }

  if (/product manager|product management/i.test(cleanQuery)) {
    variants.push(kind === "new-grad" ? "associate product manager" : "product intern");
    variants.push(kind === "new-grad" ? "product management new grad" : "product management intern");
  }

  const firstWord = cleanQuery.split(/\s+/)[0];
  if (firstWord && !/intern|grad/i.test(firstWord)) {
    variants.push(`${firstWord} ${kind === "new-grad" ? "new grad" : "intern"}`);
  }

  variants.push(kind === "new-grad" ? "new grad" : "internship");

  return Array.from(new Set(variants.map((variant) => variant.trim()).filter(Boolean)));
}

function matchesPostingSearch(posting: InternshipPosting, searchQuery: string, targetLocation: string, kind: PostingKind = "internship") {
  const query = searchQuery.trim();
  const location = targetLocation.trim();
  const haystack = `${posting.company} ${posting.title} ${posting.location} ${posting.description} ${posting.tags.join(" ")}`.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const companyMatch = Boolean(normalizedQuery && posting.company.toLowerCase().includes(normalizedQuery));
  const queryTerms = buildPostingQueryVariants(query, kind)
    .flatMap((variant) => variant.toLowerCase().split(/\s+/))
    .filter((term) => term.length > 2 && !["intern", "internship", "grad", "graduate"].includes(term));
  const queryMatch = !queryTerms.length || queryTerms.some((term) => haystack.includes(term));
  const locationMatch = companyMatch || !location || includesAny(posting.location, [location, "remote", "united states", "usa"]);

  return queryMatch && locationMatch;
}

function sortPostingsByMode(postings: InternshipPosting[], sort: PostingSort = "newest") {
  return [...postings].sort((a, b) => {
    if (sort === "company") {
      return a.company.localeCompare(b.company);
    }

    if (sort === "newest") {
      const aRecency = getPostingRecencyScore(a.postedAt);
      const bRecency = getPostingRecencyScore(b.postedAt);

      if (aRecency === bRecency) {
        return 0;
      }

      return aRecency - bRecency;
    }

    const fitDifference = b.fitScore - a.fitScore;

    if (fitDifference !== 0) {
      return fitDifference;
    }

    const aRecency = getPostingRecencyScore(a.postedAt);
    const bRecency = getPostingRecencyScore(b.postedAt);

    if (aRecency === bRecency) {
      return 0;
    }

    return aRecency - bRecency;
  });
}

function makeCuratedPosting({
  source,
  company,
  title,
  location,
  url,
  age,
  profile
}: {
  source: string;
  company: string;
  title: string;
  location: string;
  url: string;
  age: string;
  profile?: Profile;
}): InternshipPosting | null {
  const cleanCompany = company.replace(/^🔥\s*/, "").replace(/^↳$/, "").trim();
  const cleanTitle = title.replace(/[🎓🛂🇺🇸🔒🔥]/g, "").replace(/\s+/g, " ").trim();
  const cleanLocation = location.replace(/\s*,\s*/g, ", ").trim() || "United States";
  const cleanUrl = url.trim();

  if (!cleanCompany || !cleanTitle || !cleanUrl || /closed/i.test(cleanTitle)) {
    return null;
  }

  const workMode = getWorkMode(`${cleanTitle} ${cleanLocation}`);
  const posting = {
    id: makePostingId(source, cleanCompany, cleanTitle, cleanUrl),
    company: cleanCompany,
    title: cleanTitle,
    location: cleanLocation,
    source,
    url: cleanUrl,
    remote: workMode === "remote",
    workMode,
    postedAt: age || "Recently",
    tags: getRoleTags(cleanTitle, source),
    description: `${cleanTitle} at ${cleanCompany}. Curated from ${source} with a direct application link.`
  };

  return {
    ...posting,
    fitScore: getFitScore(posting, profile)
  };
}

function parseSimplifyReadme(markdown: string, profile?: Profile) {
  const rows = Array.from(markdown.matchAll(/<tr>([\s\S]*?)<\/tr>/gi));
  const postings: InternshipPosting[] = [];
  let lastCompany = "";

  rows.forEach((row) => {
    const cells = Array.from(row[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);

    if (cells.length < 5) {
      return;
    }

    const rawCompany = stripHtml(cells[0]);
    const company = rawCompany === "↳" ? lastCompany : rawCompany;
    const title = stripHtml(cells[1]);
    const location = stripHtml(cells[2]);
    const url = getFirstHref(cells[3]);
    const age = stripHtml(cells[4]);

    if (rawCompany && rawCompany !== "↳") {
      lastCompany = rawCompany;
    }

    const posting = makeCuratedPosting({
      source: "Simplify",
      company,
      title,
      location,
      url,
      age,
      profile
    });

    if (posting) {
      postings.push(posting);
    }
  });

  return postings;
}

function parseSpeedyApplyReadme(markdown: string, source: string, profile?: Profile) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && /<a href=.*<strong>/i.test(line) && /alt="Apply"/i.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map((cells) => {
      const hasSalary = cells.length >= 6;
      const company = stripHtml(cells[0] ?? "");
      const title = stripHtml(cells[1] ?? "");
      const location = stripHtml(cells[2] ?? "");
      const postingCell = cells[hasSalary ? 4 : 3] ?? "";
      const age = stripHtml(cells[hasSalary ? 5 : 4] ?? "");
      const url = getFirstHref(postingCell);

      return makeCuratedPosting({
        source,
        company,
        title,
        location,
        url,
        age,
        profile
      });
    })
    .filter((posting): posting is InternshipPosting => Boolean(posting));
}

function parseJobrightReadme(markdown: string, source: string, profile?: Profile) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && /\]\(https?:\/\//.test(line) && !/^\|\s*-/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map((cells) => {
      const company = stripMarkdown(cells[0] ?? "");
      const title = stripMarkdown(cells[1] ?? "");
      const location = stripMarkdown(cells[2] ?? "");
      const workModel = stripMarkdown(cells[3] ?? "");
      const postedAt = stripMarkdown(cells[4] ?? "");
      const url = getMarkdownHref(cells[1] ?? "");
      const workMode = getWorkMode(`${workModel} ${location}`);
      const posting = makeCuratedPosting({
        source,
        company,
        title,
        location,
        url,
        age: postedAt,
        profile
      });

      return posting
        ? {
            ...posting,
            workMode,
            remote: workMode === "remote",
            tags: Array.from(new Set([...posting.tags, workModel].filter(Boolean))).slice(0, 5),
            description: `${title} at ${company}. Curated from Intern-list/Jobright with a recent posting date and application link.`
          }
        : null;
    })
    .filter((posting): posting is InternshipPosting => Boolean(posting));
}

function parseZapplyReadme(markdown: string, source: string, profile?: Profile) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && /\]\(https?:\/\//.test(line) && !/^\|\s*-/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map((cells) => {
      if (cells.length < 6) {
        return null;
      }

      const company = stripMarkdown(cells[0] ?? "");
      const title = stripMarkdown(cells[1] ?? "");
      const location = stripMarkdown(cells[2] ?? "");
      const postedAt = stripMarkdown(cells[3] ?? "");
      const visa = stripMarkdown(cells[4] ?? "");
      const url = getMarkdownHref(cells[5] ?? "");
      const workMode = getWorkMode(`${title} ${location}`);
      const posting = makeCuratedPosting({
        source,
        company,
        title,
        location,
        url,
        age: postedAt,
        profile
      });

      return posting
        ? {
            ...posting,
            workMode,
            remote: workMode === "remote",
            tags: Array.from(new Set([...posting.tags, visa].filter(Boolean))).slice(0, 5),
            description: `${title} at ${company}. Curated from ${source} with a direct application link.`
          }
        : null;
    })
    .filter((posting): posting is InternshipPosting => Boolean(posting));
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 1800 }
  });

  if (!response.ok) {
    return "";
  }

  return response.text();
}

async function searchCuratedGithubPostings(searchQuery: string, targetLocation: string, profile?: Profile, kind: PostingKind = "internship"): Promise<PostingSearchResult | null> {
  const postings = (await fetchCuratedGithubPostings(kind, profile)).filter((posting) => matchesPostingSearch(posting, searchQuery, targetLocation, kind));
  const deduped = dedupePostings(postings);

  return deduped.length > 0
    ? {
        provider: "Curated GitHub",
        usingFallback: false,
        postings: deduped
      }
    : null;
}

export async function fetchCuratedGithubPostings(kind: PostingKind = "internship", profile?: Profile) {
  const sourceUrls =
    kind === "new-grad"
      ? [
          "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
          "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md",
          "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/NEW_GRAD_USA.md",
          "https://raw.githubusercontent.com/zapplyjobs/New-Grad-Jobs-2027/main/README.md"
        ]
      : [
          "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md",
          "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/README.md",
          "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/README.md",
          "https://raw.githubusercontent.com/zapplyjobs/Internships-2027/main/README.md"
        ];
  const [simplifyReadme, speedySweReadme, speedyAiReadme, zapplyReadme] = await Promise.all(sourceUrls.map((url) => fetchText(url)));

  return dedupePostings([
    ...parseSimplifyReadme(simplifyReadme, profile),
    ...parseSpeedyApplyReadme(speedySweReadme, kind === "new-grad" ? "SpeedyApply SWE New Grad" : "SpeedyApply SWE", profile),
    ...parseSpeedyApplyReadme(speedyAiReadme, kind === "new-grad" ? "SpeedyApply AI New Grad" : "SpeedyApply AI", profile),
    ...parseZapplyReadme(zapplyReadme, kind === "new-grad" ? "Zapply New Grad 2027" : "Zapply Internships 2027", profile)
  ]);
}

async function searchJobrightPostings(searchQuery: string, targetLocation: string, profile?: Profile, kind: PostingKind = "internship"): Promise<PostingSearchResult | null> {
  const postings = (await fetchJobrightPostings(kind, profile)).filter((posting) => matchesPostingSearch(posting, searchQuery, targetLocation, kind));
  const deduped = dedupePostings(postings);

  return deduped.length > 0
    ? {
        provider: "Jobright / Intern-list",
        usingFallback: false,
        postings: deduped
      }
    : null;
}

export async function fetchJobrightPostings(kind: PostingKind = "internship", profile?: Profile) {
  const jobrightSources =
    kind === "new-grad"
      ? ([
          ["https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-New-Grad/master/README.md", "Jobright SWE New Grad"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Engineering-New-Grad/master/README.md", "Jobright Engineering New Grad"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Data-Analysis-New-Grad/master/README.md", "Jobright Data New Grad"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Product-Management-New-Grad/master/README.md", "Jobright Product New Grad"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Business-Analyst-New-Grad/master/README.md", "Jobright Business New Grad"],
        ] as const)
      : ([
          ["https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-Internship/master/README.md", "Jobright SWE"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Engineer-Internship/master/README.md", "Jobright Engineering"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Data-Analysis-Internship/master/README.md", "Jobright Data"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Product-Management-Internship/master/README.md", "Jobright Product"],
          ["https://raw.githubusercontent.com/jobright-ai/2026-Business-Analyst-Internship/master/README.md", "Jobright Business"],
        ] as const);

  const readmes = await Promise.all(jobrightSources.map(([url]) => fetchText(url)));
  return dedupePostings(readmes.flatMap((readme, index) => parseJobrightReadme(readme, jobrightSources[index][1], profile)));
}

function dedupePostings(postings: InternshipPosting[]) {
  const collectedPostings = new Map<string, InternshipPosting>();

  postings.forEach((posting) => {
    const normalizedUrl = posting.url.replace(/[?#].*$/, "").toLowerCase();
    const fallbackKey = `${posting.company}-${posting.title}-${posting.location}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const key = normalizedUrl || fallbackKey;
    const existing = collectedPostings.get(key);

    if (!existing || posting.fitScore > existing.fitScore) {
      collectedPostings.set(key, posting);
    }
  });

  return Array.from(collectedPostings.values()).sort((a, b) => {
    const aAge = getPostingRecencyScore(a.postedAt);
    const bAge = getPostingRecencyScore(b.postedAt);

    if (aAge !== bAge) {
      return aAge - bAge;
    }

    return a.company.localeCompare(b.company) || a.title.localeCompare(b.title);
  });
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

function daysSince(date: Date) {
  const now = new Date();
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}

function parseMonthDay(value: string) {
  const match = value.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i);

  if (!match) {
    return null;
  }

  const month = MONTH_INDEX[match[1].toLowerCase()];

  if (month === undefined) {
    return null;
  }

  const day = Number(match[2]);
  const now = new Date();
  const year = match[3] ? Number(match[3]) : now.getFullYear();
  let date = new Date(year, month, day);

  if (!match[3] && date.getTime() - now.getTime() > 86_400_000) {
    date = new Date(year - 1, month, day);
  }

  return daysSince(date);
}

export function getPostingRecencyScore(value: string) {
  const normalized = value.trim().toLowerCase().replace(/^posted\s+/i, "").replace(/\s+ago$/i, "");

  if (!normalized) {
    return Number.POSITIVE_INFINITY;
  }

  if (/^(now|just now|today|recent|recently|new)$/.test(normalized)) {
    return 0;
  }

  if (normalized === "yesterday") {
    return 1;
  }

  const relativeMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|mos|month|months)$/i);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();

    if (/^mo/.test(unit)) return amount * 30;
    if (/^m/.test(unit)) return amount / 1440;
    if (/^h/.test(unit)) return amount / 24;
    if (/^(w|wk)/.test(unit)) return amount * 7;
    return amount;
  }

  const monthDayAge = parseMonthDay(value.trim());
  if (monthDayAge !== null) {
    return monthDayAge;
  }

  const parsedDate = Date.parse(value);
  return Number.isNaN(parsedDate) ? Number.POSITIVE_INFINITY : daysSince(new Date(parsedDate));
}

function fallbackPostings(kind: PostingKind = "internship", profile?: Profile): PostingSearchResult {
  const internshipSeed = [
    {
      id: "fallback-software-internship",
      company: "Northstar Labs",
      title: "Software Engineering Intern",
      location: "Remote",
      source: "CareerUp internship sample",
      url: "https://example.com/software-engineering-intern",
      remote: true,
      workMode: "remote" as const,
      postedAt: "Sample",
      tags: ["Software Engineering", "React", "TypeScript"],
      description: "Build user-facing product features with a small engineering team."
    },
    {
      id: "fallback-data-internship",
      company: "BlueGrid AI",
      title: "Data Science Intern",
      location: "New York, NY",
      source: "CareerUp internship sample",
      url: "https://example.com/data-science-intern",
      remote: false,
      workMode: "onsite" as const,
      postedAt: "Sample",
      tags: ["Data", "Python", "Analytics"],
      description: "Analyze datasets, build dashboards, and support product experiments."
    },
    {
      id: "fallback-product-internship",
      company: "Summit Systems",
      title: "Product Management Intern",
      location: "Washington, DC",
      source: "CareerUp internship sample",
      url: "https://example.com/product-management-intern",
      remote: false,
      workMode: "onsite" as const,
      postedAt: "Sample",
      tags: ["Product", "Research", "Strategy"],
      description: "Work with design and engineering to scope student-facing features."
    }
  ];
  const newGradSeed = [
    {
      id: "fallback-software-new-grad",
      company: "Northstar Labs",
      title: "Software Engineer New Grad",
      location: "Remote",
      source: "CareerUp new grad sample",
      url: "https://example.com/software-engineer-new-grad",
      remote: true,
      workMode: "remote" as const,
      postedAt: "Sample",
      tags: ["Software Engineering", "React", "TypeScript"],
      description: "Join a product engineering team as an entry-level software engineer."
    },
    {
      id: "fallback-data-new-grad",
      company: "BlueGrid AI",
      title: "Data Analyst New Grad",
      location: "New York, NY",
      source: "CareerUp new grad sample",
      url: "https://example.com/data-analyst-new-grad",
      remote: false,
      workMode: "onsite" as const,
      postedAt: "Sample",
      tags: ["Data", "Python", "Analytics"],
      description: "Analyze datasets, build dashboards, and support business decisions in an entry-level analytics role."
    },
    {
      id: "fallback-product-new-grad",
      company: "Summit Systems",
      title: "Associate Product Manager",
      location: "Washington, DC",
      source: "CareerUp new grad sample",
      url: "https://example.com/associate-product-manager",
      remote: false,
      workMode: "onsite" as const,
      postedAt: "Sample",
      tags: ["Product", "Research", "Strategy"],
      description: "Work with design and engineering to scope product features in an entry-level product role."
    }
  ];
  const seed = kind === "new-grad" ? newGradSeed : internshipSeed;

  return {
    provider: "CareerUp sample",
    usingFallback: true,
    postings: seed.map((posting) => ({
      ...posting,
      fitScore: getFitScore(posting, profile)
    }))
  };
}

function mapCachedPosting(row: CachedPostingRow, profile?: Profile): InternshipPosting {
  const posting = {
    id: row.posting_key,
    company: row.company,
    title: row.title,
    location: row.location,
    source: row.source,
    url: row.source_url,
    remote: row.remote,
    workMode: row.work_mode,
    postedAt: row.posted_at_label,
    tags: row.tags ?? [],
    description: row.description,
  };

  return {
    ...posting,
    fitScore: getFitScore(posting, profile),
  };
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[%_,().]/g, " ").replace(/\s+/g, " ").trim();
}

function buildCacheSearchTerms(query: string, kind: PostingKind) {
  return Array.from(
    new Set(
      buildPostingQueryVariants(query, kind)
        .flatMap((variant) => variant.split(/\s+/))
        .map(sanitizeSearchTerm)
        .filter((term) => term.length > 2 && !["intern", "internship", "grad", "graduate"].includes(term.toLowerCase()))
        .slice(0, 8)
    )
  );
}

export async function searchCachedPostings({
  query,
  location,
  profile,
  kind = "internship",
  remote = "all",
  minFit = 0,
  sort = "newest",
  limit = 600,
}: CachedPostingSearchOptions = {}): Promise<PostingSearchResult | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const rawQuery = typeof query === "string" ? query.trim() : "";
  const rawLocation = typeof location === "string" ? location.trim() : "";
  const hasSubmittedSearch = typeof query === "string" || typeof location === "string";
  const searchQuery = rawQuery || (hasSubmittedSearch ? (kind === "new-grad" ? "new grad" : "intern") : profile?.targetRoles[0] || (kind === "new-grad" ? "new grad" : "intern"));
  const targetLocation = rawLocation || (hasSubmittedSearch || rawQuery ? "" : profile?.targetLocations[0] || "");
  const terms = buildCacheSearchTerms(searchQuery, kind);

  let request = supabase
    .from("postings")
    .select("posting_key, kind, company, title, location, source, source_url, work_mode, remote, posted_at_label, recency_score, tags, description")
    .eq("kind", kind);

  if (remote !== "all") {
    request = request.eq("work_mode", remote);
  }

  if (terms.length > 0) {
    request = request.or(
      terms
        .flatMap((term) => [
          `company.ilike.%${term}%`,
          `title.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `tags_text.ilike.%${term}%`,
        ])
        .join(",")
    );
  }

  if (targetLocation) {
    const cleanLocation = sanitizeSearchTerm(targetLocation);
    request = request.or(`location.ilike.%${cleanLocation}%,location.ilike.%Remote%,location.ilike.%United States%,location.ilike.%USA%`);
  }

  const { data, error } = await request
    .order(sort === "company" ? "company" : "recency_score", { ascending: true })
    .limit(Math.max(50, Math.min(2000, limit * 3)))
    .returns<CachedPostingRow[]>();

  if (error || !data) {
    return null;
  }

  const postings = sortPostingsByMode(
    data
      .map((row) => mapCachedPosting(row, profile))
      .filter((posting) => matchesPostingSearch(posting, searchQuery, targetLocation, kind))
      .filter((posting) => posting.fitScore >= minFit),
    sort
  ).slice(0, limit);

  if (postings.length === 0 && data.length === 0) {
    return null;
  }

  return {
    provider: "Cached postings",
    usingFallback: false,
    cached: true,
    postings,
  };
}

export async function searchInternshipPostings({ query, location, profile, kind = "internship" }: SearchPostingsOptions = {}): Promise<PostingSearchResult> {
  const rawQuery = typeof query === "string" ? query.trim() : "";
  const rawLocation = typeof location === "string" ? location.trim() : "";
  const hasSubmittedSearch = typeof query === "string" || typeof location === "string";
  const searchQuery = rawQuery || (hasSubmittedSearch ? (kind === "new-grad" ? "new grad" : "intern") : profile?.targetRoles[0] || (kind === "new-grad" ? "new grad" : "intern"));
  const targetLocation = rawLocation || (hasSubmittedSearch || rawQuery ? "" : profile?.targetLocations[0] || "");

  try {
    const jobrightResults = await searchJobrightPostings(searchQuery, targetLocation, profile, kind);
    const curatedResults = await searchCuratedGithubPostings(searchQuery, targetLocation, profile, kind);

    if (jobrightResults && curatedResults) {
      return {
        provider: "Jobright / Intern-list + GitHub",
        usingFallback: false,
        postings: dedupePostings([...jobrightResults.postings, ...curatedResults.postings])
      };
    }

    if (jobrightResults) {
      return jobrightResults;
    }

    if (curatedResults) {
      return curatedResults;
    }

    return fallbackPostings(kind, profile);
  } catch {
    return fallbackPostings(kind, profile);
  }
}

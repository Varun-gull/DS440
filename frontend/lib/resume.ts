export const keywordGroups = [
  "python",
  "java",
  "javascript",
  "typescript",
  "react",
  "next.js",
  "node",
  "express",
  "sql",
  "postgres",
  "supabase",
  "mongodb",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "git",
  "html",
  "css",
  "tailwind",
  "figma",
  "excel",
  "tableau",
  "power bi",
  "pandas",
  "numpy",
  "scikit-learn",
  "tensorflow",
  "pytorch",
  "machine learning",
  "data science",
  "data analysis",
  "analytics",
  "api",
  "rest",
  "graphql",
  "frontend",
  "backend",
  "full stack",
  "mobile",
  "ios",
  "android",
  "swift",
  "kotlin",
  "c++",
  "c#",
  "r",
  "matlab",
  "product management",
  "user research",
  "agile",
  "scrum",
  "testing",
  "automation",
  "cloud",
  "security",
  "cybersecurity",
  "linux"
];

const stopWords = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "this",
  "that",
  "have",
  "using",
  "into",
  "your",
  "you",
  "are",
  "was",
  "were",
  "will",
  "can",
  "our",
  "their",
  "project",
  "work",
  "team",
  "experience",
  "skills",
  "education",
  "university",
  "college"
]);

export function normalizeResumeText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 18_000);
}

type UploadedResumeFile = {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function extractPdfTextWithPdfParse(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return normalizeResumeText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

async function extractPdfTextWithPdfJs(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  try {
    let text = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      text += "\n";
    }

    return normalizeResumeText(text);
  } finally {
    await pdf.destroy();
  }
}

export async function extractResumeTextFromFile(file: UploadedResumeFile) {
  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (fileName.endsWith(".pdf")) {
    try {
      return await withTimeout(extractPdfTextWithPdfParse(buffer), 10_000, "PDF text extraction");
    } catch (pdfParseError) {
      try {
        return await withTimeout(extractPdfTextWithPdfJs(buffer), 10_000, "PDF fallback extraction");
      } catch {
        throw pdfParseError;
      }
    }
  }

  if (fileName.endsWith(".docx")) {
    const mammoth = await withTimeout(import("mammoth"), 10_000, "DOCX parser load");
    const result = await withTimeout(mammoth.extractRawText({ buffer }), 10_000, "DOCX text extraction");
    return normalizeResumeText(result.value ?? "");
  }

  return normalizeResumeText(await withTimeout(file.text(), 10_000, "Resume text extraction"));
}

export function extractResumeKeywords(text: string) {
  const normalized = normalizeResumeText(text).toLowerCase();
  const keywords = new Set<string>();

  keywordGroups.forEach((keyword) => {
    if (normalized.includes(keyword)) {
      keywords.add(keyword);
    }
  });

  normalized
    .match(/\b[a-z][a-z+#.-]{2,}\b/g)
    ?.filter((word) => !stopWords.has(word))
    .slice(0, 300)
    .forEach((word) => {
      if (keywords.size < 24 && /[+#.]|sql|api|cloud|data|design|engineer|analyst|product|research|software/.test(word)) {
        keywords.add(word);
      }
    });

  if (keywords.size === 0) {
    normalized
      .match(/\b[a-z][a-z+#.-]{3,}\b/g)
      ?.filter((word) => !stopWords.has(word))
      .slice(0, 12)
      .forEach((word) => keywords.add(word));
  }

  return Array.from(keywords).slice(0, 24);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function extractJobKeywords(value: string) {
  const normalized = normalizeResumeText(value).toLowerCase();
  const keywords = new Set<string>();

  keywordGroups.forEach((keyword) => {
    if (normalized.includes(keyword)) {
      keywords.add(keyword);
    }
  });

  normalized
    .match(/\b[a-z][a-z+#.-]{2,}\b/g)
    ?.filter((word) => !stopWords.has(word))
    .slice(0, 160)
    .forEach((word) => {
      if (keywords.size < 18 && /[+#.]|sql|api|cloud|data|design|engineer|analyst|product|research|software|intern|developer|machine|learning|ai/.test(word)) {
        keywords.add(word);
      }
    });

  return Array.from(keywords).slice(0, 18);
}

export function buildResumeOptimization({
  resumeText,
  resumeKeywords,
  company,
  role,
  jobDescription,
  jobTags,
}: {
  resumeText: string;
  resumeKeywords: string[];
  company: string;
  role: string;
  jobDescription: string;
  jobTags: string[];
}) {
  const jobKeywords = extractJobKeywords(`${role} ${company} ${jobDescription} ${jobTags.join(" ")}`);
  const matchedKeywords = jobKeywords.filter((keyword) => resumeKeywords.some((resumeKeyword) => resumeKeyword.toLowerCase() === keyword.toLowerCase()));
  const missingKeywords = jobKeywords.filter((keyword) => !matchedKeywords.includes(keyword)).slice(0, 8);
  const strongestKeywords = [...matchedKeywords, ...missingKeywords].slice(0, 10);
  const skillsLine = strongestKeywords.map(titleCase).join(", ") || "role-specific tools, technical problem solving, collaboration";
  const originalResume = normalizeResumeText(resumeText);

  return `TAILORED RESUME SUGGESTION FOR ${company.toUpperCase()} - ${role.toUpperCase()}

Important: this is a suggested application version. Your saved CareerUp resume has not been changed.

TARGETED SUMMARY
${role} candidate with experience across ${skillsLine}. Interested in contributing to ${company} by applying technical problem-solving, project execution, and clear communication to internship-level work.

KEYWORDS TO INCLUDE
${strongestKeywords.length ? strongestKeywords.map((keyword) => `- ${titleCase(keyword)}`).join("\n") : "- Add exact tools, skills, and responsibilities from the posting."}

SUGGESTED SKILLS SECTION
Technical Skills: ${skillsLine}

SUGGESTED BULLET UPGRADES
- Built and improved projects using ${strongestKeywords.slice(0, 3).map(titleCase).join(", ") || "relevant technical tools"}, focusing on measurable outcomes and user impact.
- Applied ${strongestKeywords.slice(3, 6).map(titleCase).join(", ") || "data-driven problem solving"} to analyze requirements, implement solutions, and communicate results clearly.
- Collaborated in a fast-moving environment by breaking down ambiguous tasks, testing work carefully, and documenting decisions for teammates.

JOB DESCRIPTION SIGNALS TO MIRROR
${jobDescription ? jobDescription.slice(0, 900) : "Open the original posting and mirror the most important requirements using truthful resume wording."}

YOUR ORIGINAL RESUME TEXT
${originalResume}

HOW TO USE THIS
Copy the suggested summary, skills line, and bullet upgrades into a separate resume copy for this application. Keep only statements that are accurate to your actual experience.`;
}

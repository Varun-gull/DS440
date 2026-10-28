import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getFitScoreBreakdown } from "../lib/fit-score.ts";
import { extractResumeKeywords } from "../lib/resume.ts";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DATASET_DIRECTORY = path.join(REPOSITORY_ROOT, "data/private/resume-evaluation");
const DATASET_PATH = path.join(DATASET_DIRECTORY, "validation.csv");
const RESULTS_DIRECTORY = path.join(REPOSITORY_ROOT, "docs/evaluation");
const RESULTS_PATH = path.join(RESULTS_DIRECTORY, "resume-scanner-baseline.json");
const DATASET_URL = "https://huggingface.co/datasets/0xnbk/resume-domain-classifier-v1-en/resolve/main/validation.csv";
const DATASET_ID = "0xnbk/resume-domain-classifier-v1-en";
const DATASET_REVISION = "46ecfa6f5f4a978d6aa88ceeb2d0d1c30c96fb27";

async function ensureDataset() {
  try {
    return await readFile(DATASET_PATH, "utf8");
  } catch {
    await mkdir(DATASET_DIRECTORY, { recursive: true });
    const response = await fetch(DATASET_URL);

    if (!response.ok) {
      throw new Error(`Dataset download failed with status ${response.status}`);
    }

    const content = await response.text();
    await writeFile(DATASET_PATH, content);
    return content;
  }
}

function parseCsv(content) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    records.push(row);
  }

  const [header, ...data] = records;
  return data
    .filter((values) => values.length === header.length)
    .map((values) => Object.fromEntries(header.map((name, index) => [name, values[index]])));
}

function splitPair(text) {
  const separatorIndex = text.indexOf("[SEP]");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    resume: text.slice(0, separatorIndex).trim(),
    job: text.slice(separatorIndex + 5).trim(),
  };
}

function stableBucket(value) {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) % 5;
}

function confusionMetrics(rows, threshold, scoreField = "score") {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;

  rows.forEach((row) => {
    const { label } = row;
    const score = row[scoreField];
    const prediction = score >= threshold ? 1 : 0;
    if (prediction === 1 && label === 1) truePositive += 1;
    if (prediction === 1 && label === 0) falsePositive += 1;
    if (prediction === 0 && label === 0) trueNegative += 1;
    if (prediction === 0 && label === 1) falseNegative += 1;
  });

  const safeDivide = (numerator, denominator) => (denominator ? numerator / denominator : 0);
  const precision = safeDivide(truePositive, truePositive + falsePositive);
  const recall = safeDivide(truePositive, truePositive + falseNegative);
  const specificity = safeDivide(trueNegative, trueNegative + falsePositive);
  const accuracy = safeDivide(truePositive + trueNegative, rows.length);
  const f1 = safeDivide(2 * precision * recall, precision + recall);

  return {
    threshold,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    accuracy,
    balancedAccuracy: (recall + specificity) / 2,
    precision,
    recall,
    specificity,
    f1,
  };
}

function rocAuc(rows, scoreField = "score") {
  const sorted = [...rows].sort((left, right) => left[scoreField] - right[scoreField]);
  let positiveCount = 0;
  let negativeCount = 0;
  let positiveRankSum = 0;
  let index = 0;

  while (index < sorted.length) {
    let end = index + 1;
    while (end < sorted.length && sorted[end][scoreField] === sorted[index][scoreField]) end += 1;
    const averageRank = ((index + 1) + end) / 2;

    for (let itemIndex = index; itemIndex < end; itemIndex += 1) {
      if (sorted[itemIndex].label === 1) {
        positiveCount += 1;
        positiveRankSum += averageRank;
      } else {
        negativeCount += 1;
      }
    }

    index = end;
  }

  return (
    (positiveRankSum - (positiveCount * (positiveCount + 1)) / 2) /
    (positiveCount * negativeCount)
  );
}

function wilsonInterval(successes, total, z = 1.96) {
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (proportion + (z * z) / (2 * total)) / denominator;
  const margin =
    (z / denominator) *
    Math.sqrt((proportion * (1 - proportion)) / total + (z * z) / (4 * total * total));
  return [center - margin, center + margin];
}

function calibrationMetrics(rows) {
  const scoreGroups = new Map();
  let brierTotal = 0;

  rows.forEach(({ label, score }) => {
    const probability = score / 100;
    brierTotal += (probability - label) ** 2;
    const group = scoreGroups.get(score) ?? { score, count: 0, positives: 0 };
    group.count += 1;
    group.positives += label;
    scoreGroups.set(score, group);
  });

  const byScore = Array.from(scoreGroups.values())
    .sort((left, right) => left.score - right.score)
    .map((group) => ({
      ...group,
      observedPositiveRate: group.positives / group.count,
    }));
  const expectedCalibrationError = byScore.reduce(
    (total, group) =>
      total +
      (group.count / rows.length) *
        Math.abs(group.score / 100 - group.observedPositiveRate),
    0
  );

  return {
    brierScore: brierTotal / rows.length,
    expectedCalibrationError,
    byScore,
  };
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

const CONTEXT_STOP_WORDS = new Set(
  "a an and are as at be been being by can could did do does doing for from had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves work works working experience experienced experiences skill skills ability abilities knowledge strong excellent including required preferred plus years year role roles position positions team teams job jobs company companies using use used".split(" ")
);

function contextTokens(value) {
  const normalized = value
    .toLowerCase()
    .replaceAll("c++", "cplusplus")
    .replaceAll("c#", "csharp")
    .replaceAll(".net", "dotnet");
  const words = (normalized.match(/[a-z][a-z0-9]+/g) ?? [])
    .filter((word) => word.length >= 3 && !CONTEXT_STOP_WORDS.has(word))
    .slice(0, 500);
  const bigrams = words.slice(0, -1).map((word, index) => `${word}_${words[index + 1]}`);
  return [...words, ...bigrams];
}

function buildContextDocumentFrequency(rows) {
  const frequency = new Map();
  let documentCount = 0;

  rows.forEach((row) => {
    [row.resumeText, row.jobText].forEach((document) => {
      documentCount += 1;
      new Set(contextTokens(document)).forEach((token) => {
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
      });
    });
  });

  return { frequency, documentCount };
}

function contextVector(value, documentFrequency) {
  const counts = new Map();
  contextTokens(value).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  const weights = new Map();
  let squaredNorm = 0;

  counts.forEach((count, token) => {
    const inverseDocumentFrequency =
      Math.log(
        (documentFrequency.documentCount + 1) /
          ((documentFrequency.frequency.get(token) ?? 0) + 1)
      ) + 1;
    const weight = (1 + Math.log(count)) * inverseDocumentFrequency;
    weights.set(token, weight);
    squaredNorm += weight * weight;
  });

  return { weights, norm: Math.sqrt(squaredNorm) || 1 };
}

function contextSimilarity(resume, job, documentFrequency) {
  let resumeVector = contextVector(resume, documentFrequency);
  let jobVector = contextVector(job, documentFrequency);

  if (resumeVector.weights.size > jobVector.weights.size) {
    [resumeVector, jobVector] = [jobVector, resumeVector];
  }

  let dotProduct = 0;
  resumeVector.weights.forEach((weight, token) => {
    dotProduct += weight * (jobVector.weights.get(token) ?? 0);
  });

  return dotProduct / (resumeVector.norm * jobVector.norm);
}

function summarizeDomainErrors(rows, threshold) {
  const falsePositivePairs = new Map();
  const falseNegativeDomains = new Map();
  const falsePositiveKeywords = new Map();

  rows.forEach((row) => {
    const prediction = row.score >= threshold ? 1 : 0;

    if (row.label === 0 && prediction === 1) {
      const key = `${row.resumeDomain} → ${row.jobDomain}`;
      const current = falsePositivePairs.get(key) ?? { pair: key, count: 0, scoreTotal: 0 };
      current.count += 1;
      current.scoreTotal += row.score;
      falsePositivePairs.set(key, current);
      row.matchedKeywords.forEach((keyword) => {
        falsePositiveKeywords.set(keyword, (falsePositiveKeywords.get(keyword) ?? 0) + 1);
      });
    }

    if (row.label === 1 && prediction === 0) {
      const current = falseNegativeDomains.get(row.resumeDomain) ?? {
        domain: row.resumeDomain,
        count: 0,
        scoreTotal: 0,
      };
      current.count += 1;
      current.scoreTotal += row.score;
      falseNegativeDomains.set(row.resumeDomain, current);
    }
  });

  return {
    falsePositiveDomainPairs: Array.from(falsePositivePairs.values())
      .map((item) => ({ ...item, meanScore: item.scoreTotal / item.count }))
      .sort((left, right) => right.count - left.count || right.meanScore - left.meanScore)
      .slice(0, 10)
      .map(({ scoreTotal, ...item }) => item),
    falseNegativeDomains: Array.from(falseNegativeDomains.values())
      .map((item) => ({ ...item, meanScore: item.scoreTotal / item.count }))
      .sort((left, right) => right.count - left.count || left.meanScore - right.meanScore)
      .slice(0, 10)
      .map(({ scoreTotal, ...item }) => item),
    falsePositiveKeywords: Array.from(falsePositiveKeywords.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((left, right) => right.count - left.count || left.keyword.localeCompare(right.keyword))
      .slice(0, 15),
  };
}

function roundMetrics(value) {
  if (Array.isArray(value)) return value.map(roundMetrics);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundMetrics(item)]));
  }
  if (typeof value === "number" && !Number.isInteger(value)) return Number(value.toFixed(6));
  return value;
}

const csv = await ensureDataset();
const sourceRows = parseCsv(csv);
const evaluatedRows = [];
const uniqueResumeHashes = new Set();
const uniqueJobHashes = new Set();

for (const sourceRow of sourceRows) {
  const pair = splitPair(sourceRow.text);
  if (!pair) continue;

  const resumeKeywords = extractResumeKeywords(pair.resume);
  const job = {
    title: pair.job.split(/\r?\n/, 1)[0] || "Job posting",
    location: "",
    description: pair.job,
    tags: [],
  };
  const fitBreakdown = getFitScoreBreakdown(
    job,
    {
      targetRoles: [],
      targetLocations: [],
      resumeText: pair.resume,
      resumeKeywords,
    }
  );
  const legacyMatchedKeywords = resumeKeywords.filter((keyword) => pair.job.toLowerCase().includes(keyword.toLowerCase()));
  const legacyScore = Math.min(98, 62 + Math.min(18, legacyMatchedKeywords.length * 4));

  uniqueResumeHashes.add(createHash("sha256").update(pair.resume).digest("hex"));
  uniqueJobHashes.add(createHash("sha256").update(pair.job).digest("hex"));
  evaluatedRows.push({
    label: Number(sourceRow.label),
    score: fitBreakdown.score,
    legacyScore,
    pairType: sourceRow.pair_type,
    resumeDomain: sourceRow.resume_domain,
    jobDomain: sourceRow.job_domain,
    matchedKeywords: [...fitBreakdown.matched, ...fitBreakdown.partial].map((item) => item.label),
    split: stableBucket(sourceRow.text) === 0 ? "calibration" : "evaluation",
    resumeText: pair.resume,
    jobText: pair.job,
  });
}

const calibrationRows = evaluatedRows.filter((row) => row.split === "calibration");
const evaluationRows = evaluatedRows.filter((row) => row.split === "evaluation");
const candidateThresholds = Array.from(new Set(calibrationRows.map((row) => row.score))).sort(
  (left, right) => left - right
);
const thresholdSearch = candidateThresholds.map((threshold) =>
  confusionMetrics(calibrationRows, threshold)
);
const selectedThreshold = thresholdSearch.sort(
  (left, right) =>
    right.balancedAccuracy - left.balancedAccuracy || right.f1 - left.f1 || right.threshold - left.threshold
)[0].threshold;
const classification = confusionMetrics(evaluationRows, selectedThreshold);
const correct = classification.truePositive + classification.trueNegative;
const positiveScores = evaluationRows.filter((row) => row.label === 1).map((row) => row.score);
const negativeScores = evaluationRows.filter((row) => row.label === 0).map((row) => row.score);
const legacyThresholdSearch = Array.from(new Set(calibrationRows.map((row) => row.legacyScore)))
  .sort((left, right) => left - right)
  .map((threshold) => confusionMetrics(calibrationRows, threshold, "legacyScore"));
const selectedLegacyThreshold = legacyThresholdSearch.sort(
  (left, right) =>
    right.balancedAccuracy - left.balancedAccuracy || right.f1 - left.f1 || right.threshold - left.threshold
)[0].threshold;
const legacyClassification = confusionMetrics(evaluationRows, selectedLegacyThreshold, "legacyScore");
const legacyCorrect = legacyClassification.truePositive + legacyClassification.trueNegative;
const positiveLegacyScores = evaluationRows.filter((row) => row.label === 1).map((row) => row.legacyScore);
const negativeLegacyScores = evaluationRows.filter((row) => row.label === 0).map((row) => row.legacyScore);
const contextDocumentFrequency = buildContextDocumentFrequency(calibrationRows);

evaluatedRows.forEach((row) => {
  row.contextScore = contextSimilarity(row.resumeText, row.jobText, contextDocumentFrequency);
});

const contextThresholdSearch = Array.from({ length: 501 }, (_, index) => index / 1000).map(
  (threshold) => confusionMetrics(calibrationRows, threshold, "contextScore")
);
const selectedContextThreshold = contextThresholdSearch.sort(
  (left, right) =>
    right.balancedAccuracy - left.balancedAccuracy || right.f1 - left.f1 || right.threshold - left.threshold
)[0].threshold;
const contextClassification = confusionMetrics(
  evaluationRows,
  selectedContextThreshold,
  "contextScore"
);
const contextCorrect = contextClassification.truePositive + contextClassification.trueNegative;
const positiveContextScores = evaluationRows
  .filter((row) => row.label === 1)
  .map((row) => row.contextScore);
const negativeContextScores = evaluationRows
  .filter((row) => row.label === 0)
  .map((row) => row.contextScore);

const result = roundMetrics({
  generatedAt: new Date().toISOString(),
  dataset: {
    id: DATASET_ID,
    url: `https://huggingface.co/datasets/${DATASET_ID}`,
    revision: DATASET_REVISION,
    license: "Apache 2.0",
    sourceRows: sourceRows.length,
    evaluatedRows: evaluatedRows.length,
    uniqueResumes: uniqueResumeHashes.size,
    uniqueJobs: uniqueJobHashes.size,
    positivePairs: evaluatedRows.filter((row) => row.label === 1).length,
    negativePairs: evaluatedRows.filter((row) => row.label === 0).length,
  },
  protocol: {
    scanner: "CareerUp production concept and evidence fit score function",
    calibrationRule: "SHA256 pair hash modulo 5 equals 0",
    calibrationRows: calibrationRows.length,
    evaluationRows: evaluationRows.length,
    thresholdSelection: "Maximum balanced accuracy on calibration split",
    selectedThreshold,
    targetRolesExcluded: true,
    locationsExcluded: true,
    reason: "The dataset supplies domain labels but not user selected role or location preferences. Excluding them avoids label leakage and isolates resume to job text matching.",
  },
  results: {
    legacyKeywordBaseline: {
      selectedThreshold: selectedLegacyThreshold,
      classification: legacyClassification,
      accuracyConfidenceInterval95: wilsonInterval(legacyCorrect, evaluationRows.length),
      rocAuc: rocAuc(evaluationRows, "legacyScore"),
      positiveMeanScore: mean(positiveLegacyScores),
      negativeMeanScore: mean(negativeLegacyScores),
      scoreSeparation: mean(positiveLegacyScores) - mean(negativeLegacyScores),
    },
    productionContextAware: {
      classification,
      accuracyConfidenceInterval95: wilsonInterval(correct, evaluationRows.length),
      rocAuc: rocAuc(evaluationRows),
      positiveMeanScore: mean(positiveScores),
      negativeMeanScore: mean(negativeScores),
      scoreSeparation: mean(positiveScores) - mean(negativeScores),
      calibration: calibrationMetrics(evaluationRows),
      errors: summarizeDomainErrors(evaluationRows, selectedThreshold),
      accuracyUpliftFromLegacy: classification.accuracy - legacyClassification.accuracy,
      rocAucUpliftFromLegacy: rocAuc(evaluationRows) - rocAuc(evaluationRows, "legacyScore"),
    },
    experimentalContextWeightedBaseline: {
      status: "Evaluation prototype only. Not used by the CareerUp website.",
      method: "TF IDF cosine similarity over meaningful unigrams and bigrams. IDF is learned only from the calibration split.",
      selectedThreshold: selectedContextThreshold,
      classification: contextClassification,
      accuracyConfidenceInterval95: wilsonInterval(contextCorrect, evaluationRows.length),
      rocAuc: rocAuc(evaluationRows, "contextScore"),
      positiveMeanScore: mean(positiveContextScores),
      negativeMeanScore: mean(negativeContextScores),
      scoreSeparation: mean(positiveContextScores) - mean(negativeContextScores),
      accuracyUplift: contextClassification.accuracy - classification.accuracy,
      rocAucUplift: rocAuc(evaluationRows, "contextScore") - rocAuc(evaluationRows),
    },
  },
  validityNotes: [
    "The test uses aggregate metrics only. No resume text is written to the result file.",
    "The dataset contains generated resume profiles paired with real job descriptions, so it tests domain compatibility more directly than real hiring outcomes.",
    "The fit score is evaluated as a screening signal, not as a hiring decision or prediction of candidate success.",
    "A future external test should use student resumes and manually labeled job relevance judgments with consent.",
  ],
});

await mkdir(RESULTS_DIRECTORY, { recursive: true });
await writeFile(RESULTS_PATH, `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify(result, null, 2));

import assert from "node:assert/strict";

import { getFitScoreBreakdown } from "../lib/fit-score.ts";

const machineLearningJob = {
  title: "Machine Learning Intern",
  location: "New York, NY",
  tags: ["Machine Learning"],
  description: `Responsibilities:
Build forecasting models and analyze datasets.
Required Qualifications:
Python and SQL.
Preferred Qualifications:
Tableau and strong communication skills.`,
};

function score(resumeText) {
  return getFitScoreBreakdown(machineLearningJob, {
    resumeText,
    resumeKeywords: [],
    targetRoles: [],
    targetLocations: [],
  });
}

const vagueModel = score("Designed a model for a class project using Python and SQL.");
const contextualModel = score("Designed a forecasting model for a class project using Python and SQL.");
const unrelatedAi = score("Sold an AI enabled product and managed customer accounts.");
const broadWordsOnly = score("Worked with data and AI in a business technology environment.");

assert.equal(
  vagueModel.partial.some((item) => item.concept === "machine-learning"),
  true,
  "A generic designed model phrase should receive partial machine learning credit"
);
assert.equal(
  contextualModel.matched.some((item) => item.concept === "machine-learning"),
  true,
  "A forecasting model should confirm machine learning evidence"
);
assert.ok(
  contextualModel.score > vagueModel.score,
  "Contextual model evidence should score higher than an ambiguous model phrase"
);
assert.equal(unrelatedAi.score, 0, "AI used as company or product language should not create a match");
assert.equal(broadWordsOnly.score, 0, "Broad terms should not create a fit score by themselves");

const pythonEvidence = contextualModel.matched.find((item) => item.concept === "python");
const tableauGap = contextualModel.missing.find((item) => item.concept === "data-visualization");
assert.ok(pythonEvidence, "Python should be confirmed");
assert.ok(tableauGap, "Tableau should remain missing");
assert.ok(
  pythonEvidence.requirementWeight > tableauGap.requirementWeight,
  "A required qualification should outweigh a preferred qualification"
);

console.log(JSON.stringify({
  vagueModelScore: vagueModel.score,
  contextualModelScore: contextualModel.score,
  unrelatedAiScore: unrelatedAi.score,
  broadWordsOnlyScore: broadWordsOnly.score,
  requiredPythonWeight: pythonEvidence.requirementWeight,
  preferredTableauWeight: tableauGap.requirementWeight,
}, null, 2));

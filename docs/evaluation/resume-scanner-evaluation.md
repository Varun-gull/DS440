# CareerUp Resume Scanner Evaluation

Evaluation date: October 7, 2026

## Executive summary

CareerUp's resume scanner was tested on 37,740 labeled resume and job description pairs from the Hugging Face `0xnbk/resume-domain-classifier-v1-en` dataset. The final evaluation split contained 30,082 pairs that were not used to select the decision threshold.

The original keyword scanner achieved 54.7% accuracy and a 0.547 ROC AUC. The new production scanner reads the full resume and job description, separates job sections, recognizes related concepts, and assigns partial or full evidence credit. It achieved 62.3% accuracy and a 0.641 ROC AUC. Accuracy increased by 7.6 percentage points, recall increased from 17.0% to 39.0%, and F1 increased from 27.2% to 50.8%.

An evaluation-only TF IDF baseline achieved 72.6% accuracy and a 0.764 ROC AUC on the same held-out pairs. This remains a research prototype because production scoring must preserve requirement-level explanations rather than returning only a document similarity value.

## Dataset

Source: [Hugging Face Resume Domain Classifier Dataset](https://huggingface.co/datasets/0xnbk/resume-domain-classifier-v1-en)

Pinned dataset revision: `46ecfa6f5f4a978d6aa88ceeb2d0d1c30c96fb27`

License: Apache 2.0

| Property | Value |
| --- | ---: |
| Labeled resume and job pairs | 37,740 |
| Unique resumes | 37,676 |
| Unique job descriptions | 30,780 |
| Valid same domain pairs | 18,884 |
| Invalid cross domain pairs | 18,856 |
| Professional domains | 13 |
| Calibration pairs | 7,658 |
| Final evaluation pairs | 30,082 |

The dataset was selected because it directly represents CareerUp's matching task. Every record contains a resume, a job description, and a binary ground truth label indicating whether they belong to the same professional domain.

## Evaluation protocol

1. The original baseline extracted resume keywords and checked for raw substring overlap.
2. The production scanner analyzed the full resume and full job description with the actual CareerUp `getFitScoreBreakdown` function.
3. The production scanner assigned different weights to required qualifications, responsibilities, preferred qualifications, title context, and tags.
4. Related evidence could receive partial or full credit. For example, `designed a model` receives partial machine learning credit, while `designed a forecasting model` receives full credit.
5. Target role and location preferences were excluded because the dataset does not provide genuine user preferences. Adding the known domain label as a target role would leak the answer into the score.
6. A deterministic SHA256 rule assigned approximately 20% of pairs to calibration and 80% to final evaluation.
7. The fit threshold was selected only on the calibration split by maximizing balanced accuracy.
8. The threshold was locked before metrics were calculated on the final evaluation split.
9. No resume text or personally identifying information was written to the aggregate results file.

## Production scanner results

The calibration process selected a fit threshold of 10 for the new evidence coverage score.

| Metric | Original keyword scanner | New production scanner | Change |
| --- | ---: | ---: | ---: |
| Accuracy | 54.7% | 62.3% | +7.6 points |
| Balanced accuracy | 54.6% | 62.3% | +7.7 points |
| Precision | 68.4% | 72.9% | +4.4 points |
| Recall | 17.0% | 39.0% | +22.0 points |
| Specificity | 92.2% | 85.6% | -6.6 points |
| F1 score | 27.2% | 50.8% | +23.5 points |
| ROC AUC | 0.547 | 0.641 | +0.094 |

The new scanner's 95% confidence interval for accuracy is 61.8% to 62.9%. Mean score separation increased from 0.57 points to 14.22 points, showing that valid and invalid pairs receive more distinguishable scores.

### Confusion matrix

| | Predicted match | Predicted nonmatch |
| --- | ---: | ---: |
| Actual match | 5,840 | 9,152 |
| Actual nonmatch | 2,175 | 12,915 |

The new scanner identifies more valid matches while continuing to reject most unrelated pairs. Recall more than doubled, although the current concept vocabulary still misses many valid examples outside the most developed career areas.

## Error analysis

### Common word protection

The production scorer no longer awards evidence for the words `data`, `AI`, `model`, `technology`, `business`, `design`, `product`, or `software` by themselves. Complete concepts such as `predictive model`, `data analysis`, `product management`, and `UX design` remain eligible evidence. Exact word boundaries also prevent the single letter skill `R` from matching letters inside ordinary words.

### Domains with the most false negatives

Government and nonprofit, human resources, manufacturing and operations, retail and hospitality, construction and real estate, technology, design, legal, finance, and education produced many false negatives. The next vocabulary expansion should add more specific concepts and evidence patterns for these fields.

### Cross domain pairs with frequent false positives

The most frequent errors included design resumes matched with technology, sales and marketing, or media jobs. Technology resumes were also confused with design and finance jobs. These fields share broad vocabulary but require different skill combinations.

## Evaluation-only TF IDF baseline

The experimental baseline uses TF IDF weighting over meaningful single words and two word phrases. Word frequency weights were learned only from the calibration split. It is not currently used by the CareerUp website.

| Metric | New production scanner | TF IDF prototype | Change |
| --- | ---: | ---: | ---: |
| Accuracy | 62.3% | 72.6% | +10.3 points |
| Balanced accuracy | 62.3% | 72.6% | +10.3 points |
| Precision | 72.9% | 80.6% | +7.8 points |
| Recall | 39.0% | 59.4% | +20.4 points |
| F1 score | 50.8% | 68.4% | +17.6 points |
| ROC AUC | 0.641 | 0.764 | +0.123 |

These results support the proposed direction, but they do not prove that the prototype is ready for production. The next version must preserve explainability, be calibrated, and pass an external human-labeled test.

## Improvement plan

### Phase 1: Correct exact matching

1. Replace raw substring checks with token boundary and complete phrase matching.
2. Treat short technical skills such as `R`, `C`, `C++`, and `C#` as exact tokens.
3. Remove duplicate and overly broad extracted keywords.
4. Add a visible explanation listing the evidence that contributed to each score.

### Phase 2: Add word importance and context

1. Reduce the influence of common terms based on document frequency.
2. Give complete phrases such as `data science`, `data entry`, and `product design` separate meanings.
3. Expand the skill vocabulary beyond technology to healthcare, finance, education, legal, design, operations, sales, and human resources.
4. Combine structured skill overlap with a TF IDF or embedding based semantic similarity score.

### Phase 3: Build a hybrid explainable score

Use separate components rather than one opaque number:

1. Career field compatibility
2. Required skill coverage
3. Preferred skill coverage
4. Experience and education alignment
5. Semantic similarity
6. User preference alignment

Store each component and show the strongest matching evidence, missing requirements, and uncertain qualifications.

### Phase 4: Calibrate the score

1. Keep a separate calibration set and external test set.
2. Convert raw similarity into an observed match probability using calibration data.
3. Measure Brier score and expected calibration error.
4. Avoid presenting a score as a probability until calibration supports that interpretation.

### Phase 5: Conduct human validation

1. Create at least 300 consented or synthetic student resume and job pairs.
2. Ask two independent reviewers to label each pair as relevant or not relevant.
3. Measure reviewer agreement with Cohen's kappa.
4. Resolve disagreements before creating the final ground truth set.
5. Report accuracy, balanced accuracy, precision, recall, F1, ROC AUC, and calibration.
6. Break results down by career field and experience level to identify weak groups.

## Proposed acceptance criteria

Before the next scanner replaces the current scorer, it should meet all of the following on an untouched external test set:

| Requirement | Target |
| --- | ---: |
| Resume and job pairs | At least 1,000 |
| Professional domains | At least 10 |
| Balanced accuracy | At least 70% |
| ROC AUC | At least 0.75 |
| Recall | At least 60% |
| Expected calibration error | At most 10 percentage points |
| Human reviewer agreement | Cohen's kappa of at least 0.70 |

## Reproduction

From the `frontend` directory, run:

```text
npm run evaluate:resume-scanner
```

The script downloads the pinned public dataset into the ignored `data/private` directory, executes the production CareerUp functions, evaluates the contextual prototype, and writes aggregate results to `docs/evaluation/resume-scanner-baseline.json`.

## Validity limitations

1. The dataset uses generated resume profiles paired with real job descriptions. It tests domain compatibility, not real hiring outcomes.
2. Same domain is a useful relevance label, but resumes and jobs within one domain can still be poor matches.
3. The result does not measure fairness across protected demographic groups because those attributes are neither required nor safely inferred.
4. The test measures resume and job text matching only. User selected role and location preferences were intentionally excluded.
5. External human-labeled testing is still required before claiming the scanner is accurate for real students.

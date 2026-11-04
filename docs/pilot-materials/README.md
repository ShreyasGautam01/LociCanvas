# Delayed-recall pilot — materials preparation templates

**Status:** Empty preparation templates only. Not an approved study pack.  
**Protocol:** [Delayed-Recall Pilot Protocol v1](../DELAYED_RECALL_PILOT_PROTOCOL_V1.md)

This folder provides blank, versionable structures for preparing the materials required by Protocol v1. It does not contain real study questions, canonical answers, participant records, or a randomization sequence. No study has been conducted.

## 1. What is provided

| File | Purpose |
|---|---|
| [item-bank-template.csv](./item-bank-template.csv) | 18 stable study-item IDs and fields needed to author and review each item |
| [form-rotation-template.csv](./form-rotation-template.csv) | The three predeclared A/B/C rotations across immediate, 24-hour, and 7-day outcomes |
| [item-marker-map-template.csv](./item-marker-map-template.csv) | Separate mapping from protocol item IDs to the corresponding LociCanvas route/marker snapshot |
| [outcome-administration-template.csv](./outcome-administration-template.csv) | Coded assessment timing, completion, exposure, and deviation log |
| [blinded-scoring-template.csv](./blinded-scoring-template.csv) | Rater-facing response sheet that omits arm and assessment timepoint |

These CSVs are schemas/templates. Copy them to an institution-approved study workspace before filling them. Do not commit completed item content, participant responses, allocation lists, identity keys, backups, or other study data to this public repository.

## 2. Decisions still required before authoring

The protocol does not specify a subject domain or a final item bank. The research team must choose a suitable, non-sensitive factual topic before authoring questions. Do not silently infer the subject from the product or select personal, health, political, religious, or otherwise sensitive facts about participants.

Before items are drafted, record:
- the intended study population and study language;
- why the topic is unlikely to be universally known but remains understandable to the target population;
- authoritative sources for the factual claims;
- the subject-matter reviewer and independent clarity reviewer;
- the institution-approved storage, access, retention, and deletion arrangements.

The 18 prompts should test short, independently scorable factual knowledge. Avoid questions whose answers depend on subjective judgement, unstated context, or a long chain of reasoning. Keep question wording parallel in specificity and response demand.

## 3. Authoring and item review

1. Draft 18 candidate items and assign the fixed IDs `PILOT-01` through `PILOT-18`. IDs must not depend on LociCanvas marker IDs.
2. For each item, write the exact prompt, canonical answer, source, required semantic units, partial-credit boundary, and material-contradiction rule.
3. A subject-matter reviewer checks factual accuracy and source support. A separate reviewer checks prompt clarity, answer-key completeness, and whether the scoring boundary can be applied consistently.
4. Record expected difficulty and prior-familiarity risk using the same 1–5 anchors for all items:
   - Difficulty: 1 = very easy; 3 = moderate; 5 = very difficult.
   - Familiarity risk: 1 = unlikely to be known by the target population; 3 = some prior exposure plausible; 5 = likely to be widely known.
5. Match the items into Forms A, B, and C with six items per form. Compare semantic-unit counts, canonical-answer length, reviewer difficulty ratings, and familiarity risk. The forms should be as similar as practicable; do not claim psychometric equivalence from reviewer ratings alone.
6. Resolve every ambiguous rubric before any participant is enrolled. A rater must be able to apply the item-specific rules without inventing criteria after seeing an answer.
7. Freeze the item bank, form membership, sources, scoring keys, and version/hash together. A later correction requires a new version and a written change log.

The protocol's scoring categories remain 0, 0.5, and 1. The per-item rubric must explain exactly which semantic units count and what constitutes a material contradiction. Accept clearly equivalent wording; do not use an LLM or automated semantic grader for this pilot.

## 4. Form rotation

The rotation file reproduces the protocol's fixed schedule:

| Schedule | Immediate | 24 hours | 7 days |
|---|---|---|---|
| 1 | A | B | C |
| 2 | B | C | A |
| 3 | C | A | B |

With 15 participants per arm, the target is five participants per schedule in each arm. This table is **not** the participant allocation sequence. The arm allocation and participant-to-schedule assignments must be generated, concealed, and held by the designated custodian under the approved protocol. Do not generate or publish that sequence in this repository.

Every item is assessed once per participant, at one assigned timepoint only. Forms A/B/C must not overlap in item membership.

## 5. LociCanvas starter-backup mapping

Use the mapping template to connect each `PILOT-nn` ID to the exact palace and marker used by the intervention backup. The study ID remains independent of application IDs. Verify all 18 items against the exported backup and the route before the materials are frozen.

The app's self-grades and confidence are process/self-report measures. They must not be copied into the independent outcome-scoring sheet or used as substitutes for objective recall. The starter backup should be prepared in a clean browser profile and validated without real participant data.

## 6. Outcome administration and blinded scoring

- Use random participant codes. Keep the identity-to-code key separately in the approved study environment.
- The administration log records timing, status, and extra exposure. It should not contain names, email addresses, phone numbers, student IDs, or other direct identifiers.
- Create a separate de-identified response export for raters. The blinded scoring template intentionally has no arm or assessment-timepoint column.
- A person who is not scoring should maintain any linkage required to reconnect scores to participant/timepoint/arm for analysis.
- Preserve both independent rater scores and the adjudicated result. Do not overwrite disagreements.
- A missing assessment is missing, not a score of zero.

## 7. Pre-recruitment gate

These templates do not authorize recruitment. Before anyone is approached, complete the governance and pre-recruitment requirements in Protocol v1, including supervisor/institutional review, consent and recruitment approval, locked content and scoring, a concealed allocation process, approved data handling, and a successful dry-run with non-study testers.

No adaptive scheduler, due-date logic, or interval recommendation should be implemented on the basis of this template pack or a feasibility pilot alone.

# LociCanvas Delayed-Recall Feasibility Pilot — Protocol v1

**Protocol status:** Draft for supervisor / institutional review; not authorized for participant recruitment  
**Version:** 1.0-draft  
**Protocol date:** 2026-11-04  
**Product baseline:** LociCanvas Guided Recall v1, local-first  
**Design:** Two-arm, parallel-group randomized feasibility pilot  
**Planned sample:** 30 adult participants (15 per arm)  
**Primary delayed outcome:** Objectively scored, one-time 7-day recall test

> This is a feasibility protocol, not an efficacy trial. Its sample size is not powered to establish that LociCanvas improves memory, to estimate an optimal review interval, or to validate an adaptive scheduling algorithm.

---

## 1. Purpose and decision question

LociCanvas already records route completion, self-reported grades, confidence, item revisions, and learner-triggered manual reviews. Those records describe interaction and self-assessment. They do not independently establish whether a learner can retrieve the material after a delay.

This pilot asks:

1. Can a small, controlled study of the current Guided Recall workflow be run with acceptable recruitment, session completion, and delayed follow-up?
2. Can objective delayed recall be measured independently of the app's self-grades?
3. Are the study materials, scoring rubric, item-revision tracking, and local-data export process reliable enough for a later, adequately powered study?

It does **not** ask which review interval is optimal. It does not authorize an adaptive scheduler.

## 2. Research question and estimand

**Exploratory comparison:** Among consenting adult participants learning the same fixed set of short factual items, what are the observed differences in objective recall after the assigned study condition:

- **Guided Recall condition:** use a prepared LociCanvas memory palace and one guided recall session with answer reveal, confidence-before-reveal, and self-grading.
- **Active study comparator:** study the same prompts and answers using a standardized, non-spatial study sheet for the same allotted study period.

The contrast estimates the effect of the **whole study package** (spatial organization plus the app's retrieval-and-feedback workflow) relative to the specified conventional study activity. It cannot isolate the separate causal contributions of the Method of Loci, retrieval practice, feedback, confidence judgements, or the software interface.

The primary learning estimand is the between-group difference in mean **7-day objectively scored recall percentage**, among observed 7-day assessments. This is exploratory and will be reported with uncertainty; it is not a confirmatory efficacy estimate.

## 3. Design overview

A two-arm, 1:1, parallel-group randomized feasibility design is proposed.

| Element | Predeclared protocol |
|---|---|
| Recruitment target | 30 participants total |
| Allocation | 15 Guided Recall; 15 active study comparator |
| Content | One fixed, versioned bank of 18 short factual items |
| Study period | One supervised or consistently facilitated Day-0 session |
| Immediate outcome | 6 items, tested 10–20 minutes after study |
| 24-hour outcome | A different 6 items, tested 22–26 hours after study |
| 7-day outcome | The remaining 6 items, tested 6–8 days after study |
| Primary outcome | 7-day objective recall score |
| App data | Browser-local only; exported as a de-identified study backup |
| Review policy | No additional study or manual review of pilot items during follow-up; any extra exposure is recorded |

The 18 test items are divided into three matched six-item forms (A, B, and C). Participants are allocated to one of three form schedules, rotated evenly within each study arm:

| Schedule | Immediate (10–20 min) | 24-hour (22–26 h) | 7-day (6–8 d) |
|---|---|---|---|
| 1 | A | B | C |
| 2 | B | C | A |
| 3 | C | A | B |

With 15 participants per arm, assign five participants per schedule in each arm. This rotation allows each item form to appear at each test delay across participants, reducing the risk that one form's difficulty is confused with a particular delay. The assignment schedule must be generated and locked before recruitment.

**Each item is assessed in only one post-study outcome test per participant.** This avoids an immediate or 24-hour measurement test itself becoming an additional retrieval-practice exposure for that same item before the 7-day outcome. The intervention's Day-0 Guided Recall practice is part of the intervention and is not an outcome test.

## 4. Participants and recruitment

### Proposed eligibility

- Adults aged 18 years or older.
- Able to understand the participant information and provide informed consent.
- Able to use the study device and complete the written recall assessment in the selected study language.
- Available for the Day-0, 24-hour, and 7-day contacts.

### Exclusion before randomization

- Prior participation in the pilot or prior access to the fixed answer bank.
- A declared specialist-level familiarity with the selected content domain, using a screening rule defined before recruitment.
- Inability to complete the study workflow or follow-up schedule.

Do not invent or apply post-randomization exclusions based on performance. Record withdrawals and protocol deviations and report them transparently.

Recruitment wording, consent, eligibility screening, incentive arrangements (if any), and withdrawal handling must be approved by the responsible supervisor / institutional ethics process before any participant is enrolled. The protocol must not be run on classmates or other participants merely because they are conveniently available without the required institutional review.

### Prior familiarity

Before study allocation and learning, participants rate their general familiarity with the selected topic using a fixed scale. Do not show the 18 target prompts for an item-by-item familiarity rating and do not administer a baseline recall test: either could expose retrieval cues and create additional practice. The topic-level familiarity measure is descriptive and may be used in a prespecified sensitivity description, not to remove participants after outcomes are known.

## 5. Study materials and item-bank lock

Before recruitment, prepare and version:

1. **18 factual prompts** that can be answered briefly and scored against explicit semantic answer units.
2. A canonical answer and scoring rubric for each prompt.
3. Three six-item forms (A/B/C), matched as closely as practicable for answer length, number of semantic units, and expected difficulty.
4. A LociCanvas starter backup containing the exact item notes and a validated Guided Recall route for the intervention condition.
5. A standardized study sheet containing the same prompt-and-answer content for the comparator condition.
6. The participant instructions and timed follow-up forms.

The item bank should use content that is useful for a memory task but not likely to be mastered already by the recruited population. Have a subject-matter reviewer check factual accuracy and a separate reviewer check that the questions and scoring keys are unambiguous.

Each content item must have a stable study item ID (for example, `PILOT-01`) independent of a LociCanvas marker ID. Record the canonical answer version and a content fingerprint or locked item-bank version. Do not silently edit a prompt or answer after the first participant is randomized. A necessary correction creates a new protocol/materials version and must be documented; affected observations must remain associated with the version actually used.

Do not use participants' personal notes, private information, health details, or sensitive personal material as study items.

## 6. Allocation and bias control

Generate a 1:1 allocation sequence before recruitment using permuted blocks of varying sizes (for example, 4 and 6). Keep the allocation sequence with a person who does not conduct eligibility decisions or score responses. Reveal the next assignment only after consent, eligibility, and baseline familiarity are complete.

Within each arm, allocate schedules 1, 2, and 3 evenly. Preserve the allocation and schedule assignment in the study log. Do not change condition because a participant prefers one method or has difficulty with the assigned one.

The outcome scorer should receive de-identified responses with participant arm and study condition removed. The facilitator cannot be blinded to the condition, but should use a written script and identical follow-up procedures.

## 7. Day-0 procedure

### Shared setup

1. Confirm consent and eligibility.
2. Assign a participant code; keep the identity-to-code key separately from study responses.
3. Record the item-bank version, protocol version, device/browser, date, and start time.
4. Record the participant's pre-study familiarity rating.
5. Assign the study arm and one of the three form schedules.
6. Explain that the later tests measure unaided recall, that no feedback will be provided until all scheduled measurements are finished, and that participants should not study the pilot content between sessions.

### Guided Recall condition

1. Import or open the locked starter backup on the participant's browser profile.
2. Confirm that the 18 note prompts, answer snapshots, route order, and item IDs match the locked materials.
3. Ask the participant to complete one Guided Recall session using the prepared route.
4. The participant follows the existing answer-hidden workflow: attempt recall, record confidence or explicitly skip it, reveal the saved answer, and submit their own grade.
5. Do not initiate a second route, manual review, or automatic schedule.
6. Record start/end timestamps, whether the route completed or was abandoned, and any assistance or deviation.

The app's self-grade and confidence are retained as **self-reports**. They are not the objective outcome and must not be substituted for delayed test scores.

### Active study comparator

1. Give the participant the standardized study sheet containing the same 18 prompts and answers.
2. Allow the same fixed study period as the Guided Recall session (proposed cap: 25 minutes).
3. Instruct the participant to study the material normally using the sheet; do not add a separate retrieval quiz or spatial palace task.
4. Record start/end timestamps, completion, and any assistance or deviation.

The comparator is conventional study, not a retrieval-practice-matched control. Therefore, any observed difference is attributable only to the **combined package contrast**, not specifically to spatial navigation or retrieval practice.

### Time-on-task

Use the same 25-minute maximum study window for both arms. Record actual time used. If the intervention session routinely exceeds the comparator window, record the overrun and treat study-time imbalance as a protocol deviation to be considered in interpretation. Do not silently extend one arm.

## 8. Outcome assessments

At the assigned immediate, 24-hour, and 7-day windows, administer only the six-item form assigned to that timepoint.

- Use the same short-answer response format, instructions, and time allowance in both arms.
- Do not show the original answers, give correctness feedback, or allow app notes during assessment.
- Do not use the app's Reveal or self-grade controls during outcome measurement.
- Record the actual test timestamp, time elapsed since Day 0 in hours, response status, and any interruption.
- A reminder may be sent using the same neutral wording in both arms. Do not include answer hints or note titles in the reminder.
- Ask the participant whether they studied, searched for, discussed, or otherwise encountered the pilot items between Day 0 and the assessment. Record the reported exposure, duration if known, and item IDs if identifiable.

The three outcome forms are non-overlapping for each participant. No participant should receive the same item in more than one post-study outcome form.

### Primary outcome

**7-day objective recall percentage** on the six items assigned to the 7-day window:

`100 × (sum of the six adjudicated item scores ÷ 6)`

This is the primary learning outcome for the feasibility pilot. Report its distribution and uncertainty by randomized arm.

### Secondary / exploratory outcomes

- 24-hour objective recall percentage.
- Immediate objective recall percentage.
- Completion of the assigned Day-0 activity.
- Completion of each scheduled outcome assessment.
- Actual delay in hours from Day 0.
- Study time and intervention route duration.
- Self-grade distribution and confidence observations in the Guided Recall arm.
- Concordance between Guided Recall self-grades and the separate objective 7-day results, described only as exploratory because the item-level schedule and measurement differ.

Session count, time in the app, route completion, and confidence are process or self-report measures. They are not substitutes for delayed objective recall.

## 9. Scoring procedure

Each item must have a frozen answer key divided into explicit semantic units before the first participant is enrolled. Each item receives one score from the fixed rubric:

- **0:** no required semantic unit is correctly recalled.
- **0.5:** at least one, but not all, required semantic units are correctly recalled, with no critical contradiction.
- **1:** all required semantic units are correctly recalled without a material contradiction.

Where an item has multiple independent semantic units, the item-specific answer key must define the exact boundary between 0, 0.5, and 1 before recruitment. The six-item form score is the mean of its six adjudicated item scores; multiply by 100 to express it as a percentage. Do not create scoring criteria after seeing a participant's response.

Two reviewers should independently score de-identified short answers while blinded to study arm and assessment timepoint. Resolve disagreements by a preselected adjudication rule and record both original scores and the adjudicated score. Report the proportion of exact agreement and a suitable agreement statistic; do not hide disagreement by storing only the final score.

Scoring must accept clearly equivalent wording while rejecting unsupported or contradictory claims. Do not use an LLM or automated semantic grader in this pilot.

## 10. Feasibility measures and progression criteria

The proposed target is **30 randomized participants**, 15 per arm. This is a practical feasibility target, not a statistical power calculation for efficacy. Do not interpret a non-significant result or a between-arm difference from this sample as proof of benefit or no benefit.

Predeclare these operational thresholds before recruitment:

| Feasibility measure | Progression threshold | Interpretation |
|---|---:|---|
| 7-day outcome completion | At least 24/30 (80%) | Follow-up process is sufficiently workable to plan a larger study |
| Guided Recall session completion | At least 12/15 (80%) complete the assigned session | Core intervention is usable under the study conditions |
| Outcome scoring | At least 95% of returned item responses receive an adjudicated score | Scoring process is operationally reliable |
| Serious privacy / consent incident | 0 unresolved incidents | Required safety and governance condition |

These thresholds are pragmatic decision rules chosen for this feasibility study, not literature-established cut-offs. Report the exact numerators and denominators with confidence intervals. If a threshold is missed, explain the cause and revise the protocol before a larger study. Meeting all thresholds permits planning a better-powered study; it does **not** establish educational efficacy or authorize adaptive scheduling.

## 11. Analysis plan

Lock the data-cleaning rules and analysis table before examining group outcomes.

1. Report the participant flow: screened, eligible, consented, randomized by arm, completed Day 0, completed each follow-up, withdrawn, and excluded from a particular measurement with reason.
2. Report baseline characteristics and familiarity descriptively, without significance testing as a baseline-balance gate.
3. Report each feasibility numerator and denominator, with a binomial confidence interval.
4. Report immediate, 24-hour, and 7-day score distributions separately by randomized arm.
5. For the primary 7-day score, report group means and standard deviations, medians and ranges, the mean difference in percentage points, and an uncertainty interval. An exploratory standardized effect size may be reported with an interval, clearly labelled unstable and non-confirmatory.
6. Report actual elapsed time, route/session completion, exposure deviations, and missing follow-ups by arm.
7. Do not impute missing 7-day scores in the primary descriptive analysis. Report missingness and reasons explicitly. A complete-case estimate must not be described as an intention-to-treat estimate.
8. A sensitivity description may show how the observed results change when participants with reported extra exposure are separately displayed. Do not silently remove these participants from the main randomized flow.
9. If item-level analyses are conducted, account for repeated observations within participants and differences among items; do not treat every answer as an independent participant.
10. Avoid efficacy claims based on p-values, small-sample effect estimates, engagement, or self-grades.

The primary output is a feasibility report with descriptive learning observations and uncertainty, not a claim that one method is superior.

## 12. Missing data, protocol deviations, and withdrawals

- Keep every randomized participant in the participant-flow denominator.
- Do not replace a participant because they fail to complete a follow-up.
- Record missed windows, late tests, incomplete responses, technical failures, outside study exposure, and route abandonment using prespecified reason codes.
- The 24-hour and 7-day windows are defined in section 3. An assessment outside its window is retained and labelled late; it does not count as on-time completion.
- Respect withdrawal and data-removal requests according to the approved consent and institutional policy. Report the number of withdrawals and the handling of previously collected data as approved.
- Never convert a missing assessment into a zero score.

## 13. Privacy, data handling, and local-first constraints

LociCanvas currently stores palace content, recall routes, sessions, and attempts in browser `localStorage`; it does not provide accounts or cloud synchronization. The pilot must not imply otherwise.

- Use study-only notes and a random participant code. Do not put names, email addresses, phone numbers, student IDs, or sensitive personal data into note titles, answers, route names, or participant codes.
- Keep any identity-to-code key separately from the recall backup and outcome responses, with access limited to authorized study staff.
- Export the browser-local JSON backup after the assigned session and after any required recovery point. The backup may contain prompts, answer content, routes, and self-reported attempts; treat it as study data, not as a harmless app setting.
- Transfer files only to an institution-approved storage location with access controls. Do not claim the app encrypts local data or backups; encryption and retention must be handled by the approved study environment.
- Do not send participant data to external AI services, analytics vendors, or cloud APIs.
- Define a retention period, deletion process, and access list in the ethics submission before collection.
- Confirm that shared or lab devices use an isolated browser profile and that previous participants' localStorage is cleared using the approved reset procedure only after their export has been verified.

## 14. Research governance and registration lock

Before the first participant is approached, fill and approve the following:

- Responsible investigator and faculty supervisor.
- Institution / department and required ethics approval reference.
- Recruitment material and participant information / consent text.
- Participant eligibility and exact study-language requirements.
- Item-bank file, answer-key version, and item-form schedule hash.
- Randomization sequence custodian and allocation procedure.
- Exact Day-0 and follow-up dates, contact method, reminder wording, and assessment instructions.
- Data access list, storage location, retention duration, and withdrawal/deletion handling.
- Analysis workbook or script and the locked data dictionary.

Time-stamp the approved protocol, item bank, allocation procedure, scoring rubric, and analysis plan before recruitment. Any later changes must be versioned with date, reason, and affected participants / observations. Do not retrospectively change the primary outcome, time windows, scoring rubric, or feasibility thresholds after inspecting results.

## 15. Stop / pause conditions

Pause recruitment and contact the supervisor if any of the following occurs:

- A consent, privacy, or data-handling incident.
- The locked item bank or answer material is exposed before a participant's scheduled assessment.
- A persistent technical failure prevents the assigned session or follow-up from being completed reliably.
- Participants receive materially different study content or procedures across arms.
- The protocol cannot be followed within the approved participant burden or institutional requirements.

Document the event and corrective decision before restarting.

## 16. What this pilot can and cannot justify

**It can inform:**
- whether participants can complete a prepared Guided Recall session;
- whether independent short-answer delayed assessments can be collected;
- the observed follow-up and missing-data rates;
- whether the study materials and scoring rubric are usable;
- rough outcome variability to inform a future sample-size calculation.

**It cannot establish:**
- that LociCanvas causes better memory than conventional study;
- that the Method of Loci itself, separate from retrieval and feedback, caused an observed difference;
- that the existing 5-exposure / 60-day / 3-session / 50% weakness heuristic is optimal;
- that confidence predicts the best next review time;
- that 24 hours, 7 days, or any other interval is an optimal schedule;
- that an adaptive scheduler is ready to be implemented.

A future efficacy study requires a sample-size justification based on a prespecified meaningful effect, a clearly specified comparator, an adequately validated outcome instrument, and reconciliation of the full research report referenced by the Guided Recall specification. Adaptive scheduling requires further evidence and a separate versioned decision record.

---

## Appendix A — Minimum data dictionary

Use one participant-level record and one outcome-item record per scheduled assessment item. Keep identifiers coded.

| Field | Level | Description |
|---|---|---|
| `participant_code` | Participant | Random study code; not a student or government ID |
| `protocol_version` | Participant | Protocol version used |
| `item_bank_version` | Participant | Locked item-bank version/hash |
| `arm` | Participant | `guided_recall` or `active_study` |
| `form_schedule` | Participant | Schedule 1, 2, or 3 |
| `day0_started_at` | Participant | Day-0 start timestamp |
| `day0_ended_at` | Participant | Day-0 end timestamp |
| `day0_status` | Participant | Completed / abandoned / technical failure |
| `item_id` | Outcome item | Stable canonical study item ID |
| `assigned_timepoint` | Outcome item | Immediate / 24h / 7d |
| `scheduled_window_start/end` | Outcome item | Permitted measurement window |
| `actual_assessment_at` | Outcome item | Actual timestamp or missing |
| `delay_hours` | Outcome item | Actual elapsed hours since Day 0 |
| `raw_response` | Outcome item | De-identified response under approved storage |
| `rater_1_score` | Outcome item | Blinded score |
| `rater_2_score` | Outcome item | Blinded score |
| `adjudicated_score` | Outcome item | Final score under the frozen rubric |
| `maximum_score` | Outcome item | Maximum item score (1.0) |
| `extra_exposure` | Outcome item | Reported study / discussion / outside exposure |
| `assessment_status` | Outcome item | Completed / late / missing / withdrawn |
| `deviation_code` | Outcome item | Prespecified deviation reason or blank |

App backups and outcome-assessment records are distinct sources. Do not treat the app's attempt timestamps or self-grades as the independently administered 24-hour or 7-day outcome.

## Appendix B — Pre-recruitment checklist

- [ ] Supervisor and required institutional ethics review approve the protocol and consent materials.
- [ ] All 18 items and canonical answer keys are reviewed and version-locked.
- [ ] Forms A/B/C are matched and their schedule rotation is generated.
- [ ] Standard intervention backup is validated in a clean browser profile.
- [ ] Comparator study sheet contains identical prompts and answers.
- [ ] Randomization sequence is generated, concealed, and tested.
- [ ] Follow-up test forms and neutral reminders are ready.
- [ ] Rater rubric, blinding process, and adjudication process are rehearsed.
- [ ] Data dictionary, data storage, access, retention, and deletion procedure are approved.
- [ ] Protocol, thresholds, and analysis plan are time-stamped before enrollment.
- [ ] A dry-run with non-study testers confirms timing and technical feasibility; dry-run participants are not included in the pilot.

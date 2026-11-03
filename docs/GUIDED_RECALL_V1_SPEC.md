# Guided Recall v1 — Product and Engineering Contract

**Status:** Proposed; initial evidence reconciliation completed 2026-11-03; final research-report reconciliation remains open  
**Target:** LociCanvas local-first release  
**Normative language:** MUST / MUST NOT are release-blocking requirements; SHOULD is the default unless a documented decision record explains otherwise; MAY is optional.  
**Parent context:** `IMPROVEMENT_PLAN.md`

## 1. Purpose

Guided Recall turns LociCanvas's existing visual palaces, memory-note markers, and gateway markers into a reproducible active-recall workflow.

The product is not a timed slideshow. A session must require the learner to retrieve an answer before the answer is shown, record the learner's own judgement, and preserve enough history to show how recall changes over repeated exposures.

The feature's primary outcome is **better delayed recall**, not session count, time in app, or animation completion.

### Current-code baseline

The current domain model contains:
- palace/environment records with an `id`, `name`, `imageUrl`, and ordered `items`;
- note markers with an `id`, `type: "note"`, `title`, `content`, `color`, and percentage coordinates `x`/`y`;
- gateway markers with an `id`, `type: "gateway"`, and `targetId` referencing another palace;
- browser-local palace persistence under `locicanvas_v2_data`, plus JSON backup import/export.

The application currently has no route/recall domain, no session history, and no cloud-backed persistence. Guided Recall MUST preserve the existing palace and marker format unless a separately reviewed migration is introduced.

## 2. Product scope

### Included in v1

1. Create, rename, edit, and delete a named, ordered recall route.
2. Build a route from existing note markers and gateway markers; do not duplicate note content into a second editable content store.
3. Validate that each route can be traversed through the actual directed gateway links.
4. Run the route in a guided mode that shows the relevant palace background and locus while withholding the note answer.
5. Require a learner action before revealing the answer.
6. Record one self-grade (correct / partial / missed) or an explicit skip for every recall stop, plus an optional confidence rating.
7. Save completed and interrupted session state locally and allow resume after refresh.
8. Show session summaries and per-note recent performance with sample counts.
9. Identify repeatedly missed notes using the explicit algorithm in section 7.
10. Keep routes and recall history in JSON backup/restore.
11. Keep the current "Local only" disclosure truthful and visible.

### Explicitly out of scope for v1

- AI-generated answers, semantic auto-grading, or claims that free text was objectively correct.
- Public sharing, collaboration, accounts, cross-device sync, or remote database writes.
- AI-generated images or automatic palace construction.
- A sophisticated proprietary spaced-repetition model.
- Leaderboards, streak pressure, gamification intended to maximize time spent.
- Treating response speed as a measure of intelligence, mastery, or memory quality.

These may be reconsidered only through a separate decision record and acceptance criteria.

## 3. Domain contract

### 3.1 Recall route

A route is an ordered sequence of references to existing palace markers. It does not own copies of notes.

Proposed logical shape:

```ts
type RecallRoute = {
  id: string;
  name: string;
  description?: string;
  steps: RecallRouteStep[];
  schemaVersion: 1;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

type RecallRouteStep =
  | {
      id: string;
      kind: "recall";
      palaceId: string;
      markerId: string; // must resolve to a note marker
    }
  | {
      id: string;
      kind: "gateway";
      palaceId: string;
      markerId: string; // must resolve to a gateway marker in palaceId
      targetPalaceId: string; // must equal that gateway's targetId
    };
```

The discriminated union is intentional: a gateway is a navigation step, not a recall question.

### 3.2 Route invariants

A route MUST be rejected as invalid unless all conditions hold:

- The route has a non-blank name and at least one recall step.
- The first and final steps are recall steps.
- Every step ID is unique within the route.
- Every referenced palace exists.
- Every `recall` step references an existing note marker in the stated palace.
- Every `gateway` step references an existing gateway marker in the stated palace, and `targetPalaceId` exactly matches that marker's `targetId`.
- Traversal is continuous: after a recall step, the current palace remains that step's `palaceId`; a gateway step is legal only when its `palaceId` is the current palace; after a gateway step, the current palace becomes `targetPalaceId`; the next step's `palaceId` MUST equal the current palace.
- A note marker MUST NOT appear more than once in a route in v1. This prevents a single session from inflating its exposure count through accidental duplicates.
- A route with a deleted note, deleted gateway, deleted palace, or changed gateway target becomes invalid and MUST be visibly marked as needing repair. It MUST NOT silently skip the broken step or redirect to a different palace.

A route MAY contain multiple gateway steps between recall steps, allowing a learner to pass through intermediate environments without being tested there.

### 3.3 Route authoring UX

The route editor MUST support:
- entering a route name and optional description;
- adding an existing note marker as a recall step;
- adding an existing gateway marker as a navigation step;
- reordering steps;
- removing a step;
- showing each step's palace, marker title, and step type;
- validating the whole route before save and before run;
- explaining the exact broken reference or discontinuity rather than displaying only "invalid route".

The editor SHOULD make route construction possible without requiring users to memorize marker IDs. Selection is by visible palace and marker title; stable IDs remain internal.

## 4. Guided session contract

### 4.1 Session lifecycle

A session MUST have one of these states:

- `in_progress`
- `completed`
- `abandoned`

A refresh or tab close MUST NOT silently erase a persisted in-progress session. On re-entry, the user MUST be offered resume or explicitly discard/abandon. Discarding MUST preserve already graded attempts.

A session starts only after route validation succeeds. At start, it captures an immutable run snapshot:
- route ID and route name;
- ordered route steps as they existed at start;
- each recall item's marker ID, palace ID, prompt/title snapshot, and content fingerprint;
- route schema/version metadata.

Edits to a route or note during a running session MUST NOT mutate the active run snapshot. A newly edited note is treated as a new content revision for future attempts.

### 4.2 Recall stop interaction

For each recall step, the screen MUST:

1. Show the correct palace background and identify the active locus visually.
2. Show a recall cue. In v1, the note's title is the cue.
3. Keep the note's content/answer hidden until the learner explicitly requests reveal.
4. Offer an optional response field for the learner to type or mentally formulate an answer. The field MUST be optional; the feature must work for mental recall.
5. After the learner has made a genuine recall attempt (mentally or by typing), ask for confidence **before** answer reveal: `low`, `medium`, or `high`. The UI MUST distinguish "I have attempted recall" from "Reveal answer". Confidence is confidence in the attempted answer, not a prediction made before trying to retrieve.
6. Reveal the saved note content only after the learner chooses `Reveal answer`.
7. Require one self-grade: `correct`, `partial`, or `missed`; alternatively, the learner may explicitly `skip` without making a recall attempt.
8. Only then allow progression to the next step.

The app MUST NOT infer correctness from typed text in v1. The user is the grader. The interface MUST label recorded results as self-reported.

The optional typed response MUST NOT be persisted by default. If future versions store it, that requires an explicit privacy setting and separate acceptance criteria.

### 4.3 Gateway step interaction

For each gateway step, the session MUST show the source palace and the actual gateway marker, identify the destination palace, and provide an explicit `Enter gateway` action. Entering the gateway changes the current environment to its existing `targetId`. Gateway traversal is navigation, not a recall attempt, and MUST NOT affect recall accuracy.

The runner MUST use the gateway reference in the route snapshot. It MUST NOT invent a visual connection or jump to an unrelated palace.

### 4.4 Confidence and elapsed time

Confidence is collected after a genuine retrieval attempt but before reveal. This is a retrospective confidence judgement about the answer just attempted, not a judgement of learning made before retrieval. It remains a self-report, not an objective probability estimate.

If latency is recorded, it MUST be labelled **cue-to-reveal time**. It MUST NOT contribute to the recall score. The implementation SHOULD use a monotonic clock and pause elapsed-time accumulation while the document is hidden or the session is paused. If reliable timing is unavailable, omit the value rather than inventing one.

## 5. Attempt and session data contract

Proposed logical shape:

```ts
type RecallItemSnapshot = {
  routeStepId: string;
  palaceId: string;
  markerId: string;
  promptSnapshot: string;
  answerSnapshot: string;
  itemFingerprint: string;
};

type RecallSession = {
  id: string;
  routeId: string;
  routeNameSnapshot: string;
  routeSnapshot: RecallRouteStep[];
  state: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  endedAt: string | null;
  currentStepIndex: number;
  recallSnapshots: RecallItemSnapshot[]; // immutable prompt and answer snapshots required to resume
  attempts: RecallAttempt[];
  skippedStepIds: string[]; // route-step IDs deliberately skipped without recall
  traversedGatewayStepIds: string[];
  schemaVersion: 1;
};

type RecallAttempt = {
  id: string;
  sessionId: string;
  routeStepId: string;
  palaceId: string;
  markerId: string;
  itemFingerprint: string;
  promptSnapshot: string;
  confidence: "low" | "medium" | "high" | null;
  grade: "correct" | "partial" | "missed";
  cueToRevealMs?: number;
  attemptedAt: string;
};
```

Implementation may normalize this representation into separate arrays/maps for efficient updates, but it MUST preserve these semantics.

### Required data invariants

- IDs are stable strings; timestamps are ISO 8601 UTC strings.
- There is at most one scored recall attempt for a given `(sessionId, palaceId, markerId)`.
- Gateway steps never create `RecallAttempt` records.
- A completed self-grade creates a scored attempt. An explicit skip creates a separate skip outcome and MUST NOT be treated as a failed retrieval.
- Skips are visible in session summaries but excluded from accuracy and frequently-missed denominators.
- An abandoned session keeps its graded attempts; ungraded current stops are not treated as misses.
- A session summary is derived from its attempt events, not independently edited totals.
- A content fingerprint identifies the exact cue/answer revision used. It is a version key, not a security hash.
- Changing note title or content creates a different fingerprint. Historical attempts remain in history but MUST NOT be mixed into current-revision weakness calculations.

### Local persistence and backup

- The initial implementation MUST remain local-only and use browser storage behind a small repository/storage boundary rather than scattering direct storage calls through UI components.
- A session snapshot MUST retain the exact prompt and answer text used at session start so that refreshing or editing a source note cannot alter an in-progress test. Typed free-text responses remain transient and are not persisted by default.
- Existing `locicanvas_v2_data` palace data MUST remain readable and MUST NOT be destructively rewritten merely to add recall.
- Store recall data under the separate versioned key `locicanvas_recall_v1_data` in v1. This isolates recall migrations from existing palace persistence. The current route-authoring slice stores `{ schemaVersion, routes, sessions: [], attempts: [] }`; session and attempt arrays are reserved for later slices and are not yet populated.
- The current recall-route payload has a conservative 512 KiB estimated local-storage limit. It is separate from the existing 4 MiB palace-collection budget; future session-history growth must use explicit quota handling and must never silently prune history.
- JSON backup/export MUST include recall route definitions and session/attempt history. Import MUST validate both palace and recall payloads before replacing either. There MUST be no partial restore where palace data changes but recall data fails validation.
- A failed local write MUST produce a visible unsaved/error state. The UI MUST NOT claim a session was saved before storage confirms the write.
- Local-only disclosures MUST state that clearing browser data can remove routes and histories too.
- Storage-size and retention limits MUST be explicit. The app MUST NOT silently delete session history to fit a quota; it must warn and offer export or a deliberate user-controlled cleanup.

The future Supabase mapping should use user-owned tables for routes, route steps, sessions, and attempts, with owner-consistent foreign keys and RLS. That mapping is a later phase; this spec does not authorize or imply cloud persistence.

## 6. Scoring contract

### 6.1 Session score

Use explicit self-grade weights:

| Grade | Score weight |
|---|---:|
| Correct | 1.0 |
| Partial | 0.5 |
| Missed | 0.0 |
| Skipped | Excluded |

```
sessionScorePercent =
  100 * sum(gradeWeight(correct/partial/missed attempts)) / numberOfScoredRecallAttempts
```

A session with no scored recall attempts has no score (display "No scored recall attempts"), not 0% or 100%.

Also show counts for correct, partial, missed, skipped, and total recall stops. Do not include gateway steps or skipped stops in the score denominator. Do not round before aggregation; round only for display. A skipped stop is not evidence of an unsuccessful retrieval.

### 6.2 Item revision and recent-window calculation

For each `(markerId, itemFingerprint)`:
1. Select the most recent **5 scored exposures** (correct / partial / missed) from distinct sessions, limited to the last **60 days**. Explicit skips are excluded.
2. Require at least **3** exposures before assigning a weakness status.
3. Compute weighted miss rate:

```
missRate =
  (missed + 0.5 * partial) / scoredExposures
```

4. Flag the item as **Frequently missed** when `missRate >= 0.50` and there are at least 3 eligible exposures.
5. Otherwise classify it as:
   - **Improving / monitor** when sample count is sufficient but miss rate is below 0.50;
   - **Not enough history** when fewer than 3 eligible exposures exist.

Default display MUST expose the numerator, denominator, time window, and item revision, e.g. "Needs review — 3.0 weighted misses across 5 recent attempts". Do not present the status as a diagnosis of memory ability.

### 6.3 Worked example

For the last five scored exposures: missed, partial, correct, missed, correct:

```
missRate = (1 + 0.5 + 0 + 1 + 0) / 5 = 0.50
```

The item is flagged because the minimum sample count is met and the threshold is reached.

For only two exposures, even if both are missed, the UI MUST say "Not enough history" rather than flagging the item.

### 6.4 Anti-distortion safeguards

- Count at most one recall attempt per note per session.
- Do not count route previews, design-mode interactions, explicit skips, or ungraded abandoned steps.
- Do not mix attempts from different note fingerprints.
- Do not count gateway navigation as recall.
- Keep self-grade labels visible in all reports; do not call the metric objective accuracy.
- Display sample size and date window with every weak-item flag.
- Confidence and cue-to-reveal time are separate signals and MUST NOT change the grade weight in v1.
- High-confidence missed attempts MAY be surfaced as "confident miss" observations, but this label must not alter the base miss-rate algorithm.

## 7. Minimum analytics views

V1 MUST provide:

1. **Session result:** score, counts by grade, number of recall stops, duration if reliable, and route name.
2. **Route history:** recent sessions with date, completion status, and score where defined.
3. **Frequently missed items:** current-revision notes meeting section 6.2, with evidence count and the last few outcomes.
4. **Item history:** attempts for a note revision, including grade and confidence.

V1 SHOULD include a filter for the last 7 / 30 / 60 days, but the default weakness algorithm remains 5 exposures in 60 days. A route with insufficient attempt history must say so rather than showing a misleading rank.

## 8. Accessibility, resilience, and interaction quality

- All route editor and runner actions MUST be keyboard-operable, with visible focus and semantic labels.
- Focus MUST move to the new cue when a recall step begins and to the result heading when a session completes.
- Answer reveal and grade selection MUST not depend on animation completion.
- Respect `prefers-reduced-motion`; route transitions must have a reduced-motion alternative.
- Do not auto-advance after a delay. Learners control reveal and progression.
- Controls MUST be usable at narrow mobile widths; no action may be available only on hover.
- A route's current step and session progress MUST be visible text, not color alone.
- Avoid exposing answer content in accessibility labels before reveal.
- If storage is unavailable or full, explain whether the active response/attempt is saved and provide a recovery path.

## 9. Test and release gates

No Guided Recall implementation is complete until all applicable gates pass.

### Domain unit tests

- Route validation: missing palace, missing note, wrong marker type, wrong gateway target, broken continuity, duplicate step IDs, duplicate recall marker, empty route, invalid first/final step.
- Route traversal: same-palace recall, one gateway transition, multiple gateway transitions, wrong destination, deleted gateway.
- Session lifecycle: start snapshot, record attempt once, duplicate submission rejected, gateway creates no attempt, abandon preserves graded attempts, resume restores current index.
- Scoring: all-correct, all-partial, mixed grades, skipped attempts, no-attempt session, gateway exclusion.
- Weak-item algorithm: 2 vs 3 samples; threshold boundary; last-5 window; 60-day cutoff; old attempts excluded; note revision separation; duplicate session exposure excluded.
- Persistence: invalid recall payload rejected; previous palace-only backup imports; combined backup validates atomically; storage failure reported.

### UI/integration tests

- Create and edit a route using visible palace/marker titles.
- Run route and verify answer content remains hidden until reveal.
- Verify confidence is selected before reveal.
- Verify a user cannot advance before grading/skipping.
- Verify gateway traversal enters only its declared target.
- Verify refresh/resume and deliberate abandon behavior.
- Verify session history/weak-item UI matches domain calculations.
- Verify keyboard-only and reduced-motion paths.

The repository uses Node's built-in `node:test` for domain tests and now includes a Playwright 1.64.1 Chromium acceptance harness. CI installs the browser runner transiently after `npm ci` (it is not an application runtime dependency) and executes `npm run test:e2e` against the production preview build. The current browser test covers route creation through a real gateway, local persistence after refresh, combined backup export/import, and legacy palace-only import. Broken-reference repair UI, storage-quota interaction, keyboard-only navigation, reduced motion, narrow mobile layout, and runner behavior still require additional browser acceptance coverage; domain tests must not be treated as proof of those UI paths.

### Release acceptance checklist

- [ ] Existing palace data from the current schema still loads without loss.
- [ ] Routes can be created and invalid routes cannot be saved or run.
- [ ] Each recall step hides the note answer until explicit reveal.
- [ ] Confidence is captured before reveal.
- [ ] Every completed recall stop has exactly one self-grade.
- [ ] Gateway navigation does not affect recall metrics.
- [ ] Session history survives refresh and can be resumed or deliberately abandoned.
- [ ] Item revisions have independent performance histories.
- [ ] Frequently missed flags match the defined 5-exposure / 60-day / 3-sample / 50% algorithm.
- [ ] Backup and restore include routes and history without partial replacement.
- [ ] Storage errors are visible and no false "saved" confirmation is shown.
- [ ] Keyboard, mobile, and reduced-motion acceptance checks pass.
- [ ] Unit, integration, lint, and production build checks pass.
- [ ] README continues to describe the application as local-only until Auth, database persistence, and Storage are actually implemented and verified.

## 10. Evidence boundary and research-derived design rationale

The research supports the direction but does not validate this particular implementation:

- A 2021 meta-analysis of 13 randomized trials reported a medium effect for the method of loci (Hedges' g = 0.65), while noting high experimental-bias risk in most included studies and a predominantly university-based sample.
- A 2025 systematic review/meta-analysis reported promising method-of-loci effects, but 89.2% of experiments were rated at high risk of bias and the GRADE certainty for young-adult evidence was very low. Reported effectiveness must not be generalized as a guaranteed benefit for all learners or note types.
- A 2021 review of retrieval practice describes benefits across material types, ages, learner abilities, and test formats. A 2026 classroom meta-analysis (53 studies; 7,303 participants) reported average effects for retrieval practice, distributed practice, and interleaving, with outcomes moderated by knowledge type, test format, retention interval, and feedback conditions.
- Confidence judgements can provide useful metacognitive information, but their usefulness depends on when and how they are elicited. Guided Recall therefore records confidence after an actual retrieval attempt and before answer reveal, keeping confidence separate from the self-grade.

These findings justify prioritizing genuine retrieval and answer feedback. They do **not** establish the optimal 5-exposure window, 60-day lookback, 3-exposure minimum, 50% flag threshold, 0.5 partial-credit weight, route length, animation, or particular UI design. Those are transparent product heuristics requiring empirical evaluation.

### Selected references

1. Qureshi et al. (2021). *The effectiveness of the loci method as a mnemonic device: Meta-analysis.* [PubMed](https://pubmed.ncbi.nlm.nih.gov/33535926/).
2. Ondřej et al. (2025). *The method of loci in the context of psychological research: A systematic review and meta-analysis.* British Journal of Psychology. [DOI](https://doi.org/10.1111/bjop.12799).
3. McDermott (2021). *Practicing Retrieval Facilitates Learning.* Annual Review of Psychology, 72, 609–633. [DOI](https://doi.org/10.1146/annurev-psych-010419-051019).
4. Camp et al. (2026). *A Meta-Analysis of the Effectiveness and Boundary Conditions of Retrieval Practice, Distributed Practice, and Interleaved Practice in Authentic School Classrooms.* Educational Psychology Review. [DOI](https://doi.org/10.1007/s10648-026-10225-5).
5. *Testing and metacognition: retrieval practice effects on metacognitive monitoring in learning from text* (2018). [PubMed](https://pubmed.ncbi.nlm.nih.gov/30074864/).

## 11. Evaluation: prove learning value, not just usability

The first release is a functional baseline, not proof of educational efficacy.

A later opt-in evaluation SHOULD compare:
- immediate post-session recall;
- delayed recall after a predeclared interval (for example, 24 hours and 7 days);
- retention by item revision;
- self-grade versus a separately administered objective check on a subset of material;
- route completion and abandonment as usability measures, not learning outcomes.

Where feasible, use the same content and comparable item difficulty across conditions (for example, guided loci recall versus reviewing the same notes without route traversal). Predefine inclusion rules and report sample size, missing follow-ups, and uncertainty. Do not infer that the method works from engagement, self-ratings, or a small uncontrolled pilot alone.

## 12. Decision boundary

This document is the implementation contract for Guided Recall v1. Research findings may refine defaults, terminology, or optional experiments, but any change to route invariants, scoring weights, weakness thresholds, data retention, or privacy behavior MUST be recorded as a versioned decision with updated tests. The full Deep Research report should still be reconciled before adaptive scheduling, experimental features, or claims of learning efficacy. The deterministic domain model in PR 1 does not encode claims about optimal learning intervals or effect sizes.

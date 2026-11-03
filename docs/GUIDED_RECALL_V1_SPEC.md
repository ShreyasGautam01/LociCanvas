# Guided Recall v1 — Product and Engineering Contract

**Status:** Proposed, pending research-report reconciliation and implementation review  
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
6. Record a self-grade (correct / partial / missed / skipped) and optional confidence rating for every recall stop.
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
5. Ask for confidence **before** answer reveal: `low`, `medium`, or `high`.
6. Reveal the saved note content only after the learner chooses `Reveal answer`.
7. Require one self-grade: `correct`, `partial`, `missed`, or `skipped`.
8. Only then allow progression to the next step.

The app MUST NOT infer correctness from typed text in v1. The user is the grader. The interface MUST label recorded results as self-reported.

The optional typed response MUST NOT be persisted by default. If future versions store it, that requires an explicit privacy setting and separate acceptance criteria.

### 4.3 Gateway step interaction

For each gateway step, the session MUST show the source palace and the actual gateway marker, identify the destination palace, and provide an explicit `Enter gateway` action. Entering the gateway changes the current environment to its existing `targetId`. Gateway traversal is navigation, not a recall attempt, and MUST NOT affect recall accuracy.

The runner MUST use the gateway reference in the route snapshot. It MUST NOT invent a visual connection or jump to an unrelated palace.

### 4.4 Confidence and elapsed time

Confidence is collected before reveal to avoid post-answer confidence revision. It is a self-report, not an objective probability estimate.

If latency is recorded, it MUST be labelled **cue-to-reveal time**. It MUST NOT contribute to the recall score. The implementation SHOULD use a monotonic clock and pause elapsed-time accumulation while the document is hidden or the session is paused. If reliable timing is unavailable, omit the value rather than inventing one.

## 5. Attempt and session data contract

Proposed logical shape:

```ts
type RecallSession = {
  id: string;
  routeId: string;
  routeNameSnapshot: string;
  routeSnapshot: RecallRouteStep[];
  state: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  endedAt?: string;
  currentStepIndex: number;
  attempts: RecallAttempt[];
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
  grade: "correct" | "partial" | "missed" | "skipped";
  cueToRevealMs?: number;
  attemptedAt: string;
};
```

Implementation may normalize this representation into separate arrays/maps for efficient updates, but it MUST preserve these semantics.

### Required data invariants

- IDs are stable strings; timestamps are ISO 8601 UTC strings.
- There is at most one graded recall attempt for a given `(sessionId, markerId)`.
- Gateway steps never create `RecallAttempt` records.
- Only a completed self-grade or explicit skip creates an attempt record.
- An abandoned session keeps its graded attempts; ungraded current stops are not treated as misses.
- A session summary is derived from its attempt events, not independently edited totals.
- A content fingerprint identifies the exact cue/answer revision used. It is a version key, not a security hash.
- Changing note title or content creates a different fingerprint. Historical attempts remain in history but MUST NOT be mixed into current-revision weakness calculations.

### Local persistence and backup

- The initial implementation MUST remain local-only and use browser storage behind a small repository/storage boundary rather than scattering direct storage calls through UI components.
- Existing `locicanvas_v2_data` palace data MUST remain readable and MUST NOT be destructively rewritten merely to add recall.
- Store recall data under a separate versioned key (proposed: `locicanvas_recall_v1_data`) in v1. This isolates the first recall migration from existing palace persistence.
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
| Skipped | 0.0 |

```
sessionScorePercent =
  100 * sum(gradeWeight(attempt)) / numberOfGradedRecallAttempts
```

A session with no graded attempts has no score (display "No recall attempts recorded"), not 0% or 100%.

Also show counts for correct, partial, missed, skipped, and total recall attempts. Do not include gateway steps in the denominator. Do not round before aggregation; round only for display.

### 6.2 Item revision and recent-window calculation

For each `(markerId, itemFingerprint)`:
1. Select the most recent **5 graded exposures** from distinct sessions, limited to the last **60 days**.
2. Require at least **3** exposures before assigning a weakness status.
3. Compute weighted miss rate:

```
missRate =
  (missed + skipped + 0.5 * partial) / gradedExposures
```

4. Flag the item as **Frequently missed** when `missRate >= 0.50` and there are at least 3 eligible exposures.
5. Otherwise classify it as:
   - **Improving / monitor** when sample count is sufficient but miss rate is below 0.50;
   - **Not enough history** when fewer than 3 eligible exposures exist.

Default display MUST expose the numerator, denominator, time window, and item revision, e.g. "Needs review — 3.0 weighted misses across 5 recent attempts". Do not present the status as a diagnosis of memory ability.

### 6.3 Worked example

For the last five eligible exposures: missed, partial, correct, missed, correct:

```
missRate = (1 + 0.5 + 0 + 1 + 0) / 5 = 0.50
```

The item is flagged because the minimum sample count is met and the threshold is reached.

For only two exposures, even if both are missed, the UI MUST say "Not enough history" rather than flagging the item.

### 6.4 Anti-distortion safeguards

- Count at most one recall attempt per note per session.
- Do not count route previews, design-mode interactions, or ungraded abandoned steps.
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

The repository currently uses Node's built-in `node:test` for domain tests and does not yet declare a browser E2E test framework. The implementation plan must select and add a UI test harness only when its first UI slice begins; it must not claim browser-level coverage from domain tests alone.

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

## 10. Evaluation: prove learning value, not just usability

The first release is a functional baseline, not proof of educational efficacy.

A later opt-in evaluation SHOULD compare:
- immediate post-session recall;
- delayed recall after a predeclared interval (for example, 24 hours and 7 days);
- retention by item revision;
- self-grade versus a separately administered objective check on a subset of material;
- route completion and abandonment as usability measures, not learning outcomes.

Where feasible, use the same content and comparable item difficulty across conditions (for example, guided loci recall versus reviewing the same notes without route traversal). Predefine inclusion rules and report sample size, missing follow-ups, and uncertainty. Do not infer that the method works from engagement, self-ratings, or a small uncontrolled pilot alone.

## 11. Decision boundary

This document is the implementation contract for Guided Recall v1. Research findings may refine defaults, terminology, or optional experiments, but any change to route invariants, scoring weights, weakness thresholds, data retention, or privacy behavior MUST be recorded as a versioned decision with updated tests. The final research report should be reconciled against this contract before the first feature implementation PR is opened.

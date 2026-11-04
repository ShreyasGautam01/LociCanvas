# Guided Recall v1 — Implementation Slices

This task plan decomposes `GUIDED_RECALL_V1_SPEC.md` into reviewable pull requests. Each PR should implement one vertical slice, include tests, and remain local-only. Do not merge a slice whose acceptance criteria are incomplete.

## PR 0 — Specification and decisions

**Status:** Documentation-only contract branch.

Deliverables:
- Product/engineering contract with normative requirements.
- Task breakdown and explicit scope boundaries.
- README and improvement-plan links.

Acceptance:
- [ ] Requirements have stable IDs or clearly named sections.
- [ ] The route, session, attempt, score, and weak-item semantics are unambiguous.
- [ ] Current local-only architecture and compatibility constraints are stated.
- [ ] No production feature code or cloud-sync claim is introduced.

## PR 1 — Pure domain model and algorithm

**Goal:** implement deterministic, independently testable recall logic before building the UI.

Likely files:
- `src/domain/recallModel.js`
- `src/domain/recallModel.test.js`
- Small compatibility updates to existing palace model only if necessary.

Deliverables:
- Route validator and readable validation errors.
- Content fingerprint helper.
- Immutable session snapshot builder.
- Session lifecycle reducer/transition functions.
- Attempt recording with one-attempt-per-item-per-session guard.
- Grade weighting and session score.
- Recent-window and frequently-missed calculations.

Acceptance:
- [ ] All route invariants from spec section 3.2 are covered by tests.
- [ ] All session invariants from spec section 5 are covered by tests.
- [ ] Weak-item tests cover minimum sample, threshold boundary, date cutoff, last-five window, and revision changes.
- [ ] Explicit skips are excluded from scored attempts and weakness calculations.
- [ ] Session snapshots retain prompt and answer revisions; changes to the source note cannot mutate an active session.
- [ ] Domain code has no React, MUI, localStorage, or Supabase dependency.
- [ ] Existing `npm test`, `npm run lint`, and `npm run build` remain green.

## PR 2 — Local persistence and route authoring

**Implementation slice:** PR #7, branch `feat/guided-recall-route-authoring` (merged into `main`).

**Goal:** users can define valid routes from existing palace markers.

Deliverables:
- [x] Versioned recall repository/storage adapter at `locicanvas_recall_v1_data` (512 KiB estimated budget).
- [x] Route list and create/edit/delete flow.
- [x] Add/reorder/remove recall and gateway steps.
- [x] Keep broken routes and surface validation errors rather than silently deleting or redirecting them.
- [x] Validate palace + recall payloads before atomic backup restore; rollback the previous values if a write fails.
- [x] Combined backup export/import with legacy palace-only import compatibility.

Acceptance:
- [x] Legacy palace-only backups still import after an explicit warning that current recall routes will be cleared.
- [x] Routes survive refresh; browser test exercises reload persistence.
- [x] Invalid routes cannot be saved; the domain validator blocks invalid route saves.
- [ ] Deleting/retargeting a referenced item marks dependent routes invalid without deleting them silently (implementation is present; dedicated UI regression test remains outstanding).
- [x] Storage failure does not display a successful save; persistence errors are surfaced and rollback is unit-tested.
- [x] Export/import round-trips route definitions in the browser acceptance suite.

## PR 3 — Guided runner and persistent sessions

**Implementation slice:** PR #8, branch `feat/guided-recall-runner` (merged into `main`).

**Goal:** a complete recall session works end-to-end.

Deliverables:
- [x] Guided session screen for recall and gateway steps.
- [x] Prompt-first / answer-hidden flow.
- [x] Confidence choice or explicit confidence skip before reveal.
- [x] Optional typed response held in memory only and never added to session storage.
- [x] Explicit self-grade and controlled progression.
- [x] Start, exit-with-resume, resume, complete, and abandon handling. (Pause is represented by leaving an in-progress session resumable.)
- [x] Persistent session snapshot, skipped outcomes, gateway traversal, and attempt events.

Acceptance:
- [x] The answer cannot be revealed before the learner chooses Reveal.
- [x] The learner cannot progress until the recall step is graded or skipped.
- [x] Confidence is selected or explicitly skipped before reveal; the resulting value is stored on a grade when provided.
- [x] Gateway transitions use the route's actual gateway marker and target.
- [x] A refresh resumes without losing graded attempts.
- [x] Abandoning does not turn an ungraded stop into a miss.
- [x] Exactly one attempt is recorded per recall stop.

## PR 4 — Session history and weakness analytics

**Implementation slice:** PR #9, branch `feat/recall-session-analytics` (merged into `main` on 2026-11-04).

**Goal:** expose useful evidence about recall without overclaiming.

Deliverables:
- [x] Session history and expandable per-session grade details.
- [x] Route history grouped by route, with dated session scores.
- [x] Per-item revision history separating fingerprints.
- [x] Frequently missed view using the specified 5-exposure / 60-day / 3-sample / 50% algorithm.
- [x] High-confidence missed observations displayed separately from the weakness score.
- [x] Read-only analytics projection; nested session attempts are authoritative and the flat attempt array is not double-counted.
- [x] 7 / 30 / 60 day and all-time history filters.
- [x] Palace-scoped note identity so equal marker IDs in different environments do not contaminate each other.

Acceptance:
- [x] Every score is derived from saved attempt records.
- [x] Gateway steps do not enter the score denominator.
- [x] The weak-item view shows sample count, lookback window, and recent grade counts.
- [x] Fewer than three eligible exposures remains Not enough history.
- [x] Edited note content starts a new revision bucket.
- [x] UI labels results as self-reported and explicitly disclaims objective mastery / delayed-retention claims.
- [x] CI domain, lint, production build, and browser acceptance gates pass.

## PR 5 — Manual one-note review

**Implementation slice:** PR #10, branch `feat/manual-note-review` (merged into `main` on 2026-11-04; domain, lint, build, Chromium acceptance, PostgreSQL/RLS, and Vercel checks passed).

**Goal:** let the learner deliberately re-practise a note highlighted by current-revision history, without pretending to know the optimal review interval.

Deliverables:
- [x] Add a learner-triggered review action to current-revision notes with eligible recent history.
- [x] Launch a transient one-step route at the note's original palace and marker.
- [x] Re-check the current content fingerprint before the review starts.
- [x] Use the existing answer-hidden, confidence-before-reveal, self-grade, resume, and backup lifecycle.
- [x] Keep the transient route out of the user's authored route list.
- [x] State clearly that this is manual practice, not an automatically scheduled or due review.
- [x] Record the design boundary in `docs/MANUAL_REVIEW_V1_DECISION.md`.

Acceptance:
- [x] A review session is stored and appears in session history.
- [x] A review does not add or mutate a saved route.
- [x] Stale content revisions and deleted note references are rejected.
- [x] Review attempts remain associated with the exact note fingerprint and original locus.
- [x] CI domain, lint, production build, browser acceptance, and database checks pass.

## Future PR — Adaptive scheduling and replay (deferred)

Do not implement until the full research report is reconciled and a predeclared delayed-recall pilot provides evidence to evaluate scheduling choices.

Candidate work:
- Transparent due-review intervals.
- Confidence-aware ordering experiments.
- Reverse cue / blank-cue variants.
- Interference-aware ordering experiments.

Acceptance before implementation:
- [ ] Scheduling defaults are justified by the reconciled research evidence or a documented experiment.
- [ ] The algorithm is versioned, deterministic, and covered by boundary/edge-case tests.
- [ ] Every due recommendation explains its rule and evidence.
- [ ] The queue does not silently replace the user's custom route order.
- [ ] Delayed recall is measured separately from immediate self-reported performance.
- [ ] Pilot sample size, missing follow-ups, and uncertainty are reported.

## PR 6 — Accessibility and mobile hardening

**Implementation slice:** PR #11, branch `feat/guided-recall-accessibility`.

Deliverables:
- Keyboard-operable route creation and recall flow with explicit focus movement.
- Semantic dialog, heading, confidence-group, and progress labels.
- Visible keyboard focus and minimum 44 px Guided Recall action targets.
- Reduced-motion behavior for Framer Motion transitions and the session progress indicator.
- Responsive manager and runner actions at narrow mobile widths.
- Updated automated coverage and a manual assistive-technology checklist.

Acceptance:
- [x] Opening Guided Recall focuses its heading; opening the editor focuses the route-name field.
- [x] Starting a recall step focuses the cue; confidence, answer reveal, grading, gateway entry, and session completion move focus to the next meaningful element.
- [x] The hidden answer is absent from visible content and accessible-label attributes before reveal.
- [x] The narrow mobile dialog and runner actions remain within the viewport without horizontal overflow.
- [x] Reduced-motion emulation disables the session progress transition and Framer Motion uses the user's system preference.
- [x] The browser acceptance flow exercises route creation and the core recall actions by keyboard.
- [ ] A complete keyboard-only audit covers every route-authoring and analytics control.
- [ ] Manual NVDA, VoiceOver, or TalkBack testing is completed on supported devices before declaring a full screen-reader audit.
- [ ] Broken-route repair UI and storage-quota interaction have dedicated browser acceptance tests.

### Delayed-recall evaluation gate (separate, deferred)

Do not add automatic due dates or adaptive scheduling as part of this accessibility slice. First reconcile the full research report, then predeclare an opt-in delayed-recall feasibility protocol with actual follow-up completion, item revision identity, objective scoring rules where feasible, and explicit reporting of sample size and missing follow-ups.

### PR #11 verification scope

- The route manager and runner expose named dialog/heading/field/group/progress semantics.
- Focus is moved to new recall cues, answer reveal, confidence choices, Continue, gateway cues, and completed-session results; returning from a runner restores focus to the route manager.
- The browser acceptance test uses a 390 × 844 viewport and reduced-motion emulation, verifies keyboard operation through the first recall step, checks accessible-label answer hiding, and asserts no horizontal dialog overflow.
- Framer Motion follows the user's `prefers-reduced-motion` setting; the session progress bar has no transition when reduced motion is requested.
- Manual screen-reader/device verification remains explicitly outstanding.

## PR #10 verification scope

- Manual reviews create a transient one-note route with a reserved ID; authored route definitions are not changed.
- Reviews preserve the selected palace/marker and immutable note snapshot and reject stale item fingerprints before session creation.
- The browser acceptance test launches a review from analytics, completes it through the existing recall runner, verifies it appears in history, and checks that backups retain two sessions but still only one authored route.
- There is no due date, interval, automatic scheduling, or new storage schema.

### PR #9 verification scope

- Analytics are derived from nested saved session attempts, de-duplicated by attempt ID; a stale/orphan flat index cannot inflate results.
- Session and route history use the selected 7 / 30 / 60 day or all-time window; the weakness algorithm remains fixed at 5 exposures / 60 days / 3 minimum / 50% threshold.
- Item history separates exact content fingerprints and marks only the live note revision as current.
- Weakness calculations scope by palace ID and marker ID, preventing collisions across environments.
- High-confidence misses are separately shown and do not change the underlying miss-rate calculation.
- Browser acceptance opens analytics after a completed gateway-connected route and verifies route history plus its self-reported score.

### PR #8 verification scope

- Session snapshots preserve prompt/answer revisions and stable locus metadata without duplicating background image bytes.
- Session updates persist both the resumable session and a flat attempt index for later analytics.
- The browser acceptance test verifies that answers remain absent before explicit reveal, confidence is addressed before reveal, self-grades are persisted, gateway navigation is explicit, and a session resumes after refresh.
- Session summaries show self-reported grade counts and exclude skipped stops and gateway navigation from the score.
- PR #8 was merged into `main` on 2026-11-04.

### PR #7 verification scope

- Domain coverage: `npm test` includes route/storage parsing, backup compatibility, size limits, atomic two-key rollback, and the existing route invariants.
- Browser coverage: `npm run test:e2e` opens the production preview in Chromium, creates a route across a gateway, reloads, exports/imports a combined backup, and imports a palace-only backup.
- The browser harness is installed transiently in CI as Playwright 1.64.1; it is not included in the app bundle or normal runtime dependencies.
- Still outstanding before calling the whole V1 complete: runner UI, session persistence, analytics, keyboard/mobile/reduced-motion audit, and dedicated broken-route repair UI regression tests.

## Execution rules for every PR

1. Start from the latest `main`; do not assume another PR has merged.
2. Keep the change focused on its stated goal.
3. Add tests alongside domain behavior, not at the end.
4. Run `npm ci`, `npm test`, `npm run lint`, and `npm run build` when the environment permits.
5. Report exactly which checks ran and which did not.
6. Do not change the existing palace data format without migration and backup compatibility tests.
7. Do not add Supabase calls, authentication screens, or claims of cloud sync as part of local Guided Recall.
8. Do not merge PRs unless the repository owner explicitly asks for that action.

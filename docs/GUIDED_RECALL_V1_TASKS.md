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

**Implementation slice:** PR #8, branch `feat/guided-recall-runner` (open for review).

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

**Goal:** expose useful evidence about recall without overclaiming.

Deliverables:
- Session result summary.
- Route history.
- Per-item revision history.
- Frequently missed view using the specified algorithm.
- Confidence/missed observations as a separate signal.

Acceptance:
- [ ] Every score is derived from attempt records.
- [ ] Gateway steps do not enter the score denominator.
- [ ] The weak-item view shows sample count, lookback window, and recent grades.
- [ ] Fewer than three eligible exposures displays Not enough history.
- [ ] Edited note content starts a new revision bucket.
- [ ] UI labels results as self-reported.

## PR 5 — Review queue and adaptive replay (after pilot feedback)

**Goal:** introduce a simple, explainable re-review workflow only after the base metrics are trusted.

Candidate work:
- Due-review queue based on transparent intervals.
- Re-run one missed item in its original locus.
- Confidence-aware replay ordering.
- Reverse cue / blank-cue variants.
- Interference-aware ordering experiments.

Acceptance before implementation:
- [ ] Defaults are justified by the research report or a documented experiment.
- [ ] The algorithm is versioned and has deterministic tests.
- [ ] The UI explains why an item is due.
- [ ] The queue does not silently replace the user's custom route order.
- [ ] Delayed recall is measured separately from immediate performance.

## PR 6 — Accessibility and learning evaluation hardening

Deliverables:
- Keyboard-only audit.
- Reduced-motion and focus-management audit.
- Mobile layout and screen-reader check.
- Opt-in delayed-recall evaluation protocol.
- Updated documentation and screenshots/manual test notes.

Acceptance:
- [ ] All controls are keyboard reachable and visibly focused.
- [ ] No recall action depends on animation.
- [ ] Answer content is not exposed before reveal through accessible labels.
- [ ] Session resume and storage errors are tested in a browser.
- [ ] Evaluation reports delayed recall and sample size, not engagement alone.

### PR #8 verification scope

- Session snapshots preserve prompt/answer revisions and stable locus metadata without duplicating background image bytes.
- Session updates persist both the resumable session and a flat attempt index for later analytics.
- The browser acceptance test verifies that answers remain absent before explicit reveal, confidence is addressed before reveal, self-grades are persisted, gateway navigation is explicit, and a session resumes after refresh.
- Session summaries show self-reported grade counts and exclude skipped stops and gateway navigation from the score.

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

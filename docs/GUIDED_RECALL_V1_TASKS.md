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
- [ ] Domain code has no React, MUI, localStorage, or Supabase dependency.
- [ ] Existing `npm test`, `npm run lint`, and `npm run build` remain green.

## PR 2 — Local persistence and route authoring

**Goal:** users can define valid routes from existing palace markers.

Deliverables:
- Versioned recall repository/storage adapter.
- Route list and create/edit/delete flow.
- Add/reorder/remove recall and gateway steps.
- Clear broken-route state when referenced markers or palaces change.
- Atomic validation of palace + recall data in import/restore.
- Backup format compatibility and storage-budget/error handling.

Acceptance:
- [ ] Legacy palace-only backups still import.
- [ ] Routes survive refresh and browser restart.
- [ ] Invalid routes cannot be saved or started.
- [ ] Deleting/retargeting a referenced item marks dependent routes invalid without deleting them silently.
- [ ] Storage failure does not display a successful save.
- [ ] Export/import round-trips route definitions.

## PR 3 — Guided runner and persistent sessions

**Goal:** a complete recall session works end-to-end.

Deliverables:
- Guided session screen for recall and gateway steps.
- Prompt-first / answer-hidden flow.
- Confidence before reveal.
- Optional typed response held in memory only and discarded after grade unless future privacy opt-in is specified.
- Explicit self-grade and controlled progression.
- Start, pause, resume, complete, and abandon handling.
- Persistent session snapshot and attempt events.

Acceptance:
- [ ] The answer cannot be revealed before the learner chooses Reveal.
- [ ] The learner cannot progress until the recall step is graded or skipped.
- [ ] Confidence is recorded before reveal.
- [ ] Gateway transitions use the route's actual gateway marker and target.
- [ ] A refresh resumes without losing graded attempts.
- [ ] Abandoning does not turn an ungraded stop into a miss.
- [ ] Exactly one attempt is recorded per recall stop.

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

## Execution rules for every PR

1. Start from the latest `main`; do not assume another PR has merged.
2. Keep the change focused on its stated goal.
3. Add tests alongside domain behavior, not at the end.
4. Run `npm ci`, `npm test`, `npm run lint`, and `npm run build` when the environment permits.
5. Report exactly which checks ran and which did not.
6. Do not change the existing palace data format without migration and backup compatibility tests.
7. Do not add Supabase calls, authentication screens, or claims of cloud sync as part of local Guided Recall.
8. Do not merge PRs unless the repository owner explicitly asks for that action.

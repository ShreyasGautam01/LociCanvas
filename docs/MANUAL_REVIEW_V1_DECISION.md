# Decision Record — Manual Note Review v1

**Date:** 2026-11-04  
**Status:** Accepted for implementation in PR #10  
**Scope:** Local-first Guided Recall

## Context

The Session History and Learning Analytics slice exposes current-revision note performance and a transparent frequently-missed indicator. That signal can identify material a learner may choose to practise again.

The current repository does not contain the full research report referenced by the Guided Recall specification, nor does it contain delayed-recall pilot data from LociCanvas users. Therefore, the present evidence does not justify selecting automatic review intervals or claiming that a particular schedule is optimal.

## Decision

Implement a **manual, learner-triggered review action** from the current-revision performance list.

When the learner selects a note:

1. Re-resolve the exact palace and note marker from the current palace collection.
2. Recompute its content fingerprint and reject the action if the note has changed since the analytics list was rendered.
3. Construct a transient route containing exactly one recall step at the note's original palace and marker.
4. Create the normal immutable Guided Recall session snapshot and use the existing answer-hidden, confidence-before-reveal, self-grade, and persistence lifecycle.
5. Persist the session and its attempts using the existing recall storage and backup format.
6. Do not add, reorder, or modify the learner's authored routes.

The transient route uses a reserved system route ID and the route name "Manual review". It is not stored in recallData.routes; the session snapshot retains the step, note revision, and locus needed to resume or report the session.

## Explicit non-goals

This feature MUST NOT:
- assign due dates or review intervals;
- schedule or start reviews automatically;
- change the existing 5-exposure / 60-day / 3-exposure / 50% weakness heuristic;
- use confidence to change grade weights or determine a due date;
- alter custom route ordering;
- use AI grading or infer objective correctness;
- claim improved delayed retention from immediate self-grades.

The visible order of notes may follow the existing weakness metric, but the learner explicitly chooses when and what to review.

## Data and compatibility

- No recall storage schema migration.
- No new local-storage key.
- No cloud, account, or network dependency.
- Sessions continue to be written to the existing nested session history and flat attempt index through upsertRecallSession.
- Combined JSON backup behavior remains unchanged.
- The existing local recall-storage size limit still applies; the UI must not claim an attempt was saved if persistence fails.

## Acceptance tests

- A current note revision launches a one-step review at the original palace and marker.
- The answer remains hidden until the existing reveal action.
- Confidence is captured or explicitly skipped before reveal.
- The review grade is persisted as a regular self-reported attempt.
- The review session appears in history and backups.
- No learner-authored route is added or changed.
- Missing palace/marker and stale content fingerprints are rejected.
- No due date, interval, or automated scheduling field is created.

## Gate for future adaptive scheduling

Adaptive scheduling remains a separate future decision. Before implementation, reconcile the full research report and conduct a predeclared delayed-recall pilot. The pilot should report sample size, missing follow-ups, actual review timestamps, item revisions, and delayed outcomes. Any scheduling rule must be versioned, deterministic, explainable in the UI, and evaluated against delayed recall rather than engagement or immediate self-reported grades alone.

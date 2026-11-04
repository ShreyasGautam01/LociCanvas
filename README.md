# LociCanvas

LociCanvas is a visual digital memory palace based on the Method of Loci. Create virtual environments, place notes at meaningful positions, and connect environments using gateway markers.

## Current features

- Visual palace environments with HTTPS background URLs or device-uploaded JPG/PNG/WebP images, optimized before saving.
- Memory notes with title, content, and accent colors.
- Gateway markers linking environments.
- Breadcrumb and collection navigation.
- Design mode for adding memories and gateways.
- Drag markers to reposition them while Design Mode is active.
- Create environments from the Palace Collection drawer.
- First-run welcome guide explaining the memory-palace workflow and backup safety.
- Global search across palace names, marker titles, and note content.
- Keyboard-focusable memory and gateway markers; Enter/Space activates the selected marker.
- Visible local-only status and a clear warning that cloud sync is not enabled yet.
- Built-in guide dialog.
- Browser-local persistence using a versioned JSON envelope, with support for reading the older array format.
- Export a versioned JSON backup; import by pasting JSON or choosing a JSON backup file after validation and explicit replacement confirmation.
- Uploaded background images are downscaled/compressed to a maximum of 350 KB each and included in local JSON backups; a conservative 4 MiB estimated browser-storage budget protects against oversized collections.
- Best-effort recovery copy preservation with an in-app recovery action.
- HTTPS URL validation plus allow-listed, size-bounded raster image data URLs for device-uploaded backgrounds.
- Responsive, full-width editor dialogs on smaller screens.
- Validation of saved palace/marker structure and broken gateway references.
- Guided Recall route authoring: create, rename, edit, and delete routes; add existing note and gateway markers; reorder steps; and see broken references marked for repair.
- Guided Recall runner with answer-hidden recall cues, optional private response drafting, confidence-before-reveal, explicit self-grading/skips, and gateway traversal.
- Persisted active-session snapshots with resume after refresh; completed and abandoned session snapshots and self-reported attempts are included in backups.
- Session history and route performance views derived from saved self-reported attempts.
- Per-note content-revision history, current-revision frequently-missed indicators, and separate high-confidence-miss observations.
- Learner-triggered one-note manual review at the original locus, without creating or changing authored routes or assigning review intervals.

## Technology

- React 19 and Vite 7
- Material UI 7
- Framer Motion 12
- Browser `localStorage` (current persistence; no accounts or cloud sync yet)
- Node.js test runner for domain tests, Playwright browser acceptance tests, and PostgreSQL 17 CI checks for the migration, RLS, constraints, and gateway cleanup

## Run locally

Use a current Node.js LTS release, then from this directory:

```sh
npm ci
npm run dev
```

Vite prints the local development URL. To run the available checks:

```sh
npm test
npm run lint
npm run build
```

The browser acceptance suite can be run locally after installing its CI-only test runner and Chromium: `npm install --no-save --package-lock=false playwright@1.64.1`, `npx playwright install chromium`, then `npm run test:e2e`. The runtime application does not depend on Playwright. GitHub Actions installs the pinned runner transiently and runs the suite against the production preview build.

GitHub Actions also applies the SQL migration to a disposable PostgreSQL 17 database and checks the owner policies and integrity constraints. This uses a test-only substitute for the Supabase Auth helper; it does not replace a live Supabase project verification.

## Data persistence and recovery

The application stores palace data under `locicanvas_v2_data` and Guided Recall routes under the separate versioned key `locicanvas_recall_v1_data`. Palace saves continue to use the existing envelope containing `schemaVersion` and `palaces`; existing valid array-format data is still read and migrated on the next successful save. Recall routes have an independent 512 KiB estimated local-storage budget and do not rewrite palace records.

JSON backups contain both palace and recall data. Import validates both payloads before writing either key and attempts to restore both previous values if one storage write fails. Older palace-only backups remain supported; the import confirmation explains that their absence of recall data will clear the current routes.

If saved data is malformed or fails structural validation, the app attempts to preserve the raw value under `locicanvas_v2_data_recovery` and loads the sample collection instead of silently treating malformed data as an empty collection. Browser storage may be unavailable or full, so this recovery copy is best-effort. Do not clear site data if you need to recover a previous collection.

Data is still local to a browser profile and origin. It is not synchronized across devices, and clearing browser storage can remove it. Cloud accounts and database persistence are not implemented yet. Static hosting does not change the localStorage-only behavior.

## Project structure

- `src/App.jsx`: application UI and interactions.
- `src/domain/palaceModel.js`: pure coordinate, movement, storage parsing/serialization, and gateway-cleanup operations.
- `src/domain/palaceModel.test.js`: tests for domain operations and data validation.
- `src/domain/recallModel.js` and `src/domain/recallModel.test.js`: route validation, session domain logic, scoring, and recent-performance algorithms.
- `src/domain/recallAnalytics.js` and `src/domain/recallAnalytics.test.js`: read-only analytics projections over persisted sessions, revision history, and current-note weakness signals.
- `src/domain/recallReview.js` and `src/domain/recallReview.test.js`: transient, fingerprint-checked one-note manual review route creation.
- `src/domain/recallStorage.js` and `src/domain/recallStorage.test.js`: versioned recall storage, combined backup validation, legacy import, and two-key rollback tests.
- `src/GuidedRecallManager.jsx`: Guided Recall route authoring, resumable-session entry points, and analytics entry point.
- `src/RecallAnalyticsPanel.jsx`: session history, route performance, note revision history, weakness indicators, manual-review entry, and confidence observations.
- `src/GuidedRecallRunner.jsx`: guided recall runner, answer reveal, confidence, self-grading, skip, gateway entry, and session results.
- `browser-tests/guided-recall.browser.js`: Chromium end-to-end acceptance for a gateway-connected route, refresh persistence, and backup round-trip.
- `vite.config.js`: Vite configuration.
- `IMPROVEMENT_PLAN.md`: phased multi-user upgrade plan and architecture decisions.
- `docs/GUIDED_RECALL_V1_SPEC.md`: enforceable product, data, scoring, persistence, accessibility, and test contract for Guided Recall.
- `docs/GUIDED_RECALL_V1_TASKS.md`: implementation slices and release gates for Guided Recall.
- `docs/MANUAL_REVIEW_V1_DECISION.md`: decision record distinguishing manual re-practice from future adaptive scheduling.
- `docs/DELAYED_RECALL_PILOT_PROTOCOL_V1.md`: draft, documentation-only feasibility protocol for independently measuring immediate and delayed recall; it is not authorization to recruit participants or evidence of efficacy.
- `docs/GUIDED_RECALL_ACCESSIBILITY_AUDIT.md`: automated accessibility coverage and the remaining manual screen-reader checklist.
- `supabase/migrations/`: version-controlled PostgreSQL schema and RLS policies.
- `supabase/tests/`: disposable PostgreSQL setup plus migration/ownership tests run in CI.
- `SUPABASE_SETUP.md`: database setup, migration deployment, and live cloud-security verification checklist.

## GitHub Pages deployment

The repository includes a GitHub Actions workflow at `.github/workflows/locicanvas-pages.yml`. It tests, builds, and deploys LociCanvas when relevant changes reach `main`, and it can also be run manually from the Actions tab.

Before its first successful deployment, open **Repository Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. Then review the LociCanvas Pages workflow in the Actions tab. The project-site base path is configured as `/LociCanvas/`, because this standalone repository is hosted as a GitHub Pages project site.

Expected site URL: https://shreyasgautam01.github.io/LociCanvas/

GitHub Pages only serves the static frontend. The deployment workflow has completed successfully, but this version continues to store data in the current browser's localStorage; it does **not** yet offer accounts, cloud persistence, or cross-device synchronization. The Supabase schema foundation is being added separately; the frontend must not be considered cloud-connected until the authentication and repository integration is implemented.

## Current limitations

- No authentication, cloud database, or cross-device synchronization.
- Uploaded background images remain local to this browser until cloud storage is implemented. A future Supabase Storage integration will be needed to sync those images across devices.
- Browser-local recovery remains best-effort and depends on browser storage being accessible.
- Palace deletion UI, search, tags, and undo/redo are not implemented yet.
- A successful Pages deployment is recorded in GitHub Actions. Automated Guided Recall keyboard/mobile/reduced-motion checks pass, but manual NVDA/VoiceOver/TalkBack checks and some repair/storage-error browser paths remain outstanding.
- The delayed-recall pilot protocol is a draft study plan only. No participant study has been conducted, and the app does not automatically schedule reviews.
- The Supabase migration defines the security-oriented database foundation only; no frontend Supabase client or authentication flow is wired up yet.


## Standalone repository

This project now lives at the root of `ShreyasGautam01/LociCanvas`. CI and deployment workflows are stored in `.github/workflows/` at this repository root. Set the Vite project-site base to `/LociCanvas/` for GitHub Pages.

# LociCanvas v2 — Improvement Plan

**Status:** Standalone repository migration in progress; schema foundation merged; Supabase frontend integration remains incomplete  
**Scope:** `.`  
**History:** migrated from `Full_Stack2/.`; this standalone repository is now the implementation home

## Product direction

Evolve LociCanvas from a browser-local digital memory palace into a reliable, responsive, multi-user application. Keep the core mental model: people create visual environments, place memories at meaningful positions, and connect environments with gateways. This is a personal memory-space application; collaborative editing is **not** assumed as a core feature.

The first release should make each user's palace collection private, available across devices, and safely persisted. Optional sharing can follow once the private-user model is reliable.

## 1. Baseline inspection

### Current implementation

- React 19 + Vite 7, Material UI 7, Framer Motion 12; scripts currently include `dev`, `build`, `lint`, and `preview`.
- Main UI and most feature logic are in `src/App.jsx` (about 24 KB); `src/App.css` and `src/index.css` are currently empty.
- The domain model is an array of palaces/environments. Each palace has an `id`, `name`, `imageUrl`, and an `items` array. Items are either memory notes or gateways. Marker coordinates are stored as percentages.
- Existing features include a sample Grand Library and Oak Desk, positioned memory notes, note editing and accent colors, gateway creation to an existing or new palace, background image URLs, breadcrumbs, a palace drawer, design mode, and animated environment transitions.
- Persistence uses the `locicanvas_v2_data` key in browser `localStorage`. It is local to the browser origin and device profile, not shared cloud storage or account-aware persistence.
- The README describes moving markers and a working help guide; the inspected implementation has no marker drag handler and the help button changes state without rendering a help dialog. The drawer's “New Environment” action opens current environment settings, while a separate new-environment handler exists but is not wired into that visible flow.
- The README describes MUI v5, while `package.json` currently declares MUI v7. Documentation should match the actual dependencies.

### Main risks / gaps

1. **No identity or data isolation.** There is no sign-in flow, owner identity, cloud database, or cross-device synchronization.
2. **Persistence has no recovery path.** The browser-local data has no built-in export/import flow, schema migration, or save/error indicator.
3. **Incomplete interactions.** Marker movement, first-class environment creation/management, and the guide need end-to-end implementation.
4. **Monolithic component.** Application state, persistence, navigation, dialogs, and reusable UI are coupled in one large file.
5. **Validation and resilience.** Names, note content, image URLs, coordinates, missing gateway targets, storage failures, and malformed saved data need explicit handling.
6. **Responsive/accessibility quality.** Fixed-width dialogs and a full-viewport, overflow-hidden layout need mobile testing, keyboard access, visible focus, and accessible control labels.
7. **No evident automated test suite or CI quality gate.** Add a reproducible build/lint baseline and tests for domain logic, migration, and account isolation before release.

These are source-inspection observations, not claims that the application has undergone a runtime or security audit. The application has not yet been run in a local browser as part of this planning phase.

## 2. Architecture decision after independent critique

### Recommended initial stack

- **Frontend:** existing React + Vite app, hosted as static files on GitHub Pages.
- **Authentication:** Supabase Auth.
- **Persistent data:** Supabase PostgreSQL.
- **Authorization:** PostgreSQL Row-Level Security (RLS), enabled and tested for every user-accessible table.
- **File storage:** defer uploads; use validated HTTPS background-image URLs for the initial release. Reconsider Supabase Storage when image uploads are a validated requirement.
- **CI/CD:** GitHub Actions for install, lint, unit tests, production build, and deployment.

### Why Supabase/PostgreSQL is the recommended default

LociCanvas has explicit relationships: a marker belongs to one palace, and a gateway points to another palace. These relationships matter when a target palace is deleted, ownership is checked, or users search across all their memories.

PostgreSQL provides foreign keys, check constraints, transactions, and flexible cross-table queries. Those database constraints can protect relationships even when requests originate from different UI flows or race with one another. Supabase combines PostgreSQL with managed authentication and row-level security, avoiding the need to operate a custom API server for the MVP.

This is a practical recommendation, not a claim that Firestore cannot implement the product. Firestore can support the relationships, but referential integrity and cascading cleanup must be implemented and tested in application logic or trusted backend functions; deleting a parent Firestore document also does not automatically remove its subcollections. Given this product's relationships and the desire to search across palaces, PostgreSQL is the simpler integrity-oriented fit.

### Alternatives considered

| Option | Strengths | Trade-offs for LociCanvas | Decision |
|---|---|---|---|
| GitHub Pages + Firebase Auth/Firestore | Managed authentication, document data model, client SDKs, minimal server operations | No native relational foreign keys; gateway cleanup, referential integrity, and cross-palace querying need additional design | Viable, but not the first choice |
| GitHub Pages + Supabase Auth/PostgreSQL | Relational constraints, SQL queries, transactions, RLS, managed auth | Requires explicit SQL schema, RLS policies, and tests; free projects may pause after inactivity | **Recommended default** |
| Static frontend + custom Node/Express API + SQL database | Full control over domain endpoints, server-side operations, and integrations | More deployment, security, CORS, patching, monitoring, and API code to maintain | Defer until a concrete server-only requirement exists |

### Hosting and routing decision

GitHub Pages is appropriate for the first release because the current application uses in-app state for palace navigation and does not currently expose a URL route for each palace. Vite requires the correct project base path for a repository site (typically `/Full_Stack2/`) and a workflow that builds from `.`.

A deep-link refresh problem is **conditional**, not yet a confirmed defect in this app: it becomes relevant if we add path-based routes such as `/palace/<id>`. Before implementing shareable palace URLs, choose a deliberate routing strategy (for example, hash-based routes on Pages, a verified Pages fallback, or a host with configurable SPA rewrites). A custom host such as Vercel is not required merely to serve the current single-page UI.

### Security principles

- Treat every palace and marker as private unless an explicit future sharing model says otherwise.
- Use Supabase Auth identity plus database RLS; hiding records in React is not authorization.
- Enable RLS and define/test policies for each CRUD operation on every exposed user-data table.
- Never place a Supabase service-role key or other privileged secret in frontend code. The browser uses only the intended public client configuration and user session.
- Validate input in the UI for usability and enforce essential integrity rules in PostgreSQL as well.
- Test cross-account reads, inserts, updates, deletes, and gateway references before public release.

## 3. Proposed relational data model

Prefer a small normalized schema with stable UUIDs. Exact SQL should be authored and tested when Phase 2 begins.

### `palaces`

- `id UUID PRIMARY KEY`
- `owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `name TEXT NOT NULL`, with a database check that it is not blank after trimming
- `background_url TEXT`
- `created_at` and `updated_at` timestamps
- A composite unique constraint on `(id, owner_id)` so other tables can enforce ownership-consistent references

### `markers`

- `id UUID PRIMARY KEY`
- `owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `palace_id UUID NOT NULL`, with a composite foreign key `(palace_id, owner_id) REFERENCES palaces(id, owner_id) ON DELETE CASCADE`
- `type` constrained to `note` or `gateway`
- `x` and `y` numeric coordinates constrained to the inclusive range 0–100
- `title`, `content`, `color`, and timestamps as appropriate
- Nullable `destination_palace_id` for gateway targets
- A composite foreign key `(destination_palace_id, owner_id) REFERENCES palaces(id, owner_id) ON DELETE CASCADE`
- A check constraint: gateway rows must have a destination; note rows must not have one

**Why keep `owner_id` on markers?** It makes the RLS policy straightforward, but it is duplicated ownership data. The composite foreign keys are important: they prevent a marker from being attached to another user's palace and prevent a gateway from targeting another user's palace, even if a client submits a forged ID. The composite unique key on `palaces(id, owner_id)` supports those constraints.

**Deletion behavior:** deleting a palace should cascade-delete its own markers and incoming gateway markers that target it. This is more coherent than `ON DELETE SET NULL` while also requiring every gateway to have a valid destination. If product behavior later prefers a warning and manual cleanup, implement the deletion as one transaction and change the constraints deliberately; do not leave broken gateways.

Add indexes for common queries such as `palaces(owner_id)`, `markers(owner_id)`, `markers(palace_id)`, and `markers(destination_palace_id)` as justified by actual query plans. Search across memories should query markers scoped to the authenticated owner and can use PostgreSQL full-text search if a simple title/content search is insufficient.

No separate public `users` table is needed for the MVP unless profile/preferences data is required. Supabase Auth owns authentication records; a separate profile table can be introduced for application-specific fields.

## 4. Phased implementation roadmap

### Phase 0 — Discovery and architecture review (current phase)

- Inspect the source and document what currently works and what is incomplete.
- Define multi-user as private independent accounts with cross-device persistence, not collaborative editing.
- Obtain an independent architecture critique and record which recommendations are accepted, deferred, or rejected.
- Keep the existing `main` branch unchanged and use `project-improvement/locicanvas-v2-roadmap` for planning and implementation.

**Exit criteria:** architecture and MVP are documented; the schema's ownership and deletion rules are explicit; each phase has testable acceptance criteria.

### Phase 1 — Stabilize the existing local-first experience

- Establish and record baseline `npm ci`, lint, and production-build results before changing functionality.
- Extract pure palace/marker operations and a storage interface from `App.jsx`; split UI components as needed, without a wholesale redesign.
- Fix environment creation and implement the missing help dialog.
- Implement pointer-based marker drag/move with robust conversion between pixels and normalized percentage coordinates; enforce 0–100 boundaries.
- Validate names, note fields, URLs, and gateway targets. Prevent navigation to missing targets.
- Define safe environment deletion when other gateways point to it.
- Add versioned local-data parsing/migration and preserve current `locicanvas_v2_data` content.
- Add responsive layouts, keyboard-operable controls, accessible labels/focus, and reduced-motion handling.
- Add unit tests for coordinate conversion, palace/marker operations, gateway integrity, and local-data migration.

**Exit criteria:** the local version remains usable; primary flows work on desktop and mobile; build/lint/tests pass; old local data is preserved.

### Phase 2 — Add accounts and cloud persistence (multi-user MVP)

- Create the Supabase project and version-controlled SQL migrations.
- Define tables, constraints, indexes, grants, and RLS policies before enabling production writes.
- Add sign-up, sign-in, sign-out, password reset, and clear authentication/loading/error states.
- Create a data-access/repository layer (for example, `palaceRepository`) so UI components do not call Supabase throughout the component tree.
- Integrate Supabase Auth and PostgreSQL persistence.
- Provide truthful saving/saved/error/retry states; do not show a save as successful before the request is confirmed.
- Offer a controlled local-data import with preview and confirmation. Handle duplicate IDs/names and partial failures; never overwrite cloud data silently.
- Add a versioned JSON export for backup/portability.
- Test cross-account isolation and constraint behavior using automated database tests before public deployment.

**Exit criteria:** two accounts cannot read or mutate each other's data; invalid cross-user gateway targets are rejected; the same account can retrieve its data in a different browser/device; refresh/re-login preserve data; local migration and export are verified.

### Phase 3 — Product improvements and edge-case hardening

**Prioritize after the cloud MVP:**
- Search across memories; tags, favorites, and sorting/filtering.
- Complete palace lifecycle management: create, rename, duplicate, and safe delete.
- Background preview/fallback and clear feedback for invalid or unavailable URLs.
- Improved editor (links and lightweight Markdown before attachments).
- Undo/redo, recently opened palaces, and user preferences.
- Optional recall mode and manually configured review reminders if user testing supports their value.

**Explicitly deferred:** background uploads, real-time collaboration, public sharing/invitations, complex spaced repetition, and AI features. Introduce sharing only with a separately designed membership/role model and authorization tests.

### Phase 4 — Deployment, verification, and recovery

- Add GitHub Actions workflow to install from the lockfile, lint, run tests, build, and deploy the static `dist` directory.
- Configure the Vite base path for the nested repository directory and verify the output asset paths.
- Configure production authentication URLs and allowed redirect URLs.
- Run two-account isolation tests and manually test sign-up, password recovery, browser refresh/back, slow/failed network requests, mobile controls, and local import/export.
- Review Supabase current plan limits, pausing behavior, storage/egress costs, and backup guarantees before launch. A free tier is suitable for development but should not be treated as a production backup strategy.
- Document setup, schema migrations, RLS policies, deployment, backup/recovery, account deletion, and known limitations.

**Exit criteria:** reproducible deploy; no privileged keys in the bundle; database authorization tests pass; recovery and setup instructions are documented.

## 5. MVP acceptance criteria

The application is not a multi-user MVP until:

- Users can create an account, sign in/out, and recover access.
- Each account can access only its own private palaces and markers.
- Database constraints prevent cross-owner palace and gateway references.
- Data survives refresh, re-login, and use from a second browser/device.
- Local data can be imported without silent data loss and exported as a versioned backup.
- The core palace, marker, and gateway flows work on desktop and mobile.
- RLS tests demonstrate denied cross-account access for read/write/delete operations.
- Lint, automated tests, and the production build pass.
- Deployment, configuration, recovery, and known limitations are documented.

## 6. Independent critique reconciliation (Gemini review)

### Accepted

- **Prefer PostgreSQL/Supabase for the initial backend.** Relational constraints fit the palace-marker-gateway domain and reduce the amount of custom cleanup logic.
- **Make a data-access layer a Phase 1/2 boundary.** UI components should not be coupled to one persistence SDK.
- **Implement marker dragging and coordinate checks.** Percentage coordinates are a suitable representation, but they need boundary validation and tests.
- **Add controlled import/export and versioned local data.** Migration needs to preserve old data and never silently overwrite a cloud collection.
- **Use RLS tests as release blockers.** Verify cross-account select/insert/update/delete behavior.
- **Defer uploads and collaboration.** URL-based backgrounds keep initial storage needs smaller; shared editing is not a requirement.
- **Treat deep-link routing as a deployment design decision.** Test it when URL-addressable palace routes are introduced.

### Accepted with refinement

- **Relational integrity needs owner-aware foreign keys, not merely foreign keys.** A foreign key from `destination_palace_id` to `palaces.id` alone does not guarantee the target belongs to the same owner. Composite keys/foreign keys and RLS jointly enforce that boundary.
- **Gateway deletion behavior needs an explicit invariant.** Gemini's draft combined `ON DELETE SET NULL` with gateway integrity expectations. If every gateway requires a target, setting the target to NULL creates a contradictory state; this plan instead proposes cascading deletion of incoming gateways, with a transaction-based alternative if user experience requires it.
- **Refactor, but do not perform a large rewrite for its own sake.** Split data/domain operations and the components touched by features; keep each change small and build-tested.

### Qualified or not adopted as a current defect

- **Firestore is not inherently unsuitable.** It supports subcollections and collection-group queries, but relational constraints are a better fit here. The supposed N+1 gateway traversal problem is not proven by the inspected code; the current app keeps palace data in one in-memory collection and has no cloud traversal implementation yet.
- **GitHub Pages deep-link failure is conditional.** The existing app does not currently navigate using palace IDs in URL paths. A fallback/routing decision is needed if path-based routes are added, not a reason by itself to abandon Pages today.
- **Free-tier behavior must be checked at release time.** Budget assumptions and idle pausing are operational risks to plan for, not stable guarantees.

## 7. Execution log

### Phase 1 — initial implementation pass

**Committed to the planning branch; runtime/browser verification remains outstanding.**

- Added `src/domain/palaceModel.js` for bounded percentage coordinates, pointer-to-canvas conversion, marker movement, safe gateway cleanup on palace deletion, versioned local-storage serialization, and validation of legacy/versioned saved collections.
- Added `src/domain/palaceModel.test.js` covering coordinate bounds, coordinate conversion, marker updates, gateway cleanup, legacy/versioned storage, and malformed/broken-gateway data.
- Added `npm test` using Node's built-in test runner.
- Implemented marker dragging in Design Mode and guarded the delete control against accidental drag capture.
- Fixed the Palace Collection's New Environment action and added a help dialog.
- Added required-title validation, safer environment naming, and a broken-gateway navigation warning.
- Changed saved data writes to a versioned envelope while continuing to read the previous array format.
- Added best-effort preservation of malformed saved data under `locicanvas_v2_data_recovery`; the initial recovery state is not immediately written over the malformed active key.
- Updated the README to reflect the actual MUI version, current behavior, local setup, checks, persistence format, and known limitations.

**Verification performed:** the six domain test cases passed under Node.js 22.16.0 in an isolated local test run using the committed domain logic and test cases.

**Initial verification gap (historical):** at the first implementation pass, full tests/lint/build, browser interactions, keyboard/screen-reader behavior, mobile layout, and deployment had not yet been verified. Later GitHub Actions runs have passed domain tests, lint, and production build, and the Pages deployment workflow succeeded. Browser interaction/accessibility/device smoke tests remain outstanding.

**Remaining Phase 1 verification:** run browser smoke tests for marker dragging, import/export, recovery, responsive dialogs, keyboard focus, and reduced-motion/accessibility behavior. URL/form validation, backup import/export, recovery UI, and repeatable CI checks have been implemented. Cloud schema work can proceed, but account integration should not be described as complete before these browser checks and database security tests pass.

### Phase 1 — follow-up hardening pass (merged; CI succeeded)

- Added HTTPS URL validation for newly entered or edited environment backgrounds and gateway-created environments; blank URLs remain allowed and use the app's fallback behavior where configured.
- Replaced timestamp-only palace/gateway IDs with UUID-backed IDs when available, plus a fallback for environments without `crypto.randomUUID`.
- Added validated JSON backup export and paste-based import with a confirmation before replacing the current local collection.
- Added an in-app attempt to restore the best-effort preserved malformed-data recovery copy.
- Made note, gateway, settings, and environment creation dialogs use responsive widths.
- Added tests for HTTPS URL validation and generated ID uniqueness.

**Verification status:** PR #3 was merged after GitHub Actions passed dependency installation, domain tests, ESLint, and the Vite production build. Browser checks for import/export, recovery, URL validation, marker dragging, responsive dialogs, and accessibility remain outstanding. Import uses pasted JSON rather than a file picker.

### Phase 1 — CI result and Phase 4 deployment preparation

- The GitHub Actions run for the Phase 1 follow-up PR completed successfully: dependency installation, all domain tests, ESLint, and Vite production build passed.
- Added the Vite project-site base path `/Full_Stack2/` for repository-hosted Pages deployment.
- Replaced the malformed Google Fonts link (the existing href contained Markdown link syntax) and updated the page title, description, theme color, and favicon reference.
- Added a dedicated Pages workflow that runs tests, lint, build, uploads only the LociCanvas `dist` folder, and deploys via the GitHub Pages environment.
- Updated deployment instructions. The repository's Pages source must be set to **GitHub Actions** in Settings before the first deployment can succeed.
- Corrected README limitations to reflect that JSON backup import/export has been implemented.

**Previous deployment:** the nested application was deployed successfully from `Full_Stack2`. This standalone repository requires its own Pages configuration and workflow. The app remains localStorage-only until Supabase Auth and cloud persistence are wired into the frontend.

### Phase 2 — Supabase schema foundation (schema and CI checks merged; hosted migration pending)

- Added `supabase/config.toml` and a versioned migration defining owner-scoped `palaces` and `markers` tables.
- Added RLS policies for select, insert, update, and delete on both tables; table grants are limited to authenticated users.
- Added composite owner-aware foreign keys so a marker cannot reference another owner's palace and a gateway cannot target another owner's palace.
- Added database checks for nonblank bounded names/titles, HTTPS background URLs, supported marker types, percentage coordinates, color format, and the gateway/destination invariant.
- Added indexes for owner-scoped queries and update-time triggers.
- Documented project linking, migration preview/application, safe publishable-key configuration, local-to-cloud ID remapping, and required two-account isolation checks in `SUPABASE_SETUP.md`.
- **Not implemented by this schema-only phase:** frontend Supabase client, sign-up/sign-in UI, cloud repository, local-data import into cloud, or cross-device synchronization. Do not claim cloud support until these are implemented and verified.
- **Verification status:** a dedicated CI job has successfully applied the migration to PostgreSQL 17 and exercised the integrity checks, owner-only visibility/mutations, cross-owner foreign keys, and gateway cleanup using a test-only `auth.uid()` fixture. This does not contact a hosted Supabase project; apply the migration there and pass the documented two-account checks before enabling frontend cloud writes.

## References

- [Vite static deployment guide — GitHub Pages](https://vite.dev/guide/static-deploy)
- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase user data management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase free-project pausing behavior](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Firestore data model and subcollections (comparison)](https://firebase.google.com/docs/firestore/data-model)
- [Firestore collection-group queries (comparison)](https://firebase.google.com/docs/firestore/query-data/queries)

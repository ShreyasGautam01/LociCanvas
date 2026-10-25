# LociCanvas — Supabase setup and Phase 2 notes

## Status

This directory adds the first version-controlled database migration for cloud persistence. **The frontend is not connected to Supabase yet.** Until the separate authentication and data-repository integration is implemented and configured, the published app continues to use browser `localStorage`.

The migration is intentionally committed before frontend writes are enabled. Authentication, schema constraints, and Row Level Security must be established before browser code sends user data to the database.

## Data model

- `public.palaces`: one row per memory-palace environment, owned by a Supabase Auth user.
- `public.markers`: one row per note or gateway, including normalized percentage coordinates.
- Row Level Security (RLS) policies scope select, insert, update, and delete to `auth.uid()`.
- Composite foreign keys require a marker's palace and a gateway's destination palace to belong to the same owner.
- Deleting a palace cascades to its markers and incoming gateways, avoiding stale destination links.
- Palace/marker database identifiers are UUIDs. The current local app contains legacy IDs such as `root`, `desk`, `note-1` and prefixed IDs. The eventual local-to-cloud importer must map each local ID to a UUID and rewrite gateway destination references within one controlled import operation; it must not assume local IDs are UUIDs.
- This schema keeps background images as HTTPS URLs; it does not create object storage buckets or upload functionality.

## Create and link a Supabase project

1. Create a project in the Supabase Dashboard. Store the database password in a password manager and do not commit it.
2. Open PowerShell in the repository root (`LociCanvas`).
3. Authenticate the CLI and link this checkout to your project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

   The project reference is in your Supabase Dashboard project URL. The CLI may prompt for the database password.

4. Review the pending migration before applying it:

   ```powershell
   npx supabase db push --dry-run
   ```

5. Only after the preview shows the intended migration, apply it:

   ```powershell
   npx supabase db push
   ```

The migration path is `supabase/migrations/20261012000000_create_locicanvas_schema.sql` in this standalone repository. Do not separately paste the migration into the SQL Editor and then run `db push`; that can leave the database schema and migration history out of sync. If the remote database already has manual schema changes, reconcile them before applying this migration rather than forcing it.

## Future frontend configuration

The React/Vite integration is planned to use these build-time variables:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

- Put real values in a local `.env.local` file (not committed to Git).
- For GitHub Pages, add the same variable names as GitHub Actions **repository variables**, then explicitly pass them into the build step in the Pages workflow. Vite embeds `VITE_*` values in the static bundle at build time.
- Use a Supabase **publishable** key in browser code. Never put a Supabase secret/service-role key, database password, or personal access token in `VITE_*` variables, frontend files, GitHub Pages artifacts, or commit history.
- A publishable key is designed for public clients; it does not replace RLS. Data privacy depends on RLS and database constraints.

## Connect the existing Supabase project to this repository

Use the existing project; do not create a replacement:

- Project name: `Loci_Canvas`
- Project reference: `ydvxlwtwkogjcirjzoor`
- Project URL: `https://ydvxlwtwkogjcirjzoor.supabase.co`

In the Supabase Dashboard:

1. Open **Project Settings → Integrations → GitHub Integration**.
2. Choose **Authorize GitHub** if needed, and authorize Supabase on GitHub.
3. Select repository `ShreyasGautam01/LociCanvas`.
4. Set **Working directory** to `.` because the `supabase/` directory is at the repository root.
5. Set the production branch to `main`.
6. Connect/enable the integration, but keep **Deploy to production** disabled until this standalone-repository migration PR is merged and its CI checks pass.
7. After the migration PR is merged, enable **Deploy to production** to let the integration apply new migration files pushed to `main`. Then check the Supabase integration status on GitHub and verify the tables in the Supabase Dashboard.

The Supabase project was checked on 2026-10-25 after restoring it to an active state: it reported healthy, with no recorded migrations and no tables in the `public` schema. This means the existing project did not show an already-applied LociCanvas schema at that time. Verify again in the dashboard before the first production deployment in case its state changes.

Supabase's GitHub integration deploys files under `supabase/migrations/`; simply connecting the repository does not wire React to Supabase Auth or cloud persistence. The UI is still localStorage-only until the frontend client, authentication flows, and repository adapter are implemented.

## Security verification required before cloud writes are enabled

After applying the migration and once the auth/data integration exists, use two separately registered test accounts:

1. Account A creates a palace with one note and a gateway to a second palace.
2. Account B must see no rows owned by A and must not be able to select, update, or delete A's rows by guessing their UUIDs.
3. Account B must be unable to insert a marker referencing A's palace or a gateway targeting A's palace.
4. Invalid coordinates, blank titles, invalid background protocols, notes with destinations, and gateways without destinations must be rejected by PostgreSQL.
5. Deleting a destination palace must remove incoming gateways and leave no broken destination references.
6. Repeat tests for read/insert/update/delete after signing out and signing back in.

The GitHub Actions database job now applies this migration to PostgreSQL 17 and exercises the constraints, row visibility/mutations, owner-aware foreign keys, and gateway cleanup using a test-only `auth.uid()` fixture. This catches migration syntax and policy regressions, but it does not contact your hosted Supabase project. The two-account checks above remain required before the cloud frontend can be considered production-ready.

## Official references

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase CLI local/remote workflows](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

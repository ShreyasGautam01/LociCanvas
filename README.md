# LociCanvas

LociCanvas is a visual digital memory palace based on the Method of Loci. This repository is being initialized from the existing implementation in `ShreyasGautam01/Full_Stack2`.

The standalone migration will preserve the app, tests, Supabase migration files, and deployment checks. Follow-up commits will update the root build/deployment paths for this repository.

## Current persistence status

The current frontend uses browser `localStorage`. Supabase database migrations and RLS tests are included in the project, but the app is not yet wired to Supabase Auth or cloud persistence.

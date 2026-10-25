-- Executes against the migration using a test-only auth.uid() fixture.
-- Any failure raises an exception and causes the CI job to fail.
BEGIN;

INSERT INTO auth.users (id) VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

INSERT INTO public.palaces (id, name) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Account A — Study Hall'),
  ('20000000-0000-0000-0000-000000000002', 'Account A — Reading Room');

INSERT INTO public.markers (id, palace_id, type, x, y, title, content)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'note', 20, 30, 'Private note', 'Owned by account A'
);

INSERT INTO public.markers (
  id, palace_id, type, x, y, title, destination_palace_id
) VALUES (
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'gateway', 75, 60, 'Gateway to Reading Room',
  '20000000-0000-0000-0000-000000000002'
);

DO $assert_account_a$
DECLARE palace_count integer;
        marker_count integer;
BEGIN
  SELECT count(*) INTO palace_count FROM public.palaces;
  SELECT count(*) INTO marker_count FROM public.markers;
  IF palace_count <> 2 OR marker_count <> 2 THEN
    RAISE EXCEPTION 'Account A should initially see two palaces and two markers; got %, %', palace_count, marker_count;
  END IF;
END;
$assert_account_a$;

-- Each invalid input must be rejected by a database CHECK constraint.
DO $invalid_background$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.palaces (id, name, background_url)
    VALUES ('20000000-0000-0000-0000-000000000011', 'Unsafe background', 'http://example.com/image.jpg');
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'HTTP background URL was not rejected'; END IF;
END;
$invalid_background$;

DO $invalid_coordinate$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.markers (id, palace_id, type, x, y, title)
    VALUES (
      '30000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000001',
      'note', 101, 10, 'Out of bounds'
    );
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Out-of-range marker coordinate was not rejected'; END IF;
END;
$invalid_coordinate$;

DO $note_with_destination$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.markers (id, palace_id, type, x, y, title, destination_palace_id)
    VALUES (
      '30000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000001',
      'note', 10, 10, 'Invalid note', '20000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Note with a destination was not rejected'; END IF;
END;
$note_with_destination$;

DO $gateway_without_destination$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.markers (id, palace_id, type, x, y, title)
    VALUES (
      '30000000-0000-0000-0000-000000000013',
      '20000000-0000-0000-0000-000000000001',
      'gateway', 10, 10, 'Invalid gateway'
    );
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Gateway without a destination was not rejected'; END IF;
END;
$gateway_without_destination$;

-- Switch the request identity to account B without changing the database role.
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

INSERT INTO public.palaces (id, name)
VALUES ('20000000-0000-0000-0000-000000000003', 'Account B — Private Room');

DO $assert_account_b_isolation$
DECLARE palace_count integer;
DECLARE marker_count integer;
BEGIN
  SELECT count(*) INTO palace_count FROM public.palaces;
  SELECT count(*) INTO marker_count FROM public.markers;
  IF palace_count <> 1 OR marker_count <> 0 THEN
    RAISE EXCEPTION 'Account B should see only its own palace and no markers; got %, %', palace_count, marker_count;
  END IF;
END;
$assert_account_b_isolation$;

DO $forged_owner$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.palaces (id, owner_id, name)
    VALUES (
      '20000000-0000-0000-0000-000000000021',
      '10000000-0000-0000-0000-000000000001',
      'Forged owner'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Insert with another account owner_id was not rejected by RLS'; END IF;
END;
$forged_owner$;

DO $cross_owner_source$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.markers (id, palace_id, type, x, y, title)
    VALUES (
      '30000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000001',
      'note', 10, 10, 'Cross-owner source'
    );
  EXCEPTION WHEN foreign_key_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Marker referencing another account palace was not rejected'; END IF;
END;
$cross_owner_source$;

DO $cross_owner_destination$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.markers (
      id, palace_id, type, x, y, title, destination_palace_id
    ) VALUES (
      '30000000-0000-0000-0000-000000000022',
      '20000000-0000-0000-0000-000000000003',
      'gateway', 10, 10, 'Cross-owner destination',
      '20000000-0000-0000-0000-000000000001'
    );
  EXCEPTION WHEN foreign_key_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Gateway targeting another account palace was not rejected'; END IF;
END;
$cross_owner_destination$;

DO $cross_owner_mutations$
DECLARE affected integer;
BEGIN
  UPDATE public.palaces
  SET name = 'Account A was changed by B'
  WHERE id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Account B updated another account palace'; END IF;

  DELETE FROM public.palaces
  WHERE id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Account B deleted another account palace'; END IF;
END;
$cross_owner_mutations$;

-- Verify gateway cleanup on deletion while acting as the owning account.
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
DELETE FROM public.palaces WHERE id = '20000000-0000-0000-0000-000000000002';

DO $assert_gateway_cleanup$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.markers
    WHERE id = '30000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'Deleting a destination palace should delete its incoming gateway';
  END IF;
END;
$assert_gateway_cleanup$;

ROLLBACK;

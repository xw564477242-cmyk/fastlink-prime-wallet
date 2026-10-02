-- Append-only correction: PostgreSQL requires MINVALUE < MAXVALUE.
-- START 1 / MAXVALUE 1 / NO CYCLE permits exactly one nextval; zero is never issued.
-- Earlier failed candidate and replay evidence are retained.
BEGIN;
DO $guard$
BEGIN
 IF current_setting('fl_db005.isolated_validation',true) IS DISTINCT FROM 'approved-blank-task'
 OR current_database() NOT LIKE 'fl_db005_%' THEN
 RAISE EXCEPTION 'FL-DB-005 requires an explicitly approved blank task database';
 END IF;
END
$guard$;
SET LOCAL ROLE fl_db005_identity_owner;
CREATE OR REPLACE FUNCTION fl_identity.issue_ticket(p_digest bytea,p_principal text,p_login name,
 p_pid integer,p_xid xid8,p_purpose text,p_expires timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE sequence_name text;
BEGIN
 IF p_digest IS NULL OR octet_length(p_digest)<>32 OR p_expires IS NULL
 OR p_expires<=clock_timestamp() OR p_expires>clock_timestamp()+interval '60 seconds'
 OR p_pid IS NULL OR p_xid IS NULL OR p_purpose IS NULL
 OR NOT EXISTS (SELECT 1 FROM fl_identity.principal p WHERE p.principal_id=p_principal
 AND p.database_login=p_login AND NOT p.direct_login AND p.enabled
 AND p.purpose=p_purpose AND p.expires_at>=p_expires AND p.actor_kind IN ('USER','TENANT_ADMIN'))
 THEN RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
 ON n.oid=c.relnamespace WHERE n.nspname='fl_identity' AND c.relkind='S')>=10000 THEN
   RAISE EXCEPTION 'identity admission unavailable' USING ERRCODE='42501';
 END IF;
 sequence_name:='consume_'||substr(encode(p_digest,'hex'),1,48);
 EXECUTE format('CREATE SEQUENCE fl_identity.%I MINVALUE 0 MAXVALUE 1 START WITH 1 CACHE 1 NO CYCLE',sequence_name);
 INSERT INTO fl_identity.ticket(digest,principal_id,target_login,target_pid,target_xid,purpose,expires_at,consumption_sequence)
 VALUES(p_digest,p_principal,p_login,p_pid,p_xid,p_purpose,p_expires,
 format('fl_identity.%I',sequence_name)::regclass);
END
$fn$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA fl_identity FROM PUBLIC;
RESET ROLE;
COMMIT;

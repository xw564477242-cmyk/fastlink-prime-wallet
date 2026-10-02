-- FL-DB-005 isolation-only replay correction. Prior executed migration is retained.
-- One private, non-cycling single-value sequence per ticket is a nontransactional
-- consumption latch. Savepoint/transaction rollback cannot restore its first use.
-- Retain sequences as evidence; production capacity/lifecycle is NOT approved.
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
ALTER TABLE fl_identity.ticket ADD COLUMN consumption_sequence regclass;
UPDATE fl_identity.ticket SET expires_at=LEAST(expires_at,clock_timestamp());
ALTER DEFAULT PRIVILEGES IN SCHEMA fl_identity REVOKE ALL ON SEQUENCES FROM PUBLIC;
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
 EXECUTE format('CREATE SEQUENCE fl_identity.%I MINVALUE 1 MAXVALUE 1 START WITH 1 CACHE 1 NO CYCLE',sequence_name);
 INSERT INTO fl_identity.ticket(digest,principal_id,target_login,target_pid,target_xid,purpose,expires_at,consumption_sequence)
 VALUES(p_digest,p_principal,p_login,p_pid,p_xid,p_purpose,p_expires,
 format('fl_identity.%I',sequence_name)::regclass);
END
$fn$;
CREATE OR REPLACE FUNCTION fl_identity.bind_ticket(p_value text,p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE t fl_identity.ticket%ROWTYPE;
BEGIN
 IF p_value IS NULL OR length(p_value)<>64 OR p_value !~ '^[0-9a-f]{64}$' OR p_purpose IS NULL
 OR EXISTS (SELECT 1 FROM fl_identity.binding b WHERE b.database_login=session_user
 AND b.backend_pid=pg_backend_pid() AND b.transaction_id=pg_current_xact_id())
 THEN RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501'; END IF;
 UPDATE fl_identity.ticket SET consumed_at=clock_timestamp()
 WHERE digest=sha256(convert_to(p_value,'UTF8')) AND target_login=session_user
 AND target_pid=pg_backend_pid() AND target_xid=pg_current_xact_id()
 AND purpose=p_purpose AND expires_at>clock_timestamp() AND consumed_at IS NULL
 AND consumption_sequence IS NOT NULL
 RETURNING * INTO t;
 IF NOT FOUND THEN RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501'; END IF;
 BEGIN
   PERFORM pg_catalog.nextval(t.consumption_sequence);
 EXCEPTION WHEN SQLSTATE '2200H' THEN
   RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501';
 END;
 INSERT INTO fl_identity.binding VALUES(session_user,pg_backend_pid(),pg_current_xact_id(),
 t.principal_id,t.purpose,t.expires_at);
END
$fn$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA fl_identity FROM PUBLIC,fl_db005_runtime,fl_db005_issuer;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA fl_identity FROM PUBLIC;
RESET ROLE;
COMMIT;

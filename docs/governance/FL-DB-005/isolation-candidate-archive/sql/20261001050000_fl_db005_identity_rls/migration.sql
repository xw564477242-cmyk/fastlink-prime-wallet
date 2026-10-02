-- FL-DB-005 isolation-only candidate. NOT a production identity integration.
-- Original migrations remain unchanged. All semantic permissions are default deny.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('fl_db005.isolated_validation', true) IS DISTINCT FROM 'approved-blank-task'
     OR current_database() NOT LIKE 'fl_db005_%' THEN
    RAISE EXCEPTION 'FL-DB-005 requires an explicitly approved blank task database';
  END IF;
END
$guard$;
CREATE ROLE fl_db005_identity_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fl_db005_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fl_db005_issuer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA fl_identity AUTHORIZATION fl_db005_identity_owner;
REVOKE ALL ON SCHEMA fl_identity FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;
SET LOCAL ROLE fl_db005_identity_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA fl_identity REVOKE ALL ON TABLES FROM PUBLIC;
CREATE TABLE fl_identity.principal (
  principal_id text PRIMARY KEY,
  database_login name NOT NULL,
  tenant_id text NOT NULL,
  subject_id text NOT NULL,
  environment text NOT NULL CHECK (environment = 'SANDBOX'),
  actor_kind text NOT NULL CHECK (actor_kind IN ('USER','TENANT_ADMIN','PLATFORM_ADMIN','TASK')),
  purpose text NOT NULL,
  direct_login boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX principal_direct_login ON fl_identity.principal(database_login) WHERE direct_login;
CREATE TABLE fl_identity.ticket (
  digest bytea PRIMARY KEY CHECK (octet_length(digest)=32),
  principal_id text NOT NULL REFERENCES fl_identity.principal(principal_id),
  target_login name NOT NULL,
  target_pid integer NOT NULL,
  target_xid xid8 NOT NULL,
  purpose text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  UNIQUE(target_login,target_pid,target_xid)
);
CREATE TABLE fl_identity.binding (
  database_login name NOT NULL,
  backend_pid integer NOT NULL,
  transaction_id xid8 NOT NULL,
  principal_id text NOT NULL REFERENCES fl_identity.principal(principal_id),
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(database_login,backend_pid,transaction_id)
);
-- Only a trusted issuer may register an already-approved principal and transaction.
-- No registration or identity mutation function is granted to runtime.
CREATE FUNCTION fl_identity.issue_ticket(p_digest bytea,p_principal text,p_login name,
 p_pid integer,p_xid xid8,p_purpose text,p_expires timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $fn$
BEGIN
 IF octet_length(p_digest)<>32 OR p_expires<=clock_timestamp()
    OR p_expires>clock_timestamp()+interval '60 seconds' OR NOT EXISTS (
      SELECT 1 FROM fl_identity.principal p WHERE p.principal_id=p_principal
      AND p.database_login=p_login AND NOT p.direct_login AND p.enabled
      AND p.purpose=p_purpose AND p.expires_at>=p_expires
      AND p.actor_kind IN ('USER','TENANT_ADMIN')
    ) THEN RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501'; END IF;
 INSERT INTO fl_identity.ticket(digest,principal_id,target_login,target_pid,target_xid,purpose,expires_at)
 VALUES(p_digest,p_principal,p_login,p_pid,p_xid,p_purpose,p_expires);
END
$fn$;
CREATE FUNCTION fl_identity.bind_ticket(p_value text,p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE t fl_identity.ticket%ROWTYPE;
BEGIN
 IF p_value IS NULL OR length(p_value)<>64 OR p_value !~ '^[0-9a-f]{64}$'
 OR EXISTS (SELECT 1 FROM fl_identity.binding b WHERE b.database_login=session_user
 AND b.backend_pid=pg_backend_pid() AND b.transaction_id=pg_current_xact_id())
 THEN RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501'; END IF;
 UPDATE fl_identity.ticket SET consumed_at=clock_timestamp()
 WHERE digest=sha256(convert_to(p_value,'UTF8')) AND target_login=session_user
 AND target_pid=pg_backend_pid() AND target_xid=pg_current_xact_id()
 AND purpose=p_purpose AND expires_at>clock_timestamp() AND consumed_at IS NULL
 RETURNING * INTO t;
 IF NOT FOUND THEN RAISE EXCEPTION 'identity admission denied' USING ERRCODE='42501'; END IF;
 INSERT INTO fl_identity.binding VALUES(session_user,pg_backend_pid(),pg_current_xact_id(),
 t.principal_id,t.purpose,t.expires_at);
END
$fn$;
CREATE FUNCTION fl_identity.current_identity()
RETURNS TABLE(tenant_id text,subject_id text,environment text,actor_kind text,purpose text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
 SELECT p.tenant_id,p.subject_id,p.environment,p.actor_kind,p.purpose
 FROM fl_identity.principal p
 WHERE p.enabled AND p.expires_at>statement_timestamp() AND p.database_login=session_user
 AND p.actor_kind IN ('USER','TENANT_ADMIN')
 AND (p.direct_login OR EXISTS (
 SELECT 1 FROM fl_identity.binding b WHERE b.database_login=session_user
 AND b.backend_pid=pg_backend_pid() AND b.transaction_id=pg_current_xact_id_if_assigned()
 AND b.principal_id=p.principal_id AND b.purpose=p.purpose AND b.expires_at>statement_timestamp()))
$fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA fl_identity FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA fl_identity FROM PUBLIC;
GRANT USAGE ON SCHEMA fl_identity TO fl_db005_runtime,fl_db005_issuer;
GRANT EXECUTE ON FUNCTION fl_identity.issue_ticket(bytea,text,name,integer,xid8,text,timestamptz) TO fl_db005_issuer;
GRANT EXECUTE ON FUNCTION fl_identity.bind_ticket(text,text),fl_identity.current_identity() TO fl_db005_runtime;
RESET ROLE;
GRANT USAGE ON SCHEMA public TO fl_db005_runtime;
ALTER TABLE public."AdminSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminSession" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."AdminSession" FROM PUBLIC;
ALTER TABLE public."ApiClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApiClient" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ApiClient" FROM PUBLIC;
ALTER TABLE public."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApiKey" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ApiKey" FROM PUBLIC;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."AuditLog" FROM PUBLIC;
ALTER TABLE public."Card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Card" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Card" FROM PUBLIC;
ALTER TABLE public."CardBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardBalance" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardBalance" FROM PUBLIC;
ALTER TABLE public."CardEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardEvent" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardEvent" FROM PUBLIC;
ALTER TABLE public."CardHolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardHolder" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardHolder" FROM PUBLIC;
ALTER TABLE public."CardLifecycleEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardLifecycleEvent" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardLifecycleEvent" FROM PUBLIC;
ALTER TABLE public."CardLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardLimit" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardLimit" FROM PUBLIC;
ALTER TABLE public."CardRenewal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardRenewal" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardRenewal" FROM PUBLIC;
ALTER TABLE public."CardReplacement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardReplacement" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardReplacement" FROM PUBLIC;
ALTER TABLE public."CardRestriction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardRestriction" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardRestriction" FROM PUBLIC;
ALTER TABLE public."CardSecurityProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardSecurityProfile" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardSecurityProfile" FROM PUBLIC;
ALTER TABLE public."CardTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CardTransaction" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."CardTransaction" FROM PUBLIC;
ALTER TABLE public."Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Customer" FROM PUBLIC;
ALTER TABLE public."EndUserRefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EndUserRefreshToken" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."EndUserRefreshToken" FROM PUBLIC;
ALTER TABLE public."EndUserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EndUserSession" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."EndUserSession" FROM PUBLIC;
ALTER TABLE public."EvidenceArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EvidenceArtifact" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."EvidenceArtifact" FROM PUBLIC;
ALTER TABLE public."FxConversion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FxConversion" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."FxConversion" FROM PUBLIC;
ALTER TABLE public."FxOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FxOrder" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."FxOrder" FROM PUBLIC;
ALTER TABLE public."FxRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FxRate" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."FxRate" FROM PUBLIC;
ALTER TABLE public."Journal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Journal" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Journal" FROM PUBLIC;
ALTER TABLE public."JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."JournalEntry" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."JournalEntry" FROM PUBLIC;
ALTER TABLE public."Merchant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Merchant" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Merchant" FROM PUBLIC;
ALTER TABLE public."MerchantPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchantPayment" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."MerchantPayment" FROM PUBLIC;
ALTER TABLE public."MerchantQrCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchantQrCode" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."MerchantQrCode" FROM PUBLIC;
ALTER TABLE public."Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Permission" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Permission" FROM PUBLIC;
ALTER TABLE public."ProviderOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderOperation" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ProviderOperation" FROM PUBLIC;
ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Role" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Role" FROM PUBLIC;
ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RolePermission" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."RolePermission" FROM PUBLIC;
ALTER TABLE public."SettlementBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SettlementBatch" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."SettlementBatch" FROM PUBLIC;
ALTER TABLE public."SettlementItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SettlementItem" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."SettlementItem" FROM PUBLIC;
ALTER TABLE public."SimulationRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SimulationRecord" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."SimulationRecord" FROM PUBLIC;
ALTER TABLE public."SimulationScenario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SimulationScenario" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."SimulationScenario" FROM PUBLIC;
ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tenant" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Tenant" FROM PUBLIC;
ALTER TABLE public."TenantCardProviderConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantCardProviderConfig" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."TenantCardProviderConfig" FROM PUBLIC;
ALTER TABLE public."TenantUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantUser" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."TenantUser" FROM PUBLIC;
ALTER TABLE public."TenantUserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantUserRole" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."TenantUserRole" FROM PUBLIC;
ALTER TABLE public."TreasuryPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TreasuryPosition" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."TreasuryPosition" FROM PUBLIC;
ALTER TABLE public."WalletAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WalletAccount" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WalletAccount" FROM PUBLIC;
ALTER TABLE public."WalletOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WalletOperation" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WalletOperation" FROM PUBLIC;
ALTER TABLE public."WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WalletTransaction" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WalletTransaction" FROM PUBLIC;
ALTER TABLE public."WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebhookEvent" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WebhookEvent" FROM PUBLIC;
ALTER TABLE public."WithdrawalAddress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WithdrawalAddress" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."WithdrawalAddress" FROM PUBLIC;
ALTER TABLE public."tenant_third_party_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_third_party_config" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."tenant_third_party_config" FROM PUBLIC;
ALTER TABLE public."third_party_asset_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."third_party_asset_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."third_party_asset_orders" FROM PUBLIC;
ALTER TABLE public."third_party_callback_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."third_party_callback_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."third_party_callback_events" FROM PUBLIC;
ALTER TABLE public."treasury_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treasury_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."treasury_accounts" FROM PUBLIC;
ALTER TABLE public."treasury_fx_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treasury_fx_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."treasury_fx_orders" FROM PUBLIC;
ALTER TABLE public."treasury_operation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treasury_operation_logs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."treasury_operation_logs" FROM PUBLIC;
ALTER TABLE public."treasury_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treasury_settlements" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."treasury_settlements" FROM PUBLIC;
ALTER TABLE public."ucard_card_base" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ucard_card_base" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ucard_card_base" FROM PUBLIC;
ALTER TABLE public."ucard_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ucard_transactions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ucard_transactions" FROM PUBLIC;
-- Two explicitly approved positive samples only. Other 52 tables stay default deny.
GRANT SELECT ON TABLE public."Customer" TO fl_db005_runtime;
CREATE POLICY db5_customer_select ON public."Customer" FOR SELECT TO fl_db005_runtime
 USING (EXISTS (SELECT 1 FROM fl_identity.current_identity() i
 WHERE i.tenant_id="tenantId" AND i.environment="Customer".environment::text
 AND i.purpose IN ('profile','address-book')
 AND (i.actor_kind='TENANT_ADMIN' OR (i.actor_kind='USER' AND i.subject_id="Customer".id))));

SET LOCAL ROLE fl_db005_identity_owner;
CREATE FUNCTION fl_identity.address_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
DECLARE i record;
BEGIN
 SELECT * INTO i FROM fl_identity.current_identity();
 IF NOT FOUND OR i.actor_kind<>'USER' OR i.purpose<>'address-book' THEN
   RAISE EXCEPTION 'object access denied' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW."tenantId" IS NOT NULL OR NEW."customerId" IS NOT NULL OR NEW.environment IS NOT NULL THEN
     RAISE EXCEPTION 'object access denied' USING ERRCODE='42501';
   END IF;
   NEW."tenantId":=i.tenant_id;
   NEW."customerId":=i.subject_id;
   NEW.environment:=i.environment::public."Environment";
 ELSIF NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
    OR NEW.environment IS DISTINCT FROM OLD.environment THEN
   RAISE EXCEPTION 'object access denied' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION fl_identity.address_ownership() FROM PUBLIC;
RESET ROLE;
CREATE TRIGGER db5_address_ownership BEFORE INSERT OR UPDATE ON public."WithdrawalAddress"
 FOR EACH ROW EXECUTE FUNCTION fl_identity.address_ownership();
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public."WithdrawalAddress" TO fl_db005_runtime;
CREATE POLICY db5_address_select ON public."WithdrawalAddress" FOR SELECT TO fl_db005_runtime
 USING (EXISTS (SELECT 1 FROM fl_identity.current_identity() i WHERE i.actor_kind='USER'
 AND i.purpose='address-book' AND i.tenant_id="tenantId" AND i.subject_id="customerId"
 AND i.environment="WithdrawalAddress".environment::text));
CREATE POLICY db5_address_insert ON public."WithdrawalAddress" FOR INSERT TO fl_db005_runtime
 WITH CHECK (EXISTS (SELECT 1 FROM fl_identity.current_identity() i WHERE i.actor_kind='USER'
 AND i.purpose='address-book' AND i.tenant_id="tenantId" AND i.subject_id="customerId"
 AND i.environment="WithdrawalAddress".environment::text));
CREATE POLICY db5_address_update ON public."WithdrawalAddress" FOR UPDATE TO fl_db005_runtime
 USING (EXISTS (SELECT 1 FROM fl_identity.current_identity() i WHERE i.actor_kind='USER'
 AND i.purpose='address-book' AND i.tenant_id="tenantId" AND i.subject_id="customerId"
 AND i.environment="WithdrawalAddress".environment::text))
 WITH CHECK (EXISTS (SELECT 1 FROM fl_identity.current_identity() i WHERE i.actor_kind='USER'
 AND i.purpose='address-book' AND i.tenant_id="tenantId" AND i.subject_id="customerId"
 AND i.environment="WithdrawalAddress".environment::text));
CREATE POLICY db5_address_delete ON public."WithdrawalAddress" FOR DELETE TO fl_db005_runtime
 USING (EXISTS (SELECT 1 FROM fl_identity.current_identity() i WHERE i.actor_kind='USER'
 AND i.purpose='address-book' AND i.tenant_id="tenantId" AND i.subject_id="customerId"
 AND i.environment="WithdrawalAddress".environment::text));
COMMIT;

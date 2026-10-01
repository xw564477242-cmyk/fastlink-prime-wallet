-- Read-only catalog queries. No secrets or pg_authid.
-- relations
SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,c.relacl::text AS acl,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname;
-- roles
SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles ORDER BY rolname;
-- memberships
SELECT pg_get_userbyid(roleid) AS granted_role,pg_get_userbyid(member) AS member,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2;
-- policies
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
-- default_privileges
SELECT pg_get_userbyid(defaclrole) AS creator,defaclnamespace::regnamespace::text AS namespace,defaclobjtype,defaclacl::text FROM pg_default_acl ORDER BY 1,2,3;
-- functions
SELECT n.nspname AS schema,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prokind,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2,3;
-- schemas
SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl::text FROM pg_namespace WHERE nspname='public';
-- grants
SELECT grantor,grantee,table_schema,table_name,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type;
-- constraints
SELECT c.conname,c.contype,c.conrelid::regclass::text AS relation,c.confrelid::regclass::text AS referenced_relation FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY 3,1;
-- columns
SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
-- extensions
SELECT extname,extversion FROM pg_extension ORDER BY extname;
-- role_effective_privileges
SELECT r.rolname,c.relname,has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('fl_db004_tenant_a','fl_db004_tenant_b','fl_db004_anonymous') AND n.nspname='public' AND c.relkind IN ('r','p','v','m') ORDER BY 1,2;
-- triggers
SELECT n.nspname AS schema,c.relname AS relation,t.tgname,t.tgisinternal,p.proname AS function,pn.nspname AS function_schema FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 2,3;
-- test_role_attributes_after_migration
SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,(SELECT count(*) FROM pg_auth_members WHERE member=r.oid) AS memberships,(SELECT count(*) FROM pg_class WHERE relowner=r.oid) AS owned_relations FROM pg_roles r WHERE r.rolname IN ('fl_db004_tenant_a','fl_db004_tenant_b','fl_db004_anonymous') ORDER BY 1;

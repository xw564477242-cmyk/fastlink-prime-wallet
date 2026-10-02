import json,subprocess,hashlib,pathlib
ROOT=pathlib.Path('/private/tmp/FL-DB-005-resume-20261002')
queries={
"columns": "SELECT n.nspname AS schema,c.relname AS object,a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','fl_identity') AND c.relkind IN ('r','v','m') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,a.attnum",
"objects": "SELECT n.nspname AS schema,c.relname AS object,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','fl_identity') AND c.relkind IN ('r','v','m') ORDER BY 1,2",
"policies": "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','fl_identity') ORDER BY 1,2,3",
"functions": "SELECT n.nspname AS schema,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','fl_identity') AND p.prokind IN ('f','p') ORDER BY 1,2,3",
"memberships": "SELECT pg_get_userbyid(roleid) AS role,pg_get_userbyid(member) AS member,admin_option,inherit_option,set_option FROM pg_auth_members WHERE pg_get_userbyid(member) LIKE 'db5_%' ORDER BY 1,2",
"role_attributes": "SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'db5_%' OR rolname LIKE 'fl_db005_%' ORDER BY rolname",
"table_grants": "SELECT table_schema,table_name,grantee,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema IN ('public','fl_identity') ORDER BY 1,2,3,4",
"default_privileges": "SELECT pg_get_userbyid(defaclrole) AS creator,defaclnamespace::regnamespace::text AS namespace,defaclobjtype,defaclacl::text AS acl FROM pg_default_acl ORDER BY 1,2,3",
"triggers": "SELECT n.nspname AS schema,c.relname AS object,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','fl_identity') AND NOT t.tgisinternal ORDER BY 1,2,3",
"constraints": "SELECT n.nspname AS schema,c.relname AS object,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','fl_identity') ORDER BY 1,2,3"
}
result={"scope":"schema and privilege metadata only; no authid/password/rows queried", "rounds":[]}
for i in [5,6]:
 c=f'fl-db005-resume1002-r{i}';d=f'fl_db005_r{i}';entry={"round":i,"catalog":{}}
 for name,q in queries.items():
  x=subprocess.run(['docker','exec','-i',c,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','db5_initializer','-d',d],input="SELECT coalesce(json_agg(x),'[]'::json) FROM ("+q+") x;",text=True,capture_output=True)
  assert x.returncode==0,'catalog_read_failed'
  entry['catalog'][name]=json.loads(x.stdout)
 encoded=json.dumps(entry['catalog'],sort_keys=True,separators=(',',':')).encode();entry['catalog_sha256']=hashlib.sha256(encoded).hexdigest();result['rounds'].append(entry)
result['catalog_equal']=result['rounds'][0]['catalog']==result['rounds'][1]['catalog'];assert result['catalog_equal']
(ROOT/'validation/results/final-chain-catalog.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'catalog_equal':result['catalog_equal'],'hashes':[r['catalog_sha256'] for r in result['rounds']]}))

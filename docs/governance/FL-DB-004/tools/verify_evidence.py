"""Offline evidence checks only. No database connections, file writes or secret reads."""
import json, pathlib, hashlib, collections
D=pathlib.Path(__file__).resolve().parents[1]
def read(n): return json.loads((D/'evidence'/n).read_text())
checks=[]
def check(n,ok): checks.append({'name':n,'status':'PASS' if ok else 'FAIL'})
d=read('source-delta.json');m=read('migration-execution-r1.json');c=read('catalog-r1.json');p=read('native-role-probes-r1.json');i=read('isolation.json')
check('51 source hashes/OIDs match',len(d['records'])==51 and all(x['unchanged'] and x['prior_sha256']==x['current_sha256'] and x['prior_blob_oid']==x['current_blob_oid'] for x in d['records']))
check('prisma no change',d['prisma_diff']=='')
check('32 original steps ordered', [x['order'] for x in m['records']]==list(range(1,33)))
check('32 source streams unchanged/success',all(x['exit']==0 and x['bytes_unmodified'] for x in m['records']))
check('no Prisma ledger claim',not m['prisma_engine_used'] and not m['prisma_internal_ledger_created'])
check('17.11/no network/no ports',i['server_version']=='17.11' and i['network_mode']=='none' and not i['host_port_bindings'])
check('three nonprivileged authenticated roles',len(i['roles'])==3 and all(x['current_user']==x['session_user'] and not any(x[k] for k in ['superuser','bypassrls','createdb','createrole','memberships','owned_relations']) for x in i['roles']))
check('private credential modes',i['credential_directory_mode']=='0o700' and set(i['credential_file_modes'])=={'0o600'})
tables=[r for r in c['relations'] if r['kind']=='r']
check('54 business tables/no absent count fudging',len(tables)==54 and '_prisma_migrations' not in {r['name'] for r in tables})
check('RLS absence preserved',all(not x['rls'] and not x['force_rls'] for x in tables))
check('162 native role/table rights',len(c['role_effective_privileges'])==162)
check('native DML not added',p['DML_grants_added']==0 and all(not any(x[k] for k in ['can_select','can_insert','can_update','can_delete']) for x in c['role_effective_privileges']))
check('42 actual cases',len(p['cases'])==42)
check('same and cross paths present',{x['relation'] for x in p['cases']}=={'same','cross'})
check('four operations represented',{x['operation'] for x in p['cases']}=={'SELECT','INSERT','UPDATE','DELETE'})
check('denial attributable to ACL',all(x['exit']!=0 and '42501' in x['sqlstate'] and x['rows'] is None for x in p['cases']))
check('before/after row snapshots stable',all(x['unchanged'] and x['before_sha256']==x['after_sha256'] for x in p['cases']) and p['initial_sha256']==p['current_sha256'])
check('synthetic dual tenant/user fixture',p['synthetic_tenants']==p['synthetic_users']==p['synthetic_customers']==2)
check('draft is comments only',all(not line.strip() or line.lstrip().startswith('--') for line in (D/'REMEDIATION-DRAFT.sql').read_text().splitlines()))
check('historical FAIL/BLOCKED retained','T08/T09 FAIL' in (D/'BASELINE-DELTA-R1.md').read_text() and 'T13 BLOCKED' in (D/'BASELINE-DELTA-R1.md').read_text())
# Counterexample controls: the assessor must not turn all-denied into RLS success.
def rls_accept(same_allowed,cross_denied,trusted_scope): return same_allowed and cross_denied and trusted_scope
check('control all-denied not accepted',not rls_accept(False,True,False))
check('control cross success not accepted',not rls_accept(True,False,True))
check('control unmapped identity not accepted',not rls_accept(True,True,False))
check('control valid requirements accepted',rls_accept(True,True,True))
result={'scope':'offline artifact/control verification; NOT DB4 security PASS','checks':checks,'summary':dict(collections.Counter(x['status'] for x in checks))}
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(any(x['status']=='FAIL' for x in checks))

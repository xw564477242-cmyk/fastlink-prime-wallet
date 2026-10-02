#!/usr/bin/env python3
"""Read-only governance validation and in-memory adversarial fixtures. No SQL/network."""
import copy
import csv
import hashlib
import io
import json
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]
ROLES={'USER','TENANT_ADMIN','PLATFORM_ADMIN','BACKGROUND_TASK','BACKEND_RUNTIME','MIGRATION_OWNER'}
OPS={'SELECT','INSERT','UPDATE','DELETE'}

def read(name):
    return json.loads((ROOT/name).read_text())

def reference_profiles():
    text=(ROOT/'sources/00-OWNER-DECISION.md').read_text().split('二、54表策略分组',1)[1].split('三、角色正式边界',1)[0]
    pairs=re.findall(r'^(P\d+) [^：\n]+：(.+)。$',text,re.M)
    return {key:values.split('、') for key,values in pairs}

def validate(data):
    errors=[]
    reference=reference_profiles()
    ref={t:profile for profile,items in reference.items() for t in items}
    rows=data['tables'];names=[r['table'] for r in rows]
    if len(names)!=54 or len(set(names))!=54 or set(names)!=set(ref):errors.append('table set')
    for r in rows:
        if r['table'] not in ref or r['primary_profile']!=ref.get(r['table']):errors.append('profile')
        if r['policy_status']!='OWNER_APPROVED_POLICY' or r['validation_status']!='NOT_RUN' or not r['implementation_status'].startswith('BLOCKED'):errors.append('false approval/runtime status')
        if r['prior_db6']['contract_status'] not in {'UNKNOWN','BLOCKED'}:errors.append('old status altered')
        if {x['role'] for x in r['roles']}!=ROLES or len(r['roles'])!=6:errors.append('roles')
        fields=r['fields'];columns=set(fields['existing_columns']);hidden=set(fields['hidden_columns']);immutable=set(fields['immutable_fields'])
        if not set(fields['safe_projection_upper_bound'])<=columns or set(fields['safe_projection_upper_bound'])&hidden:errors.append('projection')
        if (set(fields['user_direct_update'])|set(fields['tenant_admin_direct_update']))&(hidden|immutable):errors.append('write secret/immutable')
        api=r['api_client_boundary']
        if api['direct_database']!='DENY' or api['upstream_provider_interface']!='DENY':errors.append('API boundary')
        j=r['jit']
        if j['standing_cross_tenant_access'] or j['normal_max_minutes']!=60 or j['break_glass_max_minutes']!=30 or j['review_within_hours']!=24 or j['default']!='READ_ONLY_REDACTED':errors.append('JIT boundary')
        if set(j['required'])!={'caseId','targetTenant','purpose','actor','approver','expiresAt'}:errors.append('JIT evidence')
        if not r['audit'] or not r['sources'] or not r['implementation_gaps']:errors.append('evidence/gaps')
        for role in r['roles']:
            if set(role['effective_business_crud'])!=OPS:errors.append('CRUD coverage')
            if role['implementation_status']!='BLOCKED_NOT_IMPLEMENTED' or role['validation_status']!='NOT_RUN':errors.append('role implementation')
            if role['role'] in {'USER','TENANT_ADMIN','PLATFORM_ADMIN'} and role['database_direct_access']!='DENY':errors.append('direct database')
            if set(role['visible_fields_upper_bound'])&hidden or not set(role['visible_fields_upper_bound'])<=columns:errors.append('role projection')
            if set(role['direct_update_fields'])&(hidden|immutable):errors.append('role write boundary')
            if role['role']=='MIGRATION_OWNER' and set(role['effective_business_crud'].values())!={'DENY'}:errors.append('owner DML')
            if r['primary_profile']=='P12' and (set(role['effective_business_crud'].values())!={'DENY'} or role['commands'] or role['visible_fields_upper_bound']):errors.append('quarantine')
        for state in r['state_contracts']:
            if state['unlisted_edges']!='DENY' or state['execution']!='NOT_IMPLEMENTED':errors.append('state default')
            if any(a in state['terminal_states'] for a,b in state['edges']):errors.append('terminal reopened')
            if state['physical_field'] and state['physical_field'] not in columns:errors.append('invented field')
            if state['schema_values'] and not {v for edge in state['edges'] for v in edge}<=set(state['schema_values']):errors.append('enum mismatch not isolated')
    return errors

def main():
    data=read('POLICY-CONTRACTS.json');checks=[]
    def check(name,yes):checks.append({'name':name,'status':'PASS' if yes else 'FAIL'})
    errors=validate(data);check('54 records/profiles/roles/fields/state/JIT/no direct access',not errors)
    check('authority source has exactly 12 groups/54 tables',len(reference_profiles())==12 and sum(map(len,reference_profiles().values()))==54)
    index=read('evidence/SOURCE-INDEX.json')['sources']
    originals=[s for s in index if s['path'].startswith('sources/')]
    ok=len(originals)==4
    for source in originals:
        path=ROOT/source['path'];text=path.read_text();raw=text.split('<!-- ORIGINAL-BEGIN -->\n',1)[1].split('\n<!-- ORIGINAL-END -->',1)[0]
        ok &= hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256'] and hashlib.sha256(raw.encode()).hexdigest()==source['original_body_sha256']
    check('four authority originals unchanged against source index',ok)
    rows=list(csv.DictReader(io.StringIO((ROOT/'ROLE-CRUD-MATRIX.csv').read_text())))
    expected={(t['table'],r['role']):r['effective_business_crud'] for t in data['tables'] for r in t['roles']}
    check('324 role rows/1296 cells exact JSON CSV agreement',len(rows)==324 and len({(r['table'],r['role']) for r in rows})==324 and all((r['table'],r['role']) in expected and all(r[o]==expected[(r['table'],r['role'])][o] for o in OPS) for r in rows))
    succession=read('STATE-SUCCESSION.json')
    check('47/7 old decisions retained separately from 54 approved policy',sum(r['prior_db6']['contract_status']=='BLOCKED' for r in data['tables'])==47 and sum(r['prior_db6']['contract_status']=='UNKNOWN' for r in data['tables'])==7 and succession['previous_formal_verified']==0 and succession['new_rls_verified']==0 and succession['new_policy_approved']==54)
    check('P12 all four quarantined',sum(r['primary_profile']=='P12' and r['implementation_status']=='BLOCKED_QUARANTINED' and not r['jit']['applies'] for r in data['tables'])==4)
    conflicts=read('CONFLICT-QUEUE.json')['items'];gap=read('IMPLEMENTATION-GAPS.json')['gaps']
    check('6 explicit conflicts, 3 unresolved without broadening',len(conflicts)==6 and sum(c['status']=='UNRESOLVED_IMPLEMENTATION' for c in conflicts)==3 and not read('CONFLICT-QUEUE.json')['auto_broaden_permissions'])
    check('9 gap groups map to real table names',len(gap)==9 and all(set(g['tables'])<=set(expected_t['table'] for expected_t in data['tables']) and g['state']=='BLOCKED' for g in gap))
    contracts={r['table']:r for r in data['tables']}
    check('withdrawal deletion and missing provider state remain blocked',next(r for r in contracts['WithdrawalAddress']['roles'] if r['role']=='USER')['effective_business_crud']['DELETE']=='BLOCKED_NO_DEACTIVATION_SCHEMA' and all(s['physical_field'] is None for s in contracts['tenant_third_party_config']['state_contracts']))
    check('simulator not mapped to scheduler write identity',contracts['SimulationRecord']['background_tasks']['allowed_purpose_families']==[] and 'DB7-G09' in contracts['SimulationRecord']['implementation_gaps'])
    task_families={f for t in data['tables'] for f in t['background_tasks']['allowed_purpose_families']}
    check('only approved task families named',task_families<={'scheduler','provider-adapter','webhook','ledger','settlement','retention','audit'})
    check('runtime merely carries principal, never blanket grant',all(all(v=='CARRIER_OF_AUTHORIZED_PRINCIPAL_ONLY' for v in next(r for r in t['roles'] if r['role']=='BACKEND_RUNTIME')['effective_business_crud'].values()) for t in data['tables'] if t['primary_profile']!='P12'))
    check('logical state index agrees with per-table contracts',read('STATE-CONTRACTS.json')['tables']=={t['table']:t['state_contracts'] for t in data['tables']})
    docs='\n'.join(f.read_text() for f in ROOT.glob('*.md'))
    check('permanent deviations/history gaps preserved',all(s in docs for s in ['DEV1-T03','DEV1-T12','GOV2-T09','HISTORY-GAP','DB-R02','88 High','2917','38 Admin','T17']))
    check('no executable SQL files or SQL fences',not list(ROOT.rglob('*.sql')) and '```sql' not in docs.lower())
    tests=read('TEST-DEFINITIONS.json')['tests'];check('16 distinct governance tests',len(tests)==16 and {t['id'] for t in tests}=={f'DB7-T{i:02d}' for i in range(1,17)})
    # In-memory corruption controls: do not write fixture files or execute business code.
    mutations=[('missing table',lambda d:d['tables'].pop()),('extra duplicate',lambda d:d['tables'].append(copy.deepcopy(d['tables'][0]))),('wrong profile',lambda d:d['tables'][0].update(primary_profile='P99')),('false VERIFIED',lambda d:d['tables'][0].update(policy_status='VERIFIED')),('false dynamic PASS',lambda d:d['tables'][0].update(validation_status='PASS')),('secret projection',lambda d:d['tables'][0]['fields']['safe_projection_upper_bound'].append('tokenHash')),('immutable write',lambda d:d['tables'][0]['fields']['user_direct_update'].append('id')),('upstream bypass',lambda d:d['tables'][0]['api_client_boundary'].update(upstream_provider_interface='ALLOW')),('JIT extended',lambda d:d['tables'][0]['jit'].update(normal_max_minutes=61)),('JIT no approver',lambda d:d['tables'][0]['jit']['required'].remove('approver')),('missing role',lambda d:d['tables'][0]['roles'].pop()),('owner DML',lambda d:d['tables'][0]['roles'][-1]['effective_business_crud'].update(UPDATE='ALLOW')),('unlisted edge allowed',lambda d:d['tables'][0]['state_contracts'][0].update(unlisted_edges='ALLOW')),('terminal reopens',lambda d:d['tables'][0]['state_contracts'][0]['edges'].append(['TIMESTAMP','NULL']))]
    for name,mutation in mutations:
        changed=copy.deepcopy(data);mutation(changed);check('synthetic rejection: '+name,bool(validate(changed)))
    for f in ROOT.rglob('*.json'):json.loads(f.read_text())
    check('all governance JSON valid',True)
    manifest=ROOT/'SHA256SUMS'
    if manifest.exists():
        values={name:sha for line in manifest.read_text().splitlines() for sha,name in [line.split('  ',1)]}
        names={str(f.relative_to(ROOT)) for f in ROOT.rglob('*') if f.is_file() and f!=manifest}
        check('SHA completeness and exact bytes',set(values)==names and all(hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==s for n,s in values.items()))
    failed=sum(c['status']=='FAIL' for c in checks)
    print(json.dumps({'scope':'DB7 governance only','read_only':True,'dynamic_tests':0,'total':len(checks),'failed':failed,'validation_error_categories':sorted(set(errors)),'checks':checks},ensure_ascii=False,indent=2))
    return int(bool(failed))

if __name__=='__main__':raise SystemExit(main())

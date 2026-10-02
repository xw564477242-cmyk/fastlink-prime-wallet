#!/usr/bin/env python3
"""Read only this governance package. No SQL, imports of business code or writes."""
import copy
import csv
import hashlib
import io
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_json(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def validate_contracts(data, reference):
    errors = []
    tables = data['tables']
    names = [t['table'] for t in tables]
    if len(names) != 54 or len(set(names)) != 54 or set(names) != set(reference):
        errors.append('54-table set mismatch')
    roles = {'USER', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'BACKGROUND_TASK', 'BACKEND_RUNTIME', 'MIGRATION_OWNER'}
    operations = {'SELECT', 'INSERT', 'UPDATE', 'DELETE'}
    for t in tables:
        if not t.get('evidence') or not t.get('responsible_roles') or not t.get('decision_id'):
            errors.append('missing evidence/owner/decision')
        if t['formal_positive_approved'] or t['current_formal_database_applied']:
            errors.append('unapproved formal assertion')
        if t['contract_status'] not in {'UNKNOWN', 'BLOCKED'}:
            errors.append('unsupported formal status')
        if len(t['role_contracts']) != 6 or {x['role'] for x in t['role_contracts']} != roles:
            errors.append('role coverage mismatch')
        for role in t['role_contracts']:
            if set(role['crud']) != operations or set(role['crud'].values()) != {'BLOCKED_PENDING_FORMAL_CONTRACT'}:
                errors.append('missing CRUD or invented permission')
            if role['admin_task_exception'] != 'NONE_APPROVED_FOR_FORMAL_RUNTIME':
                errors.append('unapproved exception')
    return errors


def main():
    checks = []
    def check(name, ok):
        checks.append({'check': name, 'status': 'PASS' if ok else 'FAIL'})
    data = read_json('TABLE-CONTRACTS.json')
    ref = read_json('evidence/catalog-reconciliation.json')
    check('54 unique records, evidence, six roles and no invented formal authorization', not validate_contracts(data, ref['historical_table_names']))
    status = {s: sum(t['contract_status'] == s for t in data['tables']) for s in ('VERIFIED','UNKNOWN','BLOCKED')}
    check('formal status counts 0/7/47', status == {'VERIFIED':0,'UNKNOWN':7,'BLOCKED':47})
    check('52 inherited default-deny and two isolation samples only', sum(t['inherited_default_deny'] for t in data['tables']) == 52 and sum(bool(t['inherited_positive_isolation_sample']) for t in data['tables']) == 2)
    queue = read_json('DECISION-QUEUE.json')['rows']
    check('all 54 decision records have evidence, next action, owner and deadline proposal', len(queue)==54 and {r['table'] for r in queue} == {t['table'] for t in data['tables']} and all(r.get('required_non_secret_evidence') and r.get('next_step') and r.get('responsible_roles') and r.get('deadline_suggestion') and r['approved_person'] is None and r['approval_time'] is None for r in queue))
    rows = list(csv.DictReader(io.StringIO((ROOT/'OPERATION-MATRIX.csv').read_text())))
    by_pair = {(t['table'],r['role']):(t,r) for t in data['tables'] for r in t['role_contracts']}
    csv_ok = len(rows)==324 and len({(r['table'],r['role']) for r in rows})==324
    for row in rows:
        match=by_pair.get((row['table'],row['role']))
        csv_ok &= bool(match) and all(row[op]==match[1]['crud'][op] for op in data['operations']) and row['contract_status']==match[0]['contract_status']
    check('324 CSV rows / 1296 CRUD cells agree with JSON', csv_ok)
    check('catalog/model discrepancy explicitly retained', ref['catalog_tables']==54 and ref['prisma_models']==60 and ref['intersection']==50 and len(ref['schema_only'])==10 and len(ref['catalog_only'])==4 and ref['inherited_difference_not_resolved'] and not ref['live_catalog_queried'])
    routes=read_json('evidence/route-reuse.json')
    check('216 inherited symbols; 131 Admin including 38 LIMITED, no dynamic claim', len(routes['routes'])==216 and all(r['symbol_exists'] and r['full_runtime_authorization']=='NOT_VALIDATED' for r in routes['routes']) and routes['admin_routes']==131 and routes['admin_inherited_counts'].get('LIMITED')==38 and routes['new_dynamic_tests']==0)
    future=read_json('FUTURE-ACCEPTANCE.json')
    ids={c['id'] for c in future['cases']}
    check('25 future cases are explicitly NOT_RUN', len(ids)==25 and all(c['execution']=='NOT_RUN' and c['expected'] and c['stop'] for c in future['cases']))
    check('pool, replay, CRUD, admin, task, indirect and rollback design coverage', {'CTX-02','CTX-03','CTX-04','CTX-05','CTX-06','CRUD-01','CRUD-02','CRUD-03','CRUD-04','CRUD-05','CRUD-06','ADMIN-01','TASK-01','INDIRECT-01','INDIRECT-02','PRIV-01','ROLLBACK-01'}<=ids)
    definitions=read_json('TEST-DEFINITIONS.json')['tests']
    check('16 fixed DB6 definitions with basis and limits', {t['id'] for t in definitions}=={f'DB6-T{i:02d}' for i in range(1,17)} and all(t['basis'] and t['limit'] for t in definitions))
    docs='\n'.join(f.read_text() for f in ROOT.glob('*.md'))
    check('permanent deviations and gaps inherited', all(s in docs for s in ['DEV1-T03','DEV1-T12','GOV2-T09','HISTORY-GAP','21','原FAIL','T17永久LIMITED','DB-R02','38条']))
    check('no SQL file or executable SQL fence', not list(ROOT.rglob('*.sql')) and '```sql' not in docs.lower())
    check('future rollout is approval-gated and fail-closed', all(s in (ROOT/'MIGRATION-ROLLOUT-ROLLBACK.md').read_text() for s in ['独立门禁4','不默认关闭RLS或恢复宽权限','旧迁移不覆盖','D0','D5']))
    check('baseline delta PENDING; no formal update', 'PENDING' in (ROOT/'BASELINE-PROPOSED-DELTA.md').read_text() and '未写入正式基线' in docs)
    # In-memory adversarial validation. Never writes a fixture or modifies originals.
    mutations=[('missing table',lambda d:d['tables'].pop()),
               ('duplicate table',lambda d:d['tables'].append(copy.deepcopy(d['tables'][0]))),
               ('unknown replacement table',lambda d:d['tables'][0].update(table='UNAPPROVED_SYNTHETIC_TABLE')),
               ('invented grant',lambda d:d['tables'][0]['role_contracts'][0]['crud'].update(SELECT='ALLOW')),
               ('missing role',lambda d:d['tables'][0]['role_contracts'].pop()),
               ('missing evidence',lambda d:d['tables'][0].update(evidence=[])),
               ('false approval',lambda d:d['tables'][0].update(formal_positive_approved=True)),
               ('invented platform exception',lambda d:d['tables'][0]['role_contracts'][2].update(admin_task_exception='ALLOW_ALL'))]
    for name,mutate in mutations:
        candidate=copy.deepcopy(data);mutate(candidate)
        check('synthetic rejection: '+name,bool(validate_contracts(candidate,ref['historical_table_names'])))
    files=[f for f in ROOT.rglob('*') if f.is_file()]
    check('all JSON parses', all(json.loads(f.read_text()) is not None for f in files if f.suffix=='.json'))
    manifest=ROOT/'SHA256SUMS'
    if manifest.exists():
        listed={}
        for line in manifest.read_text().splitlines():
            digest,name=line.split('  ',1);listed[name]=digest
        expected={str(f.relative_to(ROOT)) for f in files if f!=manifest}
        check('SHA manifest complete and exact',set(listed)==expected and all(hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==h for n,h in listed.items()))
    failed=sum(c['status']=='FAIL' for c in checks)
    print(json.dumps({'read_only':True,'database_tests_run':0,'checks':checks,'total':len(checks),'failed':failed},ensure_ascii=False,indent=2))
    return 1 if failed else 0


if __name__=='__main__':
    sys.exit(main())

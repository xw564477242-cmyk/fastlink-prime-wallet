"""Offline review of retained DB5 evidence; no database, process or network access."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'evidence/docs/governance/FL-DB-005'
CURRENT = Path(__file__).resolve().parent.parent / 'results'

def read(name):
    p = CURRENT / name.removeprefix('evidence/') if name in ['evidence/final-chain-catalog.json','evidence/dynamic-final-r5-r6.json','evidence/negative-final-r5-r6.json'] else ROOT / name
    return json.loads(p.read_text())

def main():
    approved = read('evidence/52-table-approved-contract-r3.json')
    previous = read('evidence/52-table-contract-approval-matrix.json')
    catalog = read('evidence/final-chain-catalog.json')
    scope = read('evidence/table-scope-final.json')
    deny = {x['table'] for x in approved['rows']}
    assert len(deny) == 52
    assert deny == {x['table'] for x in previous['rows']}
    assert deny == {x['table'] for x in scope['tables']} - {'Customer', 'WithdrawalAddress'}
    assert all(x['contract_status'] == 'APPROVED_DEFAULT_DENY' and
               set(x['approved_crud']) == {'SELECT', 'INSERT', 'UPDATE', 'DELETE'} and
               set(x['approved_crud'].values()) == {'DENY'} for x in approved['rows'])
    assert [x['round'] for x in catalog['rounds']] == [5, 6]
    assert catalog['rounds'][0]['catalog'] == catalog['rounds'][1]['catalog']
    matches = []
    expected_grants = {('Customer', 'SELECT')} | {
        ('WithdrawalAddress', op) for op in ['SELECT', 'INSERT', 'UPDATE', 'DELETE']}
    for round_info in catalog['rounds']:
        c = round_info['catalog']
        tables = {x['object']: x for x in c['objects']
                  if x['schema'] == 'public' and x['relkind'] == 'r'}
        assert set(tables) == deny | {'Customer', 'WithdrawalAddress'}
        assert all(x['relrowsecurity'] and x['relforcerowsecurity'] for x in tables.values())
        non_owner_grants = [x for x in c['table_grants'] if x['table_schema'] == 'public'
                            and x['grantee'] != tables[x['table_name']]['owner']]
        assert len(non_owner_grants) == 5
        assert all(x['grantee'] == 'fl_db005_runtime' and x['is_grantable'] == 'NO'
                   for x in non_owner_grants)
        assert {(x['table_name'], x['privilege_type']) for x in non_owner_grants} == expected_grants
        assert all(x['tablename'] not in deny for x in c['policies'])
        assert len(c['policies']) == 5
        policies = {(x['tablename'], x['cmd']): x for x in c['policies']}
        assert set(policies) == expected_grants
        customer = policies['Customer', 'SELECT']['qual']
        assert all(t in customer for t in ['current_identity()', 'tenant_id', '"tenantId"',
                                           'environment', 'TENANT_ADMIN', 'USER',
                                           'i.subject_id = "Customer".id'])
        for op in ['SELECT', 'INSERT', 'UPDATE', 'DELETE']:
            policy = policies['WithdrawalAddress', op]
            exprs = [policy['with_check']] if op == 'INSERT' else [policy['qual']]
            if op == 'UPDATE':
                exprs.append(policy['with_check'])
            assert all(e and all(t in e for t in ['current_identity()', 'USER',
                       'address-book', 'tenant_id', '"tenantId"', 'subject_id',
                       '"customerId"', 'environment']) for e in exprs)
        funcs = {x['proname']: x for x in c['functions'] if x['schema'] == 'fl_identity'}
        assert set(funcs) == {'address_ownership', 'bind_ticket', 'current_identity', 'issue_ticket'}
        assert all(x['owner'] == 'fl_db005_identity_owner' and x['prosecdef'] and
                   x['proconfig'] == ['search_path=pg_catalog, pg_temp'] for x in funcs.values())
        trigger = funcs['address_ownership']['definition']
        for marker in ['NEW."tenantId" IS NOT NULL', 'NEW."customerId" IS NOT NULL',
                       'NEW.environment IS NOT NULL', 'NEW."tenantId":=i.tenant_id',
                       'NEW."customerId":=i.subject_id',
                       'NEW."tenantId" IS DISTINCT FROM OLD."tenantId"',
                       'NEW."customerId" IS DISTINCT FROM OLD."customerId"',
                       'NEW.environment IS DISTINCT FROM OLD.environment']:
            assert marker in trigger
        assert len(c['triggers']) == 1 and c['triggers'][0]['object'] == 'WithdrawalAddress'
        identity = funcs['current_identity']['definition']
        assert 'session_user' in identity and 'pg_backend_pid()' in identity
        assert 'pg_current_xact_id_if_assigned()' in identity
        assert "actor_kind IN ('USER','TENANT_ADMIN')" in identity
        assert all(not x['rolsuper'] and not x['rolbypassrls']
                   for x in c['role_attributes'] if x['rolname'] != 'db5_initializer')
        assert all(not x['set_option'] and not x['admin_option'] and
                   x['role'] in {'fl_db005_runtime', 'fl_db005_issuer'} for x in c['memberships'])
        for table in sorted(deny):
            matches.append({'round': round_info['round'], 'table': table,
                            'rls': True, 'force_rls': True, 'non_owner_grants': 0,
                            'policies': 0, 'approved_crud': 'DENY_ALL', 'match': True})
    for filename, count in [('dynamic-final-r5-r6.json', 29), ('negative-final-r5-r6.json', 17)]:
        data = read('evidence/' + filename)
        assert not data.get('stopped') and not data.get('error')
        assert len(data['rounds']) == 2
        assert all(len(x['cases']) == count and all(t['status'] == 'PASS' for t in x['cases'])
                   for x in data['rounds'])
    inputs = ['OWNER-CONTRACT-APPROVAL-R3.md', 'evidence/52-table-approved-contract-r3.json',
              'evidence/52-table-contract-approval-matrix.json', 'evidence/final-chain-catalog.json',
              'evidence/table-scope-final.json', 'evidence/dynamic-final-r5-r6.json',
              'evidence/negative-final-r5-r6.json']
    result = {'status': 'PASS', 'test': 'DB5-T06', 'scope': 'approved default-deny contract/evidence match',
              'matched_tables': 52, 'catalog_rounds': [5, 6], 'matches': matches,
              'positive_exception_table_count': 2, 'positive_permissions_added': 0,
              'source_sha256': {n: hashlib.sha256(((CURRENT / n.removeprefix('evidence/')) if (CURRENT / n.removeprefix('evidence/')).exists() else (ROOT / n)).read_bytes()).hexdigest() for n in inputs},
              'database_executions': 0, 'limitations': [
                  'Offline retained-catalog and source-structure checks, not new dynamic tests',
                  'Does not prove business usability, actual Prisma/JWT/task integration or owner isolation',
                  'T08-T15 remain LIMITED; full CI and funds prerequisite remain unresolved']}
    (CURRENT / 'contract-implementation-check-c5.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['status', 'test', 'matched_tables', 'database_executions']}))

if __name__ == '__main__':
    main()

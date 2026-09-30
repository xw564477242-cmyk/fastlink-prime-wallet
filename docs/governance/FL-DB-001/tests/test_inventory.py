"""Synthetic scanner controls and cross-checks of recorded local evidence only."""
import sys,json,unittest,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import inventory

def data(n):return json.loads((ROOT/'evidence'/n).read_text())
class ScannerControls(unittest.TestCase):
 def test_line_comment(self):self.assertFalse(inventory.scan('-- CREATE TABLE fictional (id int);'))
 def test_nested_comment(self):self.assertFalse(inventory.scan('/* a /* CREATE TABLE fictional(id int); */ b */'))
 def test_regular_table(self):self.assertEqual(inventory.scan('CREATE TABLE "Synthetic"(id int);')[0]['identifiers'],['Synthetic'])
 def test_schema_table(self):self.assertEqual(inventory.scan('CREATE TABLE public.synthetic(id int);')[0]['identifiers'],['public.synthetic'])
 def test_dynamic_template(self):self.assertTrue(any(x['dynamic_literal'] for x in inventory.scan("DO $$ BEGIN EXECUTE format('CREATE POLICY synthetic ON %I USING (true)', t); END $$;")))
 def test_dollar_body(self):self.assertTrue(any(x['kind']=='role' for x in inventory.scan('DO $$ BEGIN CREATE ROLE synthetic; END $$;')))
 def test_line_number(self):self.assertEqual(inventory.scan('-- comment\nCREATE TABLE synthetic(id int);')[0]['line'],2)
 def test_quoted_noise(self):self.assertFalse(inventory.scan("SELECT 'synthetic harmless value';"))
 def test_security_definer(self):self.assertTrue(any(x['kind']=='security_definer' for x in inventory.scan('CREATE FUNCTION synthetic() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;')))
 def test_drop_kind(self):self.assertEqual(inventory.scan('ALTER TABLE synthetic DROP CONSTRAINT c;')[0]['identifiers'],['CONSTRAINT'])
 def test_rls_force(self):self.assertEqual(inventory.scan('ALTER TABLE synthetic FORCE ROW LEVEL SECURITY;')[0]['kind'],'rls_force')
 def test_policy_with_check(self):self.assertTrue(any(x['kind']=='check_true' for x in inventory.scan('CREATE POLICY synthetic ON t WITH CHECK (true);')))
 def test_non_executable_truncate_requires_review(self):self.assertTrue(any(x['kind']=='truncate' for x in inventory.scan('REVOKE TRUNCATE ON t FROM r;')))
class EvidenceControls(unittest.TestCase):
 def test_inventory_51(self):self.assertEqual(len(data('migration-inventory.json')['records']),51)
 def test_formal_source_checksum_matches_ledger(self):
  inv={x['path'].split('/')[-2]:x['sha256'] for x in data('migration-inventory.json')['records'] if x['source_class']=='formal_forward'}
  live=data('catalog-default.json')['migrations'];self.assertEqual(len(live),32)
  for x in live:self.assertTrue(x['finished']);self.assertEqual(x['checksum'],inv[x['migration_name']])
 def test_uat_failure_not_hidden(self):self.assertEqual(sum(x['finished'] for x in data('catalog-uat-partial.json')['migrations']),31)
 def test_nonowner_identities(self):
  for x in data('tenant-probes.json')['identities']:
   self.assertFalse(x['superuser'] or x['bypassrls'] or x['owns_customer']);self.assertEqual(x['current_user'],x['session_user'])
 def test_two_tenants_42_cases(self):
  d=data('tenant-probes.json');self.assertEqual(d['tenant_count'],2);self.assertEqual(len(d['cases']),42)
 def test_data_unchanged_each_case(self):
  for x in data('tenant-probes.json')['cases']:self.assertTrue(x['target_data_unchanged']);self.assertEqual(x['before_sha256'],x['after_sha256'])
 def test_anonymous_effective_no_dml(self):
  rows=data('effective-fl_db001_anonymous.json');self.assertEqual(len(rows),55)
  for x in rows:self.assertFalse(any(x[k] for k in ['sel','ins','upd','del']))
 def test_source_no_change(self):
  d=data('source-protection.json');self.assertTrue(d['equal']);self.assertEqual(d['before'],d['after']);self.assertEqual(len(d['before']['files']),55)
 def test_service_stopped_retained(self):
  d=data('retention.json');self.assertFalse(d['running']);self.assertFalse(d['host_port_bindings']);self.assertTrue(d['volume_retained']);self.assertFalse(d['cleanup_executed'])
 def test_risks_not_promoted(self):self.assertEqual(data('test-results.json')['summary'],{'PASS':3,'LIMITED':10,'FAIL':2,'BLOCKED':1})
 def test_sql_draft_comments_only(self):
  for s in (ROOT/'REMEDIATION-DRAFT.sql').read_text().splitlines():self.assertTrue(not s.strip() or s.lstrip().startswith('--'))
 def test_no_gate2_pass_claim(self):self.assertEqual(data('test-results.json')['gate2'],'NOT_PASSED')
if __name__=='__main__':unittest.main()

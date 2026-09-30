import sys
sys.dont_write_bytecode=True
import unittest,tempfile,subprocess,json,hashlib,os,stat
from pathlib import Path
from datetime import datetime,timedelta,timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import model,drift

class ModelTests(unittest.TestCase):
 def test_five_states(self): self.assertEqual(set(model.STATES),{'VERIFIED','PENDING','STALE','PERMANENT-DEVIATION','HISTORY-GAP'})
 def test_unstarted_not_pending(self):
  with self.assertRaises(ValueError):model.transition({'status':None},'accepted',gate_approved=True,evidence_complete=True)
 def test_removed_constraint_rejected(self):
  with self.assertRaises(ValueError):model.transition({'status':'PENDING','constraints':['DEV1-T03']},'accepted',gate_approved=True,evidence_complete=True)
 def test_unconstrained_result_not_reusable(self):
  self.assertFalse(model.reusable({'status':'VERIFIED'},inputs_match=True,scope_matches=True,evidence_available=True))
 def test_produced_pending(self):self.assertEqual(model.transition({'status':None},'produced')['status'],'PENDING')
 def test_no_ungated_verification(self):
  with self.assertRaises(ValueError):model.transition({'status':'PENDING'},'accepted',evidence_complete=True)
 def test_constraints_survive_verification(self):
  x={'status':'PENDING','constraints':list(model.REQUIRED)}
  self.assertEqual(model.transition(x,'accepted',gate_approved=True,evidence_complete=True)['constraints'],list(model.REQUIRED))
 def test_stale_preserves_constraints(self):
  x=model.transition({'status':'VERIFIED','constraints':list(model.REQUIRED)},'inputs_changed')
  self.assertEqual(x['status'],'STALE');self.assertEqual(x['constraints'],list(model.REQUIRED))
 def test_verified_reuse(self):self.assertTrue(model.reusable({'status':'VERIFIED','constraints':list(model.REQUIRED)},inputs_match=True,scope_matches=True,evidence_available=True))
 def test_pending_not_reusable(self):self.assertFalse(model.reusable({'status':'PENDING'},inputs_match=True,scope_matches=True,evidence_available=True))
 def test_changed_scope_not_reusable(self):self.assertFalse(model.reusable({'status':'VERIFIED','constraints':list(model.REQUIRED)},inputs_match=True,scope_matches=False,evidence_available=True))
 def test_expired_exception_not_reusable(self):self.assertFalse(model.reusable({'status':'VERIFIED','constraints':list(model.REQUIRED)},inputs_match=True,scope_matches=True,evidence_available=True,overdue_exception=True))
 def test_rls_reaches_wallet_and_admin(self):
  names={x['conclusion'] for x in model.propagate(['rls_functions'])}
  self.assertTrue({'tenant_isolation','authenticated_api','wallet_reads','admin_views','tenant_admin'}<=names)
  self.assertNotIn('frontend_startup',names)
 def test_unrelated_no_full_retest(self):self.assertEqual(model.propagate(['unrelated_documentation']),[])
 def test_api_not_database(self):self.assertNotIn('tenant_isolation',{x['conclusion'] for x in model.propagate(['api_contract'])})
 def test_seven_input_families(self):
  for x in ['rls_functions','api_contract','toolchain_lock','identity_keys','funds_state','branch_base','environment_config']:
   with self.subTest(x=x):self.assertTrue(model.propagate([x]))
 def test_deterministic_propagation(self):self.assertEqual(model.propagate(['identity_keys','rls_functions']),model.propagate(['rls_functions','identity_keys']))
 def test_overlay_does_not_invalidate_official(self):
  self.assertEqual({x['conclusion'] for x in model.propagate(['local_baseline_overlay'])},{'local_summary_reuse','local_history_reuse'})
 def test_immutable_input(self):
  x={'status':'VERIFIED','constraints':list(model.REQUIRED)};s=json.dumps(x)
  model.transition(x,'inputs_changed');self.assertEqual(json.dumps(x),s)
 def exception(self):
  now=datetime(2026,9,30,tzinfo=timezone.utc)
  return now,dict(reason='synthetic',scope='mock validation',approver='review-role',approved_at=now,expires_at=now+timedelta(hours=24),risk='no production',rollback='end validation; retain evidence',followup_ticket='SYNTHETIC',persistent=True,red_lines=[],effective_at=now,no_persistent_effect_confirmed=True)
 def test_exception_active(self):
  n,e=self.exception();self.assertEqual(model.exception_state(e,n),'ACTIVE')
 def test_exception_48h_limit(self):
  n,e=self.exception();e['expires_at']=n+timedelta(hours=49);self.assertEqual(model.exception_state(e,n),'INVALID')
 def test_exception_red_lines(self):
  for kind in ['money','multi_tenant','secrets','production']:
   n,e=self.exception();e['red_lines']=[kind];self.assertEqual(model.exception_state(e,n),'FORBIDDEN')
 def test_exception_expired_persistent(self):
  n,e=self.exception();self.assertEqual(model.exception_state(e,n+timedelta(days=2)),'OVERDUE-GATES')
 def test_temporary_expiry_archive_proposal(self):
  n,e=self.exception();e['persistent']=False;self.assertEqual(model.exception_state(e,n+timedelta(days=2)),'EXPIRED-ARCHIVE-PROPOSAL')
 def test_temporary_requires_no_effect_evidence(self):
  n,e=self.exception();e['persistent']=False;e['no_persistent_effect_confirmed']=False;self.assertEqual(model.exception_state(e,n+timedelta(days=2)),'EXPIRED-REVIEW-REQUIRED')
 def test_48h_starts_at_actual_change(self):
  n,e=self.exception();e['effective_at']=n-timedelta(days=2);self.assertEqual(model.exception_state(e,n),'INVALID')
 def test_missing_approval(self):
  n,e=self.exception();e['approver']='';self.assertEqual(model.exception_state(e,n),'INVALID')
 def test_unknown_event_rejected(self):
  with self.assertRaises(ValueError):model.transition({'status':'STALE'},'delete_constraint')

class ReadOnlyTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory(prefix='gov2-synthetic-');cls.root=Path(cls.temp.name)/'repo';cls.root.mkdir(mode=0o700)
  cls.git('init','-q');cls.git('config','user.name','Synthetic');cls.git('config','user.email','synthetic@invalid.local')
  (cls.root/'package.json').write_text('{"name":"synthetic","version":"1.0.0"}\n')
  (cls.root/'prisma/migrations/demo').mkdir(parents=True)
  (cls.root/'prisma/migrations/demo/migration.sql').write_text('-- synthetic empty migration\n')
  cls.git('add','.');cls.git('commit','-qm','Synthetic fixture')
  cls.head=cls.git('rev-parse','HEAD').strip()
  cls.expected={n:hashlib.sha256((cls.root/n).read_bytes()).hexdigest() for n in ['package.json','prisma/migrations/demo/migration.sql']}
 @classmethod
 def tearDownClass(cls):cls.temp.cleanup() # synthetic fixtures only; never target real assets
 @classmethod
 def git(cls,*args):
  return subprocess.check_output(['git','-c','core.hooksPath=/dev/null','-c','gc.auto=0','-C',str(cls.root),*args],stderr=subprocess.DEVNULL,text=True)
 def ref(self):return {'head':self.head,'upstream':None,'files':dict(self.expected)}
 def snapshot(self):
  return {str(p.relative_to(self.root)):(stat.S_IMODE(p.lstat().st_mode),p.lstat().st_uid,p.lstat().st_gid,hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None) for p in self.root.rglob('*') if not p.is_symlink()}
 def test_clean_no_drift(self):self.assertEqual(drift.inspect_repo(self.root,self.ref())['result'],'无漂移')
 def test_run_twice_zero_mutation(self):
  before=self.snapshot();a=drift.inspect_repo(self.root,self.ref());middle=self.snapshot();b=drift.inspect_repo(self.root,self.ref());after=self.snapshot()
  self.assertEqual(before,middle);self.assertEqual(before,after);self.assertEqual(a,b)
 def test_changed_lock_is_targeted(self):
  ref=self.ref();ref['files']['package.json']='0'*64
  r=drift.inspect_repo(self.root,ref);self.assertEqual(r['result'],'发现漂移');self.assertIn('reproducible_build',{x['conclusion'] for x in r['affected']});self.assertNotIn('tenant_isolation',{x['conclusion'] for x in r['affected']})
 def test_rls_actual_digest_change(self):
  ref=self.ref();ref['files']['prisma/migrations/demo/migration.sql']='0'*64
  r=drift.inspect_repo(self.root,ref);self.assertIn('wallet_reads',{x['conclusion'] for x in r['affected']});self.assertEqual(r['automatic_retests'],0)
 def test_index_not_rewritten_with_dirty_file(self):
  p=self.root/'package.json';old=p.read_bytes()
  try:
   p.write_text('{"name":"synthetic-modified"}\n');before=self.snapshot();drift.inspect_repo(self.root,self.ref());self.assertEqual(before,self.snapshot())
  finally:p.write_bytes(old)
 def test_protected_read_denied(self):
  for p in drift.PROTECTED:
   with self.assertRaises(drift.Unsafe):drift.read_bytes(self.root,p)
 def test_protected_object_never_opened(self):
  from unittest.mock import patch
  paths='\0'.join(list(self.expected)+sorted(drift.PROTECTED))+'\0'
  original=drift.git;opened=[];read=drift.read_bytes
  def fake_git(root,*a):return paths.encode() if a[0]=='ls-files' else original(root,*a)
  def spy(root,path,**kw):opened.append(path);return read(root,path,**kw)
  with patch.object(drift,'git',fake_git),patch.object(drift,'read_bytes',spy):
   r=drift.inspect_repo(self.root,self.ref())
  self.assertFalse(set(opened)&drift.PROTECTED);self.assertEqual(len(r['blocked']),3)
 def test_env_and_key_paths_not_monitored(self):
  for p in ['.env','.env.local','secrets/key.pem','credentials.json','private/fingerprint.key']:
   self.assertIsNone(drift.category(p))
 def test_sensitive_content_reads_rejected(self):
  for p in ['.env','.env.local','fingerprint.key','credentials.json']:
   with self.assertRaises(drift.Unsafe):drift.read_bytes(self.root,p)
 def test_traversal_rejected(self):
  for n in ['../secret','/etc/passwd','a/../../secret','a\\b']:
   with self.assertRaises(drift.Unsafe):drift.read_bytes(self.root,n)
 def test_file_symlink_rejected(self):
  p=self.root/'bun.lock';p.symlink_to('package.json')
  try:
   with self.assertRaises(OSError):drift.read_bytes(self.root,'bun.lock')
  finally:p.unlink()
 def test_directory_symlink_rejected(self):
  p=self.root/'prisma/migrations/linked';p.symlink_to('demo',target_is_directory=True)
  try:
   with self.assertRaises(OSError):drift.read_bytes(self.root,'prisma/migrations/linked/migration.sql')
  finally:p.unlink()
 def test_hardlink_rejected(self):
  p=self.root/'bun.lock';os.link(self.root/'package.json',p)
  try:
   with self.assertRaises(drift.Unsafe):drift.read_bytes(self.root,'bun.lock')
  finally:p.unlink()
 def test_file_size_cap(self):
  with self.assertRaises(drift.Unsafe):drift.read_bytes(self.root,'package.json',cap=1)
 def test_missing_file_is_unsafe(self):
  ref=self.ref();ref['files']['bun.lock']='0'*64
  r=drift.inspect_repo(self.root,ref);self.assertEqual(r['result'],'发现漂移')
 def test_arbitrary_manifest_scope_rejected(self):
  ref=self.ref();ref['files']['.env']='0'*64
  with self.assertRaises(drift.Unsafe):drift.inspect_repo(self.root,ref)
 def test_git_write_command_denied(self):
  for cmd in ['fetch','status','write-tree','update-ref','gc','prune']:
   with self.assertRaises(drift.Unsafe):drift.git(self.root,cmd)
 def test_unrelated_file_no_retest(self):
  p=self.root/'unrelated-note.md';p.write_text('synthetic')
  try:self.assertEqual(drift.inspect_repo(self.root,self.ref())['affected'],[])
  finally:p.unlink()
 def test_new_migration_detected_without_read(self):
  p=self.root/'prisma/migrations/demo/new.sql';p.write_text('-- synthetic')
  try:
   r=drift.inspect_repo(self.root,self.ref());self.assertTrue(any(x.get('path')=='prisma/migrations/demo/new.sql' for x in r['changes']))
  finally:p.unlink()
 def test_empty_scope_rejected(self):
  doc={'schema':'FL-GOV-002/reference-v1','baseline':{'version':'BASE-V1.0-20260930','merge_sha':'1686d504ec2c44f06718d70e6e4b0c6f92452de8'},'repositories':{}}
  with self.assertRaises(drift.Unsafe):drift.check_manifest(doc,{})
 def test_three_result_values(self):
  self.assertEqual({drift.classify_output([],[]),drift.classify_output([1],[]),drift.classify_output([],[1])},{'无漂移','发现漂移','无法安全检查'})
 def test_invalid_cli_no_raw_error(self):
  s=Path(drift.__file__)
  p=subprocess.run([sys.executable,'-B',str(s),'--reference','/missing/synthetic-input','--roots','/missing/synthetic-root'],capture_output=True,text=True)
  self.assertEqual(p.returncode,2);self.assertNotIn('/missing',p.stdout);self.assertNotIn('Traceback',p.stderr);self.assertEqual(json.loads(p.stdout)['result'],'无法安全检查')

if __name__=='__main__':unittest.main()

import copy
import io
import urllib.parse
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import guard
import package_artifact as artifact

NOW = dt.datetime(2026, 9, 16, tzinfo=dt.timezone.utc)
C, E, B = 'a'*40, 'b'*40, 'c'*40

def fixture():
    ci = {'id': 72, 'run_attempt': 1, 'repository': {'id': guard.REPO_ID}, 'head_repository': {'id': guard.REPO_ID}, 'workflow_id': guard.CI_ID, 'path': guard.CI_PATH, 'event': 'push', 'head_branch': 'dev', 'head_sha': C, 'status': 'completed', 'conclusion': 'success'}
    return {'candidate': C, 'entry': E, 'event': 'workflow_dispatch', 'ref': 'refs/heads/main', 'repository': guard.REPO, 'workflow_ref': guard.REPO+'/'+guard.ENTRY_PATH+'@refs/heads/main', 'run_id': 99, 'run_attempt': 1, 'approval_id': 'human-fixture-only',
            'main': E, 'dev': C, 'approval': {'version': 1, 'candidate_sha': C, 'entry_sha': E, 'approval_id': 'human-fixture-only', 'approval_reference': 'OFFLINE FIXTURE, NOT AUTHORIZATION', 'expires_at': '2026-09-16T01:00:00Z', 'ci_run_id': 72, 'ci_attempt': 1, 'ci_workflow_blob': B, 'reviewer_ids': [123]},
            'new_switch': 'true', 'old_switch': 'false', 'environment': {'can_admins_bypass': False, 'protection_rules': [{'type': 'required_reviewers', 'prevent_self_review': True, 'reviewers': [{'type': 'User', 'reviewer': {'id': 123}}]}], 'deployment_branch_policy': {'protected_branches': False, 'custom_branch_policies': True}}, 'branches': [{'name': 'main', 'type': 'branch'}], 'origin': guard.ORIGIN, 'wallet': guard.WALLET,
            'deployment_runs': [], 'ci': ci, 'ci_workflow': {'id': guard.CI_ID, 'path': guard.CI_PATH, 'state': 'active'}, 'ci_blob': B, 'candidate_runs': [copy.deepcopy(ci)]}

class Guards(unittest.TestCase):
    def reject(self, change, code):
        s = fixture(); change(s)
        with self.assertRaisesRegex(guard.Reject, code):
            guard.validate(s, NOW)

    def test_normal(self):
        self.assertEqual(guard.validate(fixture(), NOW)['candidate_sha'], C)

    def test_approval_drift_digest(self):
        s=fixture(); first=guard.validate(s,NOW); digest=guard.decision_digest(first)
        s['approval']['approval_reference']='new approval'
        with self.assertRaisesRegex(guard.Reject,'approval-drift'):
            guard.decision_digest(guard.validate(s,NOW),digest)

    def test_reviewer_set_changed(self):
        self.reject(lambda s: s['approval'].update(reviewer_ids=[456]), 'reviewer-set')

    def test_sha_formats(self):
        for value in ['dev', 'abc123', 'A'*40, 'g'*40, '', 'a'*40+'\n', '$(echo bad)']:
            with self.subTest(value=value):
                self.reject(lambda s: s.update(candidate=value), 'sha-format')

    def test_dev_association(self):
        self.reject(lambda s: s.update(dev='d'*40), 'baseline-drift')

    def test_main_drift_during_approval(self):
        self.reject(lambda s: s.update(main='d'*40), 'baseline-drift')

    def test_unapproved_candidate(self):
        self.reject(lambda s: s['approval'].update(candidate_sha='d'*40), 'not-approved')

    def test_entry_approval_mismatch(self):
        self.reject(lambda s: s['approval'].update(entry_sha='d'*40), 'not-approved')

    def test_approval_identifier(self):
        self.reject(lambda s: s.update(approval_id='other'), 'approval-id-binding')

    def test_approval_remaining_validity_expired(self):
        self.reject(lambda s: s['approval'].update(expires_at='2026-09-15T00:00:00Z'), 'approval-expiry')

    def test_approval_remaining_validity_exceeds_24h(self):
        self.reject(lambda s: s['approval'].update(expires_at='2026-09-18T00:00:00Z'), 'approval-expiry')

    def test_approval_remaining_validity_boundary_24h(self):
        s=fixture();s['approval']['expires_at']='2026-09-17T00:00:00Z'
        self.assertEqual(guard.validate(s,NOW)['candidate_sha'],C)
        self.assertNotIn('issued_at',s['approval'])  # Total lifetime is not evaluated.

    def test_switches(self):
        for value in ['false', '', True, 'TRUE', None]:
            with self.subTest(value=value):
                self.reject(lambda s: s.update(new_switch=value), 'switch-closed-or-old-open')
        self.reject(lambda s: s.update(old_switch='true'), 'switch-closed-or-old-open')

    def test_run_ref_and_event(self):
        self.reject(lambda s: s.update(ref='refs/heads/test'), 'run-ref')
        self.reject(lambda s: s.update(event='push'), 'run-ref')

    def test_rerun_rejected(self):
        self.reject(lambda s: s.update(run_attempt=2), 'repository-or-rerun')

    def test_ci_missing(self):
        self.reject(lambda s: s.update(candidate_runs=[]), 'ci-latest')

    def test_ci_failed_or_incomplete(self):
        for state, result in [('completed','failure'), ('in_progress',None), ('queued',None), ('completed','cancelled')]:
            with self.subTest(state=state, result=result):
                self.reject(lambda s: s['ci'].update(status=state, conclusion=result), 'ci-not-success')

    def test_ci_wrong_sha(self):
        self.reject(lambda s: s['ci'].update(head_sha='d'*40), 'ci-sha')

    def test_untrusted_same_name(self):
        self.reject(lambda s: s['ci'].update(name='Prime Wallet Pull Request Gate', workflow_id=123), 'ci-source')
        self.reject(lambda s: s['ci'].update(event='pull_request'), 'ci-source')
        self.reject(lambda s: s['ci']['head_repository'].update(id=1), 'ci-repository')

    def test_ci_new_attempt(self):
        self.reject(lambda s: s['ci'].update(run_attempt=2), 'ci-attempt')

    def test_ci_changed_definition(self):
        self.reject(lambda s: s.update(ci_blob='d'*40), 'ci-definition')

    def test_newer_ci_run(self):
        self.reject(lambda s: s['candidate_runs'].append(dict(s['ci'], id=73)), 'ci-latest')

    def test_environment_protection_missing(self):
        self.reject(lambda s: s['environment'].update(protection_rules=[]), 'environment-reviewers')
        self.reject(lambda s: s['environment'].pop('can_admins_bypass'), 'environment-bypass-unknown')
        self.reject(lambda s: s['environment']['protection_rules'][0].update(prevent_self_review=False), 'environment-reviewers')

    def test_environment_checks_run_ref_not_checkout(self):
        self.reject(lambda s: s.update(branches=[{'name':'test','type':'branch'}]), 'environment-ref-filter')

    def test_target_and_other_deployments(self):
        self.reject(lambda s: s.update(origin='https://different.example'), 'fixed-target')
        self.reject(lambda s: s.update(deployment_runs=[{'id':98,'status':'waiting'}]), 'inflight-deployment')

    def test_query_failure(self):
        def forbidden(_): raise OSError('simulated permission denied')
        with self.assertRaises(OSError): guard.collect(forbidden, '/fixture', 'workflow_runs')

    def test_complete_multiple_pages(self):
        rows = [{'id': i} for i in range(101)]
        def get(url):return {'total_count':101, 'workflow_runs':rows[:100] if url.endswith('&page=1') else rows[100:]}
        self.assertEqual(len(guard.collect(get,'/fixture','workflow_runs')),101)

    def test_pagination_incomplete(self):
        with self.assertRaisesRegex(guard.Reject,'pagination-incomplete'):
            guard.collect(lambda _: {'total_count':2,'workflow_runs':[{'id':1}]}, '/fixture', 'workflow_runs')

    def test_pagination_drift(self):
        def get(url):return {'total_count':101 if url.endswith('&page=1') else 102, 'workflow_runs':[{'id': i} for i in range(100)] if url.endswith('&page=1') else [{'id':101}]}
        with self.assertRaisesRegex(guard.Reject,'pagination-drift'):guard.collect(get,'/fixture','workflow_runs')

    def test_pagination_cap_or_duplicate(self):
        with self.assertRaisesRegex(guard.Reject,'pagination-count'):guard.collect(lambda _: {'total_count':1000,'workflow_runs':[]},'/fixture','workflow_runs')
        with self.assertRaisesRegex(guard.Reject,'pagination-duplicates'):guard.collect(lambda _: {'total_count':2,'workflow_runs':[{'id':1},{'id':1}]},'/fixture','workflow_runs')

    def test_full_live_adapter_with_only_mock_http(self):
        s=fixture()
        s['approval']['expires_at']=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=1)).isoformat()
        base='/repos/'+guard.REPO
        envbase=base+'/environments/'+guard.ENVIRONMENT
        values={base+'/actions/variables/FASTLINK_PRIME_TEST_APPROVAL': {'value':json.dumps(s['approval'])},
                base+'/actions/variables/FASTLINK_PRIME_TEST_DEPLOY_ENABLED': {'value':'true'},
                base+'/actions/variables/FASTLINK_TEST_DEPLOY_ENABLED': {'value':'false'},
                base+'/git/ref/heads/dev': {'object':{'sha':C}}, base+'/git/ref/heads/main': {'object':{'sha':E}},
                envbase:s['environment'],envbase+'/deployment-branch-policies':{'total_count':1,'branch_policies':[{'id':1,'name':'main','type':'branch'}]},
                envbase+'/variables/FASTLINK_PRIME_TEST_BACKEND_ORIGIN':{'value':guard.ORIGIN},
                envbase+'/variables/FASTLINK_PRIME_TEST_WALLET_URL':{'value':guard.WALLET},
                base+'/actions/runs/72':s['ci'],base+'/actions/workflows/'+str(guard.CI_ID):s['ci_workflow'],
                base+'/contents/'+guard.CI_PATH:{'sha':B},
                base+'/actions/workflows/'+str(guard.CI_ID)+'/runs':{'total_count':1,'workflow_runs':s['candidate_runs']},
                base+'/actions/runs':{'total_count':0,'workflow_runs':[]}}
        seen=[]
        def fake(req, **kwargs):
            self.assertEqual(req.get_method(),'GET')
            url=urllib.parse.urlparse(req.full_url)
            self.assertEqual(url.hostname,'api.github.com'); seen.append(url.path)
            return io.StringIO(json.dumps(values[url.path]))
        with tempfile.TemporaryDirectory() as t:
            env={'GH_TOKEN':'OFFLINE-FAKE','CANDIDATE_SHA':C,'ENTRY_SHA':E,'APPROVAL_ID':'human-fixture-only',
                 'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':'refs/heads/main','GITHUB_REPOSITORY':guard.REPO,
                 'GITHUB_WORKFLOW_REF':guard.REPO+'/'+guard.ENTRY_PATH+'@refs/heads/main','GITHUB_RUN_ID':'99',
                 'GITHUB_RUN_ATTEMPT':'1','GITHUB_OUTPUT':t+'/out','GITHUB_STEP_SUMMARY':t+'/summary','EXPECTED_POLICY_DIGEST':''}
            with patch.dict(os.environ,env),patch('urllib.request.urlopen',side_effect=fake):
                guard.live()
                result=Path(t+'/out').read_text().strip().split('=')[1]
                with patch.dict(os.environ,{'EXPECTED_POLICY_DIGEST':result}):guard.live()
                with patch.dict(os.environ,{'EXPECTED_POLICY_DIGEST':'0'*64}):
                    with self.assertRaisesRegex(guard.Reject,'approval-drift'):guard.live()
            self.assertIn('Candidate',Path(t+'/summary').read_text())
        self.assertGreater(len(seen),10)

    def test_live_adapter_permission_failure_no_outputs(self):
        # No socket can be opened: urlopen patched before live() is called.
        with tempfile.TemporaryDirectory() as t:
            with patch.dict(os.environ, {'GH_TOKEN':'OFFLINE-FAKE', 'GITHUB_OUTPUT':t+'/out'}):
                with patch('urllib.request.urlopen', side_effect=OSError('offline denied')):
                    with self.assertRaises(OSError):guard.live()
            self.assertFalse(Path(t+'/out').exists())

class Artifacts(unittest.TestCase):
    def sample(self, t):
        root=Path(t)/'candidate'; (root/'.output/server').mkdir(parents=True)
        (root/'.output/server/index.mjs').write_text('export default {};')
        (root/'.output/public').mkdir(); (root/'.output/public/a.txt').write_text('fixture')
        return root

    def test_roundtrip_and_fixed_target(self):
        with tempfile.TemporaryDirectory() as t:
            root=self.sample(t); bundle=Path(t)/'bundle'; out=Path(t)/'out'
            d=artifact.pack(root,bundle,C,E);artifact.unpack(bundle,out,d,C,E)
            self.assertEqual((out/'.output/server/index.mjs').read_bytes(),(root/'.output/server/index.mjs').read_bytes())
            config=json.loads((out/'wrangler.json').read_text())
            self.assertEqual(config['name'],'fastlink-prime-wallet-test');self.assertEqual(config['vars']['FASTLINK_BACKEND_ORIGIN'],guard.ORIGIN)

    def test_payload_tamper(self):
        with tempfile.TemporaryDirectory() as t:
            root=self.sample(t); bundle=Path(t)/'bundle';d=artifact.pack(root,bundle,C,E)
            (bundle/'payload.zip').write_bytes(b'corrupt')
            with self.assertRaisesRegex(artifact.ArtifactError,'payload digest'):artifact.unpack(bundle,Path(t)/'out',d,C,E)

    def test_manifest_or_candidate_tamper(self):
        with tempfile.TemporaryDirectory() as t:
            root=self.sample(t); bundle=Path(t)/'bundle';d=artifact.pack(root,bundle,C,E)
            with self.assertRaises(artifact.ArtifactError):artifact.unpack(bundle,Path(t)/'out',d,'d'*40,E)
            with self.assertRaisesRegex(artifact.ArtifactError,'manifest digest'):artifact.unpack(bundle,Path(t)/'out','0'*64,C,E)

    def test_symlink_pack_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            root=self.sample(t);(root/'.output/public/link').symlink_to('/etc/passwd')
            with self.assertRaisesRegex(artifact.ArtifactError,'symlink'):artifact.pack(root,Path(t)/'bundle',C,E)

    def test_zip_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            bundle=Path(t)/'bundle';bundle.mkdir()
            with zipfile.ZipFile(bundle/'payload.zip','w') as z:
                z.writestr('.output/server/index.mjs','fixture');z.writestr('.output/../../escape','bad')
            (bundle/'manifest.json').write_text(json.dumps({'candidate_sha':C,'entry_sha':E,'payload_sha256':artifact.digest(bundle/'payload.zip')}))
            with self.assertRaises(artifact.ArtifactError):artifact.unpack(bundle,Path(t)/'out',artifact.digest(bundle/'manifest.json'),C,E)

if __name__=='__main__':unittest.main(verbosity=2)

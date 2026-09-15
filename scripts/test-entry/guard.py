"""Offline-review draft. Network is GET-only and used only by explicit `live` CLI.
Tests exercise the same validate/collect routines with synthetic snapshots.
"""
import datetime as dt
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request

REPO = 'xw564477242-cmyk/fastlink-prime-wallet'
REPO_ID = 1289778742
CI_ID = 324421200
CI_PATH = '.github/workflows/prime-wallet-pr.yml'
ENTRY_PATH = '.github/workflows/test-manual-approved.yml'
ENVIRONMENT = 'cloudflare-prime-test'
ACCOUNT = '2e8bea79bb07cc0cd8f6edb028618dd7'
ORIGIN = 'https://fastlink-backend-test-test.up.railway.app'
WALLET = 'https://fastlink-prime-wallet-test.xw1134315560.workers.dev'

class Reject(ValueError):
    pass

def require(ok, code):
    if not ok:
        raise Reject(code)

def sha(value):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value) is not None

def collect(get, path, key):
    """No partial result is accepted, including races changing total_count."""
    rows, count = [], None
    for page in range(1, 12):
        obj = get(path + ('&' if '?' in path else '?') + f'per_page=100&page={page}')
        n, chunk = obj.get('total_count'), obj.get(key)
        require(type(n) is int and 0 <= n < 1000, 'pagination-count')
        require(isinstance(chunk, list) and len(chunk) <= 100, 'pagination-shape')
        require(count is None or count == n, 'pagination-drift')
        count = n
        rows.extend(chunk)
        require(len(rows) <= count, 'pagination-overflow')
        if len(rows) == count:
            require(len({r['id'] for r in rows}) == len(rows), 'pagination-duplicates')
            return rows
        require(len(chunk) == 100, 'pagination-incomplete')
    raise Reject('pagination-limit')

def validate(s, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    c, e, a = s['candidate'], s['entry'], s['approval']
    require(sha(c) and sha(e), 'sha-format')
    require(s['event'] == 'workflow_dispatch' and s['ref'] == 'refs/heads/main', 'run-ref')
    require(s['repository'] == REPO and s['run_attempt'] == 1, 'repository-or-rerun')
    require(s['workflow_ref'] == f'{REPO}/{ENTRY_PATH}@refs/heads/main', 'entry-path')
    require(s['main'] == e and s['dev'] == c, 'baseline-drift')
    require(a.get('version') == 1 and a.get('candidate_sha') == c and a.get('entry_sha') == e, 'not-approved')
    require(a.get('approval_id') == s['approval_id'] and bool(s['approval_id']), 'approval-id-binding')
    require(isinstance(a.get('approval_reference'), str) and len(a['approval_reference']) > 0, 'approval-reference')
    expires = dt.datetime.fromisoformat(a['expires_at'].replace('Z', '+00:00'))
    require(expires.tzinfo is not None and now < expires <= now + dt.timedelta(hours=24), 'approval-expiry')
    require(s['new_switch'] == 'true' and s['old_switch'] == 'false', 'switch-closed-or-old-open')
    env = s['environment']
    require(env.get('can_admins_bypass') is False, 'environment-bypass-unknown')
    rules = [r for r in env['protection_rules'] if r['type'] == 'required_reviewers']
    require(len(rules) == 1 and rules[0].get('prevent_self_review') is True and len(rules[0].get('reviewers', [])) > 0, 'environment-reviewers')
    require(sorted(r['reviewer']['id'] for r in rules[0]['reviewers']) == sorted(a['reviewer_ids']), 'reviewer-set')
    require(env.get('deployment_branch_policy') == {'protected_branches': False, 'custom_branch_policies': True}, 'environment-policy')
    require([(r['name'], r['type']) for r in s['branches']] == [('main', 'branch')], 'environment-ref-filter')
    require(s['origin'] == ORIGIN and s['wallet'] == WALLET, 'fixed-target')
    require(not any(r['status'] != 'completed' and r['id'] != s['run_id'] for r in s['deployment_runs']), 'inflight-deployment')
    ci = s['ci']
    require(ci['id'] == a['ci_run_id'] and ci['run_attempt'] == a['ci_attempt'], 'ci-attempt')
    require(ci['repository']['id'] == REPO_ID and ci['head_repository']['id'] == REPO_ID, 'ci-repository')
    require(ci['workflow_id'] == CI_ID and ci['path'] == CI_PATH and ci['event'] == 'push' and ci['head_branch'] == 'dev', 'ci-source')
    require(ci['head_sha'] == c, 'ci-sha')
    require(ci['status'] == 'completed' and ci['conclusion'] == 'success', 'ci-not-success')
    require(s['ci_workflow']['id'] == CI_ID and s['ci_workflow']['path'] == CI_PATH and s['ci_workflow']['state'] == 'active', 'ci-workflow')
    require(sha(a.get('ci_workflow_blob')) and s['ci_blob'] == a['ci_workflow_blob'], 'ci-definition')
    runs = s['candidate_runs']
    require(len(runs) > 0 and max(r['id'] for r in runs) == ci['id'], 'ci-latest')
    for r in runs:
        require(r['workflow_id'] == CI_ID and r['head_sha'] == c and r['event'] == 'push' and r['head_branch'] == 'dev', 'ci-list-filter')
    return {'candidate_sha': c, 'entry_sha': e, 'ci_run_id': ci['id'], 'ci_attempt': ci['run_attempt'], 'run_id': s['run_id'], 'approval': a}

def decision_digest(result, expected=None):
    canonical = json.dumps(result, sort_keys=True, separators=(',', ':'))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    require(not expected or expected == digest, 'approval-drift')
    return digest

def live():
    # This mode is NEVER used by the offline tests or the current task.
    token = os.environ['GH_TOKEN']
    def get(path):
        req = urllib.request.Request('https://api.github.com/' + path, headers={'Authorization': 'Bearer '+token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.load(response)
    base = 'repos/' + REPO
    def variable(name):
        return get(base + '/actions/variables/' + name)['value']
    approval = json.loads(variable('FASTLINK_PRIME_TEST_APPROVAL'))
    candidate = os.environ['CANDIDATE_SHA']
    require(sha(candidate), 'sha-format')
    envbase = base + '/environments/' + ENVIRONMENT
    runs = []
    # All registered workflow runs, not only the first recent page. API cap fails closed.
    # Query only unfinished statuses to avoid historical run-count exhaustion.
    for status in ['queued', 'in_progress', 'waiting', 'requested', 'pending']:
        runs += collect(get, base+'/actions/runs?status='+status, 'workflow_runs')
    deployment_runs = [r for r in runs if r['path'] == '.github/workflows/deploy-cloudflare-test.yml' or r['path'] == ENTRY_PATH]
    s = {'candidate': candidate, 'entry': os.environ['ENTRY_SHA'], 'event': os.environ['GITHUB_EVENT_NAME'], 'ref': os.environ['GITHUB_REF'], 'repository': os.environ['GITHUB_REPOSITORY'], 'workflow_ref': os.environ['GITHUB_WORKFLOW_REF'], 'approval_id': os.environ['APPROVAL_ID'], 'run_id': int(os.environ['GITHUB_RUN_ID']), 'run_attempt': int(os.environ['GITHUB_RUN_ATTEMPT']), 'approval': approval,
         'dev': get(base+'/git/ref/heads/dev')['object']['sha'], 'main': get(base+'/git/ref/heads/main')['object']['sha'],
         'new_switch': variable('FASTLINK_PRIME_TEST_DEPLOY_ENABLED'), 'old_switch': variable('FASTLINK_TEST_DEPLOY_ENABLED'),
         'environment': get(envbase), 'branches': collect(get, envbase+'/deployment-branch-policies','branch_policies'),
         'origin': get(envbase+'/variables/FASTLINK_PRIME_TEST_BACKEND_ORIGIN')['value'], 'wallet': get(envbase+'/variables/FASTLINK_PRIME_TEST_WALLET_URL')['value'],
         'deployment_runs': deployment_runs, 'ci': get(base+'/actions/runs/'+str(approval['ci_run_id'])), 'ci_workflow': get(base+'/actions/workflows/'+str(CI_ID)),
         'ci_blob': get(base+'/contents/'+CI_PATH+'?ref='+candidate)['sha'],
         'candidate_runs': collect(get, base+f'/actions/workflows/{CI_ID}/runs?branch=dev&event=push&head_sha='+candidate, 'workflow_runs')}
    result = validate(s)
    digest = decision_digest(result, os.environ.get('EXPECTED_POLICY_DIGEST'))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('policy_digest='+digest+'\n')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
        f.write('\nCandidate: `'+candidate+'`\n\nEntry: `'+s['entry']+'`\n\nCI: '+str(result['ci_run_id'])+' attempt '+str(result['ci_attempt'])+'\n\nApproval digest: `'+digest+'`\n')
    print('Preflight passed; immutable approval tuple digest: '+digest)

if __name__ == '__main__':
    require(sys.argv[1:] == ['live'], 'explicit-live-only')
    try:
        live()
    except Exception as exc:
        # Do not print headers, bodies, tokens or raw API errors.
        print('STOP: '+(str(exc) if isinstance(exc, Reject) else type(exc).__name__), file=sys.stderr)
        sys.exit(1)

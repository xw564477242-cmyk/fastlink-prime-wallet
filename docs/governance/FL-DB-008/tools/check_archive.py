#!/usr/bin/env python3
"""Read-only checks of this governance delivery; no private-source/DB/network access."""
import hashlib
import json
import math
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
PREFIX = 'docs/governance/FL-DB-008/'
BASE = '603210f2933a19518773fbaf0e4835efa7fd3ea7'


def git(*args):
    return subprocess.check_output(
        ['git', '--no-optional-locks', '-C', str(REPO), *args], text=True)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def scan(text, public_paths=()):
    patterns = {
        'pem': r'-----BEGIN [A-Z ]*(?:PRIVATE KEY|CERTIFICATE)-----',
        'scram_value': r'SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$',
        'credential_url': r'(?:postgres(?:ql)?|https?|redis)://[^\s/:]+:[^\s/@]+@',
        'jwt': r'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}',
        'vendor_token': r'(?:ghp_|github_pat_|xoxb-)[A-Za-z0-9_-]{20,}',
        'credential_assignment': r'(?i)["\']?(?:password|privatekey|accesstoken|refreshtoken)["\']?\s*[:=]\s*["\'][^"\'\n]{4,}["\']',
        'raw_hba': r'(?m)^\s*host(?:ssl|nossl)?\s+\S+\s+\S+\s+\S+\s+(?:scram-sha-256|trust|md5)\b',
    }
    found = [name for name, pattern in patterns.items() if re.search(pattern, text)]
    entropy_text = text
    for path in public_paths:
        entropy_text = entropy_text.replace(path, '[DECLARED_PUBLIC_REPORT_PATH]')
    for token in re.findall(r'(?<![A-Za-z0-9_+/=-])[A-Za-z0-9_+/=-]{40,}(?![A-Za-z0-9_+/=-])', entropy_text):
        if re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', token):
            continue  # Public OIDs/SHA references are separately shape checked.
        if not (re.search('[A-Z]', token) and re.search('[a-z]', token) and re.search('[0-9]', token)):
            continue
        entropy = -sum((n / len(token)) * math.log2(n / len(token)) for n in Counter(token).values())
        if entropy >= 4.7:
            found.append('high_entropy_literal')
            break
    return sorted(set(found))


def positive_controls():
    # Entirely synthetic in-memory inputs; neither these values nor matches are logged.
    examples = {
        'pem': '-----' + 'BEGIN PRIVATE KEY' + '-----',
        'scram_value': 'SCRAM-' + 'SHA-256$4096:' + 'Q' * 12 + '$',
        'credential_url': 'postgres' + 'ql://' + 'synthetic:synthetic@invalid',
        'jwt': 'eyJ' + 'a' * 18 + '.' + 'b' * 18 + '.' + 'c' * 18,
        'vendor_token': 'gh' + 'p_' + 'a' * 30,
        'credential_assignment': 'pass' + 'word = ' + '"' + 'synthetic-only' + '"',
        'raw_hba': 'hostssl' + ' fixture role ' + '127.0.0.1/32 ' + 'scram-sha-256',
        'high_entropy_literal': ''.join(chr(i) for i in range(65, 91)) + ''.join(chr(i) for i in range(97, 123)) + ''.join(str(i) for i in range(10)),
    }
    return {name: name in scan(value) for name, value in examples.items()}


def run():
    checks = []

    def check(name, condition):
        checks.append({'check': name, 'status': 'PASS' if condition else 'FAIL'})

    paths = sorted(p for p in ROOT.rglob('*') if p.is_file())
    check('governance_files_only_no_candidates_or_symlinks', bool(paths) and all(
        not p.is_symlink() and (p.suffix in {'.md', '.json', '.py'} or p.name == 'SHA256SUMS')
        and 'candidates' not in p.relative_to(ROOT).parts for p in paths))
    texts = {p.relative_to(ROOT).as_posix(): p.read_text('utf-8') for p in paths}
    check('utf8_lf_and_no_trailing_spaces', all(
        t.endswith('\n') and '\r' not in t and all(line == line.rstrip() for line in t.splitlines())
        for t in texts.values()))
    objects = {n: json.loads(t) for n, t in texts.items() if n.endswith('.json')}
    final = objects['evidence/final-evidence.json']
    coverage = final['coverage']
    check('historical_snapshot_boundaries_preserved', final['implementationGate2'] == 'FAIL'
          and final['safetyPrerequisite'] == 'BLOCKED'
          and coverage == {'physicalTables': 64, 'manifestCases': 1280,
                           'approvedDynamicCandidates': 2, 'executedDynamicCases': 0,
                           'staticDenialsNotDynamic': 474, 'blockedCandidates': 804,
                           'databaseSafetyPass': False})
    check('historical_rounds_not_conflated', [r['observerCandidatesProvisioned'] for r in final['rounds']] == [2, 0]
          and all(r['dynamicCasesExecuted'] == 0 and not r['runtimeIssuerServicesStarted']
                  and r['postDisconnectIndependentSessionZero'] == 'LIMITED_NOT_OBSERVED' for r in final['rounds'])
          and final['rounds'][0]['rolesAtFinalControlObservation']['db8_v3_runtime_login']['canLogin'] is False
          and final['rounds'][1]['rolesAtFinalControlObservation']['db8_v3_runtime_login']['canLogin'] is True
          and final['rounds'][1]['rolesAtFinalControlObservation']['db8_v3_runtime_login']['loginExpired'] is True)
    followup = objects['evidence/recovery-closeout.json']
    recovery, closeout = followup['singleUserRecovery'], followup['safeCloseout']
    check('historical_bounded_recovery_and_retirement_preserved',
          recovery['status'] == 'PASS_TWO_BOUNDED_BOOTSTRAP_RECOVERIES'
          and closeout['status'] == 'PASS_SAFE_CLOSEOUT_ONLY'
          and [r['round'] for r in recovery['rounds']] == [1, 2]
          and [r['round'] for r in closeout['rounds']] == [1, 2]
          and all(r['stopCount'] == r['startCount'] == 1 and r['hbaUnchanged']
                  and r['entrypointRestored'] for r in recovery['rounds'])
          and all(r['beforeDisconnect']['canLogin'] is False
                  and r['beforeDisconnect']['memberOfCount'] == 0
                  and r['beforeDisconnect']['otherClientCount'] == 0
                  and r['controlledClientExitCode'] == 0
                  and r['controlBackendProcessAfterDisconnect'] == 'GONE'
                  and r['controlledClientSessionsZero'] for r in closeout['rounds'])
          and recovery['hbaWrites'] == closeout['hbaWrites'] == 0
          and recovery['dynamicCases'] == closeout['dynamicCases'] == 0
          and followup['currentDisposition']['implementationGate2'] == 'FAIL'
          and followup['currentDisposition']['scene'] == 'FROZEN'
          and followup['currentDisposition']['r1PendingHbaSetting'] == 'NOT_CLEARED'
          and followup['currentDisposition']['r2CandidateInitialization'] == 'NOT_COMPLETED')
    latest = objects['evidence/batch-c-final.json']
    disp, r2 = latest['disposition'], latest['currentR2']
    check('final_failure_and_freeze_not_safety_acceptance',
          disp['implementationGate2'] == 'FAIL'
          and disp['databaseSecurity'] == 'NOT_ACCEPTED'
          and disp['rlsSafetyPrerequisite'] == disp['fundsSafetyPrerequisite'] == 'BLOCKED'
          and disp['runtimeAdmission'] == 'PARTIALLY_VERIFIED'
          and disp['businessRuntime'] == 'NOT_VERIFIED'
          and disp['scene'] == 'PERMANENT_FREEZE'
          and disp['batchClosure'] == 'ON_SINGLE_DRAFT_PR_CREATION_OWNER_EXCEPTION'
          and disp['formalBaselineUpdated'] is False
          and all(v == 0 for v in latest['archiveActions'].values()))
    challenge = r2['challengeTransfer']
    check('final_admission_stop_and_unknown_sequence_boundary',
          r2['initializationCompleted'] and r2['observerInitializationCompleted']
          and r2['initializationReplays'] == r2['completedBusinessCases'] == 0
          and r2['selectedBusinessCases'] == 10
          and r2['controlChecks'] == {'PASS': 28, 'LIMITED': 1, 'STOP': 1}
          and challenge['byteLength'] == challenge['issuerByteLength'] == 399
          and challenge['sha256'] == challenge['issuerSha256']
          and challenge['bytesEqual'] and challenge['rawRetained'] is False
          and r2['registerAdmission'] == 'SUCCEEDED_AND_COMMITTED_BEFORE_CONSUME'
          and r2['consumeAdmission'] == 'FAILED_SQLSTATE_42501'
          and r2['callerCurrentIdentityAndBusinessDml'] == 'NOT_REACHED'
          and r2['internalCurrentIdentity'] == 'UNKNOWN'
          and r2['sequenceConsumption'] == 'UNKNOWN_NOT_QUERIED_NO_REPLAY_OR_RESET')
    retired = r2['lastRetirement']
    check('final_retirement_inherited_not_reexecuted',
          latest['currentR1']['pendingHbaCleared']
          and latest['currentR1']['notRequeriedForArchive']
          and all(v == 'REVOKED' for v in retired['newKeyStates'].values())
          and all(v == 0 for v in retired['recordState'].values())
          and all(not r['login'] and not r['connect'] and not r['temp']
                  and r['memberships'] == r['sessions'] == 0 for r in retired['runtimeIssuerRoles'])
          and retired['bootstrapLogin'] is False
          and retired['otherSessionsBeforeManagementDisconnect'] == 0
          and retired['controlBackendProcessAfterDisconnect'] == 'GONE'
          and retired['configuration']['pendingRestart'] is False
          and retired['configuration']['tlsRestored']
          and retired['oldFilesRemoved'] == 0)
    tables = objects['evidence/tables-64.json']
    check('64_table_two_round_catalog_coverage', len(tables['tables']) == len({t['table'] for t in tables['tables']}) == 64
          and tables['case_denominator'] == 1280 and all(t['dynamic_cases_executed'] == 0
          and t['dynamic_security_status'] == 'BLOCKED' and [r['round'] for r in t['rounds']] == [1, 2]
          and all(r['rls'] and r['force_rls'] for r in t['rounds']) for t in tables['tables']))
    ledger = objects['evidence/migration-ledger.json']
    check('32_plus_2_ledger_not_reexecuted', ledger['original_steps'] == 32 and ledger['append_candidates'] == 2
          and ledger['replayed_existing_steps'] == 0 and [s['order'] for s in ledger['steps']] == list(range(1, 35))
          and all(re.fullmatch('[0-9a-f]{64}', s['sha256']) for s in ledger['steps'])
          and all(s['r1_actual_status'] in {'PASS', 'APPLIED_ONCE'} and s['r2_actual_status'] in {'PASS', 'APPLIED_ONCE'} for s in ledger['steps']))
    src = objects['evidence/source-index.json']
    check('source_hashes_and_private_manifest_boundary', src['candidateCopies'] == 0
          and src['privateManifest']['sha256'] == 'e2eade33128e082cf40b7186ca70e0b037949228a7fcd9c5efe8574bdb85d665'
          and src['privateManifest']['copied'] is False and src['privateManifest']['entries'] == 239
          and all(re.fullmatch('[0-9a-f]{64}', s['sha256']) and s['path'] for s in src['sources']))
    body = '\n'.join(t for n, t in texts.items() if n.endswith('.md'))
    check('history_and_permanent_deviations', all(word in body for word in [
        'DEV1-T03', 'DEV1-T12', 'GOV2-T09', 'HISTORY-GAP', '21', 'DB-R02', 'T08/T09', 'T13 BLOCKED', '38条Admin', 'pending']))
    chronology = texts['STOP-CHRONOLOGY.md']
    check('all_39_chronological_records_retained',
          re.findall(r'^\|(\d+)\|', chronology, re.M) == [str(n) for n in range(1, 40)]
          and all(e in chronology for e in ['42809', '42601', '42703', 'ASSEMBLY_STOP_RUNTIME_PLAN_SIZE_LIMIT', 'CONTROL_PRECONDITIONS_FAILED', 'HELD_RESULT_CARDINALITY']))
    broken = []
    for name, text in texts.items():
        if not name.endswith('.md'):
            continue
        for link in re.findall(r'\]\(([^)]+)\)', text):
            if not link.startswith(('https://', 'http://', '/')) and not (ROOT / name).parent.joinpath(link.split('#')[0]).exists():
                broken.append(name)
    check('local_document_links', not broken)
    positives = positive_controls()
    check('scanner_positive_controls', all(positives.values()) and len(positives) == 8)
    public_paths = [s['path'] for s in src['sources'] if re.fullmatch(r'/private/tmp/FL-[A-Za-z0-9_./-]+\.(?:md|json)', s['path'])]
    hits = [{'file': n, 'categories': found} for n, t in texts.items() if (found := scan(t, public_paths if n == 'evidence/source-index.json' else ()))]
    check('new_directory_sensitive_scan', not hits)
    manifest = {}
    for line in texts['SHA256SUMS'].splitlines():
        value, name = line.split('  ', 1)
        if name in manifest:
            raise ValueError('duplicate manifest path')
        manifest[name] = value
    check('sha_manifest_complete_and_exact', set(manifest) == set(texts) - {'SHA256SUMS'}
          and all(digest((ROOT / n).read_bytes()) == h for n, h in manifest.items()))
    changes = git('diff', '--name-status', '--no-renames', BASE, '--').splitlines()
    check('existing_git_paths_mode_blob_unchanged', all(line.startswith('A\t' + PREFIX) for line in changes)
          and not git('ls-tree', BASE, '--', PREFIX).strip())
    untracked = git('ls-files', '--others', '--exclude-standard').splitlines()
    check('no_untracked_outside_authorized_scope', all(p.startswith(PREFIX) for p in untracked))
    check('baseline_start_unchanged', git('rev-parse', 'refs/remotes/origin/dev').strip() == BASE
          and git('merge-base', BASE, 'HEAD').strip() == BASE)
    return {'task': 'FL-DB-008', 'scope': 'GOVERNANCE_ARCHIVE_ONLY',
            'status': 'PASS' if all(c['status'] == 'PASS' for c in checks) else 'FAIL',
            'checks': checks, 'files': len(paths), 'manifestEntries': len(manifest),
            'sensitiveHits': hits, 'positiveControlCount': len(positives),
            'databaseDockerSqlDynamicCalls': 0, 'privateMaterialReads': 0,
            'limitations': ['Pattern/entropy scanning cannot prove absence of every unknown secret format.',
                            'Inherited task-database evidence was not reexecuted.',
                            'Archive PASS does not alter implementation gate2 FAIL or safety BLOCKED.']}


if __name__ == '__main__':
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['status'] == 'PASS' else 1)

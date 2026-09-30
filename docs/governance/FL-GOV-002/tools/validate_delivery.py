#!/usr/bin/env python3
"""Read-only validation of this delivery only; no project or credential scanning."""
import sys
sys.dont_write_bytecode = True
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
from model import validate_template
from protected_record import encode_records

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
BASE = '1686d504ec2c44f06718d70e6e4b0c6f92452de8'
PREFIX = 'docs/governance/FL-GOV-002/'
# Complete recognizable formats only. Values and matching lines are never returned.
RULES = {
    'private_key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'github_token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'cloud_access_id': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'jwt': re.compile(r'\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b'),
    'credential_url': re.compile(r'(?:https?|postgres(?:ql)?|mysql|redis)://[^\s/:"<>]+:[^\s/@"<>]+@'),
    'literal_secret_assignment': re.compile(r'''(?i)\b(?:password|passwd|api_key|access_token|client_secret)\s*[=:]\s*["']([^"'\s]{8,})["']'''),
}
TOKEN = re.compile(r'(?<![A-Za-z0-9_./-])[A-Za-z0-9+/=_-]{32,}(?![A-Za-z0-9_./-])')

def entropy(token):
    return -sum((n/len(token))*math.log2(n/len(token)) for n in collections.Counter(token).values())

def scan(text):
    found = [name for name,rule in RULES.items() if rule.search(text)]
    for token in TOKEN.findall(text):
        # Git OIDs and SHA-256 are explicit public integrity metadata, not key values.
        if re.fullmatch(r'[a-f0-9]{40}|[a-f0-9]{64}',token):
            continue
        classes = sum(bool(re.search(pattern,token)) for pattern in ['[a-z]','[A-Z]','[0-9]','[+/=]'])
        if classes >= 3 and entropy(token) >= 4.5:
            found.append('mixed_high_entropy'); break
    return found

def scanner_controls():
    positives = [
        '-----BEGIN '+ 'PRIVATE KEY-----',
        'ghp_' + 'A'*36,
        'AKIA' + 'B'*16,
        'eyJ'+'C'*10+'.'+'D'*10+'.'+'E'*10,
        'postgresql://'+'dummy'+':'+ 'synthetic'+'@'+'invalid',
        'password'+' = '+repr('SYNTHETIC_ONLY'),
        ''.join(chr(x) for x in range(65,91))+''.join(chr(x) for x in range(97,123))+'0123456789+/',
    ]
    negatives = ['无秘密正文，风险仍未关闭。',BASE,'DEV1-T03','API contract metadata']
    return all(scan(x) for x in positives) and not any(scan(x) for x in negatives)

def git(*args):
    p=subprocess.run(['git','--no-optional-locks','-c','core.hooksPath=/dev/null','-c','gc.auto=0',
        '-c','maintenance.auto=false','-c','diff.autoRefreshIndex=false','-C',str(REPO),*args],
        stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,check=True)
    return p.stdout

def validate(pre_manifest=False):
    paths=sorted(p for p in ROOT.rglob('*') if p.is_file())
    assert not any(p.is_symlink() for p in ROOT.rglob('*')), 'delivery_symlink'
    assert not any('__pycache__' in p.parts for p in paths), 'bytecode'
    assert scanner_controls(), 'scanner_controls'
    content={p.relative_to(ROOT).as_posix():p.read_bytes() for p in paths}
    hits=[]
    for n,b in content.items():
        for rule in scan(b.decode('utf-8')): hits.append({'file':n,'rule':rule})
    assert not hits, json.dumps({'sensitive_candidates':hits},ensure_ascii=False)
    protected = json.loads(content['evidence/R01-四字段合成记录.json'])
    encode_records(protected)  # Fail closed before accepting protected-evidence records.
    template_count=0
    for n,b in content.items():
        if n.startswith('templates/') and n!='templates/README.md':
            assert not validate_template(b.decode()), 'template_missing_fields'
            template_count+=1
    chars={n:len(content['templates/'+n].decode()) for n in ['启动简报模板.md','启动简报实例.md']}
    assert max(chars.values())<=800, 'brief_limit'
    for n,b in content.items():
        if n.endswith('.md'):
            for link in re.findall(r'\]\(([^)]+)\)',b.decode()):
                if '://' not in link and not link.startswith('#'):
                    assert (ROOT/n).parent.joinpath(link.split('#')[0]).exists(), 'broken_local_link'
    # No refresh of index: diff and ls-files only on the isolated report checkout.
    changed=git('diff','--name-only','-z',BASE,'--').decode().strip('\0').split('\0')
    untracked=git('ls-files','--others','--exclude-standard','-z').decode().strip('\0').split('\0')
    assert all(n.startswith(PREFIX) for n in changed+untracked if n), 'scope'
    assert not git('diff','--name-only',BASE,'--','.',':(exclude)'+PREFIX+'**').strip(), 'existing_change'
    entries=git('ls-tree','-rz',BASE).rstrip(b'\0').split(b'\0')
    # Compare inherited index objects; no Python reads of old project file contents.
    staged={}
    for row in git('ls-files','--stage','-z').rstrip(b'\0').split(b'\0'):
        meta,name=row.split(b'\t',1);mode,oid,stage=meta.split()
        assert stage==b'0', 'unmerged_index'
        staged[name]=(mode,oid)
    for entry in entries:
        meta,name=entry.split(b'\t',1);mode,kind,oid=meta.split()
        assert staged.get(name)==(mode,oid), 'inherited_index_changed'
    manifest_ok=None
    if not pre_manifest:
        lines=content['SHA256SUMS'].decode().splitlines()
        expected={}
        for line in lines:
            digest,n=line.split('  ',1);expected[n]=digest
        assert len(expected)==len(lines), 'duplicate_manifest'
        assert set(expected)==set(content)-{'SHA256SUMS'}, 'manifest_scope'
        assert all(hashlib.sha256(content[n]).hexdigest()==d for n,d in expected.items()), 'manifest_hash'
        manifest_ok=True
    return {'status':'PASS','files':len(paths),'inherited_git_entries':len(entries),'templates_validated':template_count,
        'brief_characters':chars,'sensitive_candidates':0,'format_rule_classes':len(RULES),'high_entropy_rule':'length>=32; >=3 character classes; Shannon>=4.5; exact 40/64 lowercase hex integrity metadata excluded',
        'scanner_synthetic_positive_controls':7,'scanner_synthetic_negative_controls':4,'actual_key_material_read':False,
        'key_material_limit':'No actual HMAC key read or byte comparison; checks cover recognizable formats and non-hash mixed entropy only; not a full-project no-secret assertion.',
        'protected_schema':'exact four fields; whole batch validated before serialization','protected_records_checked':len(protected),'manifest_verified':manifest_ok,'existing_files_changed':0,'writes':0}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--pre-manifest',action='store_true');args=parser.parse_args()
    try: print(json.dumps(validate(args.pre_manifest),ensure_ascii=False,indent=2))
    except AssertionError as e:
        # Only our fixed assertions and file/rule identifiers; never source values.
        print(json.dumps({'status':'FAIL','check':str(e)},ensure_ascii=False));sys.exit(1)
    except Exception:
        print(json.dumps({'status':'FAIL','check':'validation_unavailable_no_raw_error'},ensure_ascii=False));sys.exit(1)

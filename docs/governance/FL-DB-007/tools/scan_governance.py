#!/usr/bin/env python3
"""Bounded new-governance scan. Prints locations/counts, never candidate text."""
import collections
import hashlib
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
RULES = {
    'private-key-block': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'),
    'credential-url': re.compile(r'[a-z]+://[^\s/:"\x27]+:[^\s/@"\x27]+@'),
    'github-credential': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'cloud-access-key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'jwt-value': re.compile(r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b'),
    'literal-auth-assignment': re.compile(r'\b(?:password|secret|access_token|refresh_token|api_key)\b\s*[=:]\s*["\x27]([A-Za-z0-9+/=_-]{12,})["\x27]',re.I),
}


def main():
    findings=[]
    entropy_candidates=0
    structural_digests=0
    files=[]
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        relative=str(path.relative_to(ROOT))
        text=path.read_text(encoding='utf-8')
        files.append(relative)
        for number,line in enumerate(text.splitlines(),1):
            for name,pattern in RULES.items():
                for _ in pattern.finditer(line):
                    findings.append({'path':relative,'line':number,'rule':name})
            # Focus on complete literal token-shaped values, not source identifiers.
            for match in re.finditer(r'["\x27`]([A-Za-z0-9+/_=-]{32,})["\x27`]',line):
                value=match.group(1)
                if re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}',value) and re.search(r'(?i)(sha|head|tree|base|commit|提交|基点|dev)',line):
                    structural_digests+=1
                    continue
                counts=collections.Counter(value)
                entropy=-sum((n/len(value))*math.log2(n/len(value)) for n in counts.values())
                if entropy>=4.6 and re.search('[a-z]',value) and re.search('[A-Z0-9]',value):
                    entropy_candidates+=1
                    findings.append({'path':relative,'line':number,'rule':'high-entropy-literal','candidate_sha256':hashlib.sha256(value.encode()).hexdigest()})
    result={'scope':'only new docs/governance/FL-DB-007 files','read_only':True,'files_count':len(files),'files':files,'explicit_format_hits':sum(f['rule']!='high-entropy-literal' for f in findings),'high_entropy_hits':entropy_candidates,'contextual_hex_digest_exclusions':structural_digests,'findings':findings,'actual_secret_material_read':False,'actual_secret_equality_check':'NOT_PERFORMED; no permission to read real keys','limits':'Heuristic format/literal scan; no whole-project scan or proof that all secrets are absent.'}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 1 if findings else 0


if __name__=='__main__':
    raise SystemExit(main())

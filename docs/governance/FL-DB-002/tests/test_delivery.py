#!/usr/bin/env python3
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
errors=[];checks=[]
def check(name,ok,detail=''):
 checks.append({'name':name,'status':'PASS' if ok else 'FAIL','detail':detail})
 if not ok: errors.append(name)
required=['README.md','SCOPE-AND-REUSE.md','CONNECTION-ROLE-MATRIX.md','API-ENTRY-MATRIX.md','JWT-SESSION-TRUST.md','LOCAL-TENANT-TEST.md','EMERGENCY-P0.md','RISKS-AND-FOLLOWUPS.md','ISOLATION-AND-PROTECTION.md','CHANGE-AND-ROLLBACK.md','BASELINE-DELTA.md','SELF-TEST.md','HANDOFF.md']
check('required-documents',all((ROOT/x).is_file() for x in required),str(len(required)))
matrix=json.loads((ROOT/'evidence/api-static-matrix.json').read_text())
check('static-route-count',len(matrix['routes'])==216 and matrix['controllerCount']==35,'216 routes / 35 controllers')
check('static-registration',all(x['registeredFromAppModule'] for x in matrix['routes']),'all registered')
probe=json.loads((ROOT/'evidence/local-admin-probe.json').read_text())
check('local-cases',[x['actual'] for x in probe['cases']]==[401,200,403,200],'expected 401/200/403/200 evidence')
check('stop-after-p0',probe['stopOnConfirmedCrossTenant'] and probe['expandedTestsAfterStop']==0,'zero expanded requests')
check('isolation',probe['deniedNetworkAttempts']==0 and probe['binding']['serverStopped'] and probe['syntheticBusinessData']['equal'],'loopback stopped unchanged')
check('material-permissions',probe['materials']['fileMode']=='600' and probe['materials']['parentMode']=='700','600/700')
protection=json.loads((ROOT/'evidence/source-protection.json').read_text())
check('source-protection',protection['allEqual'],'six repositories unchanged')
text='\n'.join((ROOT/x).read_text() for x in required)
statuses=dict(re.findall(r'DB2-T(\d{2}) \| (PASS|LIMITED|BLOCKED|FAIL)',(ROOT/'SELF-TEST.md').read_text()))
check('test-statuses',len(statuses)==14 and set(statuses.values())=={'PASS','LIMITED','BLOCKED','FAIL'},str(statuses))
check('boundary-language','不等于已部署' in text and '阶段B' in text and 'BLOCKED' in text,'deployment boundary present')
check('rollback-boundary','revert PR' in (ROOT/'CHANGE-AND-ROLLBACK.md').read_text() and 'GC' in (ROOT/'CHANGE-AND-ROLLBACK.md').read_text(),'non-destructive')
# Six explicit synthetic positives prove detector wiring; do not store authenticatable examples.
synthetic=['AKIA'+'A'*16,'ghp_'+'A'*36,'-----BEGIN '+'PRIVATE KEY-----','postgresql:'+'//user:pass@127.0.0.1/db','eyJ'+'A'*24+'.'+'B'*24+'.'+'C'*24,'api_'+'secret='+'A'*32]
patterns=[r'AKIA[A-Z0-9]{16}',r'ghp_[A-Za-z0-9]{36}',r'BEGIN (?:RSA |EC )?PRIVATE KEY',r'(?:postgres|postgresql)://[^\s]+:[^\s]+@',r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',r'(?i)(?:api[_-]?secret|password)\s*[:=]\s*[A-Za-z0-9]{24,}']
check('scanner-synthetic',all(re.search(p,s) for p,s in zip(patterns,synthetic)),'6/6 synthetic positives')
scan_files=[p for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS' and p!=Path(__file__) and '__pycache__' not in p.parts]
hits=[]
for p in scan_files:
 data=p.read_text(errors='replace')
 for idx,pat in enumerate(patterns):
  if re.search(pat,data):hits.append({'path':str(p.relative_to(ROOT)),'rule':idx+1})
check('delivery-sensitive-formats',not hits,json.dumps(hits,ensure_ascii=False))
out={'schema':'FL-DB-002-delivery-tests-v1','checks':checks,'summary':{'pass':sum(x['status']=='PASS' for x in checks),'fail':len(errors)}}
(ROOT/'evidence/test-results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out['summary']))
sys.exit(1 if errors else 0)

"""Offline governance-output scanner; candidates contain positions only, never values. Structural exclusions are not a whole-project secrecy guarantee."""
from pathlib import Path
import re,math,collections,json,hashlib,subprocess
import sys
D=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
rules={
 'private_key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'provider_token':r'\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,}|sk_live_[0-9A-Za-z]{20,})',
 'jwt':r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b',
 'credential_url':r'(?:postgres(?:ql)?|mysql|https?)://[^\s:/]+:[^\s@/]+@',
 'literal_secret':r'(?i)\b(?:password|secret|api_key|access_token|service_role_key|database_url)\s*[:=]\s*["\x27]([^"\x27\n]{12,})["\x27]',
 'key_material_file':r'(?i)(?:hmac[_-]?key|private[_-]?key|secret[_-]?key)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{24,}'
}
# Synthetic values are assembled transiently and never printed/persisted.
positive=['-----BEGIN '+'PRIVATE KEY-----','AK'+'IA'+'A'*16,'eyJ'+'A'*20+'.'+'B'*20+'.'+'C'*20,'postgresql'+':'+'//'+'synthetic'+':'+'synthetic'+'@'+'localhost','password'+' = '+chr(34)+'synthetic_value_for_control'+chr(34),'hmac_key'+' = '+chr(34)+'A'*32+chr(34)]
controls={k:bool(re.search(p,v)) for (k,p),v in zip(rules.items(),positive)}
hits=[];entropy=[];files=[]
for f in sorted(D.rglob('*')):
 if not f.is_file():continue
 if f.is_symlink():raise SystemExit('symlink_rejected')
 s=f.read_text();files.append(f.relative_to(D).as_posix())
 for k,p in rules.items():
  for m in re.finditer(p,s):hits.append({'path':f.relative_to(D).as_posix(),'line':s.count('\n',0,m.start())+1,'rule':k})
 for m in re.finditer(r'(?<![\w/])[A-Za-z0-9+/_=-]{32,}(?![\w/])',s):
  v=m.group();counts=collections.Counter(v);h=-sum((c/len(v))*math.log2(c/len(v)) for c in counts.values())
  # Source object IDs/digests are intentional public audit identifiers; ordinary identifiers and paths are structural.
  if re.fullmatch(r'[a-fA-F0-9]{32,128}',v) or re.fullmatch(r'[A-Za-z_][A-Za-z_/-]*',v) or '/' in v:continue
  if h>=4.3:entropy.append({'path':f.relative_to(D).as_posix(),'line':s.count('\n',0,m.start())+1,'rule':'high_entropy','length':len(v)})
print(json.dumps({'files':len(files),'format_hits':hits,'entropy_candidates':entropy,'rule_positive_controls':controls},ensure_ascii=False))

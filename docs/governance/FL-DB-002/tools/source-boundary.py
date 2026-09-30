#!/usr/bin/env python3
"""Read selected tracked code only; no environment files, protected baseline, or remote calls."""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
ROOT=Path('/Users/ck/Developer/FastLink')
NAMES=['fastlink-prime-wallet','fastlik-backend','fastlik-app','fastlik-Admin','fastlik-Website','fastlink-control-plane']
RULES={
 'postgres_driver':r'\b(?:PrismaClient|PrismaService|Pool|createConnection)\b|(?:postgres|postgresql)://|from [\x22\x27](?:pg|postgres|mysql)',
 'database_variable':r'\b(?:DATABASE_URL|DIRECT_URL|PGUSER|PGHOST)\b',
 'supabase_client':r'@supabase/|supabase\.co|createClient\(',
 'privileged_variable':r'\b[A-Z_]*(?:SERVICE_ROLE|SERVICE_KEY|DATABASE_PASSWORD|PRIVATE_KEY)[A-Z_]*\b',
 'http_client':r'\bfetch\s*\(|\baxios\b|https?\.request\(',
 'session_transport':r'credentials\s*:|authorization|Authorization|localStorage|sessionStorage|document\.cookie',
 'jwt_library':r'jsonwebtoken|jose|jwt\.verify|jwt\.decode|JwtService',
 'untrusted_claim':r'user_metadata|raw_user_meta_data|jwt\.decode',
 'server_session':r'adminSession|endUserSession|sessionHash|tokenHash|authVersion',
 'tenant_field':r'\btenantId\b|\btenant_id\b',
 'background_trigger':r'@Cron|@Interval|setInterval\(|onModuleInit\(|@Processor|\.process\(',
 'provider_boundary':r'\b(?:THREDD|CREGIS)[A-Z_]*\b',
}
def git(p,*args): return subprocess.check_output(['git','--no-optional-locks',*args],cwd=p,stderr=subprocess.DEVNULL).decode().strip()
def sha(b):return hashlib.sha256(b).hexdigest()
def run():
 out={'schema':'FL-DB-002-source-v1','repositories':[], 'limits':['Only tracked first-party source, package declarations, and existing frontend bundles; no full secret scan.','No .env, credential store, protected baseline overlays, dependency code, migrations, old auth material, or source values emitted.','Regex indicators are triage signals, not credential validity or runtime reachability proof.']}
 for name in NAMES:
  p=ROOT/name; names=git(p,'ls-files','-z').split('\x00'); files=[];signals=[]; skipped=[]
  for rel in names:
   if not rel:continue
   q=Path(rel)
   # Deliberately never inspect docs (including the three protected overlays).
   if q.parts[0] in ['docs','.git','node_modules','prisma','migrations','tests','test','e2e'] or '.env' in q.name or any(x in q.name for x in ['lock','spec.','test.']):continue
   if q.suffix not in ['.ts','.tsx','.js','.jsx','.mjs','.cjs','.html'] and rel!='package.json':continue
   f=p/rel
   if f.is_symlink():skipped.append({'path':rel,'reason':'symlink not followed'});continue
   st=f.stat()
   if st.st_size>8*1024*1024:skipped.append({'path':rel,'reason':'size limit','size':st.st_size});continue
   b=f.read_bytes();s=b.decode('utf8',errors='replace');files.append({'path':rel,'sha256':sha(b),'mode':oct(st.st_mode&0o777),'size':st.st_size})
   for line,t in enumerate(s.splitlines(),1):
    matched=[k for k,r in RULES.items() if re.search(r,t)]
    if matched:signals.append({'path':rel,'line':line,'indicators':matched})
  # Existing build outputs: inspect only regular frontend JS/HTML, never create/rebuild artifacts.
  bundles=[]
  if name in ['fastlink-prime-wallet','fastlik-app','fastlik-Admin','fastlik-Website']:
   d=p/'dist'
   if d.is_dir():
    for f in sorted(d.rglob('*')):
     if not f.is_file() or f.is_symlink() or f.suffix not in ['.js','.html']:continue
     st=f.stat();rel=str(f.relative_to(p))
     if st.st_size>8*1024*1024:skipped.append({'path':rel,'reason':'bundle size limit','size':st.st_size});continue
     b=f.read_bytes();s=b.decode('utf8',errors='replace')
     bundles.append({'path':rel,'size':len(b),'sha256':sha(b),'indicators':{k:len(re.findall(r,s)) for k,r in RULES.items() if re.search(r,s)}})
  ip=Path(git(p,'rev-parse','--git-path','index'));ip=ip if ip.is_absolute() else p/ip
  index=ip.read_bytes()
  refs=git(p,'for-each-ref','--format=%(refname) %(objectname)')
  out['repositories'].append({'repository':name,'head':git(p,'rev-parse','HEAD'),'index_sha256':sha(index),'refs_sha256':sha(refs.encode()),'files':files,'signals':signals,'existingBundles':bundles,'skipped':skipped})
 return out
if __name__=='__main__':print(json.dumps(run(),ensure_ascii=False,indent=2))

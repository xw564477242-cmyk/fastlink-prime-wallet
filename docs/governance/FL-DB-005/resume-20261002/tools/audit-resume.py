import pathlib,json,hashlib,re,urllib.request,ssl,datetime
root=pathlib.Path('/private/tmp/FL-DB-005-resume-20261002')
lock=json.loads((root/'backend/package-lock.json').read_text()); pairs=[]
for path,v in lock['packages'].items():
 if not path or v.get('dev'):continue
 name=v.get('name') or path.rsplit('node_modules/',1)[-1]
 assert re.fullmatch(r'(?:@[a-z0-9._-]+/)?[a-z0-9._-]+',name)
 assert v.get('resolved','').startswith('https://registry.npmjs.org/')
 pairs.append({'name':name,'version':v['version']})
packages={}
for x in pairs:packages.setdefault(x['name'],[]).append(x['version'])
wire=json.dumps({k:sorted(set(v)) for k,v in sorted(packages.items())},separators=(',',':')).encode()
assert len(pairs)==174 and len(packages)==165
assert hashlib.sha256(wire).hexdigest()=='b90bf1b07a0949b2345cd72686ea500ec8021aff84ebe02a9eb771386acc883e'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**k):raise RuntimeError('redirect denied')
endpoint='https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect(),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
r={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pairs':174,'names':165,'wire_sha256':hashlib.sha256(wire).hexdigest(),'endpoint':endpoint,'authority':'current resumed audit authorization; request bytes equal prior approved wire digest','old_wrapper_reconstructed':False,'credentials_sent':False,'full_lock_or_source_sent':False,'advisories':[]}
try:
 req=urllib.request.Request(endpoint,data=wire,method='POST',headers={'Content-Type':'application/json','Accept':'application/json'})
 with opener.open(req,timeout=30) as response:
  r['http_status']=response.status;raw=response.read(4000001);assert len(raw)<=4000000
 for name,items in json.loads(raw).items():
  assert name in packages
  for x in items:r['advisories'].append({'package':name,'installed_versions':sorted(set(packages[name])),'id':x.get('id'),'severity':x.get('severity'),'vulnerable_versions':x.get('vulnerable_versions'),'url':x.get('url')})
 r['status']='HTTP_SUCCESS_REQUIRES_SEMVER_MATCH'
except Exception as e:r['status']='BLOCKED';r['error_type']=type(e).__name__
(root/'validation/results/npm-audit-resume.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({'status':r['status'],'http':r.get('http_status'),'advisory_count':len(r['advisories'])}))

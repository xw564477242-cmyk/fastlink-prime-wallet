import pathlib,json,hashlib,urllib.request,urllib.error,ssl,datetime,re
ROOT=pathlib.Path(__file__).resolve().parent.parent
expected='afc58daba124d5073884690020487b5c5042fb1cc66e8aa4148c20ff6b8e53f4'
raw=(ROOT/'private/audit-public-payload-proposed.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==expected,'approved_payload_sha_changed'
a=json.loads(raw);assert len(a['packages'])==174 and not a['unknown']
packages={}
for x in a['packages']:
 assert set(x)=={'name','version'}
 assert re.fullmatch(r'(?:@[a-z0-9._-]+/)?[a-z0-9._-]+',x['name'])
 assert re.fullmatch(r'[0-9A-Za-z.+_-]+',x['version'])
 packages.setdefault(x['name'],[])
 if x['version'] not in packages[x['name']]:packages[x['name']].append(x['version'])
# Protocol encoding contains only the approved name/version pairs, no wrapper metadata.
wire=json.dumps({k:sorted(v) for k,v in sorted(packages.items())},separators=(',',':')).encode()
endpoint='https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise RuntimeError('redirect_not_permitted')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect(),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
req=urllib.request.Request(endpoint,data=wire,method='POST',headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'restricted-dependency-audit'})
result={'time_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'approved_source_sha256':expected,'wire_sha256':hashlib.sha256(wire).hexdigest(),'source_pairs':174,'unique_package_names':len(packages),'endpoint':endpoint,'protocol':'official Bulk Advisory, package-name to installed-version list; approved-source wrapper omitted','network_destinations':1,'fallback':False,'credentials_sent':False,'private_context_sent':False,'advisories':[]}
try:
 with opener.open(req,timeout=30) as response:
  result['http_status']=response.status;data=response.read(4_000_001);assert len(data)<=4_000_000,'response_size_limit'
 parsed=json.loads(data);assert isinstance(parsed,dict)
 for name,items in parsed.items():
  assert name in packages and isinstance(items,list),'unexpected_response_shape'
  for item in items:
   assert isinstance(item,dict)
   severity=item.get('severity');assert severity in ['info','low','moderate','high','critical']
   result['advisories'].append({'package':name,'installed_versions':packages[name],'id':item.get('id'),'severity':severity,'vulnerable_versions':item.get('vulnerable_versions'),'url':item.get('url'),'title':item.get('title')})
 result['status']='HTTP_SUCCESS_ADVISORIES_REQUIRE_VERSION_MATCH'
except Exception as e:
 result['status']='BLOCKED_RESPONSE_OR_NETWORK';result['error_type']=type(e).__name__
 if isinstance(e,urllib.error.HTTPError):result['http_status']=e.code
(ROOT/'evidence/docs/governance/FL-DB-005/evidence/npm-audit-r2.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['status','source_pairs','unique_package_names','http_status'] if k in result},sort_keys=True));print('advisory_count',len(result['advisories']))

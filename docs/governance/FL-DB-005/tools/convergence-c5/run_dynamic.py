import pathlib,subprocess,json,os,sys
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parents[2];c=r/'convergence-c5';image='sha256:6622b5ce13429346f91fcdb936ec2e026ccc28465409fd25b7f79c623e7a20af'
for name in ['dynamic-final-r5-r6','negative-final-r5-r6']:
 container='fl-db005-p8ryoi9-c5-'+name
 assert subprocess.run(['docker','inspect',container],capture_output=True).returncode!=0
 a=['docker','run','--pull=never','--name',container,'--platform','linux/amd64','--label','fl-ticket=FL-DB-005','--label','fl-round=C5','--network','fl-db005-p8ryoi9-isolated','--mount',f'type=bind,src={c}/source,dst=/work,readonly','--mount','type=volume,src=fl-db005-p8ryoi9-node-modules,dst=/work/node_modules,readonly','--mount',f'type=bind,src={c}/tools/{name}.cjs,dst=/runner/main.cjs,readonly','--mount',f'type=bind,src={c}/private/r5,dst=/auth/r5,readonly','--mount',f'type=bind,src={c}/private/r6,dst=/auth/r6,readonly','--mount',f'type=bind,src={c}/results,dst=/results','--mount','type=bind,src=/Users/ck/.cache/prisma/master/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x,dst=/engines,readonly','-w','/work','-e','PRISMA_QUERY_ENGINE_LIBRARY=/engines/libquery-engine','--entrypoint','node',image,'/runner/main.cjs']
 with (c/'private'/f'{name}.log').open('w') as f:p=subprocess.run(a,stdout=f,stderr=subprocess.STDOUT)
 result=json.loads((c/'results'/f'{name}.json').read_text()) if (c/'results'/f'{name}.json').exists() else {}
 ok=p.returncode==0 and len(result.get('rounds',[]))==2 and not result.get('stopped') and not result.get('error') and all(x['status']=='PASS' for rnd in result.get('rounds',[]) for x in rnd['cases'])
 print(json.dumps({'control':name,'exit':p.returncode,'accepted':ok,'rounds':[{'round':x['round'],'pass':sum(t['status']=='PASS' for t in x['cases']),'fail':sum(t['status']=='FAIL' for t in x['cases'])} for x in result.get('rounds',[])]}),flush=True)
 if not ok:print('STOP: control failure; no extension tests.');sys.exit(1)

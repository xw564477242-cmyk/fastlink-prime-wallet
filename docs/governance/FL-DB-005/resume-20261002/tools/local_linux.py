import subprocess,pathlib,json,hashlib,os,time,sys
os.umask(0o077)
ROOT=pathlib.Path('/private/tmp/FL-DB-005-resume-20261002'); C=ROOT/'validation'; IMAGE='sha256:6622b5ce13429346f91fcdb936ec2e026ccc28465409fd25b7f79c623e7a20af'
summary={'head':'d33a85520aff868cdfa867c45b10911592230f77','network':'none','host_ports':0,'existing_dependencies':'read-only retained Linux volume','results':[]}
def save(): (C/'results/local-linux.json').write_text(json.dumps(summary,indent=2)+'\n')
base=['docker','run','--restart=no','--pull=never','--platform','linux/amd64','--network','none','--label','fl-ticket=FL-DB-005','--label','fl-round=C5','--mount',f'type=bind,src={C}/source,dst=/work','--mount','type=volume,src=fl-db005-p8ryoi9-node-modules,dst=/work/node_modules,readonly','--mount',f'type=bind,src={C}/private,dst=/results','-w','/work','-e','NODE_ENV=test']
steps=[('versions',['node','-e','console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,prisma:require("prisma/package.json").version,client:require("@prisma/client/package.json").version}))']),('build',['npm','run','build']),('lint',['npm','run','lint']),('jest',['npm','test','--','--runInBand','--json','--outputFile=/results/jest-private.json']),('targeted',['npm','test','--','--runInBand','--runTestsByPath','src/prisma/isolated-tenant-transaction.spec.ts','--json','--outputFile=/results/targeted-private.json'])]
for name,cmd in steps:
 container='fl-db005-resume1002-check-'+name
 assert subprocess.run(['docker','inspect',container],capture_output=True).returncode!=0
 start=time.time()
 with (C/'private'/f'{name}.log').open('w') as log:
  p=subprocess.run(base+['--name',container,IMAGE]+cmd,stdout=log,stderr=subprocess.STDOUT)
 row={'name':name,'exit':p.returncode,'seconds':round(time.time()-start,2),'container':container}
 if name=='versions' and p.returncode==0:row['runtime']=json.loads((C/'private'/f'{name}.log').read_text())
 if name in ['jest','targeted'] and (C/'private'/f'{name}-private.json').exists():
  j=json.loads((C/'private'/f'{name}-private.json').read_text());row['summary']={k:j.get(k) for k in ['success','numTotalTests','numPassedTests','numFailedTests','numPendingTests','numPassedTestSuites','numFailedTestSuites']}
 summary['results'].append(row);save();print(json.dumps(row),flush=True)
 if p.returncode: print('STOP: local stage failed, raw log retained privately.');sys.exit(1)
print('Local Linux checks completed without external network.')

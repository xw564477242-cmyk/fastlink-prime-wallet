import sys,pathlib,subprocess,os
os.umask(0o077)
r=pathlib.Path(__file__).resolve().parent.parent
name=sys.argv[1]
assert name.replace('-','').isalnum()
script=r/'private'/f'{name}.cjs';assert script.is_file()
a=['docker','run','--name','fl-db005-p8ryoi9-'+name,'--platform','linux/amd64','--network','fl-db005-p8ryoi9-isolated','--mount',f'type=bind,src={r}/backend,dst=/work,readonly','--mount','type=volume,src=fl-db005-p8ryoi9-node-modules,dst=/work/node_modules','--mount',f'type=bind,src={script},dst=/runner/main.cjs,readonly','--mount',f'type=bind,src={r}/private/r1,dst=/auth/r1,readonly','--mount',f'type=bind,src={r}/private/r2,dst=/auth/r2,readonly','--mount',f'type=bind,src={r}/private/results,dst=/results','--mount','type=bind,src=/Users/ck/.cache/prisma/master/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x,dst=/engines,readonly','-w','/work','-e','PRISMA_QUERY_ENGINE_LIBRARY=/engines/libquery-engine','--entrypoint','node','sha256:6622b5ce13429346f91fcdb936ec2e026ccc28465409fd25b7f79c623e7a20af','/runner/main.cjs']
with (r/'private'/f'{name}-private.log').open('w') as f:p=subprocess.run(a,stdout=f,stderr=subprocess.STDOUT)
print('Runner exit:',p.returncode)

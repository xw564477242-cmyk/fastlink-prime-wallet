import pathlib, subprocess, os, json, secrets, hashlib, time, re
os.umask(0o077)
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'evidence/docs/governance/FL-DB-005/evidence'
IMAGE='sha256:25a89970a83255ae96484d709005bb35aa71f7455f941bc1634514f31c5d5c62'
NETWORK='fl-db005-p8ryoi9-isolated'
def run(args, **kw): return subprocess.run(args,capture_output=True,text=True,**kw)
def save(name,obj): (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def main():
    info=run(['docker','image','inspect',IMAGE]); assert info.returncode==0
    assert json.loads(info.stdout)[0]['Id']==IMAGE
    assert run(['docker','network','create','--internal',NETWORK]).returncode==0
    inv=json.loads((ROOT/'evidence/docs/governance/FL-DB-001/evidence/migration-inventory.json').read_text())
    original=sorted([x for x in inv['records'] if x['source_class']=='formal_forward'],key=lambda x:x['forward_order'])
    states=[]
    for iteration in [1,2]:
        container=f'fl-db005-p8ryoi9-r{iteration}'; database=f'fl_db005_r{iteration}'
        auth=ROOT/'private'/f'r{iteration}'; auth.mkdir(mode=0o700)
        password=secrets.token_hex(32); password_file=auth/'initializer-password'
        password_file.write_text(password);password_file.chmod(0o600)
        roles={n:secrets.token_hex(32) for n in ['db5_pool','db5_issuer','db5_user_a','db5_user_b','db5_admin_a','db5_platform','db5_task']}
        volume=container+'-data'
        assert run(['docker','volume','create',volume]).returncode==0
        result=run(['docker','run','-d','--name',container,'--network',NETWORK,
          '-e','POSTGRES_USER=db5_initializer','-e',f'POSTGRES_DB={database}',
          '-e','POSTGRES_PASSWORD_FILE=/run/db5/password','-e','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256',
          '--mount',f'type=bind,src={password_file},dst=/run/db5/password,readonly',
          '--mount',f'type=volume,src={volume},dst=/var/lib/postgresql/data',IMAGE,
          '-c','log_statement=none','-c','log_min_error_statement=panic','-c','log_error_verbosity=terse',
          '-c','log_parameter_max_length=0','-c','log_parameter_max_length_on_error=0'])
        assert result.returncode==0,'container_creation_failed'
        def sql(q): return run(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1',
                         '-v','VERBOSITY=sqlstate','-U','db5_initializer','-d',database],input=q)
        for _ in range(60):
            check=sql('SELECT 1;')
            if check.returncode==0:break
            time.sleep(.5)
        assert check.returncode==0,'database_not_ready'
        assert sql('SHOW server_version;').stdout.strip()=='17.11'
        assert sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public';").stdout.strip()=='0'
        state={'round':iteration,'image':IMAGE,'version':'17.11','blank_confirmed':True,'original_migrations':[]};states.append(state)
        for item in original:
            raw=(ROOT/'backend'/item['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==item['sha256']
            p=sql(raw.decode());state['original_migrations'].append({'path':item['path'],'order':item['forward_order'],
              'sha256':item['sha256'],'exit':p.returncode,'sqlstate':re.findall(r'ERROR:\s*([0-9A-Z]{5})',p.stderr)})
            save('rebuild-r1.json',states);assert p.returncode==0,'original_migration_failed_no_rewrite'
        for t in ['a','b']:
            fixture=f'''INSERT INTO public."Tenant" (id,"legalName","brandName",slug,environment,"updatedAt")
VALUES ('db5_tenant_{t}','Synthetic','Synthetic','db5-synthetic-{t}','SANDBOX','2026-01-01');
INSERT INTO public."Customer" (id,"tenantId",environment,"externalUserId","providerCustomerRef","updatedAt")
VALUES ('db5_customer_{t}','db5_tenant_{t}','SANDBOX','db5-subject-{t}','db5-synthetic-provider-{t}','2026-01-01');'''
            assert sql(fixture).returncode==0,'synthetic_fixture_failed'
        migration=ROOT/'backend/prisma/migrations/20261001050000_fl_db005_identity_rls/migration.sql'
        p=sql("SET fl_db005.isolated_validation='approved-blank-task';\n"+migration.read_text())
        state['candidate_migration']={'sha256':hashlib.sha256(migration.read_bytes()).hexdigest(),'exit':p.returncode,
          'sqlstate':re.findall(r'ERROR:\s*([0-9A-Z]{5})',p.stderr)}
        save('rebuild-r1.json',states);assert p.returncode==0,'candidate_migration_failed'
        for name,pw in roles.items():
            q=f"CREATE ROLE {name} LOGIN PASSWORD '{pw}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;"
            q+=f"GRANT {'fl_db005_issuer' if name=='db5_issuer' else 'fl_db005_runtime'} TO {name} WITH INHERIT TRUE, SET FALSE;"
            assert sql(q).returncode==0,'synthetic_role_setup_failed'
        for role,tenant,kind in [('db5_user_a','a','USER'),('db5_user_b','b','USER'),('db5_admin_a','a','TENANT_ADMIN'),('db5_platform','a','PLATFORM_ADMIN'),('db5_task','a','TASK')]:
            q=f"INSERT INTO fl_identity.principal VALUES ('{role}','{role}','db5_tenant_{tenant}','db5_customer_{tenant}','SANDBOX','{kind}','address-book',true,true,clock_timestamp()+interval '2 hours');"
            assert sql(q).returncode==0,'direct_mapping_failed'
        for t in ['a','b']:
            assert sql(f"INSERT INTO fl_identity.principal VALUES ('pool_{t}','db5_pool','db5_tenant_{t}','db5_customer_{t}','SANDBOX','USER','address-book',false,true,clock_timestamp()+interval '2 hours');").returncode==0
        inspect=json.loads(run(['docker','inspect',container]).stdout)[0]
        assert not inspect['HostConfig'].get('PortBindings') and not any(inspect['NetworkSettings']['Ports'].values())
        assert json.loads(run(['docker','network','inspect',NETWORK]).stdout)[0]['Internal'] is True
        state['network']={'internal':True,'host_ports':0,'network':NETWORK}
        state['authentication']={'parent_mode':'700','file_mode':'600','origin':'new task-only random','raw_values_exported':False}
        state['retention']={'container':container,'volume':volume,'automatic_delete':False}
        credentials={'container':container,'database':database,'initializer':password,'roles':roles}
        f=auth/'credentials.json';f.write_text(json.dumps(credentials));f.chmod(0o600)
        save('rebuild-r1.json',states)
    print('Two blank task databases rebuilt; no host ports; original bytes/order retained.')
if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('STOP:',type(exc).__name__,'; see sanitized checkpoint.');raise SystemExit(1)

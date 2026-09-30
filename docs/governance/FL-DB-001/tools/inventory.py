"""Offline static migration inventory. No SQL execution, database connection or raw SQL output."""
import sys
sys.dont_write_bytecode=True
import re,json,hashlib
from pathlib import Path

IDENT=r'(?:"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*|%I)(?:\.(?:"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*))?'
PATTERNS={
 'schema':rf'\bCREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?({IDENT})',
 'table':rf'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?({IDENT})',
 'materialized_view':rf'\bCREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?({IDENT})',
 'view':rf'\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+({IDENT})',
 'function':rf'\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+({IDENT})',
 'procedure':rf'\bCREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+({IDENT})',
 'trigger':rf'\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+({IDENT})',
 'role':rf'\bCREATE\s+(?:ROLE|USER)\s+({IDENT})',
 'extension':rf'\bCREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?({IDENT})',
 'policy':rf'\bCREATE\s+POLICY\s+({IDENT})\s+ON\s+({IDENT})',
 'rls_enable':rf'\bALTER\s+TABLE\s+({IDENT})\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY',
 'rls_force':rf'\bALTER\s+TABLE\s+({IDENT})\s+FORCE\s+ROW\s+LEVEL\s+SECURITY',
 'rls_disable':rf'\bALTER\s+TABLE\s+({IDENT})\s+(?:DISABLE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY',
 'drop':r'\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|POLICY|ROLE|TYPE|SCHEMA|FUNCTION|PROCEDURE|TRIGGER|VIEW|EXTENSION)\b',
 'truncate':r'\b(TRUNCATE)\b',
 'security_definer':r'\b(SECURITY\s+DEFINER)\b',
 'search_path':r'\b(search_path)\b',
 'default_privilege':r'\b(ALTER\s+DEFAULT\s+PRIVILEGES)\b',
 'grant':r'\b(GRANT)\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL|USAGE|EXECUTE|CREATE|CONNECT|REFERENCES|TRIGGER)\b',
 'revoke':r'\b(REVOKE)\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|CREATE|CONNECT)\b',
 'execute_privilege':r'\b(?:GRANT|REVOKE)\s+(EXECUTE)\b',
 'using_true':r'\bUSING\s*\(\s*(true)\s*\)',
 'check_true':r'\bWITH\s+CHECK\s*\(\s*(true)\s*\)',
}

def lex(text):
    """Blank comments/literals preserving offsets. DO/dollar bodies kept for conservative scan."""
    chars=list(text); literals=[]; i=0
    while i<len(text):
        if text.startswith('--',i):
            j=text.find('\n',i);j=len(text) if j<0 else j
            for k in range(i,j):chars[k]=' '
            i=j
        elif text.startswith('/*',i):
            start=i;level=1;i+=2
            while i<len(text) and level:
                if text.startswith('/*',i):level+=1;i+=2
                elif text.startswith('*/',i):level-=1;i+=2
                else:i+=1
            for k in range(start,i):
                if chars[k]!='\n':chars[k]=' '
        elif text[i]=="'":
            start=i;i+=1
            while i<len(text):
                if text[i]=="'":
                    if i+1<len(text) and text[i+1]=="'":i+=2;continue
                    i+=1;break
                if text[i]=='\\' and i+1<len(text):i+=2
                else:i+=1
            literals.append((start,text[start+1:i-1].replace("''","'")))
            for k in range(start,i):
                if chars[k]!='\n':chars[k]=' '
        else:i+=1
    return ''.join(chars),literals

def scan(text):
    code,literals=lex(text);events=[]
    sources=[(0,code,False)]+[(offset,body,True) for offset,body in literals if re.search(r'\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\b',body,re.I)]
    for offset,body,dynamic in sources:
        for kind,pattern in PATTERNS.items():
            for m in re.finditer(pattern,body,re.I):
                events.append({'kind':kind,'identifiers':[v.strip('"') for v in m.groups()],
                  'line':text.count('\n',0,offset+m.start())+1,'dynamic_literal':dynamic})
    return sorted(events,key=lambda e:(e['line'],e['kind'],e['identifiers']))

def inventory(root):
    root=Path(root);records=[]
    for group in ['prisma/migrations','prisma/dev-migrations']:
        files=sorted((root/group).rglob('*.sql'))
        forward_order={str(f):i for i,f in enumerate((f for f in files if f.name=='migration.sql'),1)}
        for i,f in enumerate(files,1):
            if f.is_symlink():raise ValueError('source_link_rejected')
            raw=f.read_bytes();text=raw.decode('utf-8');events=scan(text)
            cls=('formal_forward' if group.endswith('/migrations') else 'dev_forward') if f.name=='migration.sql' else ('rollback' if f.name=='rollback.sql' else 'dev_prepare' if f.name=='prepare.sql' else 'dev_activate' if f.name=='activate.sql' else 'dev_post_constraints')
            records.append({'path':f.relative_to(root).as_posix(),'source_class':cls,'lexical_inventory_order':i,
             'forward_order':forward_order.get(str(f)),'sha256':hashlib.sha256(raw).hexdigest(),
             'blob_oid':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),
             'lines':text.count('\n'),'events':events,'execution':'NOT_RUN',
             'execution_reason':'rollback_not_forward_never_execute' if cls=='rollback' else 'await_scope_review_no_SQL_executed'})
    return {'scope':'51 SQL sources; static occurrences are not live catalog or effective privilege proof',
      'limitations':['Conservative lexical extraction, not a PostgreSQL parser','Dynamic templates retained as unresolved identifiers; no invented expansion','Dollar bodies inspected conservatively, environment guards require manual review','No assertions about unseen live objects, extensions, defaults or application SQL'],
      'records':records}

if __name__=='__main__':
    try:print(json.dumps(inventory(sys.argv[1]),ensure_ascii=False,indent=2))
    except Exception:
        print(json.dumps({'status':'BLOCKED','reason':'static_inventory_unavailable_no_raw_error'}));sys.exit(2)

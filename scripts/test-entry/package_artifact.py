"""Trusted artifact helper. Explicit checks remain active under python -O.
Only a newly owned staging directory is written until all checks succeed.
Failed staging is retained; existing destinations are never cleaned or reused.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import zipfile
from guard import ACCOUNT, ORIGIN

CONFIG = {'name': 'fastlink-prime-wallet-test', 'account_id': ACCOUNT,
          'main': '.output/server/index.mjs', 'compatibility_date': '2026-07-25',
          'compatibility_flags': ['nodejs_compat'], 'no_bundle': True,
          'rules': [{'type': 'ESModule', 'globs': ['**/*.mjs', '**/*.js']}],
          'assets': {'binding': 'ASSETS', 'directory': '.output/public'},
          'vars': {'FASTLINK_PROXY_ID': 'prime-test', 'FASTLINK_BACKEND_ORIGIN': ORIGIN},
          'observability': {'enabled': True}}

class ArtifactError(ValueError):
    pass

def check(condition, message):
    if not condition:
        raise ArtifactError(message)

def hex_value(value, length):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{'+str(length)+'}', value) is not None

def identity(candidate, entry):
    check(hex_value(candidate,40) and hex_value(entry,40), 'invalid candidate or entry SHA')

def kind(path):
    mode = Path(path).lstat().st_mode
    check(not stat.S_ISLNK(mode), 'symlink rejected')
    check(stat.S_ISDIR(mode) or stat.S_ISREG(mode), 'unsupported file type')
    check(not mode & 0o7000, 'special permission bits rejected')
    return mode

def digest(path):
    check(stat.S_ISREG(kind(path)), 'expected regular file')
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def namesafe(name, directory):
    check(isinstance(name,str) and name and '\\' not in name and ':' not in name, 'invalid separator/path')
    check(not any(ord(c)<32 or ord(c)==127 for c in name), 'control character in path')
    check(not name.startswith('/'), 'absolute path')
    raw=name[:-1] if directory and name.endswith('/') else name
    parts=raw.split('/')
    check(parts[0]=='.output' and all(p not in ('', '.', '..') for p in parts), 'path traversal or outside output')
    return raw

def destination(path):
    p=Path(path).absolute()
    check(not os.path.lexists(p), 'destination already exists')
    check(p.parent.is_dir(), 'destination parent must exist')
    return p.parent.resolve()/p.name

def stage_for(dest):
    return Path(tempfile.mkdtemp(prefix='.'+dest.name+'.incomplete-',dir=dest.parent))

def publish(stage,dest):
    # Exclusively reserve a new empty directory, then atomically rename staging
    # over OUR reservation. No pre-existing user directory is overwritten.
    os.mkdir(dest,0o700)
    try:
        os.rename(stage,dest)
    except Exception:
        try: os.rmdir(dest)  # Only our empty reservation; never recursive cleanup.
        except OSError: pass
        raise

def failed(stage,exc):
    if stage.exists():
        (stage/'INCOMPLETE.txt').write_text('Validation failed; not a deployment artifact.\n')
    raise ArtifactError('artifact failed; isolated staging retained: '+str(stage)) from exc

def inventory(root):
    root=Path(root)
    check(stat.S_ISDIR(kind(root)), 'source must be directory')
    output=root/'.output'
    check(stat.S_ISDIR(kind(output)), 'output must be directory')
    rows=[]; aliases=set()
    for p in [output]+sorted(output.rglob('*')):
        mode=kind(p); directory=stat.S_ISDIR(mode)
        rel=p.relative_to(root).as_posix()
        namesafe(rel,directory)
        check(rel.casefold() not in aliases,'duplicate or case-colliding path')
        aliases.add(rel.casefold())
        rows.append({'path':rel,'type':'directory' if directory else 'file','mode':stat.S_IMODE(mode),
                     'sha256':None if directory else digest(p)})
    byname={r['path']:r for r in rows}
    check(byname.get('.output/server/index.mjs',{}).get('type')=='file','required entry missing')
    check(byname.get('.output/public',{}).get('type')=='directory','required assets directory missing')
    return rows

def pack(source,dest,candidate,entry):
    identity(candidate,entry)
    source=Path(source); dest=destination(dest)
    check(not dest.is_relative_to(source.resolve()), 'destination inside source')
    rows=inventory(source)  # Validate everything before writing any archive.
    stage=stage_for(dest)
    try:
        with zipfile.ZipFile(stage/'payload.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
            for row in rows:
                p=source/row['path']
                z.write(p,row['path']+('/' if row['type']=='directory' else ''))
        check(inventory(source)==rows,'source changed during packaging')
        (stage/'manifest.json').write_text(json.dumps({'candidate_sha':candidate,'entry_sha':entry,
               'payload_sha256':digest(stage/'payload.zip')},sort_keys=True))
        value=digest(stage/'manifest.json')
        publish(stage,dest)
        return value
    except Exception as exc:
        failed(stage,exc)

def unique_object(pairs):
    obj={}
    for key,value in pairs:
        check(key not in obj,'duplicate manifest key')
        obj[key]=value
    return obj

def zip_inventory(z):
    rows=[]; paths={}; aliases=set()
    for info in z.infolist():
        check(info.orig_filename==info.filename,'invalid original ZIP name')
        check(not info.flag_bits & 1,'encrypted ZIP unsupported')
        mode=info.external_attr >> 16
        check(info.create_system==3,'unsupported permission platform')
        check(stat.S_ISREG(mode) or stat.S_ISDIR(mode),'symlink or unsupported ZIP file type')
        directory=stat.S_ISDIR(mode)
        check(directory==info.is_dir(),'file type/name mismatch')
        check(not mode & 0o7000,'special ZIP permissions rejected')
        rel=namesafe(info.filename,directory)
        check(rel not in paths and rel.casefold() not in aliases,'duplicate ZIP member')
        paths[rel]='directory' if directory else 'file'; aliases.add(rel.casefold())
        rows.append((info,rel,stat.S_IMODE(mode),directory))
    check(paths.get('.output/server/index.mjs')=='file','required entry missing')
    check(paths.get('.output/public')=='directory','required assets directory missing')
    for _,rel,_,_ in rows:
        for parent in Path(rel).parents:
            if str(parent)!='.':check(paths.get(parent.as_posix())=='directory','missing directory or file parent collision')
    return rows

def unpack(source,dest,expected,candidate,entry):
    identity(candidate,entry)
    check(hex_value(expected,64),'invalid manifest digest')
    source=Path(source); dest=destination(dest)
    check(stat.S_ISDIR(kind(source)),'bundle source must be directory')
    check(not dest.is_relative_to(source.resolve()),'destination inside source')
    check(digest(source/'manifest.json')==expected,'manifest digest mismatch')
    m=json.loads((source/'manifest.json').read_text(),object_pairs_hook=unique_object)
    check(isinstance(m,dict) and set(m)=={'candidate_sha','entry_sha','payload_sha256'},'manifest structure')
    check(m['candidate_sha']==candidate and m['entry_sha']==entry,'candidate or entry SHA mismatch')
    check(hex_value(m['payload_sha256'],64),'payload digest format')
    check(m['payload_sha256']==digest(source/'payload.zip'),'payload digest mismatch')
    stage=None
    try:
        with zipfile.ZipFile(source/'payload.zip') as z:
            rows=zip_inventory(z)
            stage=stage_for(dest)
            for info,rel,mode,directory in rows:
                if directory:(stage/rel).mkdir(parents=True,exist_ok=True)
            for info,rel,mode,directory in rows:
                if not directory:
                    with z.open(info) as src, (stage/rel).open('xb') as dst:
                        for chunk in iter(lambda:src.read(1024*1024),b''):dst.write(chunk)
                    os.chmod(stage/rel,mode)
            for _,rel,mode,directory in sorted(rows,key=lambda r:len(r[1]),reverse=True):
                if directory:os.chmod(stage/rel,mode)
        check(m['payload_sha256']==digest(source/'payload.zip'),'payload changed during extraction')
        inventory(stage)
        (stage/'wrangler.json').write_text(json.dumps(CONFIG,indent=2))
        publish(stage,dest)
    except Exception as exc:
        if stage is not None:failed(stage,exc)
        raise

if __name__=='__main__':
    try:
        check(len(sys.argv) in (6,7),'invalid argument count')
        mode,source,dest,candidate,entry=sys.argv[1:6]
        if mode=='pack':
            check(len(sys.argv)==6,'pack arguments')
            value=pack(source,dest,candidate,entry)
            with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('manifest_digest='+value+'\n')
            with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write('\nCandidate '+candidate+'\nEntry '+entry+'\nManifest SHA256 '+value+'\n')
        elif mode=='unpack':
            check(len(sys.argv)==7,'unpack arguments');unpack(source,dest,sys.argv[6],candidate,entry)
        else:raise ArtifactError('unknown mode')
    except Exception as exc:
        print('STOP artifact: '+str(exc),file=sys.stderr)
        sys.exit(1)

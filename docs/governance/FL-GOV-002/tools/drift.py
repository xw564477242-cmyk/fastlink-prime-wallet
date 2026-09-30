#!/usr/bin/env python3
"""Read-only, offline drift observations. stdout contains metadata only."""
import sys
sys.dont_write_bytecode = True
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
from model import propagate, REQUIRED

LIMIT = 16 * 1024 * 1024
PROTECTED = {
 'docs/governance/baseline/CHANGE-HISTORY.md',
 'docs/governance/baseline/PROJECT-STATUS-SUMMARY.md',
 'docs/governance/baseline/FULL-ARCHIVE-INDEX.md',
}
SAFE_GOV = {
 'docs/governance/baseline/BASE-V1.0-20260930.md',
 'docs/governance/baseline/SHA256SUMS',
 'docs/governance/baseline/PROJECT-STATUS-ARCHIVE.md',
 'docs/governance/baseline/sources/FL-DEV-001-门禁5原文.md',
 'docs/governance/baseline/sources/活跃基线-用户原文.md',
}
LOCKS = {'bun.lock','bun.lockb','package-lock.json','yarn.lock','pnpm-lock.yaml','e2e/package-lock.json'}
VERSIONS = {'package.json','e2e/package.json','.nvmrc','.node-version','.tool-versions','bunfig.toml'}
TEMPLATES = {'tsconfig.json'} | {
 'docs/governance/FL-DEV-001/templates/'+n+'.env.example'
 for n in ['fastlink-prime-wallet','fastlik-backend','fastlik-app','fastlik-Admin','fastlik-Website']
}
class Unsafe(Exception):
    pass

def safe_rel(path):
    if not isinstance(path, str) or not path or '\\' in path or '\x00' in path:
        raise Unsafe('path')
    p = PurePosixPath(path)
    if p.is_absolute() or '..' in p.parts or str(p) != path:
        raise Unsafe('path')
    return path

def category(path):
    safe_rel(path)
    if path in PROTECTED:
        return 'protected'
    if path in LOCKS or path in VERSIONS:
        return 'toolchain_lock'
    if path in TEMPLATES:
        return 'environment_config'
    if path in SAFE_GOV:
        return 'governance_digest'
    if re.fullmatch(r'\.github/workflows/[A-Za-z0-9_.-]+\.ya?ml', path):
        return 'branch_base'
    if re.fullmatch(r'prisma/(?:dev-migrations|migrations)/[A-Za-z0-9_./-]+\.(?:sql|toml)',path):
        return 'rls_functions'
    if path in {'src/lib/backend-api.ts','src/gateway/contracts.ts'} or (path.startswith('src/') and path.endswith('.dto.ts')):
        return 'api_contract'
    if (path.startswith('src/') and 'contract' in path.lower()
        and path.endswith(('.ts','.tsx','.json')) and not re.search(r'\.(?:test|spec)\.',path)):
        return 'api_contract'
    if path.startswith('docs/') and path.endswith('.md') and 'contract' in path.lower():
        return 'api_contract'
    return None

def read_bytes(root, relative, *, cap=LIMIT, input_schema=False):
    """No symlinks at any component, hardlinks, devices, FIFOs or oversized files."""
    relative = safe_rel(relative)
    if relative in PROTECTED:
        raise Unsafe('protected')
    if input_schema:
        if relative not in ('reference.json','roots.json'): raise Unsafe('input_name')
    elif category(relative) is None:
        raise Unsafe('unapproved_content')
    # O_NOFOLLOW and directory descriptors avoid symlink traversal/TOCTOU.
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
    fd = None
    parent = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        parts = PurePosixPath(relative).parts
        for component in parts[:-1]:
            nxt = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            os.close(parent); parent = nxt
        fd = os.open(parts[-1], flags, dir_fd=parent)
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > cap:
            raise Unsafe('file_type_or_limit')
        result = bytearray()
        while True:
            block = os.read(fd, min(65536, cap + 1 - len(result)))
            if not block: break
            result.extend(block)
            if len(result) > cap: raise Unsafe('limit')
        after = os.fstat(fd)
        keys = ('st_ino','st_size','st_mtime_ns','st_ctime_ns')
        if any(getattr(before,k)!=getattr(after,k) for k in keys):
            raise Unsafe('concurrent_change')
        return bytes(result)
    finally:
        if fd is not None: os.close(fd)
        os.close(parent)

def git(root, *args):
    env = {'PATH':os.environ.get('PATH','/usr/bin:/bin'), 'HOME':os.environ.get('HOME','/'),
           'GIT_OPTIONAL_LOCKS':'0','GIT_TERMINAL_PROMPT':'0','GIT_NO_LAZY_FETCH':'1',
           'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null',
           'LC_ALL':'C','PYTHONDONTWRITEBYTECODE':'1'}
    allowed = ('rev-parse','ls-files')
    if not args or args[0] not in allowed: raise Unsafe('git_command')
    cmd = ['git','--no-optional-locks','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',
           '-c','core.untrackedCache=false','-c','gc.auto=0','-c','maintenance.auto=false',
           '-c','diff.autoRefreshIndex=false','-C',str(root),*args]
    p = subprocess.run(cmd,env=env,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15)
    if p.returncode: raise Unsafe('git_read_unavailable')
    if len(p.stdout)>8*1024*1024: raise Unsafe('git_output_limit')
    return p.stdout

def identity(root):
    head = git(root,'rev-parse','HEAD').decode('ascii').strip()
    if not re.fullmatch(r'[a-f0-9]{40}',head): raise Unsafe('head')
    try:
        upstream=git(root,'rev-parse','--abbrev-ref','@{upstream}').decode('ascii').strip()
    except Unsafe:
        upstream=None
    if upstream and not re.fullmatch(r'[A-Za-z0-9_./-]+',upstream): raise Unsafe('upstream')
    return head,upstream

def classify_output(changes, blocked):
    return '发现漂移' if changes else ('无法安全检查' if blocked else '无漂移')

def inspect_repo(root, reference):
    changes=[];blocked=[];checked=0;inputs=set()
    def change(kind,path=None):
        changes.append({'kind':kind,**({'path':path} if path else {})})
    try:
        head,upstream=identity(root)
    except (OSError,ValueError,Unsafe,subprocess.TimeoutExpired):
        return {'result':'无法安全检查','changes':[], 'blocked':[{'reason':'Git身份不可安全读取'}], 'checked_files':0,'affected':[]}
    if head!=reference['head']:change('HEAD');inputs.add('branch_base')
    if upstream!=reference['upstream']:change('upstream');inputs.add('branch_base')
    try:
        raw=git(root,'ls-files','--cached','--others','--exclude-standard','-z')
        paths=set(raw.decode('utf-8').split('\0'))-{''}
        watched={p for p in paths if category(p) is not None}
    except (UnicodeError,OSError,Unsafe,subprocess.TimeoutExpired):
        return {'result':'无法安全检查','changes':changes,'blocked':[{'reason':'文件集合不可安全枚举'}],'checked_files':0,'affected':propagate(inputs)}
    # Manifest categories are re-derived; a malicious manifest cannot allow arbitrary files.
    expected=reference['files']
    for path in expected:
        if category(path) in (None,'protected'):raise Unsafe('reference_scope')
        if not re.fullmatch(r'[a-f0-9]{64}',expected[path]):raise Unsafe('reference_digest')
    protected=sorted(PROTECTED & watched)
    for path in protected:
        blocked.append({'path':path,'reason':'受保护本地覆盖层；正文不读取，不计算摘要'})
        inputs.add('local_baseline_overlay')
    watched-=PROTECTED
    for path in sorted(set(expected)|watched):
        kind=category(path)
        if path not in expected:
            change('新增受控路径，未读取正文',path);inputs.add(kind);continue
        if path not in watched:
            change('受控路径移出索引或清单',path);inputs.add(kind);continue
        try:
            data=read_bytes(root,path)
        except (OSError,Unsafe):
            blocked.append({'path':path,'reason':'对象缺失、超限、链接、权限或并发变化；未完整检查'})
            inputs.add(kind);continue
        checked+=1
        if hashlib.sha256(data).hexdigest()!=expected[path]:
            change('摘要变化',path);inputs.add(kind)
    # Missing governance dependencies may make current reuse unsafe, not alter immutable baseline.
    return {'result':classify_output(changes,blocked),'observed_head':head,'observed_upstream':upstream,
            'changes':changes,'blocked':blocked,'checked_files':checked,
            'affected':propagate(inputs),'risk_level_changes':0,'automatic_retests':0,'writes':0}

def check_manifest(doc, roots):
    if doc.get('schema')!='FL-GOV-002/reference-v1':raise Unsafe('schema')
    b=doc['baseline']
    if b['version']!='BASE-V1.0-20260930' or b['merge_sha']!='1686d504ec2c44f06718d70e6e4b0c6f92452de8':raise Unsafe('anchor')
    names={'fastlink-prime-wallet','fastlik-backend','fastlik-app','fastlik-Admin','fastlik-Website','fastlink-control-plane'}
    if set(doc['repositories'])!=names or set(roots)!=names:raise Unsafe('scope')
    out={}
    for name,ref in doc['repositories'].items():
        if not re.fullmatch(r'[A-Za-z0-9_-]+',name):raise Unsafe('name')
        path=Path(roots[name])
        if not path.is_absolute() or path.is_symlink():raise Unsafe('root')
        # Reject symlink parent components as well as final root.
        if any(p.is_symlink() for p in [path,*path.parents]):raise Unsafe('root_link')
        out[name]=inspect_repo(path,ref)
    result=('发现漂移' if any(v['result']=='发现漂移' for v in out.values())
            else '无法安全检查' if any(v['result']=='无法安全检查' for v in out.values()) else '无漂移')
    return {'result':result,'baseline':{'version':b['version'],'merge_sha':b['merge_sha']},'artifact_status':'PENDING','repositories':out,
            'baseline_mutated':False,'automatic_retests':0,'risk_level_changes':0,
            'mandatory_constraints':[{'id':x,'state':'HISTORY-GAP' if x=='EARLY-HISTORY' else 'PERMANENT-DEVIATION'} for x in REQUIRED]}

def main():
    parser=argparse.ArgumentParser(description='Offline read-only metadata drift observations')
    parser.add_argument('--reference',required=True);parser.add_argument('--roots',required=True)
    args=parser.parse_args()
    try:
        def load(path):
            p=Path(path).absolute()
            return json.loads(read_bytes(p.parent,p.name,cap=2*1024*1024,input_schema=True))
        out=check_manifest(load(args.reference),load(args.roots))
        print(json.dumps(out,ensure_ascii=False,sort_keys=True))
        return 0 if out['result']=='无漂移' else 2
    except Exception:
        # Never output raw exception messages, paths from exceptions, stdout of git, or traceback.
        print(json.dumps({'result':'无法安全检查','reason':'输入或只读校验失败；原始异常不输出','artifact_status':'PENDING'},ensure_ascii=False))
        return 2
if __name__=='__main__':sys.exit(main())

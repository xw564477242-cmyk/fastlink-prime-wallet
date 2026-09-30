"""Local HTTP shell only. Does not validate browser or business integration."""
import os, pathlib, subprocess, sys, http.server, urllib.parse, socket
ROOT=pathlib.Path('/Users/ck/Developer/FastLink');TOOL=ROOT/'.tooling'
PORTS={'fastlink-prime-wallet':46101,'fastlik-app':46102,'fastlik-Admin':46103,'fastlik-Website':46104}

def static_child():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            pieces=urllib.parse.unquote(urllib.parse.urlsplit(self.path).path).split('/')
            if any(p.startswith('.') for p in pieces if p):self.send_error(403);return
            path=pathlib.Path(self.translate_path(self.path))
            if not path.resolve().is_relative_to(pathlib.Path.cwd().resolve()):self.send_error(403);return
            super().do_GET()
        def do_HEAD(self):self.send_error(405)
        def list_directory(self,path):self.send_error(403);return None
        def log_message(self,*args):pass
    http.server.ThreadingHTTPServer(('127.0.0.1',46104),Handler).serve_forever()

def main():
    if len(sys.argv)==2 and sys.argv[1]=='--static-child':static_child();return
    if len(sys.argv)!=2 or sys.argv[1] not in PORTS:print('Select one of: '+', '.join(PORTS));raise SystemExit(2)
    repo=sys.argv[1];port=PORTS[repo];cwd=ROOT/repo
    if not cwd.is_dir() or not (TOOL/'profiles/local-only.sb').is_file():print('Controlled workspace or policy missing');raise SystemExit(2)
    with socket.socket() as s:s.bind(('127.0.0.1',port))
    env={'PATH':'/opt/homebrew/bin:/usr/bin:/bin','TMPDIR':str(TOOL/'tmp'),'NODE_ENV':'development','CI':'true','VITE_FASTLINK_API_URL':'http://127.0.0.1:46199','VITE_FASTLINK_ENVIRONMENT':'SANDBOX','PYTHONDONTWRITEBYTECODE':'1'}
    cmd=['/opt/homebrew/bin/python3',str(TOOL/'start-local.py'),'--static-child'] if repo=='fastlik-Website' else ['/opt/homebrew/bin/node','node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',str(port),'--strictPort','--mode','development']
    child=subprocess.Popen(['/usr/bin/sandbox-exec','-f',str(TOOL/'profiles/local-only.sb'),*cmd],cwd=cwd,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print(f'Local HTTP process requested at 127.0.0.1:{port}; no business/browser validation. Press Ctrl-C to stop.',flush=True)
    try:code=child.wait()
    except KeyboardInterrupt:
        child.terminate()
        try:child.wait(timeout=5)
        except subprocess.TimeoutExpired:child.kill();child.wait()
        code=0
    print('Local process stopped; exit='+str(code));raise SystemExit(code)

if __name__=='__main__':
    try:main()
    except Exception:print('Local startup blocked; details suppressed');raise SystemExit(1)

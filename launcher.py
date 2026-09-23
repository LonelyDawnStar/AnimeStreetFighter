"""Local / temporary Internet launcher. Run with Python 3.10+."""
import os,sys,subprocess,venv,shutil,platform,urllib.request,json,time,socket,threading,queue,re,webbrowser
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def main():
 local='--local' in sys.argv
 env=ROOT/'.venv';python=env/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
 if sys.prefix==sys.base_prefix and '--prepared' not in sys.argv:
  if not python.exists():print('Preparing Python environment...',flush=True);venv.create(env,with_pip=True)
  subprocess.run([str(python),'-m','pip','install','-r',str(ROOT/'requirements.txt')],check=True)
  return subprocess.call([str(python),str(Path(__file__).resolve()),'--prepared']+(['--local'] if local else []))
 cloud=None
 if not local:
  cloud=shutil.which('cloudflared')
  if not cloud:
   if os.name!='nt' or platform.machine().lower() not in ('amd64','x86_64'):
    print('Install cloudflared first: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/');return 1
   target=ROOT/'.tools/cloudflared.exe';target.parent.mkdir(exist_ok=True)
   if not target.exists():
    print('Downloading cloudflared from the official Cloudflare GitHub release...',flush=True)
    url='https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    temp=target.with_suffix('.download')
    try:
     with urllib.request.urlopen(url,timeout=60) as response,open(temp,'wb') as out:shutil.copyfileobj(response,out)
     temp.replace(target)
    finally:
     if temp.exists():temp.unlink()
   cloud=str(target)
 with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
 processes=[]
 try:
  server=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--port',str(port),'--host','0.0.0.0' if local else '127.0.0.1'],cwd=ROOT)
  processes.append(server);base=f'http://127.0.0.1:{port}'
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('Game server failed to start.')
   try:
    with urllib.request.urlopen(base+'/health',timeout=.5) as response:
     if json.load(response).get('status')=='ok':break
   except (OSError,ValueError):pass
   time.sleep(.1)
  else:raise RuntimeError('Game server startup timed out.')
  if local:print('Local URL:',base,flush=True);webbrowser.open(base)
  else:
   print('Opening a temporary public game address. Keep this window open.',flush=True)
   tunnel=subprocess.Popen([cloud,'tunnel','--url',base,'--no-autoupdate'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
   processes.append(tunnel);lines=queue.Queue()
   def reader():
    for line in tunnel.stdout:lines.put(line)
   threading.Thread(target=reader,daemon=True).start()
   until=time.monotonic()+90;found=False;recent=[]
   while time.monotonic()<until:
    if tunnel.poll() is not None:raise RuntimeError('Tunnel failed. '+''.join(recent[-5:]))
    try:line=lines.get(timeout=.5)
    except queue.Empty:continue
    recent.append(line);recent=recent[-10:]
    match=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line)
    if match:
     url=match.group();print('\nGAME URL: '+url+'\nOpen this address, create a room and copy its invite link.\n',flush=True);webbrowser.open(url);found=True;break
   if not found:raise RuntimeError('Could not obtain Internet address. '+''.join(recent[-5:]))
  print('Ctrl+C to stop the server and close the Internet address.',flush=True)
  while all(p.poll() is None for p in processes):time.sleep(.5)
 finally:
  for p in reversed(processes):
   if p.poll() is None:p.terminate()
  for p in processes:
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:p.kill()
 return 0

if __name__=='__main__':
 try:sys.exit(main())
 except KeyboardInterrupt:print('\nStopped.')
 except Exception as e:print('ERROR:',e);sys.exit(1)

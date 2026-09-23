"""WebSocket transport; one process owns all matches."""
import asyncio, contextlib, json, time, logging
from urllib.parse import urlsplit
from aiohttp import web, WSMsgType
import server as game

SOCKETS=web.AppKey('sockets',dict)
TASK=web.AppKey('ticker',asyncio.Task)
LAG=web.AppKey('loop_lag',dict)

class Flow:
 def __init__(self):self.seq=0;self.pending={};self.history={}
 def sent(self,now):
  self.seq+=1;self.pending[self.seq]=now;self.history[self.seq]=now
  self.history={n:t for n,t in self.history.items() if now-t<4}
  return self.seq
 def ack(self,n):
  if type(n) is int and n in self.history:
   self.pending={k:v for k,v in self.pending.items() if k>n}
 def fresh(self,n,now):
  return type(n) is int and n in self.history and 0<=now-self.history[n]<=1.5
 def blocked(self):return len(self.pending)>=4
 def expired(self,now):return bool(self.pending) and now-min(self.pending.values())>3


def invoke(action,data):
 if not isinstance(data,dict):raise ValueError('잘못된 요청입니다.')
 h=object.__new__(game.Handler);h.path='/api/'+action
 with game.LOCK:return h.api(data)

@web.middleware
async def headers(request,handler):
 origin=request.headers.get('Origin')
 if origin and urlsplit(origin).netloc != request.host:
  return web.json_response({'error':'다른 사이트에서 보낸 요청입니다.'},status=403)
 try:response=await handler(request)
 except (ValueError,KeyError,TypeError) as e:
  response=web.json_response({'error':str(e)},status=400)
 response.headers['Cache-Control']='no-store'
 response.headers['X-Content-Type-Options']='nosniff'
 return response

async def http_api(request):
 action=request.match_info['action']
 if action not in ('create','join','resume','leave','rooms','settings','pick','catalog'):raise web.HTTPNotFound()
 data=await request.json()
 result=invoke(action,data)
 return web.json_response(result)

STATIC_FILES={'/gojo-art.js':'gojo-art.js','/':'index.html',**{'/'+name:name for name in (
 'app.js','style.css','graphics.js','motions.html','motions.js','royal.css',
 'royal.js','mobile.css','mobile.js','match.css','match.js','gil-cinema.js','lancer-cinema.js','emiya-cinema.js','cinematic.js','rider-cinema.js','result.js','original-cinema.js','ultimate.html')}}

async def static(request):
 name=STATIC_FILES.get(request.path)
 if not name:raise web.HTTPNotFound()
 return web.FileResponse(game.ROOT/name,headers={'Cache-Control':'no-cache'})

async def catalog(request):return web.json_response(game.character_catalog())

async def rooms(request):
 with game.LOCK:return web.json_response(game.public_rooms())

async def health(request):return web.json_response({'status':'ok','version':'0.38','loopLagMs':request.app[LAG]['ms']})

async def websocket(request):
 ws=web.WebSocketResponse(heartbeat=10,max_msg_size=4096)
 await ws.prepare(request)
 token=None;sender=None
 try:
  first=await asyncio.wait_for(ws.receive(),5)
  if first.type!=WSMsgType.TEXT:raise ValueError('인증 메시지가 필요합니다.')
  data=json.loads(first.data)
  if not isinstance(data,dict) or data.get('type')!='auth':raise ValueError('인증 메시지가 필요합니다.')
  auth={'code':str(data.get('code','')),'token':str(data.get('token',''))}
  initial=invoke('resume',auth);token=auth['token'];bounded=data.get('protocol')==2;flow=Flow()
  old=request.app[SOCKETS].get(token)
  request.app[SOCKETS][token]=ws
  if old is not None and old is not ws:
   with contextlib.suppress(asyncio.TimeoutError):await asyncio.wait_for(old.close(code=4001,message=b'Session opened elsewhere'),.5)
  def clear_input():
   r=game.ROOMS.get(auth['code'])
   if r:
    for p in r['players']:
     if p['token']==token:p.update(keys=[],queued=[],prev=[])
  async def send_state(state):
   msg={'type':'state','state':state,'loopLagMs':request.app[LAG]['ms']}
   if bounded:msg['seq']=flow.sent(time.monotonic())
   await asyncio.wait_for(ws.send_str(json.dumps(msg,separators=(',',':'),ensure_ascii=False)),1)
  clear_input()
  await send_state(initial)
  async def broadcast():
   while not ws.closed:
    r=game.ROOMS.get(auth['code'])
    if r is None:
     await ws.send_json({'type':'fatal','message':'방이 만료되었습니다.'});await ws.close();return
    if bounded and flow.expired(time.monotonic()):
     clear_input();await ws.close(code=4002,message=b'State acknowledgement timed out');return
    if not bounded or not flow.blocked():await send_state(game.snapshot(r))
    await asyncio.sleep(1/20)
  sender=asyncio.create_task(broadcast())
  def failed(task):
   if not task.cancelled() and task.exception():asyncio.create_task(ws.close())
  sender.add_done_callback(failed)
  window=time.monotonic();count=0
  async for msg in ws:
   if msg.type!=WSMsgType.TEXT:continue
   if request.app[SOCKETS].get(token) is not ws:break
   now=time.monotonic()
   if now-window>1:window=now;count=0
   count+=1
   if count>180:raise ValueError('입력 요청이 너무 많습니다.')
   d=json.loads(msg.data)
   if not isinstance(d,dict):raise ValueError('잘못된 메시지입니다.')
   kind=d.get('type')
   if kind=='ack':
    if bounded:flow.ack(d.get('seq'))
   elif kind=='input':
    if bounded and not flow.fresh(d.get('seq'),now):
     clear_input();continue
    invoke('input',{**auth,'keys':d.get('keys',[])})
   elif kind=='ready':invoke('ready',auth)
   elif kind in ('settings','pick','rematch','augment'):
    try:invoke(kind,{**auth,**({'settings':d.get('settings')} if kind=='settings' else {'char':d.get('char')} if kind=='pick' else {'id':d.get('id')} if kind=='augment' else {})})
    except ValueError as e:await ws.send_json({'type':'notice','message':str(e)})
   elif kind=='ping':await ws.send_json({'type':'pong','stamp':d.get('stamp')})
   else:raise ValueError('알 수 없는 메시지입니다.')
 except (ValueError,KeyError,TypeError,asyncio.TimeoutError) as e:
  if not ws.closed:await ws.send_json({'type':'fatal','message':str(e) or '접속 시간이 초과되었습니다.'})
 finally:
  if sender:
   sender.cancel()
   with contextlib.suppress(asyncio.CancelledError,Exception):await sender
  if token and request.app[SOCKETS].get(token) is ws:request.app[SOCKETS].pop(token,None)
  await ws.close()
 return ws

async def ticker(app):
 prev=time.monotonic();last_log=0
 while True:
  now=time.monotonic();gap=now-prev;dt=min(.04,gap);prev=now
  lag=max(0,round((gap-1/60)*1000));recent=app[LAG]
  if lag>=recent['ms'] or now-recent['at']>5:recent.update(ms=lag,at=now)
  if gap>.5 and now-last_log>5:
   logging.warning('Game event loop stalled for %.0f ms; active rooms=%d',gap*1000,len(game.ROOMS));last_log=now
  for code,r in list(game.ROOMS.items()):
   if now-r['active']>900:del game.ROOMS[code]
   else:game.tick(r,dt,now)
  await asyncio.sleep(1/60)

async def start(app):app[TASK]=asyncio.create_task(ticker(app))
async def stop(app):
 app[TASK].cancel()
 with contextlib.suppress(asyncio.CancelledError):await app[TASK]
 await asyncio.gather(*(s.close() for s in list(app[SOCKETS].values())))

def make_app():
 app=web.Application(client_max_size=4096,middlewares=[headers]);app[SOCKETS]={};app[LAG]={'ms':0,'at':time.monotonic()}
 app.router.add_get('/api/catalog',catalog);app.router.add_get('/api/rooms',rooms);app.router.add_get('/ws',websocket);app.router.add_get('/health',health)
 app.router.add_post('/api/{action}',http_api)
 app.router.add_static('/assets/',game.ROOT/'assets',show_index=False)
 for path in STATIC_FILES:app.router.add_get(path,static)
 app.on_startup.append(start);app.on_shutdown.append(stop)
 return app



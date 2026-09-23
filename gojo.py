"""Gojo combat adaptation: server-owned timing, aim lock and dodge window."""
import math

def release(r,scene):
 i=scene['owner'];p=r['players'][i];domain=scene.get('variant')=='void'
 r['gojoCast']=dict(owner=i,elapsed=0.0,domain=domain,aim=None,fireAt=2.2 if domain else 1.0)
 if domain:r['domain']=dict(owner=i,elapsed=0.0,duration=4.3)
 p.update(action='void' if domain else 'purple_charge',anim=2.35 if domain else 1.15,animMax=2.35 if domain else 1.15,cool=2.35 if domain else 1.15,y=0,vy=0,moving=False)
 r['shots']=[] # Time-stop transition clears old projectiles for both sides.
 r.pop('cinematic',None)

def advance(r,dt):
 d=r.get('domain')
 if d:
  d['elapsed']+=dt
  if d['elapsed']>=d['duration']:r.pop('domain',None)
 cast=r.get('gojoCast')
 if not cast:return set()
 old=cast['elapsed'];cast['elapsed']+=dt;t=cast['elapsed'];i=cast['owner'];p=r['players'][i];b=r['players'][1-i]
 lock_at=1.35 if cast['domain'] else .25
 if cast['aim'] is None and t>=lock_at:
  dx=b['x']-p['x'];dy=b['y']+120-145;length=max(1,math.hypot(dx,dy))
  cast['aim']=[dx/length,dy/length];p['face']=1 if dx>=0 else -1
 if old<cast['fireAt']<=t:
  vx,vy=cast['aim'];r['shots'].append(dict(kind='purple',owner=i,x=p['x'],y=145,v=vx*1050,vy=vy*1050,face=p['face'],radius=48,life=1.6,delay=0,damage=36,elapsed=0))
  p.update(action='np_release',anim=.35,animMax=.35)
 if t>=cast['fireAt']+.15:r.pop('gojoCast',None)
 locked={i}
 if cast['domain'] and old<1.5:locked.add(1-i)
 for j in locked:
  q=r['players'][j];q.update(keys=[],prev=[],queued=[],moving=False)
 return locked

def shot(r,s,dt,hit):
 a=r['players'][s['owner']];b=r['players'][1-s['owner']]
 if s['kind']=='red' and s['delay']>0 and a['stun']>0:return False
 flight=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
 if flight<=0:return True
 x,y=s['x'],s['y'];s['x']+=s['v']*flight;s['y']+=s.get('vy',0)*flight;s['life']-=flight;s['elapsed']+=flight
 dx=s['x']-x;dy=s['y']-y;den=dx*dx+dy*dy
 u=max(0,min(1,((b['x']-x)*dx+(b['y']+120-y)*dy)/den)) if den else 0
 if abs(b['x']-(x+dx*u))<s['radius']+27 and abs(b['y']+120-(y+dy*u))<s['radius']+45:
  purple=s['kind']=='purple'
  old_face=a['face'];a['face']=s['face']
  connected=hit(r,a,b,s['damage'],150 if purple else 85,ultimate=purple,skill=not purple,fixed=purple,dodgeable=purple)
  a['face']=old_face
  if connected:return False
 return s['life']>0 and -200<s['x']<1480 and -250<s['y']<1000

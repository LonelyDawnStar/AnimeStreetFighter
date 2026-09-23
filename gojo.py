"""Gojo combat adaptation: server-owned timing, aim lock and dodge window."""
import math

def release(r,scene):
 i=scene['owner'];p=r['players'][i];b=r['players'][1-i]
 dx=b['x']-p['x'];dy=b['y']+120-145;length=max(1,math.hypot(dx,dy))
 p['face']=1 if dx>=0 else -1
 r['gojoCast']=dict(owner=i,elapsed=0.0,aim=[dx/length,dy/length],fireAt=.6)
 r.pop('domain',None)
 p.update(action='purple_charge',anim=.85,animMax=.85,cool=.85,y=0,vy=0,moving=False)
 r['shots']=[]
 r.pop('cinematic',None)

def advance(r,dt):
 cast=r.get('gojoCast')
 if not cast:return set()
 old=cast['elapsed'];cast['elapsed']+=dt;t=cast['elapsed'];i=cast['owner'];p=r['players'][i]
 if old<cast['fireAt']<=t:
  vx,vy=cast['aim'];r['shots'].append(dict(kind='purple',owner=i,x=p['x'],y=145,v=vx*1050,vy=vy*1050,face=p['face'],radius=48,life=1.6,delay=0,damage=36,elapsed=0))
  p.update(action='np_release',anim=.25,animMax=.25)
 if t>=.85:r.pop('gojoCast',None)
 p.update(keys=[],prev=[],queued=[],moving=False)
 return {i}

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


"""All Might: timed, server-authoritative punch pressure; no guaranteed hit."""
def cast(r,i,ultimate=False,rate=1):
 p=r['players'][i];kind='united_smash' if ultimate else 'detroit'
 duration=1.15 if ultimate else 1/rate
 p.update(action=kind,anim=duration,animMax=duration,cool=duration,moving=False)
 r['shots'].append(dict(kind=kind,owner=i,x=p['x'],y=p['y']+120,v=0,face=p['face'],delay=.5 if ultimate else .42/rate,life=.28,elapsed=0,damage=38 if ultimate else 22,reach=340 if ultimate else 260,hit=False))
def release(r,scene):
 cast(r,scene['owner'],True);r.pop('cinematic',None)
def shot(r,s,dt,hit):
 a,b=r['players'][s['owner']],r['players'][1-s['owner']]
 if s['delay']>0 and a['stun']>0:
  a.update(action='idle',anim=0);return False
 active=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
 if not active:return True
 s['elapsed']+=active;s['life']-=active
 if not s['hit']:
  s['hit']=True
  distance=(b['x']-s['x'])*s['face']
  if -20<=distance<=s['reach'] and abs(b['y']+120-s['y'])<110:
   ultimate=s['kind']=='united_smash'
   hit(r,a,b,s['damage'],120 if ultimate else 65,ultimate=ultimate,skill=not ultimate,dodgeable=ultimate)
 return s['life']>0

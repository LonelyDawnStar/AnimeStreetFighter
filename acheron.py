"""Acheron: three empowered basic attacks, then a conditional finisher."""
import augments as aug

def active(p):return p.get('rainCharges',0)>0 or p.get('rainFinishing',False)
def reset(p):p.update(rainCharges=0,rainHits=0,rainStep=0,rainFinishing=False)
def release(r,scene):
 if scene.get('variant')=='stygian':
  r.pop('cinematic',None);finish(r,scene['owner']);return
 p=r['players'][scene['owner']]
 p.update(rainCharges=3,rainHits=0,rainStep=0,rainFinishing=False,action='acheron_awaken',anim=.5,animMax=.5,cool=.5,moving=False)
 r.pop('cinematic',None)

def basic(r,i,heavy,reach,hit):
 p=r['players'][i];enemy=r['players'][1-i]
 if p['char']!='acheron' or p.get('rainCharges',0)<=0:return False
 p['rainCharges']-=1;p['rainStep']+=1;p['action']='rainblade';p['moving']=False
 distance=(enemy['x']-p['x'])*p['face'];damage=(20*(1+aug.value(p,'heavyDamage')) if heavy else 14)
 r['fx'].append(dict(kind='rainblade',x=p['x'],y=p['y']+120,face=p['face'],step=p['rainStep'],life=.45,color='#ff426b'))
 if -27<=distance<reach+85 and abs(enemy['y']-p['y'])<105:
  guard='guard' in enemy['keys'] and enemy['y']==0 and enemy['stun']<=0 and enemy['cool']<=0 and enemy['mana']>=max(1,6-aug.value(enemy,'guardCost'))
  connected=hit(r,p,enemy,damage,30,ultimate=True,dodgeable=True)
  if connected and not guard:p['rainHits']+=1
 if p['rainCharges']==0 and p['rainHits']==3 and enemy['hp']>0:
  p.update(rainFinishing=True,moving=False)
  if r.get('settings',{}).get('skipCinema',False):finish(r,i)
  else:
   p.update(action='acheron_finish',anim=2.6,animMax=2.6,cool=2.6)
   r['cinematic']=dict(owner=i,char='acheron',variant='stygian',face=p['face'],elapsed=0,titleDuration=0,duration=2.6,playbackRate=1)

 return True

def finish(r,i):
 p=r['players'][i]
 p.update(rainFinishing=True,action='acheron_finish',cool=.75,anim=.75,animMax=.75,moving=False)
 if not any(s['kind']=='stygian' and s['owner']==i for s in r['shots']):
  r['shots'].append(dict(kind='stygian',owner=i,x=p['x'],y=p['y']+120,face=p['face'],v=0,delay=.32,life=.42,elapsed=0,hit=False,damage=18,reach=620,radius=85))

def skill(r,i,rate):
 p=r['players'][i];p.update(action='octobolt',anim=.85/rate,animMax=.85/rate,moving=False)
 r['shots'].append(dict(kind='octobolt',owner=i,x=p['x'],y=p['y']+120,face=p['face'],v=0,delay=.28/rate,life=.25,elapsed=0,hit=False,damage=18,reach=290,radius=75))

def shot(r,s,dt,hit):
 p=r['players'][s['owner']];enemy=r['players'][1-s['owner']];finish=s['kind']=='stygian'
 if not finish and s['delay']>0 and p['stun']>0:return False
 active_dt=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
 if active_dt<=0:return True
 if not s['hit']:
  s['hit']=True;d=(enemy['x']-s['x'])*s['face'];old=p['face'];p['face']=s['face']
  if -27<=d<=s['reach'] and abs(enemy['y']+120-s['y'])<s['radius']:
   hit(r,p,enemy,s['damage'],95 if finish else 45,ultimate=finish,skill=not finish,dodgeable=finish)
  p['face']=old
 s['elapsed']+=active_dt;s['life']-=active_dt
 if finish and s['life']<=0:p['rainFinishing']=False
 return s['life']>0

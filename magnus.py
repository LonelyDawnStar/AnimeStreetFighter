"""Magnus: 17 vs 1 and Bike From Hell adapted for a 1v1 arena."""
def skill(r,i,rate):
 p=r['players'][i];duration=1.65/rate
 p.update(action='magnus_spin',anim=duration,animMax=duration,cool=duration,moving=False)
 r['shots'].append(dict(kind='magnus_spin',owner=i,x=p['x'],y=p['y']+115,v=0,face=p['face'],delay=.15/rate,life=1.5/rate,elapsed=0,rate=rate,ticks=0,damage=4))

def release(r,scene):
 i=scene['owner'];p=r['players'][i]
 p.update(action='magnus_bike',anim=2.65,animMax=2.65,cool=2.65,y=0,vy=0,moving=False)
 r['shots'].append(dict(kind='magnus_bike',owner=i,x=p['x'],y=95,v=0,face=scene['face'],delay=.35,life=2.3,elapsed=0,damage=36,rider=True))
 r.pop('cinematic',None)

def dismount(p,s):
 if s['rider']:
  s['rider']=False;p.update(action='magnus_exit',anim=.5,animMax=.5,cool=.5,moving=False)

def control(r,i,pressed,keys,dt):
 p=r['players'][i]
 for s in r['shots']:
  if s['owner']!=i:continue
  if s['kind']=='magnus_bike' and s['rider']:
   if 'np' in pressed and s['delay']<=0:
    dismount(p,s);s['v']=s['face']*1050;s['life']=min(s['life'],.85)
   return True
  if s['kind']=='magnus_spin':
   if p['stun']<=0:
    move=('right' in keys)-('left' in keys);p['x']=max(55,min(1225,p['x']+move*135*dt));p['moving']=False
   return True
 return False

def shot(r,s,dt,hit):
 a,b=r['players'][s['owner']],r['players'][1-s['owner']]
 if s['kind']=='magnus_spin':
  if a['stun']>0:
   a.update(action='idle',anim=0);return False
  active=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
  if not active:return True
  s.update(x=a['x'],y=a['y']+115);s['elapsed']+=active*s['rate'];s['life']-=active
  due=min(6,int((s['elapsed']+1e-8)/.25))
  while s['ticks']<due:
   s['ticks']+=1
   if abs(b['x']-a['x'])<=165 and abs(b['y']-a['y'])<105:
    face=a['face'];a['face']=1 if b['x']>=a['x'] else -1
    hit(r,a,b,s['damage'],4,skill=True);a['face']=face
    b['stun']=min(b['stun'],.08)
  return s['ticks']<6 and s['life']>1e-8
 if s['rider'] and a['stun']>0:
  dismount(a,s);s['life']=min(s['life'],.65);s['v']=s['face']*1050
 active=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
 if not active:return True
 old=s['x'];s['elapsed']+=active;s['life']-=active
 s['v']=s['face']*(min(820,300+520*s['elapsed']/.85) if s['rider'] else 1050)
 s['x']+=s['v']*active
 if s['rider']:a.update(x=max(55,min(1225,s['x'])),y=0,vy=0,action='magnus_bike')
 front=s['x']+s['face']*115;oldfront=old+(s['face']*115 if s['elapsed']>active+1e-9 else 0)
 contact=min(oldfront,front)-40<=b['x']<=max(oldfront,front)+40 and abs(b['y']+120-s['y'])<110
 wall=front<=55 or front>=1225
 if contact or wall or s['life']<=0:
  s['x']=max(55,min(1225,front));dismount(a,s)
  if abs(b['x']-s['x'])<=145 and abs(b['y']+120-s['y'])<135:
   face=a['face'];a['face']=s['face'];hit(r,a,b,s['damage'],105,ultimate=True,dodgeable=True);a['face']=face
  r['fx'].append(dict(kind='magnus_blast',x=s['x'],y=s['y'],life=.48,color='#ffc782'))
  return False
 return True

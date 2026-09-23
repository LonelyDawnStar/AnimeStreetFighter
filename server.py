"""Grail Duel online. Python 3.10+ and aiohttp."""
import json, math, os, random, secrets, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent / 'static'
LOCK = threading.RLock()
ROOMS = {}
CHARS = {
 'saber': dict(name='알트리아',color='#79c9ff',speed=270,reach=120,damage=10,np='EXCALIBUR'),
 'archer': dict(name='에미야',color='#ff7878',speed=290,reach=112,damage=9,np='UNLIMITED BLADE WORKS'),
 'lancer': dict(name='쿠 훌린',color='#65ede1',speed=295,reach=138,damage=8,np='GAE BOLG'),
 'gil': dict(name='길가메시',color='#ffd477',speed=240,reach=95,damage=8,np='ENUMA ELISH'),
 'iskandar':dict(name='이스칸다르',color='#e6aa62',speed=245,reach=125,damage=11,np='IONIOI HETAIROI'),
 'medusa':dict(name='메두사',color='#bf99ec',speed=310,reach=118,damage=8,np='BELLEROPHON')}
KEYS={'left','right','jump','guard','light','heavy','skill','dash','np','seal'}
TREASURY=('longsword','spear','axe','greatsword','halberd','sickle')
NP_TITLE_DURATION=1.0
NP_MAX_DURATION=9.0
NP_SOURCE_DURATION={'saber':460/60,'archer':460/60,'lancer':120/30,'gil':510/30,'iskandar':7.5,'medusa':7.0}
NP_DURATION={char:min(seconds,NP_MAX_DURATION-NP_TITLE_DURATION) for char,seconds in NP_SOURCE_DURATION.items()}
COMBAT = {
 'saber': dict(light=.24,heavy=.48,skill_cool=.65,skill_cost=28,skill_damage=15,np_damage=34),
 'archer': dict(light=.24,heavy=.46,skill_cool=1.15,skill_cost=24,skill_damage=28,np_damage=32),
 'lancer': dict(light=.30,heavy=.58,skill_cool=.75,skill_cost=32,skill_damage=11,np_damage=32),
 'gil': dict(light=.27,heavy=.52,skill_cool=.65,skill_cost=28,skill_damage=6,np_damage=32),
 'iskandar':dict(light=.32,heavy=.60,skill_cool=.95,skill_cost=30,skill_damage=22,np_damage=34),
 'medusa':dict(light=.25,heavy=.48,skill_cool=.65,skill_cost=24,skill_damage=14,np_damage=32),
}

AI_LEVELS={
 'beginner':dict(name='초급',reaction=.65,accuracy=.45,defense=.12,spacing=False,heal=False),
 'intermediate':dict(name='중급',reaction=.30,accuracy=.72,defense=.45,spacing=True,heal=False),
 'advanced':dict(name='고급',reaction=.13,accuracy=.90,defense=.78,spacing=True,heal=True),
 'impossible':dict(name='불가능',reaction=.04,accuracy=1.0,defense=1.0,spacing=True,heal=True),
}

def bot_input(r,p,enemy,dt,rng=None):
 # Visible actions/projectiles only; no reading the opponent's queued input.
 rng=rng or random
 cfg=AI_LEVELS.get(r.get('aiLevel'),AI_LEVELS['intermediate'])
 memory=p.setdefault('_ai',dict(wait=cfg['reaction'],hold=[]))
 memory['wait']-=dt
 if memory['wait']>0:return list(memory['hold'])
 memory['wait']=cfg['reaction']
 dist=abs(enemy['x']-p['x']);toward='right' if enemy['x']>=p['x'] else 'left';away='left' if toward=='right' else 'right'
 ch=CHARS[p['char']];combat=COMBAT[p['char']];ground=abs(enemy['y']-p['y'])<85
 keys=[]
 if p['stun']>0 or p['cool']>.015:
  memory['hold']=[];return []
 ultimate=False;danger=False
 for shot in r['shots']:
  if r['players'][shot['owner']] is p:continue
  ult=shot['kind'] in ('np','ea_beam','greatslash','army_charge','pegasus_charge')
  if shot['kind'] in ('ea_beam','greatslash'):
   approaching=(p['x']-shot['x'])*shot.get('face',1)>=-30
  else:approaching=(p['x']-shot['x'])*shot.get('v',0)>=0 and abs(p['x']-shot['x'])<160+abs(shot.get('v',0))*(cfg['reaction']+.12)
  if approaching and abs(shot.get('y',120)-(p['y']+120))<180:danger=True;ultimate|=ult
 danger|=enemy['action'] in ('light','heavy','royal_charge') and dist<CHARS[enemy['char']]['reach']+65
 if cfg['heal'] and p['seals']>0 and p['hp']<p.get('maxHp',100)*.32:
  keys=['seal']
 elif danger and rng.random()<cfg['defense']:
  # Dodge does not block an ultimate; guard or a remaining command seal does.
  if ultimate and cfg['heal'] and p['seals']>0 and p['hp']<p.get('maxHp',100)*.55:keys=['seal']
  elif p['mana']>=6 and p['y']==0:keys=['guard']
  elif not ultimate and p['mana']>=18:keys=[away,'dash']
 elif p['np']>=100 and dist<850 and ground and rng.random()<cfg['accuracy']:
  keys=['np']
 elif dist<ch['reach']-8 and ground and rng.random()<cfg['accuracy']:
  keys=['heavy' if p['mana']>=24 and enemy['action']=='guard' else 'light']
 else:
  can_skill=p['mana']>=combat['skill_cost']+5 and ground
  skill_range=320 if p['char']=='iskandar' else 510 if p['char']=='medusa' else 800
  if can_skill and 130<dist<skill_range and rng.random()<cfg['accuracy']:
   keys=['skill']
  else:
   preferred=({'archer':310,'gil':350,'medusa':220}.get(p['char'],ch['reach']*.72) if cfg['spacing'] and can_skill else ch['reach']*.72)
   if dist>preferred+18:keys=[toward]
   elif cfg['spacing'] and dist<preferred-35 and dist>ch['reach'] and 90<p['x']<1190:keys=[away]
   if cfg['spacing'] and dist>600 and p['mana']>=65:keys=[toward,'dash']
 # Queue a fresh action edge even if the same move was chosen last decision.
 p['queued']=list(set(p['queued'])|{k for k in keys if k not in ('left','right','guard')})
 memory['hold']=[k for k in keys if k in ('left','right','guard')]
 return keys

DEFAULT_SETTINGS=dict(skipCinema=False,bestOf=3,hp=100,attack=1.0,attackSpeed=1.0)
def settings(r):return {**DEFAULT_SETTINGS,**r.get('settings',{})}
def validate_settings(data):
 if not isinstance(data,dict) or set(data)-set(DEFAULT_SETTINGS):raise ValueError('잘못된 방 설정입니다.')
 result={**DEFAULT_SETTINGS,**data}
 if type(result['skipCinema']) is not bool or type(result['bestOf']) is not int or result['bestOf'] not in (1,3,5):raise ValueError('경기 형식을 확인하세요.')
 for key,low,high in [('hp',50,500),('attack',.5,2),('attackSpeed',.5,2)]:
  v=result[key]
  if type(v) not in (int,float) or not math.isfinite(v) or not low<=v<=high:raise ValueError('능력치 설정 범위를 확인하세요.')
 if int(result['hp'])!=result['hp']:raise ValueError('체력은 정수로 입력하세요.')
 return result

def character_catalog():
 return {'characters':{k:{**v,**COMBAT[k], 'hp':100,'mana':100,'manaRegen':11,'heavyDamage':v['damage']*1.7,'heavyCost':12,'heavyReach':v['reach']+30,'skillWindup':{'saber':.24,'archer':.9,'lancer':.3,'gil':0,'iskandar':.32,'medusa':.25}[k],'skillVelocity':{'saber':820,'archer':1150,'lancer':1000,'gil':670,'iskandar':560,'medusa':950}[k],'skillHits':3 if k=='gil' else 1,'npHits':12 if k=='gil' else 1,'npDuration':NP_TITLE_DURATION+NP_DURATION[k],'dashCost':18,'dashDistance':145,'dashInv':.17,'dashCooldown':.25,'guardReduction':82,'guardCost':6,'sealCount':3,'sealHeal':28} for k,v in CHARS.items()}}

def begin_draft(r):
 first=secrets.randbelow(2)
 r.update(phase='coin',delay=3.0,draft=dict(order=[first,1-first],turn=0,picks=[None,None],remaining=20.0),shots=[],fx=[],banner='선픽 결정 중')
 for p in r['players']:p.update(keys=[],queued=[],prev=[],action='idle',anim=0)

def lock_pick(r,slot,char):
 d=r.get('draft',{})
 if r.get('paused') or r['phase']!='draft' or d['order'][d['turn']]!=slot:raise ValueError('현재 선택 차례가 아닙니다.')
 if char not in CHARS or char in d['picks']:raise ValueError('선택할 수 없는 캐릭터입니다.')
 d['picks'][slot]=char;r['players'][slot]['char']=char
 if d['turn']==0:d.update(turn=1,remaining=20.0)
 else:setup(r)

def player(char, bot=False):
 return dict(token=secrets.token_urlsafe(24),char=char,bot=bot,ready=bot,last=time.monotonic(),keys=[],prev=[],queued=[],x=0,y=0,vy=0,hp=100,maxHp=100,attackSpeed=1.0,mana=100,np=0,seals=3,cool=0,stun=0,inv=0,dashInv=0,action='idle',anim=0,animMax=0,moving=False,face=1)

def setup(r):
 r.pop('cinematic',None)
 rule=settings(r)
 for i,p in enumerate(r['players']):
  p.pop('_ai',None)
  p.update(x=340+i*600,y=0,vy=0,hp=rule['hp'],maxHp=rule['hp'],attackSpeed=rule['attackSpeed'],mana=100,np=0,cool=0,stun=0,inv=0,dashInv=0,action='idle',anim=0,animMax=0,moving=False,keys=[],prev=[],queued=[],face=1 if i==0 else -1)
 r.update(phase='countdown',delay=2.5,clock=90,shots=[],fx=[],banner='ROUND '+str(r['round']))
 if r.get('training'):
  for p in r['players']:p.update(np=100,mana=100)

def snapshot(r):
 return {k:v for k,v in r.items() if k!='players'} | {'players':[{k:v for k,v in p.items() if k not in ('token','keys','prev','queued','last','_ai')} for p in r['players']]}

def public_rooms():
 now=time.monotonic();rooms=[]
 for r in ROOMS.values():
  ps=r['players']
  if r.get('closed') or r.get('training') or any(p['bot'] for p in ps) or now-r['active']>30:continue
  joinable=len(ps)<2 and r['phase']=='waiting'
  rooms.append(dict(code=r['code'],host=ps[0]['char'],players=len(ps),capacity=2,phase=r['phase'],joinable=joinable))
 return {'rooms':sorted(rooms,key=lambda r:(not r['joinable'],r['code']))}

def hit(r,a,b,damage,knock=35,ultimate=False):
 if b['inv']>0 or (b.get('dashInv',0)>0 and not ultimate):return False
 blocked='guard' in b['keys'] and b['y']==0 and b['stun']<=0 and b['cool']<=0 and b['mana']>=6
 if blocked:b['mana']-=6
 damage*=settings(r)['attack']
 actual=damage*(.18 if blocked else 1)
 if b.get('dummy'):b['damageTaken']=round(b.get('damageTaken',0)+actual,2);b['lastDamage']=round(actual,2)
 else:b['hp']=max(0,b['hp']-actual)
 b['stun']=.08 if blocked else .21
 if not b.get('dummy'):b['x']=max(55,min(1225,b['x']+a['face']*knock))
 a['np']=min(100,a['np']+damage*.65);b['np']=min(100,b['np']+damage*.5)
 r['fx'].append(dict(x=b['x'],y=b['y']+120,life=.25,color='#ffffff' if blocked else CHARS[a['char']]['color']))
 return True

def release_np(r,scene):
 ps=r['players']
 p=ps[scene['owner']];ch=CHARS[p['char']]
 p.update(action='np_release',anim=1.1,animMax=1.1,cool=1.1)
 if p['char']=='saber':
  p.update(y=0,vy=0,face=scene['face'],anim=1.4,animMax=1.4,cool=1.4)
  r['shots'].append(dict(x=p['x'],y=0,v=0,face=scene['face'],owner=scene['owner'],damage=COMBAT['saber']['np_damage'],life=1.4,radius=0,kind='greatslash',delay=.48,elapsed=0,hit=False,reach=780))
 elif p['char'] in ('iskandar','medusa'):
  p.update(y=0,vy=0,face=scene['face'],anim=1.65,animMax=1.65,cool=1.65)
  r['shots'].append(dict(x=p['x'],y=120,v=scene['face']*900,face=scene['face'],owner=scene['owner'],damage=COMBAT[p['char']]['np_damage'],life=1.3,radius=85,kind='army_charge' if p['char']=='iskandar' else 'pegasus_charge',delay=.35,elapsed=0,hit=False))
 elif p['char']=='gil':
  p.update(action='np_release',anim=3.0,animMax=3.0,cool=3.0,y=0,vy=0,face=scene['face'])
  r['shots'].append(dict(x=p['x']+scene['face']*115,y=155,v=0,face=scene['face'],owner=scene['owner'],damage=COMBAT['gil']['np_damage']/12,life=2.4,radius=52,color=ch['color'],kind='ea_beam',delay=.35,elapsed=0,ticks=0))
 else:
  r['shots'].append(dict(x=p['x'],y=120+p['y'],v=scene['face']*1000,owner=scene['owner'],damage=COMBAT[p['char']]['np_damage'],life=1.4,radius=75,color=ch['color'],kind='np',delay=.35))
 r.pop('cinematic',None)

def tick(r,dt,now):
 ps=r['players']
 for p in ps:
  p['moving']=False
  if p['action']=='run':p['action']='idle'
 if len(ps)<2:return
 stale=[p for p in ps if not p['bot'] and now-p['last']>1.5]
 r['paused']=bool(stale) and r['phase'] not in ('ended','waiting')
 r['reconnectLeft']=max(0,round(30-max((now-p['last'] for p in stale),default=0)))
 if stale and any(now-p['last']>30 for p in stale) and not r.get('closed'):
  r.update(phase='ended',banner='재접속 대기 시간이 끝났습니다',winner=None,closed=True,paused=False);return
 if r['paused']:
  for p in ps:p.update(keys=[],queued=[],prev=[])
  return
 if r['phase']=='coin':
  r['delay']=max(0,r['delay']-dt)
  if r['delay']==0:r.update(phase='draft',banner='서번트 선택')
  return
 if r['phase']=='draft':
  d=r['draft'];d['remaining']=max(0,d['remaining']-dt);slot=d['order'][d['turn']]
  if ps[slot]['bot'] or d['remaining']==0:
   available=[k for k in CHARS if k not in d['picks']];preferred=ps[slot]['char']
   lock_pick(r,slot,preferred if preferred in available else available[0])
  return
 if r['phase'] in ('countdown','between'):
  r['delay']-=dt
  if r['delay']<=0:
   if r['phase']=='between':r['round']+=1;setup(r)
   else:r.update(phase='fight',banner='FIGHT')
  return
 if r['phase']!='fight':return
 if r.get('cinematic'):
  scene=r['cinematic'];scene['elapsed']=min(scene['duration'],scene['elapsed']+dt)
  for p in ps:p.update(queued=[],prev=list(p['keys']))
  if scene['elapsed']>=scene['duration']:
   release_np(r,scene)
  return
 if not r.get('training'):r['clock']=max(0,r['clock']-dt)
 r['fx']=[dict(f,life=f['life']-dt) for f in r['fx'] if f['life']>dt]
 for i,p in enumerate(ps):
  enemy=ps[1-i];ch=CHARS[p['char']];combat=dict(COMBAT[p['char']]);rate=settings(r)['attackSpeed']
  for key in ('light','heavy','skill_cool'):combat[key]/=rate
  if p.get('dummy'):
   p.update(keys=[],queued=[],prev=[],stun=max(0,p['stun']-dt),action='idle',anim=0,moving=False)
   continue
  if r.get('training'):p.update(np=100,mana=100)
  if p['bot']:p['keys']=bot_input(r,p,enemy,dt)
  elif now-p['last']>.4:p['keys']=[]
  ks=set(p['keys']);pressed=(ks-set(p['prev']))|set(p['queued']);p['queued']=[];p['prev']=list(ks)
  beam=next((s for s in r['shots'] if s['owner']==i and (s['kind'] in ('ea_beam','greatslash','army_charge','pegasus_charge','royal_charge') or (s['kind'] in ('caladbolg','strike_air','spear_throw','chain_throw') and s['delay']>0))),None)
  p['face']=beam['face'] if beam else (1 if enemy['x']>=p['x'] else -1)
  for k in ('cool','stun','inv','dashInv','anim'):p[k]=max(0,p.get(k,0)-dt)
  p['mana']=min(100,p['mana']+dt*11)
  if p['anim']==0:p['action']='guard' if 'guard' in ks else 'idle'
  p['vy']-=1600*dt;p['y']=max(0,p['y']+p['vy']*dt)
  if p['y']==0:p['vy']=0
  if p['stun']>0:continue
  if 'seal' in pressed and p['seals']>0:
   p['seals']-=1;p['hp']=min(p.get('maxHp',100),p['hp']+p.get('maxHp',100)*.28);p['mana']=100;p['inv']=.6
  if p['cool']>0:continue
  if 'jump' in pressed and p['y']==0:p['vy']=650
  moving=('right' in ks)-('left' in ks)
  old_x=p['x']
  if 'guard' not in ks:p['x']=max(55,min(1225,p['x']+moving*ch['speed']*dt))
  p['moving']=p['x']!=old_x and p['y']==0 and p['vy']==0
  if p['moving'] and p['anim']==0:p['action']='run'
  if 'dash' in pressed and p['mana']>=18:
   p['mana']-=18;p['x']=max(55,min(1225,p['x']+(moving or p['face'])*145));p['dashInv']=.17;p['cool']=.25;p['action']='dash';p['anim']=p['animMax']=.25
  elif 'np' in pressed and p['np']>=100:
   p['np']=0;p['moving']=False;p['action']='np';p['anim']=p['animMax']=NP_TITLE_DURATION+NP_DURATION[p['char']];p['cool']=p['anim']
   r['cinematic']=dict(owner=i,char=p['char'],face=p['face'],elapsed=0,titleDuration=NP_TITLE_DURATION,duration=p['anim'],playbackRate=NP_SOURCE_DURATION[p['char']]/NP_DURATION[p['char']])
   if settings(r)['skipCinema']:release_np(r,r['cinematic'])
   for other in ps:other.update(queued=[],prev=list(other['keys']))
   return
  elif 'skill' in pressed and p['mana']>=combat['skill_cost']:
   p['mana']-=combat['skill_cost'];p['cool']=combat['skill_cool'];p['anim']=p['animMax']=.5/rate;p['action']='skill'
   if p['char']=='archer':
    p.update(action='caladbolg',anim=combat['skill_cool'],animMax=combat['skill_cool'],moving=False)
    r['shots'].append(dict(x=p['x']+p['face']*113,y=p['y']+162,v=p['face']*1150,face=p['face'],owner=i,damage=combat['skill_damage'],life=1.4,radius=24,color='#ffbb79',kind='caladbolg',delay=.9/rate))
    continue
   if p['char'] in ('iskandar','medusa'):
    king=p['char']=='iskandar';kind='royal_charge' if king else 'chain_throw'
    p.update(action=kind,anim=combat['skill_cool'],animMax=combat['skill_cool'],moving=False)
    r['shots'].append(dict(x=p['x'] if king else p['x']+p['face']*75,y=p['y']+120,v=p['face']*(560*rate if king else 950),face=p['face'],owner=i,damage=combat['skill_damage'],life=.38/rate if king else .48,radius=65 if king else 20,kind=kind,delay=(.32 if king else .25)/rate,elapsed=0,hit=False))
    continue
   if p['char'] in ('saber','lancer'):
    saber=p['char']=='saber';kind='strike_air' if saber else 'spear_throw'
    p.update(action=kind,anim=combat['skill_cool'],animMax=combat['skill_cool'],moving=False)
    r['shots'].append(dict(x=p['x']+p['face']*(100 if saber else 100),y=p['y']+(90 if saber else 125),v=p['face']*(820 if saber else 1000),face=p['face'],owner=i,damage=combat['skill_damage'],life=1.6,radius=40 if saber else 18,color=ch['color'],kind=kind,delay=(.24 if saber else .30)/rate))
    continue
   volley=p.get('volley',0);p['volley']=volley+1
   for n in range(3 if p['char']=='gil' else 1):
    r['shots'].append(dict(x=p['x']-p['face']*n*35,y=120+p['y']+n*26,v=p['face']*(850 if p['char']=='archer' else 670),owner=i,damage=combat['skill_damage'],life=1.8,radius=16,color=ch['color'],kind='skill',delay=n*.07/rate,weapon=TREASURY[(volley*3+n)%len(TREASURY)] if p['char']=='gil' else None))
  elif 'light' in pressed or ('heavy' in pressed and p['mana']>=12):
   heavy='heavy' in pressed and p['mana']>=12
   if heavy:p['mana']-=12
   p['cool']=combat['heavy'] if heavy else combat['light'];p['anim']=p['animMax']=p['cool'];p['action']='heavy' if heavy else 'light'
   if abs(enemy['x']-p['x'])<ch['reach']+(30 if heavy else 0) and abs(enemy['y']-p['y'])<85:hit(r,p,enemy,ch['damage']*(1.7 if heavy else 1),60 if heavy else 25)
  if p['action']!='run':p['moving']=False
 # Prevent overlapping grounded fighters.
 a,b=ps
 if abs(a['x']-b['x'])<65 and abs(a['y']-b['y'])<100:
  d=1 if b['x']>=a['x'] else -1;mid=(a['x']+b['x'])/2
  mid=max(88,min(1192,mid));a['x']=mid-d*33;b['x']=mid+d*33
 shots=[]
 for s in r['shots']:
  if s['kind'] in ('army_charge','pegasus_charge','royal_charge','chain_throw'):
   a=ps[s['owner']];b=ps[1-s['owner']];ultimate=s['kind'] in ('army_charge','pegasus_charge');chain=s['kind']=='chain_throw'
   if not ultimate and a['stun']>0:
    a.update(action='idle',anim=0);continue
   flight=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if flight<=0:shots.append(s);continue
   old=s['x'];s['x']+=s['v']*flight;s['life']-=flight;s['elapsed']+=flight
   if not chain:a['x']=max(55,min(1225,s['x']));a['y']=0;a['vy']=0
   if not s['hit'] and min(old,s['x'])-s['radius']-27<=b['x']<=max(old,s['x'])+s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:
    s['hit']=hit(r,a,b,s['damage'],80 if ultimate else 40,ultimate=ultimate)
    if chain:s['life']=0
   if s['life']>1e-9:shots.append(s)
   continue
  if s['kind']=='caladbolg':
   a=ps[s['owner']];b=ps[1-s['owner']];flight=dt
   if s['delay']>0:
    if a['stun']>0:
     a.update(action='idle',anim=0);continue
    s.update(x=a['x']+s['face']*113,y=a['y']+162)
    flight=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if flight<=0:shots.append(s);continue
   old=s['x'];s['x']+=s['v']*flight;s['life']-=flight
   if min(old,s['x'])-s['radius']-27<=b['x']<=max(old,s['x'])+s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:
    hit(r,a,b,s['damage'],75)
    r['fx'].append(dict(x=b['x'],y=s['y'],life=.45,color='#ffb578',kind='caladburst'))
   elif s['life']>0 and -150<s['x']<1430:shots.append(s)
   continue
  if s['kind']=='ea_beam':
   a=ps[s['owner']];b=ps[1-s['owner']]
   s.update(x=a['x']+s['face']*115,y=a['y']+155)
   active=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if active<=0:shots.append(s);continue
   s['elapsed']=min(2.4,s['elapsed']+active);s['life']=max(0,2.4-s['elapsed'])
   due=min(12,int((s['elapsed']+1e-9)/.2))
   while s['ticks']<due:
    s['ticks']+=1
    distance=(b['x']-s['x'])*s['face']
    if distance>=-27 and abs(s['y']-(b['y']+120))<s['radius']+45:
     damage=round(s['damage']*s['ticks'],2)-round(s['damage']*(s['ticks']-1),2)
     hit(r,a,b,damage,5,ultimate=True)
     b['stun']=min(b['stun'],.10)
   if s['life']>1e-9:shots.append(s)
   continue
  if s['kind']=='greatslash':
   a=ps[s['owner']];b=ps[1-s['owner']];previous=s['elapsed']
   s.update(x=a['x'],y=a['y'],elapsed=min(1.4,previous+dt))
   s['delay']=max(0,.48-s['elapsed']);s['life']=max(0,1.4-s['elapsed'])
   # Sweep reaches farther along the arena as the attached sword rotates down.
   if s['elapsed']>=.48 and previous<.82 and not s['hit']:
    q=min(1,max(0,(s['elapsed']-.48)/.34));reach=100+680*q
    distance=(b['x']-a['x'])*s['face']
    if -27<=distance<=reach+27 and b['y']<310:
     s['hit']=hit(r,a,b,s['damage'],85,ultimate=True)
     r['fx'].append(dict(x=b['x'],y=0,life=.45,color='#ffe4a1',kind='greatimpact'))
   if previous<.82<=s['elapsed']:
    r['fx'].append(dict(x=max(30,min(1250,a['x']+s['face']*710)),y=0,life=.45,color='#ffe4a1',kind='greatimpact'))
   if s['life']>1e-9:shots.append(s)
   continue
  if s['kind'] in ('strike_air','spear_throw'):
   a=ps[s['owner']];b=ps[1-s['owner']];flight=dt
   if s['delay']>0:
    if a['stun']>0:
     a.update(action='idle',anim=0);continue
    s.update(x=a['x']+s['face']*100,y=a['y']+(90 if s['kind']=='strike_air' else 125))
    flight=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if flight<=0:shots.append(s);continue
   old=s['x'];s['x']+=s['v']*flight;s['life']-=flight
   if min(old,s['x'])-s['radius']-27<=b['x']<=max(old,s['x'])+s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:
    hit(r,a,b,s['damage'],55 if s['kind']=='strike_air' else 45)
   elif s['life']>0 and -220<s['x']<1500:shots.append(s)
   continue
  s['delay']-=dt
  if s['delay']>0:shots.append(s);continue
  s['x']+=s['v']*dt;s['life']-=dt;b=ps[1-s['owner']]
  if abs(s['x']-b['x'])<s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:
   hit(r,ps[s['owner']],b,s['damage'],65,ultimate=s['kind']=='np')
  elif s['life']>0 and -100<s['x']<1380:shots.append(s)
 r['shots']=shots
 if any(p['hp']<=0 for p in ps) or r['clock']<=0:
  winner=0 if ps[0]['hp']>ps[1]['hp'] else 1 if ps[1]['hp']>ps[0]['hp'] else None
  if winner is not None:r['score'][winner]+=1
  r['banner']='DRAW' if winner is None else CHARS[ps[winner]['char']]['name']+' WIN'
  r.update(phase='ended' if max(r['score'])>=settings(r)['bestOf']//2+1 else 'between',delay=2.6,winner=winner)
  if r['phase']=='ended':
   for p in ps:p['ready']=p['bot']

def loop():
 prev=time.monotonic()
 while True:
  now=time.monotonic();dt=min(.04,now-prev);prev=now
  with LOCK:
   for code,r in list(ROOMS.items()):
    if now-r['active']>900:del ROOMS[code]
    else:tick(r,dt,now)
  time.sleep(1/60)

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,status,data,mime='application/json'):
  body=json.dumps(data,ensure_ascii=False).encode() if mime=='application/json' else data
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers()
  try:self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_GET(self):
  files={'/':('index.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/style.css':('style.css','text/css; charset=utf-8')}
  path=self.path.split('?')[0]
  if path not in files:return self.send(404,{'error':'찾을 수 없습니다.'})
  f,m=files[path];self.send(200,(ROOT/f).read_bytes(),m)
 def do_POST(self):
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=4096:raise ValueError('잘못된 요청입니다.')
   data=json.loads(self.rfile.read(length))
   if not isinstance(data,dict):raise ValueError('잘못된 요청입니다.')
   with LOCK:
    result=self.api(data)
   self.send(200,result)
  except (ValueError,KeyError,TypeError) as e:self.send(400,{'error':str(e) or '잘못된 요청입니다.'})
 def api(self,d):
  action=self.path
  if action=='/api/rooms':return public_rooms()
  if action=='/api/catalog':return character_catalog()
  if action in ('/api/create','/api/join'):
   char=d.get('char','saber')
   if char not in CHARS:raise ValueError('캐릭터를 다시 선택하세요.')
   level=d.get('aiLevel','intermediate')
   if d.get('practice') and (not isinstance(level,str) or level not in AI_LEVELS):raise ValueError('AI 난이도를 다시 선택하세요.')
   p=player(char)
   if action=='/api/create':
    if len(ROOMS)>=200:raise ValueError('서버가 가득 찼습니다.')
    code=secrets.token_hex(3).upper()
    while code in ROOMS:code=secrets.token_hex(3).upper()
    r=dict(code=code,players=[p],phase='waiting',score=[0,0],round=1,clock=90,shots=[],fx=[],banner='상대를 기다리는 중',active=time.monotonic(),winner=None,closed=False,host=0,settings=validate_settings(d.get('settings',{})))
    p['x']=340
    ROOMS[code]=r
    if d.get('practice') or d.get('training'):
     if d.get('practice') and not d.get('training'):r['aiLevel']=level
     bot=player('lancer' if char!='lancer' else 'saber',True);bot.update(x=940,face=-1);r['players'].append(bot)
     if d.get('training'):r['training']=True;bot.update(dummy=True,damageTaken=0,lastDamage=0);p.update(np=100,mana=100)
   else:
    code=str(d.get('code','')).upper().strip();r=ROOMS.get(code)
    if not r or time.monotonic()-r['active']>30:raise ValueError('방을 찾을 수 없습니다. 목록을 새로고침해 주세요.')
    if r.get('closed'):raise ValueError('이미 종료된 방입니다.')
    if len(r['players'])>=2:raise ValueError('이미 두 명이 있는 방입니다.')
    p.update(x=940,face=-1);r['players'].append(p)
   return dict(code=code,token=p['token'],slot=r['players'].index(p),state=snapshot(r))
  code=str(d.get('code',''));r=ROOMS.get(code)
  if not r:raise ValueError('방이 만료되었습니다. 새 방을 만들어 주세요.')
  p=next((p for p in r['players'] if secrets.compare_digest(p['token'],str(d.get('token','')))),None)
  if not p:raise ValueError('접속 인증이 만료되었습니다.')
  p['last']=r['active']=time.monotonic()
  if action=='/api/resume':return snapshot(r)
  if action=='/api/leave':
   r.update(phase='ended',banner='상대가 방을 나갔습니다',winner=None,closed=True)
   return {'ok':True}
  if action=='/api/settings':
   if r['players'].index(p)!=r.get('host',0):raise ValueError('방장만 설정을 변경할 수 있습니다.')
   if r['phase'] not in ('waiting','ended') or r.get('closed'):raise ValueError('대기 중에만 변경할 수 있습니다.')
   r['settings']=validate_settings(d.get('settings'))
   for q in r['players']:q['ready']=q['bot']
   return snapshot(r)
  if action=='/api/pick':
   if r.get('closed'):raise ValueError('종료된 방입니다.')
   lock_pick(r,r['players'].index(p),d.get('char'));return snapshot(r)
  if action=='/api/ready' and r.get('closed'):raise ValueError('로비에서 새 방을 만들어 주세요.')
  if action=='/api/ready' and r['phase'] in ('waiting','ended'):
   p['ready']=True
   if len(r['players'])==2 and all(p['ready'] and (p['bot'] or time.monotonic()-p['last']<1.5) for p in r['players']):
    r.update(score=[0,0],round=1)
    for q in r['players']:q['seals']=3
    if r.get('training'):setup(r)
    else:begin_draft(r)
  elif action=='/api/input':
   ks=d.get('keys',[])
   if not isinstance(ks,list) or any(not isinstance(k,str) for k in ks):raise ValueError('잘못된 입력입니다.')
   clean=[k for k in ks if k in KEYS][:10]
   p['queued']=list(set(p['queued'])|(set(clean)-set(p['keys'])))
   p['keys']=clean
  elif action!='/api/ready':raise ValueError('알 수 없는 요청입니다.')
  return snapshot(r)

def main():
 import argparse
 from aiohttp import web
 from online import make_app
 parser=argparse.ArgumentParser()
 parser.add_argument('--port',type=int,default=int(os.getenv('PORT','8000')))
 parser.add_argument('--host',default='0.0.0.0')
 args=parser.parse_args()
 print(f'Grail Duel Online: http://localhost:{args.port}',flush=True)
 web.run_app(make_app(),host=args.host,port=args.port,access_log=None)

if __name__=='__main__':
 # online imports server; alias the running module to share one room store.
 import sys
 sys.modules['server']=sys.modules[__name__]
 main()

"""Grail Duel online. Python 3.10+ and aiohttp."""
import json, math, os, random, secrets, threading, time
import augments as aug
import gojo
import acheron
import allmight
import magnus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent / 'static'
LOCK = threading.RLock()
ROOMS = {}
CHARS = {
 'magnus':dict(name='매그너스',color='#d4b48b',speed=255,reach=130,damage=10,np='BIKE FROM HELL'),
 'allmight':dict(name='올마이트',color='#ffd46b',speed=255,reach=125,damage=11,np='UNITED STATES OF SMASH'),
 'acheron': dict(name='아케론',color='#cc9dff',speed=270,reach=125,damage=9,np='SLASHED DREAM'),
 'gojo': dict(name='고죠 사토루',color='#9acfff',speed=285,reach=100,damage=9,np='HOLLOW PURPLE'),
 'saber': dict(name='알트리아',color='#79c9ff',speed=270,reach=120,damage=10,np='EXCALIBUR'),
 'archer': dict(name='에미야',color='#ff7878',speed=290,reach=112,damage=9,np='UNLIMITED BLADE WORKS'),
 'lancer': dict(name='쿠 훌린',color='#65ede1',speed=295,reach=138,damage=8,np='GAE BOLG'),
 'gil': dict(name='길가메시',color='#ffd477',speed=240,reach=95,damage=8,np='ENUMA ELISH'),
 'iskandar':dict(name='이스칸다르',color='#e6aa62',speed=245,reach=125,damage=11,np='IONIOI HETAIROI'),
 'berserker':dict(name='헤라클레스',color='#dc9464',speed=225,reach=145,damage=12,np='GOD HAND'),
 'medusa':dict(name='메두사',color='#bf99ec',speed=310,reach=118,damage=8,np='BELLEROPHON')}
KEYS={'left','right','jump','guard','light','heavy','skill','dash','np','seal'}
TREASURY=('longsword','spear','axe','greatsword','halberd','sickle')
NP_TITLE_DURATION=1.0
NP_MAX_DURATION=9.0
NP_SOURCE_DURATION={'magnus':5.8,'allmight':5.6,'acheron':5.2,'gojo':5.4,'saber':7.2,'archer':460/60,'lancer':6.4,'gil':7.6,'berserker':6.6,'iskandar':7.5,'medusa':7.0}
NP_DURATION={char:min(seconds,NP_MAX_DURATION-NP_TITLE_DURATION) for char,seconds in NP_SOURCE_DURATION.items()}
COMBAT = {
 'magnus':dict(light=.30,heavy=.57,skill_cool=1.65,skill_cost=32,skill_damage=4,np_damage=36),
 'allmight':dict(light=.32,heavy=.60,skill_cool=1.0,skill_cost=30,skill_damage=22,np_damage=38),
 'acheron': dict(light=.28,heavy=.52,skill_cool=.85,skill_cost=28,skill_damage=18,np_damage=0),
 'gojo': dict(light=.25,heavy=.5,skill_cool=.85,skill_cost=28,skill_damage=18,np_damage=36),
 'saber': dict(light=.24,heavy=.48,skill_cool=.65,skill_cost=28,skill_damage=15,np_damage=34),
 'archer': dict(light=.24,heavy=.46,skill_cool=1.15,skill_cost=24,skill_damage=28,np_damage=32),
 'lancer': dict(light=.30,heavy=.58,skill_cool=.75,skill_cost=32,skill_damage=11,np_damage=32),
 'gil': dict(light=.27,heavy=.52,skill_cool=.65,skill_cost=28,skill_damage=6,np_damage=32),
 'iskandar':dict(light=.32,heavy=.60,skill_cool=.95,skill_cost=30,skill_damage=22,np_damage=34),
 'berserker':dict(light=.38,heavy=.70,skill_cool=1.15,skill_cost=32,skill_damage=24,np_damage=0),
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
  ult=shot['kind'] in ('np','ea_beam','greatslash','army_charge','pegasus_charge','purple','united_smash','magnus_bike')
  if shot['kind'] in ('ea_beam','greatslash','detroit','united_smash'):
   approaching=(p['x']-shot['x'])*shot.get('face',1)>=-30
  else:approaching=(p['x']-shot['x'])*shot.get('v',0)>=0 and abs(p['x']-shot['x'])<160+abs(shot.get('v',0))*(cfg['reaction']+.12)
  if approaching and abs(shot.get('y',120)-(p['y']+120))<180:danger=True;ultimate|=ult
 danger|=enemy['action'] in ('light','heavy','royal_charge','axe_slam') and dist<CHARS[enemy['char']]['reach']+65
 if cfg['heal'] and p['seals']>0 and p['hp']<p.get('maxHp',100)*.32:
  keys=['seal']
 elif danger and rng.random()<cfg['defense']:
  # Dodge does not block an ultimate; guard or a remaining command seal does.
  if ultimate and cfg['heal'] and p['seals']>0 and p['hp']<p.get('maxHp',100)*.55:keys=['seal']
  elif p['mana']>=6 and p['y']==0:keys=['guard']
  elif not ultimate and p['mana']>=18:keys=[away,'dash']
 elif p['np']>=100 and not (p['char']=='acheron' and acheron.active(p)) and dist<(340 if p['char']=='allmight' else 850) and ground and (p['char']!='berserker' or (p['hp']<p.get('maxHp',100)*.7 and p.get('godTime',0)<=0)) and rng.random()<cfg['accuracy']:
  keys=['np']
 elif dist<ch['reach']-8 and ground and rng.random()<cfg['accuracy']:
  keys=['heavy' if p['mana']>=24 and enemy['action']=='guard' else 'light']
 else:
  can_skill=p['mana']>=combat['skill_cost']+5 and ground
  skill_range=210 if p['char']=='magnus' else 260 if p['char']=='allmight' else 290 if p['char']=='acheron' else 245 if p['char']=='berserker' else 320 if p['char']=='iskandar' else 510 if p['char']=='medusa' else 800
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

DEFAULT_SETTINGS=dict(skipCinema=False,bestOf=3,hp=100,attack=1.0,attackSpeed=1.0,carryNP=False,carryHP=False,resetSeals=False,augmentMode=False)
def settings(r):return {**DEFAULT_SETTINGS,**r.get('settings',{})}
def validate_settings(data):
 if not isinstance(data,dict) or set(data)-set(DEFAULT_SETTINGS):raise ValueError('잘못된 방 설정입니다.')
 result={**DEFAULT_SETTINGS,**data}
 if type(result['skipCinema']) is not bool or type(result['bestOf']) is not int or result['bestOf'] not in (1,3,5):raise ValueError('경기 형식을 확인하세요.')
 for key,low,high in [('hp',50,500),('attack',.5,2),('attackSpeed',.5,2)]:
  v=result[key]
  if type(v) not in (int,float) or not math.isfinite(v) or not low<=v<=high:raise ValueError('능력치 설정 범위를 확인하세요.')
 for key in ('carryNP','carryHP','resetSeals','augmentMode'):
  if type(result[key]) is not bool:raise ValueError('라운드 규칙은 켜기/끄기로 설정하세요.')
 if result['augmentMode'] and result['bestOf']==1:raise ValueError('증강 모드는 Bo3 또는 Bo5에서만 사용할 수 있습니다.')
 if int(result['hp'])!=result['hp']:raise ValueError('체력은 정수로 입력하세요.')
 return result

def character_catalog():
 return {'augments':aug.catalog(),'characters':{k:{**v,**COMBAT[k], 'hp':100,'mana':100,'manaRegen':11,'heavyDamage':v['damage']*1.7,'heavyCost':12,'heavyReach':v['reach']+30,'skillWindup':{'magnus':.15,'allmight':.42,'saber':.24,'archer':.9,'lancer':.3,'gil':0,'iskandar':.32,'medusa':.25,'berserker':.48,'gojo':.32,'acheron':.28}[k],'skillVelocity':{'magnus':0,'allmight':0,'saber':820,'archer':1150,'lancer':1000,'gil':670,'iskandar':560,'medusa':950,'berserker':0,'gojo':850,'acheron':0}[k],'skillHits':6 if k=='magnus' else 3 if k=='gil' else 1,'npHits':0 if k in ('berserker','acheron') else 12 if k=='gil' else 1,'npEffect':'폭주 바이크: 연출 6.8초 → 준비 0.35초 → 가속 질주. U 재입력 시 탈출하고 바이크 발사. 충돌·벽·시간 종료 시 폭발, 피해 36(1회). 가드·점프·회피 가능. 원작을 1대1용으로 조정' if k=='magnus' else '유나이티드 스테이츠 오브 스매시: 연출 6.6초 → 준비 0.5초 → 전방 340, 피해 38. 가드·회피·점프 가능. 원작 기술을 대전용으로 조정' if k=='allmight' else '다음 J/K 3회 강화: J 14 / K 20, 사거리 +85. 3회 모두 적중 시 황천의 귀환 18 추가. 헛침/가드/회피도 횟수 소모, 가드·회피는 적중 수 제외. 강화 중 재발동 불가, 라운드 종료 시 초기화. 원작 연출을 대전용으로 재구성' if k=='acheron' else '체력 12% 회복 · 6초간 피해 35% 감소 · 효과 중 치명타를 받으면 체력 20%로 재기(라운드당 1회)' if k=='berserker' else '허식 자: 창과 혁을 결합. 연출 6.4초 → 0.6초 발사 준비. 기본 고정 피해 36 · 가드/보호막 적용 · 점프/회피 가능. HP 조건 없음. 전투 수치는 대전용 조정' if k=='gojo' else '공격형 보구','npDuration':NP_TITLE_DURATION+NP_DURATION[k],'dashCost':18,'dashDistance':145,'dashInv':.17,'dashCooldown':.25,'guardReduction':82,'guardCost':6,'sealCount':3,'sealHeal':28} for k,v in CHARS.items()}}

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
 else:start_round(r)

def player(char, bot=False):
 return dict(token=secrets.token_urlsafe(24),char=char,bot=bot,ready=bot,last=time.monotonic(),keys=[],prev=[],queued=[],x=0,y=0,vy=0,hp=100,maxHp=100,attackSpeed=1.0,mana=100,np=0,seals=3,cool=0,stun=0,inv=0,dashInv=0,action='idle',anim=0,animMax=0,moving=False,face=1)

def start_round(r):
 r.pop('result',None)
 if settings(r)['augmentMode'] and not r.get('training'):aug.begin(r)
 else:setup(r)

def setup(r):
 r.pop('cinematic',None);r.pop('result',None);r.pop('augmentation',None);r.pop('gojoCast',None);r.pop('domain',None)
 rule=settings(r)
 for i,p in enumerate(r['players']):
  p.pop('_ai',None);p.pop('rematch',None);acheron.reset(p)
  m=aug.rebuild(p);maximum=round(rule['hp']*(1+min(1.5,m.get('hp',0))),2)
  carry=r['round']>1
  old_hp=p['hp'];old_max=p.get('maxHp',rule['hp']);old_np=p['np']
  current=min(maximum,old_hp+max(0,maximum-old_max)) if carry and rule['carryHP'] and old_hp>0 else maximum
  np=min(100,(old_np if carry and rule['carryNP'] else 0)+m.get('startNP',0))
  if rule['resetSeals']:p['seals']=3
  p.update(shield=maximum*m.get('shield',0),augRevived=False,comboHits=0,guardHealCD=0,dashShieldCD=0,dashStrikeCD=0,comboCD=0,skillHealCD=0,slowTime=0,slow=0,hasteTime=0,haste=0)
  p.update(x=340+i*600,y=0,vy=0,hp=current,maxHp=maximum,godTime=0,godReady=False,reviveUsed=False,attackSpeed=rule['attackSpeed']*min(2.5,1+m.get('rate',0)),mana=100,np=np,cool=0,stun=0,inv=0,dashInv=0,action='idle',anim=0,animMax=0,moving=False,keys=[],prev=[],queued=[],face=1 if i==0 else -1)
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

def hit(r,a,b,damage,knock=35,ultimate=False,skill=False,proc=False,fixed=False,dodgeable=False):
 if b['inv']>0 or (b.get('dashInv',0)>0 and (not ultimate or dodgeable)):return False
 guard_cost=max(1,6-aug.value(b,'guardCost'))
 blocked='guard' in b['keys'] and b['y']==0 and b['stun']<=0 and b['cool']<=0 and b['mana']>=guard_cost
 if blocked:b['mana']-=guard_cost
 multiplier=1+aug.value(a,'attack')
 if b['hp']<=b.get('maxHp',100)*.35:multiplier+=aug.value(a,'execute')
 if a['hp']<=a.get('maxHp',100)*.35:multiplier+=aug.value(a,'comeback')
 if not fixed:damage*=settings(r)['attack']*min(3,multiplier)*(1+min(1.5,aug.value(a,'skillDamage')) if skill else 1)
 armor=min(.6,aug.value(b,'armor'))
 actual=damage*(.18 if blocked else 1)*(.65 if b.get('godTime',0)>0 else 1)*(1-armor)
 if b['hp']<=b.get('maxHp',100)*.35:actual*=1-min(.6,aug.value(b,'lastArmor'))
 if fixed:actual=damage*(.18 if blocked else 1)
 absorbed=min(b.get('shield',0),actual);b['shield']=max(0,b.get('shield',0)-absorbed);actual-=absorbed
 lost=min(b['hp'],actual)
 if b.get('dummy'):b['damageTaken']=round(b.get('damageTaken',0)+actual,2);b['lastDamage']=round(actual,2)
 else:
  b['hp']=max(0,b['hp']-actual)
  if b['hp']==0 and b.get('godTime',0)>0 and b.get('godReady') and not b.get('reviveUsed'):
   b.update(hp=b.get('maxHp',100)*.2,godReady=False,reviveUsed=True,inv=.6)
   r['fx'].append(dict(x=b['x'],y=120,life=.7,color='#e6b87c',kind='rebirth'))
  elif b['hp']==0 and aug.value(b,'revive') and not b.get('augRevived'):
   b.update(hp=b['maxHp']*aug.value(b,'revive'),augRevived=True,inv=.6)
   r['fx'].append(dict(x=b['x'],y=120,life=.7,color='#cdb7ff',kind='rebirth'))
 b['stun']=(.08 if blocked else .21)*(1-min(.6,aug.value(b,'tenacity')))
 if not b.get('dummy'):b['x']=max(55,min(1225,b['x']+a['face']*knock))
 if not proc:
  a['np']=min(100,a['np']+damage*.65*(1+min(2,aug.value(a,'npGain'))));b['np']=min(100,b['np']+damage*.5*(1+min(2,aug.value(b,'npGain'))))
  aug.heal(a,lost*min(.5,aug.value(a,'lifesteal')))
  if blocked and aug.value(b,'guardHeal') and b.get('guardHealCD',0)<=0:aug.heal(b,b['maxHp']*aug.value(b,'guardHeal'));b['guardHealCD']=2
  if skill and aug.value(a,'slow'):b.update(slow=min(.5,aug.value(a,'slow')),slowTime=1.5)
  if aug.value(a,'comboCount') and a.get('comboCD',0)<=0:
   a['comboCD']=.25;a['comboHits']=a.get('comboHits',0)+1
   if a['comboHits']>=aug.value(a,'comboCount'):
    a['comboHits']=0
    if b['hp']>0:hit(r,a,b,a['maxHp']*aug.value(a,'comboDamage'),0,ultimate=ultimate,proc=True)
 r['fx'].append(dict(x=b['x'],y=b['y']+120,life=.25,color='#ffffff' if blocked else CHARS[a['char']]['color']))
 return True

def release_np(r,scene):
 if scene['char']=='magnus':magnus.release(r,scene);return
 if scene['char']=='allmight':allmight.release(r,scene);return
 if scene['char']=='acheron':acheron.release(r,scene);return
 if scene['char']=='gojo':gojo.release(r,scene);return
 ps=r['players']
 p=ps[scene['owner']];ch=CHARS[p['char']]
 p.update(action='np_release',anim=1.1,animMax=1.1,cool=1.1)
 if p['char']=='berserker':
  p.update(action='god_hand',anim=.65,animMax=.65,cool=.65,godTime=6.0,godReady=not p.get('reviveUsed',False),hp=min(p.get('maxHp',100),p['hp']+p.get('maxHp',100)*.12))
  r['fx'].append(dict(x=p['x'],y=120,life=.7,color='#e6b87c',kind='rebirth'))
 elif p['char']=='saber':
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
 if r.get('result') and r['phase'] in ('between','ended'):
  result=r['result'];result['elapsed']=min(result['duration'],result['elapsed']+dt)
 if r['phase']=='augment':
  a=r['augmentation'];a['remaining']=max(0,a['remaining']-dt)
  for i,p in enumerate(ps):
   if a['picks'][i] is None and (p['bot'] or a['remaining']==0):
    if aug.choose(r,i,random.choice(a['offers'][i])):setup(r);break
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
   if r['phase']=='between':r['round']+=1;start_round(r)
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
 gojo_locked=gojo.advance(r,dt)
 r['fx']=[dict(f,life=f['life']-dt) for f in r['fx'] if f['life']>dt]
 for i,p in enumerate(ps):
  enemy=ps[1-i];ch=dict(CHARS[p['char']]);combat=dict(COMBAT[p['char']]);aug.tick(p,dt)
  rate=settings(r)['attackSpeed']*min(2.5,1+aug.value(p,'rate')+(p.get('haste',0) if p.get('hasteTime',0)>0 else 0));p['attackSpeed']=rate
  ch['speed']*=max(.5,min(1.7,1+aug.value(p,'speed')))*(1-p.get('slow',0) if p.get('slowTime',0)>0 else 1)
  ch['reach']+=min(100,aug.value(p,'reach'))
  mode=aug.value(p,'skillMode')
  if mode:combat['skill_cost'],combat['skill_cool']=aug.SKILLS[mode][:2]
  combat['skill_cost']*=max(.25,1-aug.value(p,'skillCost'))
  for key in ('light','heavy','skill_cool'):combat[key]/=rate
  if i in gojo_locked:
   for key in ('cool','stun','inv','dashInv','anim'):p[key]=max(0,p.get(key,0)-dt)
   continue
  if p.get('dummy'):
   p.update(keys=[],queued=[],prev=[],stun=max(0,p['stun']-dt),action='idle',anim=0,moving=False)
   continue
  if r.get('training'):p.update(np=100,mana=100)
  if p['bot']:p['keys']=bot_input(r,p,enemy,dt)
  elif now-p['last']>.4:p['keys']=[]
  ks=set(p['keys']);pressed=(ks-set(p['prev']))|set(p['queued']);p['queued']=[];p['prev']=list(ks)
  beam=next((s for s in r['shots'] if s['owner']==i and (s['kind'] in ('ea_beam','greatslash','army_charge','pegasus_charge','royal_charge','axe_slam','octobolt','stygian','detroit','united_smash','magnus_spin','magnus_bike') or (s['kind'] in ('caladbolg','strike_air','spear_throw','chain_throw') and s['delay']>0))),None)
  p['face']=beam['face'] if beam else (1 if enemy['x']>=p['x'] else -1)
  for k in ('cool','stun','inv','dashInv','anim','godTime'):p[k]=max(0,p.get(k,0)-dt)
  if p.get('godTime',0)<=0:p['godReady']=False
  p['mana']=min(100,p['mana']+dt*(11+aug.value(p,'manaRegen')))
  if p['anim']==0:p['action']='guard' if 'guard' in ks else 'idle'
  p['vy']-=1600*dt;p['y']=max(0,p['y']+p['vy']*dt)
  if p['y']==0:p['vy']=0
  if p['stun']>0:continue
  if 'seal' in pressed and p['seals']>0:
   p['seals']-=1;aug.seal(r,i,hit)
  if p['char']=='magnus' and magnus.control(r,i,pressed,ks,dt):continue
  if p['cool']>0:continue
  if 'jump' in pressed and p['y']==0:p['vy']=650*(1+min(.3,aug.value(p,'jump')))
  moving=('right' in ks)-('left' in ks)
  old_x=p['x']
  if 'guard' not in ks:p['x']=max(55,min(1225,p['x']+moving*ch['speed']*dt))
  p['moving']=p['x']!=old_x and p['y']==0 and p['vy']==0
  if p['moving'] and p['anim']==0:p['action']='run'
  if 'dash' in pressed and p['mana']>=max(4,18-aug.value(p,'dashCost')):
   p['mana']-=max(4,18-aug.value(p,'dashCost'));p['x']=max(55,min(1225,p['x']+(moving or p['face'])*(145+min(100,aug.value(p,'dashDistance')))));p['dashInv']=.17;p['cool']=.25;p['action']='dash';p['anim']=p['animMax']=.25
   aug.dash(r,i,hit)
  elif 'np' in pressed and p['np']>=100 and not (p['char']=='acheron' and acheron.active(p)):
   p['np']=min(80,aug.value(p,'npRefund'));p['moving']=False;p['action']='np';p['anim']=p['animMax']=NP_TITLE_DURATION+NP_DURATION[p['char']];p['cool']=p['anim']
   r['cinematic']=dict(owner=i,char=p['char'],face=p['face'],elapsed=0,titleDuration=NP_TITLE_DURATION,duration=p['anim'],playbackRate=NP_SOURCE_DURATION[p['char']]/NP_DURATION[p['char']])
   if p['char']=='gojo':
    r['cinematic'].update(variant='purple',titleDuration=0,duration=6.4,playbackRate=1)
   if settings(r)['skipCinema']:release_np(r,r['cinematic'])
   for other in ps:other.update(queued=[],prev=list(other['keys']))
   return
  elif 'skill' in pressed and p['mana']>=combat['skill_cost']:
   p['mana']-=combat['skill_cost'];p['cool']=combat['skill_cool'];p['anim']=p['animMax']=.5/rate;p['action']='skill'
   if aug.skill(r,i,rate):continue
   if p['char']=='magnus':magnus.skill(r,i,rate);continue
   if p['char']=='allmight':allmight.cast(r,i,rate=rate);continue
   if p['char']=='acheron':acheron.skill(r,i,rate);continue
   if p['char']=='gojo':
    p.update(action='red',anim=combat['skill_cool'],animMax=combat['skill_cool'],moving=False)
    r['shots'].append(dict(kind='red',owner=i,x=p['x']+p['face']*65,y=p['y']+140,v=p['face']*850,face=p['face'],radius=24,life=1.5,delay=.32/rate,damage=18,elapsed=0))
    continue
   if p['char']=='berserker':
    p.update(action='axe_slam',anim=combat['skill_cool'],animMax=combat['skill_cool'],moving=False)
    r['shots'].append(dict(x=p['x'],y=p['y'],v=0,face=p['face'],owner=i,damage=combat['skill_damage'],life=.30,kind='axe_slam',delay=.48/rate,hit=False,elapsed=0))
    continue
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
   if acheron.basic(r,i,heavy,ch['reach']+(30 if heavy else 0),hit):
    if r.get('cinematic'):
     for other in ps:other.update(queued=[],prev=list(other['keys']))
     return
    continue
   if abs(enemy['x']-p['x'])<ch['reach']+(30 if heavy else 0) and abs(enemy['y']-p['y'])<85:hit(r,p,enemy,ch['damage']*(1.7*(1+aug.value(p,'heavyDamage')) if heavy else 1),60 if heavy else 25)
  if p['action']!='run':p['moving']=False
 # Prevent overlapping grounded fighters.
 a,b=ps
 if abs(a['x']-b['x'])<65 and abs(a['y']-b['y'])<100:
  d=1 if b['x']>=a['x'] else -1;mid=(a['x']+b['x'])/2
  mid=max(88,min(1192,mid));a['x']=mid-d*33;b['x']=mid+d*33
 shots=[]
 for s in r['shots']:
  if s['kind'] in ('magnus_spin','magnus_bike'):
   if magnus.shot(r,s,dt,hit):shots.append(s)
   continue
  if s['kind'] in ('detroit','united_smash'):
   if allmight.shot(r,s,dt,hit):shots.append(s)
   continue
  if s['kind'] in ('octobolt','stygian'):
   if acheron.shot(r,s,dt,hit):shots.append(s)
   continue
  if s['kind'] in ('purple','red'):
   if gojo.shot(r,s,dt,hit):shots.append(s)
   continue
  if s['kind'] in ('aug_orb','aug_nova'):
   a=ps[s['owner']];b=ps[1-s['owner']]
   flight=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if flight<=0:shots.append(s);continue
   old=s['x'];s['x']+=s['v']*flight;s['life']-=flight
   if s['kind']=='aug_nova':
    r['fx'].append(dict(kind='aug_ring',x=a['x'],y=a['y']+120,life=.45,radius=s['radius'],color='#c3adff'))
    if abs(b['x']-a['x'])<=s['radius'] and abs(b['y']-a['y'])<150:hit(r,a,b,s['damage'],45,skill=True)
   elif min(old,s['x'])-s['radius']-27<=b['x']<=max(old,s['x'])+s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:hit(r,a,b,s['damage'],30,skill=True)
   elif s['life']>0 and -150<s['x']<1430:shots.append(s)
   continue
  if s['kind']=='axe_slam':
   a=ps[s['owner']];b=ps[1-s['owner']]
   if s['delay']>0 and a['stun']>0:
    a.update(action='idle',anim=0);continue
   active=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if active<=0:shots.append(s);continue
   if not s['hit']:
    s['hit']=True
    if -27<=(b['x']-a['x'])*s['face']<=245 and abs(b['y']-a['y'])<100:hit(r,a,b,s['damage'],65,skill=True)
    r['fx'].append(dict(x=a['x']+s['face']*185,y=a['y'],life=.35,color='#e6b87c',kind='greatimpact'))
   s['elapsed']+=active;s['life']-=active
   if s['life']>0:shots.append(s)
   continue
  if s['kind'] in ('army_charge','pegasus_charge','royal_charge','chain_throw'):
   a=ps[s['owner']];b=ps[1-s['owner']];ultimate=s['kind'] in ('army_charge','pegasus_charge');chain=s['kind']=='chain_throw'
   if not ultimate and a['stun']>0:
    a.update(action='idle',anim=0);continue
   flight=max(0,dt-s['delay']);s['delay']=max(0,s['delay']-dt)
   if flight<=0:shots.append(s);continue
   old=s['x'];s['x']+=s['v']*flight;s['life']-=flight;s['elapsed']+=flight
   if not chain:a['x']=max(55,min(1225,s['x']));a['y']=0;a['vy']=0
   if not s['hit'] and min(old,s['x'])-s['radius']-27<=b['x']<=max(old,s['x'])+s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:
    s['hit']=hit(r,a,b,s['damage'],80 if ultimate else 40,ultimate=ultimate,skill=not ultimate)
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
    hit(r,a,b,s['damage'],75,skill=True)
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
    hit(r,a,b,s['damage'],55 if s['kind']=='strike_air' else 45,skill=True)
   elif s['life']>0 and -220<s['x']<1500:shots.append(s)
   continue
  s['delay']-=dt
  if s['delay']>0:shots.append(s);continue
  s['x']+=s['v']*dt;s['life']-=dt;b=ps[1-s['owner']]
  if abs(s['x']-b['x'])<s['radius']+27 and abs(s['y']-(b['y']+120))<s['radius']+45:
   hit(r,ps[s['owner']],b,s['damage'],65,ultimate=s['kind']=='np',skill=s['kind']!='np')
  elif s['life']>0 and -100<s['x']<1380:shots.append(s)
 r['shots']=shots
 if any(p['hp']<=0 for p in ps) or r['clock']<=0:
  winner=0 if ps[0]['hp']>ps[1]['hp'] else 1 if ps[1]['hp']>ps[0]['hp'] else None
  if winner is not None:r['score'][winner]+=1
  r.pop('gojoCast',None);r.pop('domain',None)
  r['banner']='DRAW' if winner is None else CHARS[ps[winner]['char']]['name']+' WIN'
  final=max(r['score'])>=settings(r)['bestOf']//2+1
  duration=4.0 if final else 3.2
  r.update(phase='ended' if final else 'between',delay=duration,winner=winner,shots=[],fx=[],result=dict(winner=winner,final=final,elapsed=0.0,duration=duration,round=r['round'],score=list(r['score'])))
  for p in ps:
   acheron.reset(p);p.update(keys=[],prev=[],queued=[],moving=False,action='idle',anim=0,rematch=p['bot'])
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
   if r['phase']!='waiting' or r.get('closed'):raise ValueError('대기 중에만 변경할 수 있습니다.')
   proposed=validate_settings(d.get('settings'))
   if r.get('training') and proposed['augmentMode']:raise ValueError('증강 모드는 AI 대전 또는 온라인 대전에서 사용하세요.')
   r['settings']=proposed
   for q in r['players']:q['ready']=q['bot']
   return snapshot(r)
  if action=='/api/pick':
   if r.get('closed'):raise ValueError('종료된 방입니다.')
   lock_pick(r,r['players'].index(p),d.get('char'));return snapshot(r)
  if action=='/api/augment':
   if aug.choose(r,r['players'].index(p),d.get('id')):setup(r)
   return snapshot(r)
  if action=='/api/rematch':
   result=r.get('result')
   if r.get('closed') or r.get('paused') or r['phase']!='ended' or not result or result['elapsed']<result['duration']:raise ValueError('최종 결과 연출이 끝난 뒤 재대결을 신청하세요.')
   p['rematch']=True
   if all(q.get('rematch') for q in r['players']):
    r.update(phase='waiting',score=[0,0],round=1,winner=None,banner='재대결 준비',shots=[],fx=[])
    r.pop('result',None);r.pop('draft',None)
    for q in r['players']:q.update(ready=q['bot'],rematch=False,keys=[],prev=[],queued=[],action='idle',anim=0,augments=[],augStats={})
   return snapshot(r)
  if action=='/api/ready' and r['phase']!='waiting':raise ValueError('대기실에서 준비해 주세요.')
  if action=='/api/ready' and r.get('closed'):raise ValueError('로비에서 새 방을 만들어 주세요.')
  if action=='/api/ready' and r['phase']=='waiting':
   p['ready']=True
   if len(r['players'])==2 and all(p['ready'] and (p['bot'] or time.monotonic()-p['last']<1.5) for p in r['players']):
    r.update(score=[0,0],round=1)
    for q in r['players']:q.update(seals=3,augments=[],augStats={})
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





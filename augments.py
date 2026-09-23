"""Original duel augments. Server-owned choices and bounded combat modifiers."""
import random
CATALOG={}
def add(tier,key,name,desc,**mods):
 CATALOG[key]=dict(id=key,tier=tier,name=name,description=desc,mods=mods)
# Twenty per tier; values in descriptions are pre-room-damage modifiers.
add('silver','vigor','단단한 기초','최대 체력 +12%. 늘어난 최대 체력만큼 현재 체력도 증가.',hp=.12)
add('silver','edge','날 세우기','모든 피해 +8%.',attack=.08)
add('silver','boots','가벼운 발','이동속도 +10%.',speed=.10)
add('silver','tempo','빠른 박자','기본 공격과 L 스킬 시전·회복 속도 +8%.',rate=.08)
add('silver','spring','마력 샘','초당 마나 회복 +4.',manaRegen=4)
add('silver','economy','절약 주문','L 스킬 마나 소모 -15%.',skillCost=.15)
add('silver','resonance','작은 공명','공격·피격으로 얻는 보구 게이지 +20%.',npGain=.20)
add('silver','prelude','보구 예열','매 라운드 시작 보구 게이지 +15. 최대 100.',startNP=15)
add('silver','plating','경량 갑주','받는 피해 6% 감소.',armor=.06)
add('silver','mending','자가 수복','전투 중 초당 최대 체력 0.3% 회복.',regen=.003)
add('silver','measure','한 뼘 더','약·강공격 사거리 +18.',reach=18)
add('silver','stride','긴 보폭','회피 이동 거리 +30.',dashDistance=30)
add('silver','thrift','효율 회피','회피 마나 소모 18 → 12.',dashCost=6)
add('silver','mercy','치유 각인','영주 회복량 +최대 체력 10%. 변환된 영주에도 적용.',sealHeal=.10)
add('silver','brace','효율 방어','가드 마나 소모 6 → 4.',guardCost=2)
add('silver','focus','스킬 집중','L 스킬 피해 +12%.',skillDamage=.12)
add('silver','weight','묵직한 한 수','강공격 피해 +18%.',heavyDamage=.18)
add('silver','leap','도약 각인','점프 초기 속도 +10%.',jump=.10)
add('silver','resolve','흔들림 없이','피격 경직 시간 20% 감소.',tenacity=.20)
add('silver','ward','출발 보호막','매 라운드 최대 체력 12% 보호막. 피해를 먼저 흡수.',shield=.12)
add('gold','fortress','요새 체질','최대 체력 +25%. 증가분만큼 현재 체력도 증가.',hp=.25)
add('gold','blade','강화 무장','모든 피해 +18%.',attack=.18)
add('gold','rhythm','전투 리듬','기본 공격·L 시전·회복 속도 +18%.',rate=.18)
add('gold','gale','질풍 걸음','이동속도 +20%.',speed=.20)
add('gold','renewal','재생 회로','전투 중 초당 최대 체력 0.6% 회복.',regen=.006)
add('gold','aegis','마력 갑주','받는 피해 12% 감소.',armor=.12)
add('gold','conductor','보구 전도체','공격·피격 보구 게이지 획득 +45%.',npGain=.45)
add('gold','craft','숙련된 술식','L 스킬 피해 +28%.',skillDamage=.28)
add('gold','siphon','회복의 검','직접 깎은 상대 체력의 12%를 회복. 추가타에는 미적용.',lifesteal=.12)
add('gold','finisher','마무리 일격','상대 체력이 35% 이하일 때 주는 피해 +25%.',execute=.25)
add('gold','rally','역전의 의지','내 체력이 35% 이하일 때 주는 피해 +25%.',comeback=.25)
add('gold','guard_mend','회복 방어','가드 성공 시 최대 체력 2% 회복. 재발동 2초.',guardHeal=.02)
add('gold','seal_charge','영주 공명','영주 사용 시 보구 게이지 +35.',sealNP=35)
add('gold','seal_ward','영주 방벽','영주 사용 시 최대 체력 30% 보호막 추가.',sealShield=.30)
add('gold','seal_haste','가속 명령','영주 사용 후 6초간 기본 공격·L 속도 +35%.',sealHaste=.35,sealDuration=6)
add('gold','dash_ward','잔상 방벽','회피 시 최대 체력 10% 보호막. 재발동 4초.',dashShield=.10)
add('gold','fourth','네 번째 박자','4회 명중마다 최대 체력 8% 상당 추가 피해. 명중 집계 간격 0.25초.',comboCount=4,comboDamage=.08)
add('gold','frost','서리 술식','L 적중 시 상대 이동속도 25% 감소, 1.5초. 중첩 대신 갱신.',slow=.25)
add('gold','echo','메아리 탄','L 시전 시 피해 8의 추가 마력탄 발사. 원래 스킬은 유지.',echo=8)
add('gold','fan','L 변환: 삼연탄','L을 마력탄 3발로 변경. 발당 피해 10, 마나 26, 준비 0.25초, 회복 포함 0.85초.',skillMode='fan')
add('prism','titan','거인의 계약','최대 체력 +45%, 모든 피해 +12%, 이동속도 -8%.',hp=.45,attack=.12,speed=-.08)
add('prism','overpower','초월 무장','모든 피해 +35%, 기본 공격·L 속도 +15%.',attack=.35,rate=.15)
add('prism','accelerator','시간 가속','기본 공격·L 시전·회복 속도 +40%. 보구 시간은 유지.',rate=.40)
add('prism','bastion','영원의 성벽','매 라운드 최대 체력 40% 보호막, 초당 체력 0.4% 회복.',shield=.40,regen=.004)
add('prism','reactor','보구 반응로','공격·피격 보구 획득 +85%, 매 라운드 시작 게이지 +40.',npGain=.85,startNP=40)
add('prism','second_dawn','두 번째 새벽','라운드당 한 번, 체력 0이 되면 최대 체력 35%로 복귀하고 0.6초 보호.',revive=.35)
add('prism','seal_barrier','영주 변환: 절대방벽','영주의 기본 회복을 없애고 최대 체력 65% 보호막과 1.2초 보호로 변경. 마나 회복 유지.',sealMode='barrier')
add('prism','seal_nova','영주 변환: 충격파','영주 기본 회복 12%, 주변 340 거리 내 피해 32의 충격파. 마나 회복·0.6초 보호 유지.',sealMode='nova')
add('prism','seal_overdrive','영주 변환: 초가속','영주 기본 회복 12%, 보구 +50, 8초간 기본 공격·L 속도 +60%. 마나 회복·보호 유지.',sealMode='overdrive')
add('prism','barrage','L 변환: 오연 포격','L을 마력탄 5발로 변경. 발당 피해 10, 마나 30, 준비 0.2초, 회복 포함 1.1초.',skillMode='barrage')
add('prism','lance','L 변환: 광휘의 창','L을 넓은 광창으로 변경. 피해 42, 마나 28, 준비 0.55초, 회복 포함 1.1초.',skillMode='lance')
add('prism','nova','L 변환: 마력 폭풍','L을 주변 320 거리 충격파로 변경. 피해 36, 마나 28, 준비 0.35초, 회복 포함 0.9초.',skillMode='nova')
add('prism','sustain','불굴의 순환','직접 깎은 상대 체력의 25% 회복. 추가타에는 미적용.',lifesteal=.25)
add('prism','third','삼중 공명','3회 명중마다 내 최대 체력 12% 상당 추가 피해. 집계 간격 0.25초. 네 번째 박자와 동시 보유 시 더 강한 효과만.',comboCount=3,comboDamage=.12)
add('prism','dash_strike','회피 변환: 돌파','회피 도착 지점 주변 180 거리 내 피해 14. 재발동 2초.',dashStrike=14)
add('prism','starlight','별빛 충전','전투 중 초당 보구 게이지 +4.',npRegen=4)
add('prism','last_stand','최후의 성채','내 체력이 35% 이하일 때 받는 피해 추가 40% 감소.',lastArmor=.40)
add('prism','skill_mend','생명의 술식','L 시전 시 최대 체력 6% 회복. 재발동 3초.',skillHeal=.06)
add('prism','recursion','보구 잔향','보구 발동 직후 게이지 35를 돌려받음.',npRefund=35)
add('prism','archmage','대마술사','L 피해 +45%, L 마나 소모 -35%.',skillDamage=.45,skillCost=.35)
TIERS=('silver','gold','prism')
def catalog():return [{k:v for k,v in a.items() if k!='mods'} for a in CATALOG.values()]
def stats(p):return p.get('augStats',{})
def value(p,key):return stats(p).get(key,0)
def rebuild(p):
 m={}
 for key in p.get('augments',[]):
  for k,v in CATALOG[key]['mods'].items():
   if isinstance(v,str):m[k]=v
   elif k=='comboCount':m[k]=min(m.get(k,99),v)
   elif k in ('comboDamage','sealDuration'):m[k]=max(m.get(k,0),v)
   else:m[k]=m.get(k,0)+v
 p['augStats']=m
 return m

def begin(r):
 tier=TIERS[min(r['round']-1,2)]
 offers=[]
 for p in r['players']:
  have=p.get('augments',[]);m=stats(p)
  pool=[k for k,a in CATALOG.items() if a['tier']==tier and k not in have and not any(group in a['mods'] and group in m for group in ('skillMode','sealMode'))]
  # Repeated draws can exceed a normal series. Re-offer owned upgrades only if exhausted.
  if len(pool)<3:pool=[k for k,a in CATALOG.items() if a['tier']==tier and not any(group in a['mods'] and group in m for group in ('skillMode','sealMode'))]
  if p.get('seals',0)==0 and not r.get('settings',{}).get('resetSeals'):
   useful=[k for k in pool if not any(m.startswith('seal') for m in CATALOG[k]['mods'])]
   if len(useful)>=3:pool=useful
  offers.append(random.sample(pool,3))
 r.update(phase='augment',augmentation=dict(tier=tier,offers=offers,picks=[None,None],remaining=25.0),shots=[],fx=[])
 for p in r['players']:p.update(keys=[],queued=[],prev=[],action='idle',anim=0)

def choose(r,slot,key):
 a=r.get('augmentation')
 if r.get('closed') or r.get('paused') or r['phase']!='augment' or not a or a['picks'][slot] is not None:raise ValueError('현재 증강을 선택할 수 없습니다.')
 if not isinstance(key,str) or key not in a['offers'][slot]:raise ValueError('제시된 증강 중 하나를 선택하세요.')
 a['picks'][slot]=key;p=r['players'][slot];p.setdefault('augments',[]).append(key);rebuild(p)
 return all(k is not None for k in a['picks'])

def shield(p,amount):p['shield']=min(p.get('maxHp',100)*2,p.get('shield',0)+amount)
def heal(p,amount):
 if p['hp']>0:p['hp']=min(p['maxHp'],p['hp']+amount)
def tick(p,dt):
 for k in ('guardHealCD','dashShieldCD','dashStrikeCD','comboCD','skillHealCD','slowTime','hasteTime'):p[k]=max(0,p.get(k,0)-dt)
 heal(p,p['maxHp']*value(p,'regen')*dt)
 p['np']=min(100,p['np']+value(p,'npRegen')*dt)

def orb(r,i,damage,delay=0,radius=18,speed=850,kind='aug_orb'):
 p=r['players'][i]
 r['shots'].append(dict(kind=kind,owner=i,x=p['x']+p['face']*65,y=p['y']+120,v=p['face']*speed,face=p['face'],damage=damage,delay=delay,life=1.8,radius=radius,color='#b8adff',elapsed=0))
SKILLS={'fan':(26,.85,.25,3,10,18),'barrage':(30,1.1,.2,5,10,20),'lance':(28,1.1,.55,1,42,42),'nova':(28,.9,.35,1,36,320)}
def skill(r,i,rate):
 p=r['players'][i];mode=value(p,'skillMode')
 if value(p,'skillHeal') and p.get('skillHealCD',0)<=0:heal(p,p['maxHp']*value(p,'skillHeal'));p['skillHealCD']=3
 if value(p,'echo'):orb(r,i,value(p,'echo'),.15/rate)
 if not mode:return False
 cost,cool,wind,count,damage,radius=SKILLS[mode]
 p.update(action='skill',anim=cool/rate,animMax=cool/rate,cool=cool/rate)
 for j in range(count):orb(r,i,damage,(wind+j*.10)/rate,radius,0 if mode=='nova' else 1050 if mode=='lance' else 850,'aug_nova' if mode=='nova' else 'aug_orb')
 return True

def seal(r,i,hit):
 p=r['players'][i];enemy=r['players'][1-i];mode=value(p,'sealMode')
 base=0 if mode=='barrier' else .12 if mode else .28
 heal(p,p['maxHp']*(base+value(p,'sealHeal')));p['mana']=100;p['inv']=1.2 if mode=='barrier' else .6
 shield(p,p['maxHp']*(value(p,'sealShield')+(.65 if mode=='barrier' else 0)))
 p['np']=min(100,p['np']+value(p,'sealNP')+(50 if mode=='overdrive' else 0))
 p['hasteTime']=max(value(p,'sealDuration'),8 if mode=='overdrive' else 0);p['haste']=value(p,'sealHaste')+(.60 if mode=='overdrive' else 0)
 if mode=='nova':
  r['fx'].append(dict(kind='aug_ring',x=p['x'],y=p['y']+120,life=.5,radius=340,color='#ffe0a5'))
  if abs(enemy['x']-p['x'])<=340 and abs(enemy['y']-p['y'])<150:hit(r,p,enemy,32,45,proc=True)

def dash(r,i,hit):
 p=r['players'][i];b=r['players'][1-i]
 if value(p,'dashShield') and p.get('dashShieldCD',0)<=0:shield(p,p['maxHp']*value(p,'dashShield'));p['dashShieldCD']=4
 if value(p,'dashStrike') and p.get('dashStrikeCD',0)<=0:
  p['dashStrikeCD']=2
  r['fx'].append(dict(kind='aug_ring',x=p['x'],y=p['y']+120,life=.3,radius=180,color='#9cf3dc'))
  if abs(b['x']-p['x'])<=180 and abs(b['y']-p['y'])<100:hit(r,p,b,value(p,'dashStrike'),35,proc=True)

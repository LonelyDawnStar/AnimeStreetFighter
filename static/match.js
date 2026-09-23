'use strict';
(()=>{
 let catalog=null,lastSettings='',lastPhase='',lastDraft='';
 const fmt=n=>Number(n.toFixed(2));
 function details(char){
  if(!catalog)return;const d=catalog[char];$('detailTitle').textContent=defs[char].name+' · 상세 능력치';
  const groups=[['기본 능력',[['체력',d.hp],['마나 / 초당 회복',d.mana+' / '+d.manaRegen],['이동속도',d.speed],['기본 사거리',d.reach]]],['근접 공격',[['약공격 피해',d.damage],['약공격 간격',d.light+'초'],['초당 약공격',fmt(1/d.light)+'회'],['강공격 피해',fmt(d.heavyDamage)],['강공격 간격',d.heavy+'초'],['강공격 마나',d.heavyCost],['강공격 사거리',d.heavyReach]]],['L 스킬',[['피해',d.skill_damage+(d.skillHits>1?' × '+d.skillHits:'')],['마나',d.skill_cost],['시전 준비',d.skillWindup+'초'],['행동 제한 총시간',d.skill_cool+'초'],['스킬 이동속도',d.skillVelocity]]],['보구 / 방어',[['필요 보구 게이지','100%'],['보구 총피해',d.np_damage+(d.npHits>1?' / '+d.npHits+'회':'')],['보구 연출',fmt(d.npDuration)+'초'],['가드 피해 감소',d.guardReduction+'%'],['가드 마나',d.guardCost+' / 피격'],['회피 마나 / 거리',d.dashCost+' / '+d.dashDistance],['회피 무적 / 회복',d.dashInv+'초 / '+d.dashCooldown+'초'],['영주',d.sealCount+'개 · 최대 체력 '+d.sealHeal+'% 회복']]]];
  $('detailStats').replaceChildren();for(const [name,rows]of groups){const box=document.createElement('section'),h=document.createElement('h3'),dl=document.createElement('dl');h.textContent=name;for(const [label,value]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd)}box.append(h,dl);$('detailStats').append(box)}
 }
 fetch('/api/catalog').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{catalog=d.characters;details(selected)}).catch(()=>{$('detailStats').textContent='능력치를 불러오지 못했어요. 페이지를 새로고침해 주세요.'});
 $('saveSettings').onclick=()=>{
  const settings={bestOf:Number($('bestOf').value),hp:Number($('customHp').value),attack:Number($('customAttack').value),attackSpeed:Number($('customSpeed').value),skipCinema:$('skipCinema').checked};
  if(![1,3,5].includes(settings.bestOf)||!Number.isInteger(settings.hp)||settings.hp<50||settings.hp>500||![settings.attack,settings.attackSpeed].every(v=>Number.isFinite(v)&&v>=.5&&v<=2)){error('체력 50~500, 배율 0.5~2 사이로 입력해 주세요.');return}
  if(!send({type:'settings',settings}))error('서버 연결을 확인해 주세요.');
 };
 function render(s,auth){
  const picking=['coin','draft'].includes(s.phase),waiting=['waiting','ended'].includes(s.phase)&&!s.closed;
  document.body.classList.toggle('pregame',picking||waiting);$('draftPanel').hidden=!picking;$('roomSettings').hidden=!waiting;$('ready').hidden=picking;
  const rule=s.settings||{bestOf:3,hp:100,attack:1,attackSpeed:1,skipCinema:false},signature=JSON.stringify(rule)+s.code;
  if(signature!==lastSettings){lastSettings=signature;$('bestOf').value=rule.bestOf;$('customHp').value=rule.hp;$('customAttack').value=rule.attack;$('customSpeed').value=rule.attackSpeed;$('skipCinema').checked=rule.skipCinema;$('settingsStatus').textContent='서버에 적용된 규칙';}
  const host=auth?.slot===(s.host??0);$('hostLabel').textContent='P'+((s.host??0)+1)+(host?' · 나':' · 변경 권한 없음');
  for(const id of ['bestOf','customHp','customAttack','customSpeed','skipCinema','saveSettings'])$(id).disabled=!host||!waiting;
  if(waiting&&lastPhase!==s.phase)$('roomSettings').open=host;
  lastPhase=s.phase;if(!picking)return false;
  $('overlay').hidden=false;$('overTag').textContent=s.phase==='coin'?'PICK ORDER / COIN TOSS':'SERVANT DRAFT';
  const d=s.draft,slot=d.order[d.turn],mine=slot===auth.slot;
  $('overTitle').textContent=s.paused?'상대 재접속 대기':s.phase==='coin'?'선픽을 결정합니다':mine?'당신의 서번트를 선택하세요':'상대가 선택하고 있어요';
  $('overDesc').textContent=s.phase==='coin'?'코인 토스가 끝나면 순서가 공개됩니다.':'선픽 P'+(d.order[0]+1)+' → 후픽 P'+(d.order[1]+1)+' · '+(rule.bestOf===1?'단판':'Bo'+rule.bestOf);
  $('tossCoin').hidden=s.phase!=='coin';$('tossCoin').classList.toggle('flipping',s.phase==='coin'&&!s.paused);
  $('draftStatus').textContent=s.phase==='coin'?Math.ceil(s.delay)+'초':(d.turn===0?'선픽':'후픽')+' · P'+(slot+1)+' · 남은 시간 '+Math.ceil(d.remaining)+'초';
  $('draftRoster').hidden=s.phase!=='draft';
  const key=JSON.stringify([s.code,s.phase,d.turn,d.picks,s.paused,auth.slot]);
  if(key!==lastDraft){lastDraft=key;$('draftRoster').replaceChildren();for(const [id,def]of Object.entries(defs)){const b=document.createElement('button');b.className='draft-card';const used=d.picks.includes(id);b.style.setProperty('--accent',def.color);const portrait=document.createElement('canvas');portrait.width=144;portrait.height=144;portrait.setAttribute('aria-hidden','true');const face=GrailArt.portraits[id];if(face){const g=portrait.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(face,0,0,144,144)}const name=document.createElement('strong'),status=document.createElement('small');name.textContent=def.name;status.textContent=def.cls+(used?' · 선택 완료':' · 선택 가능');b.append(portrait,name,status);b.setAttribute('aria-label',def.name+' '+status.textContent);b.disabled=!mine||used||!!s.paused;b.onclick=()=>{if(send({type:'pick',char:id}))for(const btn of $('draftRoster').querySelectorAll('button'))btn.disabled=true;else error('서버 연결을 확인해 주세요.')};$('draftRoster').append(b)}}
  return true;
 }
 window.matchControls={details,render};if(state)updateUI();
})();

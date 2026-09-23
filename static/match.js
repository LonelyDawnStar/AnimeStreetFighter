'use strict';
(()=>{
 let catalog=null,lastSettings='',lastPhase='',lastDraft='',lastSeats='';
 const fmt=n=>Number(n.toFixed(2));
 function details(char){
  if(!catalog)return;const d=catalog[char];$('detailTitle').textContent=defs[char].name+' · 상세 능력치';
  const groups=[['기본 능력',[['체력',d.hp],['마나 / 초당 회복',d.mana+' / '+d.manaRegen],['이동속도',d.speed],['기본 사거리',d.reach]]],['근접 공격',[['약공격 피해',d.damage],['약공격 간격',d.light+'초'],['초당 약공격',fmt(1/d.light)+'회'],['강공격 피해',fmt(d.heavyDamage)],['강공격 간격',d.heavy+'초'],['강공격 마나',d.heavyCost],['강공격 사거리',d.heavyReach]]],['L 스킬',[['피해',d.skill_damage+(d.skillHits>1?' × '+d.skillHits:'')],['마나',d.skill_cost],['시전 준비',d.skillWindup+'초'],['행동 제한 총시간',d.skill_cool+'초'],['스킬 이동속도',d.skillVelocity]]],['보구 / 방어',[['필요 보구 게이지','100%'],['보구 효과',d.npEffect],['보구 총피해',d.np_damage+(d.npHits>1?' / '+d.npHits+'회':'')],['보구 연출',fmt(d.npDuration)+'초'],['가드 피해 감소',d.guardReduction+'%'],['가드 마나',d.guardCost+' / 피격'],['회피 마나 / 거리',d.dashCost+' / '+d.dashDistance],['회피 무적 / 회복',d.dashInv+'초 / '+d.dashCooldown+'초'],['영주',d.sealCount+'개 · 최대 체력 '+d.sealHeal+'% 회복']]]];
  $('detailStats').replaceChildren();for(const [name,rows]of groups){const box=document.createElement('section'),h=document.createElement('h3'),dl=document.createElement('dl');h.textContent=name;for(const [label,value]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd)}box.append(h,dl);$('detailStats').append(box)}
 }
 fetch('/api/catalog').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{catalog=d.characters;details(selected)}).catch(()=>{$('detailStats').textContent='능력치를 불러오지 못했어요. 페이지를 새로고침해 주세요.'});
 $('saveSettings').onclick=()=>{
  const settings={bestOf:Number($('bestOf').value),hp:Number($('customHp').value),attack:Number($('customAttack').value),attackSpeed:Number($('customSpeed').value),skipCinema:$('skipCinema').checked};
  if(![1,3,5].includes(settings.bestOf)||!Number.isInteger(settings.hp)||settings.hp<50||settings.hp>500||![settings.attack,settings.attackSpeed].every(v=>Number.isFinite(v)&&v>=.5&&v<=2)){error('체력 50~500, 배율 0.5~2 사이로 입력해 주세요.');return}
  if(!send({type:'settings',settings}))error('서버 연결을 확인해 주세요.');
 };
 function closeSettings(){if($('roomSettings').open)$('roomSettings').close()}
 $('openSettings').onclick=()=>{clearKeys();$('roomSettings').showModal()};
 $('closeSettings').onclick=closeSettings;
 $('roomSettings').onclick=e=>{if(e.target===$('roomSettings')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSettings()}};
 $('resultMenu').onclick=()=>leaveRoom();
 $('rematch').onclick=()=>{if(send({type:'rematch'}))$('rematch').disabled=true;else error('서버 연결을 확인해 주세요.')};
 function render(s,auth){
  const picking=['coin','draft'].includes(s.phase)&&!s.closed,waiting=s.phase==='waiting'&&!s.closed,ending=s.phase==='ended'&&!!s.result&&!s.closed;
  document.body.classList.toggle('pregame',picking||waiting);document.body.classList.toggle('result-active',!!s.result&&!s.closed);
  $('overlay').classList.toggle('final-overlay',ending);$('draftPanel').hidden=!picking;$('waitingRoom').hidden=!waiting;$('finalResult').hidden=!ending;$('ready').hidden=!waiting;
  for(const id of ['overTag','overTitle','overDesc'])$(id).hidden=ending;
  if(!waiting)closeSettings();
  const rule=s.settings||{bestOf:3,hp:100,attack:1,attackSpeed:1,skipCinema:false},signature=JSON.stringify(rule)+s.code;
  if(signature!==lastSettings){lastSettings=signature;$('bestOf').value=rule.bestOf;$('customHp').value=rule.hp;$('customAttack').value=rule.attack;$('customSpeed').value=rule.attackSpeed;$('skipCinema').checked=rule.skipCinema;$('settingsStatus').textContent='서버에 적용된 규칙';}
  const host=auth?.slot===(s.host??0);$('hostLabel').textContent='P'+((s.host??0)+1)+(host?' · 나':' · 설정은 방장만 변경할 수 있어요');
  for(const id of ['bestOf','customHp','customAttack','customSpeed','skipCinema','saveSettings'])$(id).disabled=!host||!waiting;
  if(s.phase!==lastPhase){clearKeys();lastPhase=s.phase}
  if(ending){
   const r=s.result,done=r.elapsed>=r.duration,win=r.winner===auth.slot;
   $('overlay').hidden=!done;
   $('finalTitle').textContent=r.winner==null?'최종 무승부':win?'최종 승리':'최종 패배';
   $('finalNames').textContent=s.players.map((p,i)=>'P'+(i+1)+' '+defs[p.char].name+' · '+(r.winner==null?'무승부':i===r.winner?'승리':'패배')).join(' / ');
   $('finalScore').textContent=r.score.join(' : ');
   $('rematch').disabled=!done||!!s.players[auth.slot]?.rematch;
   $('rematchStatus').textContent=s.players[auth.slot]?.rematch?'상대의 재대결 응답을 기다리는 중':s.players.some((p,i)=>i!==auth.slot&&p.rematch&&!p.bot)?'상대가 재대결을 신청했어요.':'두 플레이어가 동의하면 대기실로 돌아갑니다.';
   return true;
  }
  if(waiting){
   $('overlay').hidden=false;$('overTag').textContent='DUEL LOUNGE';$('overTitle').textContent='대전 대기실';$('overDesc').textContent='준비를 마치면 코인 토스와 캐릭터 선택이 시작됩니다.';
   $('waitingCode').textContent='ROOM / '+s.code;
   $('ruleSummary').textContent=(rule.bestOf===1?'단판':'Bo'+rule.bestOf)+' · HP '+rule.hp+' · 공격 ×'+rule.attack+' · 공속 ×'+rule.attackSpeed+' · 보구 연출 '+(rule.skipCinema?'스킵':'재생');
   $('waitingHint').textContent=s.players.length<2?'초대 링크를 보내 상대를 초대하세요.':'두 플레이어 모두 준비하면 시작합니다.';
   const key=JSON.stringify([s.code,s.players.map(p=>[p.char,p.ready,p.bot]),auth.slot,s.host]);
   if(key!==lastSeats){lastSeats=key;$('waitingSeats').replaceChildren();for(let i=0;i<2;i++){
    const p=s.players[i],box=document.createElement('article');box.className='waiting-seat'+(p?.ready?' is-ready':'');
    const tag=document.createElement('small'),name=document.createElement('strong'),status=document.createElement('span');tag.textContent='P'+(i+1)+(i===(s.host??0)?' / 방장':' / 참가자')+(i===auth.slot?' / 나':'');name.textContent=p?defs[p.char].name:'빈 자리';status.textContent=p?(p.bot?'AI · 준비 완료':p.ready?'준비 완료':'준비 중'):'상대를 기다리는 중';
    const portrait=document.createElement('canvas');portrait.width=128;portrait.height=128;if(p&&GrailArt.portraits[p.char]){const g=portrait.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(GrailArt.portraits[p.char],0,0,128,128)}box.append(tag,portrait,name,status);$('waitingSeats').append(box);
   }}
   $('ready').textContent=s.players[auth.slot]?.ready?'준비 완료 · 상대 대기':'준비 완료';$('ready').disabled=!!s.players[auth.slot]?.ready;return true;
  }
  if(!picking)return false;
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
 window.matchControls={details,render,closeSettings};if(state)updateUI();
})();

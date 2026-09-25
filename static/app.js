'use strict';
const $=id=>document.getElementById(id),defs={saber:{name:'알트리아',cls:'SABER',color:'#79c9ff',body:'#274b9d',hair:'#f2d788',style:'균형 · 검술',desc:'L: 스트라이크 에어 · 바람 참격. 보구: 거대 마력 검을 휘두르는 엑스칼리버',np:'EXCALIBUR'},archer:{name:'에미야',cls:'ARCHER',color:'#ff7878',body:'#ae3544',hair:'#e6e8ed',style:'기동 · 투사체',desc:'L: 칼라드볼그 · 0.9초 충전 후 피해 28 · 마나 24. 충전 중 피격 시 취소. 보구: 무한의 검제',np:'UNLIMITED BLADE WORKS'},lancer:{name:'쿠 훌린',cls:'LANCER',color:'#65ede1',body:'#247297',hair:'#244877',style:'속도 · 긴 사거리',desc:'L: 투창 · 게이 볼그를 던져 견제. 보구: 게이 볼그',np:'GAE BOLG'},gil:{name:'길가메시',cls:'ARCHER',color:'#ffd477',body:'#c79b46',hair:'#f1d87e',style:'견제 · 연속 투사체',desc:'세 발의 투사체로 공간을 장악. 보구: 에누마 엘리시',np:'ENUMA ELISH'}};
Object.assign(defs,{berserker:{name:'헤라클레스',cls:'BERSERKER',color:'#dc9464',style:'중량 · 재기',desc:'L: 부검 내려치기 · 준비 0.48초 / 피해 24. U: 갓 핸드 · 체력 12% 회복, 6초 피해 35% 감소, 효과 중 1회 재기(라운드당 1회). 원작 능력을 대전용으로 조정',np:'GOD HAND'},iskandar:{name:'이스칸다르',cls:'RIDER',color:'#e6aa62',style:'중량 · 돌격',desc:'L: 검을 앞세운 돌격 · 피해 22. 보구: 왕의 군세 · 군대와 함께 돌진',np:'IONIOI HETAIROI'},medusa:{name:'메두사',cls:'RIDER',color:'#bf99ec',style:'기동 · 사슬 견제',desc:'L: 사슬 단검 투척 · 피해 14. 보구: 벨레로폰 · 페가수스 돌진',np:'BELLEROPHON'}});
Object.assign(defs,{gojo:{name:'고죠 사토루',cls:'JUJUTSU',color:'#9acfff',style:'술식 · 원거리 압박',desc:'L: 술식반전 혁 · 준비 0.32초 / 피해 18 / 마나 28. U: 허식 자 · 창과 혁을 결합해 발사. 기본 고정 피해 36, 가드·보호막 적용. 연출 6.4초 이후 조준 고정과 0.6초 발사 준비. HP 조건 없이 사용, 점프·회피 가능. 전투 수치는 대전용 조정.',np:'HOLLOW PURPLE'}});
Object.assign(defs,{allmight:{name:'올마이트',cls:'HERO',color:'#ffd46b',style:'근접 · 강력한 주먹',desc:'현역 머슬폼 · 원 포 올. L: 디트로이트 스매시, 준비 0.42초 / 전방 260 / 피해 22 / 마나 30. U: 유나이티드 스테이츠 오브 스매시, 준비 0.5초 / 전방 340 / 피해 38. 가드·점프·회피 가능. 원작을 대전용으로 조정.',np:'UNITED STATES OF SMASH'}});
Object.assign(defs,{acheron:{name:'아케론',cls:'NIHILITY',color:'#cc9dff',style:'발도 · 강화 평타',desc:'L: 팔뢰비도 · 번개 발도 참격, 준비 0.28초 / 피해 18 / 마나 28. U: 다음 J/K 3회 강화(J 14 / K 20, 사거리 +85). 모두 적중하면 황천의 귀환(18). 헛침·가드·회피도 횟수 소모, 가드/회피는 적중 제외. 강화는 라운드 종료 시 초기화. 원작을 대전용으로 재구성.',np:'SLASHED DREAM'}});
let selected='saber',session=null,state=null,keys=new Set(),pending=new Set(),generation=0,lastHealth=null,smoothed=[],lastFrame=0;
function polygon(c,pts,color){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()}
function line(c,x,y,a,b,color,w){c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke()}
function fighter(c,p,t,scale=1){GrailArt.fighter(c,p,t,scale)}
const rosterCanvases=[];
for(const [id,d]of Object.entries(defs)){const b=document.createElement('button');b.className='card';b.dataset.char=id;b.style.setProperty('--accent',d.color);b.innerHTML=`<span class="class">${d.cls}</span><canvas width="300" height="220"></canvas><div class="info"><div><strong>${d.name}</strong><small>${d.style}</small></div><span class="diamond">◇</span></div>`;b.onclick=()=>select(id);$('roster').appendChild(b);rosterCanvases.push({id,canvas:b.querySelector('canvas')})}
function drawRoster(t){for(const {id,canvas}of rosterCanvases){const g=canvas.getContext('2d');g.clearRect(0,0,300,220);GrailArt.fighter(g,{char:id,x:135,y:0,face:1,action:'idle',anim:0},t,id==='berserker'?.76:.88,216)}}
GrailArt.promise.then(()=>{if(GrailArt.failed){error(GrailArt.error);$('assetStatus').textContent='그래픽 로드 실패 · 새로고침해 주세요.'}else{$('assetStatus').textContent='PIXEL EDITION · READY';drawRoster(0)}});
function select(id){selected=id;document.querySelectorAll('.card').forEach(b=>{b.classList.toggle('selected',b.dataset.char===id);b.setAttribute('aria-pressed',b.dataset.char===id)});$('selectedName').textContent=defs[id].name+' · '+defs[id].cls;$('desc').textContent=defs[id].desc;window.matchControls?.details(id)}select(selected);
function error(e){$('error').textContent=e.message||e;$('error').style.display='block';setTimeout(()=>$('error').style.display='none',5000)}
async function api(path,data){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});const d=await r.json();if(!r.ok)throw Error(d.error||'접속 실패');return d}
let entering=false;
async function enter(mode){if(entering||session)return;entering=true;renderRooms();document.querySelectorAll('.actions button').forEach(b=>b.disabled=true);try{await GrailArt.promise;await NobleCinema.ready;if(!GrailArt.ready)throw GrailArt.error;const d=await api(mode==='join'?'join':'create',{char:selected,practice:mode==='practice',aiLevel:$('aiLevel').value,training:mode==='training',code:$('code').value});session={code:d.code,token:d.token,slot:d.slot};state=d.state;generation++;keys.clear();pending.clear();smoothed=[];lastHealth=null;$('lobby').hidden=true;$('game').hidden=false;$('roomLabel').textContent=`ROOM ${d.code} · PLAYER ${d.slot+1}`;updateUI();remember();connect(generation)}catch(e){error(e);refreshRooms()}finally{entering=false;document.querySelectorAll('.actions button').forEach(b=>b.disabled=false);renderRooms()}}
const aiNames={beginner:'초급',intermediate:'중급',advanced:'고급',impossible:'불가능'};
const aiHints={beginner:'느린 반응과 잦은 빈틈 · 조작 연습용',intermediate:'공격·방어·거리 조절을 섞는 기본 난이도',advanced:'빠른 대응과 영주 회복 · 숙련자용',impossible:'최단 반응과 적극적인 공방 · 최상위 도전'};
try{const value=localStorage.getItem('grail-ai-level');if(aiNames[value])$('aiLevel').value=value}catch{}
function aiChoice(){const value=$('aiLevel').value;$('aiHint').textContent=aiHints[value];try{localStorage.setItem('grail-ai-level',value)}catch{}}
$('aiLevel').onchange=aiChoice;aiChoice();
$('training').onclick=()=>enter('training');$('create').onclick=()=>enter('create');$('practice').onclick=()=>enter('practice');$('join').onclick=()=>enter('join');$('code').addEventListener('keydown',e=>{if(e.key==='Enter')enter('join')});
let socket=null,retry=null,inputTimer=null,pingTimer=null,latestSeq=null;
function remember(){try{sessionStorage.setItem('grail-session',JSON.stringify(session))}catch{}}
function forget(){try{sessionStorage.removeItem('grail-session')}catch{}}
function stopTransport(){clearTimeout(retry);clearInterval(inputTimer);clearInterval(pingTimer);latestSeq=null;if(socket){socket.onclose=null;socket.onmessage=null;socket.onerror=null;socket.close();socket=null}}
function send(msg){
 if(socket?.readyState!==WebSocket.OPEN||socket.bufferedAmount>4096)return false;
 if(msg.type==='input'){if(latestSeq===null)return false;msg={...msg,seq:latestSeq}}
 socket.send(JSON.stringify(msg));return true;
}
$('ready').onclick=()=>{if(!send({type:'ready'}))error('서버에 다시 연결하는 중입니다.')};
function leaveRoom(){window.matchControls?.closeSettings();document.body.classList.remove('pregame','result-active');if(session)api('leave',session).finally(()=>refreshRooms()).catch(()=>{});NobleCinema.draw(c,{});session=null;state=null;generation++;stopTransport();forget();clearKeys();$('lobby').hidden=false;$('game').hidden=true;$('connection').textContent='LOBBY';history.replaceState(null,'',location.pathname)}
$('leave').onclick=leaveRoom;
function applyState(s){state=s;updateUI();if(lastHealth&&s.players.some((p,i)=>p.hp<lastHealth[i])){impactUntil=performance.now()+110;}lastHealth=s.players.map(p=>p.hp)}
function connect(gen){
 if(!session||gen!==generation)return;
 stopTransport();$('connection').textContent='CONNECTING';
 const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');socket=ws;
 let lastState=performance.now(),lastPump=lastState,lastPing=0,pingStamp=null,loopLag=0,recovering=false;
 function recover(){if(recovering||socket!==ws||gen!==generation)return;recovering=true;clearKeys();smoothed=[];connect(gen)}
 ws.onopen=()=>{if(gen!==generation||socket!==ws){ws.close();return}send({type:'auth',protocol:2,code:session.code,token:session.token});$('connection').textContent='ONLINE · LIVE';
  inputTimer=setInterval(()=>{
   if(socket!==ws)return;
   const now=performance.now(),gap=now-lastPump;lastPump=now;
   if(gap>1500||now-lastState>3000||(pingStamp!==null&&now-pingStamp>3000)){recover();return}
   if(now-lastState>1000){pending.clear();$('connection').textContent='연결 지연 · 복구 확인 중';return}
   send({type:'input',keys:document.hidden?[]:[...new Set([...keys,...pending])]});pending.clear();
   if(pingStamp===null&&now-lastPing>=1000){lastPing=now;if(send({type:'ping',stamp:now}))pingStamp=now}
  },1000/30);
 };
 ws.onmessage=e=>{if(gen!==generation||socket!==ws)return;const msg=JSON.parse(e.data);
  if(msg.type==='state'){
   lastState=performance.now();latestSeq=msg.seq??null;loopLag=msg.loopLagMs||0;
   if(latestSeq!==null)send({type:'ack',seq:latestSeq});
   $('connection').textContent='ONLINE · LIVE';applyState(msg.state);
  }
  if(msg.type==='pong'&&msg.stamp===pingStamp){
   const rtt=Math.round(performance.now()-msg.stamp);pingStamp=null;
   $('ping').textContent=rtt+' ms'+(rtt>500?' · 지연':' · LIVE');
   $('ping').title='통신 왕복 '+rtt+'ms / 서버 처리 지연(최근 5초) '+loopLag+'ms';
   if(rtt>3000)recover();
  }
  if(msg.type==='notice')error(msg.message);
  if(msg.type==='fatal'){generation++;stopTransport();forget();clearKeys();error(msg.message);$('connection').textContent='DISCONNECTED';$('overlay').hidden=false;$('overTitle').textContent='다시 접속해 주세요';$('overDesc').textContent=msg.message;$('ready').disabled=true}
 };
 ws.onclose=e=>{if(gen!==generation||socket!==ws)return;clearInterval(inputTimer);clearInterval(pingTimer);if(state)state.paused=true;clearKeys();$('connection').textContent='RECONNECTING';$('overlay').hidden=false;$('overTitle').textContent='연결 복구 중';$('overDesc').textContent='30초 안에 돌아오면 경기를 이어갑니다.';$('ready').disabled=true;
  if(e.code===4001){generation++;forget();$('overDesc').textContent='다른 창에서 이 플레이어로 접속했습니다.';return}
  retry=setTimeout(()=>connect(gen),1000);
 };
 ws.onerror=()=>{if(socket===ws)ws.close()};
}
$('copyInvite').onclick=async()=>{if(!session)return;const url=new URL(location.href);url.search='';url.searchParams.set('room',session.code);url.hash='';try{await navigator.clipboard.writeText(url.href);$('copyInvite').textContent='초대 링크 복사됨';setTimeout(()=>$('copyInvite').textContent='초대 링크 복사',1800)}catch{window.prompt('이 초대 링크를 복사해서 친구에게 보내세요.',url.href)}};
const invited=new URLSearchParams(location.search).get('room');if(invited&&/^[0-9a-f]{6}$/i.test(invited)){$('code').value=invited.toUpperCase();$('inviteHint').textContent='초대받은 방 '+invited.toUpperCase()+' · 캐릭터를 선택하고 참가하세요.'}
async function restore(){let saved;try{saved=JSON.parse(sessionStorage.getItem('grail-session'))}catch{}if(!saved?.token||!saved?.code||!Number.isInteger(saved.slot))return;if(invited&&invited.toUpperCase()!==saved.code)return;
 try{await NobleCinema.ready;const s=await api('resume',saved);if(s.closed){forget();return}session=saved;state=s;generation++;$('lobby').hidden=true;$('game').hidden=false;$('roomLabel').textContent=`ROOM ${saved.code} · PLAYER ${saved.slot+1}`;updateUI();connect(generation)}catch{forget()}}
setTimeout(restore,0);
function updateUI(){
 if(state?.aiLevel)$('roomLabel').textContent='AI 대전 · '+(aiNames[state.aiLevel]||'중급');if(!state)return;if(window.matchControls?.render(state,session))return;const s=state,show=s.paused||s.phase==='waiting'||s.phase==='ended';$('overlay').hidden=!show;if(!show)return;if(s.paused){$('overTag').textContent='RECONNECTING';$('overTitle').textContent='상대가 돌아오기를 기다리는 중';$('overDesc').textContent=`남은 시간 ${s.reconnectLeft}초 · 전투는 일시 정지됩니다.`;$('ready').disabled=true;return}$('overTag').textContent=s.phase==='waiting'?'WAITING FOR SERVANTS':'DUEL COMPLETE';$('overTitle').textContent=s.banner;$('overDesc').textContent=s.players.map((p,i)=>`P${i+1} ${defs[p.char].name} ${p.bot?'· AI':p.ready?'· 준비 완료':'· 준비 중'}`).join('\n');$('ready').textContent=s.phase==='ended'?'다시 대전 준비':'준비 완료';$('ready').disabled=!!s.players[session.slot]?.ready||s.closed;if(s.closed)$('overDesc').textContent='로비로 나간 뒤 새 방을 만들어 주세요.'}
const map={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',ArrowUp:'jump',KeyS:'guard',ArrowDown:'guard',KeyJ:'light',KeyK:'heavy',KeyL:'skill',Space:'dash',KeyU:'np',KeyI:'seal'};
const inputSources=new Map();
function setInputSource(source,values){
 if(values.length)inputSources.set(source,new Set(values));else inputSources.delete(source);
 const next=new Set([...inputSources.values()].flatMap(v=>[...v]));
 for(const key of next)if(!keys.has(key))pending.add(key);
 keys.clear();for(const key of next)keys.add(key);
}
window.addEventListener('keydown',e=>{if(!session||state?.phase!=='fight'||$('roomSettings').open||!map[e.code]||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;e.preventDefault();setInputSource('keyboard:'+e.code,[map[e.code]])});
window.addEventListener('keyup',e=>{setInputSource('keyboard:'+e.code,[])});
function clearKeys(){window.arcadeControls?.reset();inputSources.clear();keys.clear();pending.clear();send({type:'input',keys:[]})}
window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearKeys()});
// Original synthesized score and effects: no downloads, no copyrighted samples.
// Sound controls are disabled; retain the element for mobile layout compatibility.
$('sound').hidden=true;
$('sound').style.setProperty('display','none','important');

const CrispHUD=(()=>{
 const style=document.createElement('style');style.textContent=`
 .crisp-hud{position:absolute;inset:0 0 auto;z-index:1;pointer-events:none;font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#fff;background:#081322f5;border-bottom:3px solid #566780;padding:12px 16px;display:grid;grid-template-columns:minmax(0,1fr) 86px minmax(0,1fr);gap:10px 20px;font-variant-numeric:tabular-nums;text-shadow:0 1px #000}
 .crisp-side{min-width:0;--accent:#a0f0d9}.crisp-side.enemy{--accent:#ffe0a0}.crisp-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.crisp-name{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.crisp-player{font-size:13px;color:var(--accent);white-space:nowrap}.crisp-health{position:relative;height:23px;background:#40283a;border:2px solid #a7b5cb;overflow:hidden}.crisp-fill{height:100%;background:var(--accent);width:100%}.crisp-health strong{position:absolute;inset:0;text-align:center;color:#fff;background:#06122266;font-size:14px;line-height:19px;text-shadow:1px 1px 2px #000,-1px -1px 2px #000}.crisp-values{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;margin-top:6px;color:#d9e6fa}.crisp-np.ready{color:#ffe099;font-weight:800}.crisp-seals{color:#ffb7ce}.crisp-buff{font-size:12px;color:#d4c4ff;margin-top:4px}.crisp-center{text-align:center;align-self:start;background:#17263a;border-top:3px solid #e6cc92;padding:4px}.crisp-round{font-size:12px;color:#d5dfed}.crisp-clock{font-size:32px;line-height:1.15;font-weight:800}.crisp-score{font-size:15px;color:#ffe2a7;margin-top:3px}.crisp-training{grid-column:1/-1;text-align:center;background:#14243c;border:2px solid #778aab;padding:5px 10px;font-size:14px;color:#fff1bd}.crisp-training b{color:#fff;font-size:16px;margin:0 4px}
 @media(max-width:850px),(pointer:coarse){.crisp-hud{padding:6px 8px;grid-template-columns:minmax(0,1fr) 54px minmax(0,1fr);gap:6px 8px}.crisp-name{font-size:13px}.crisp-player{font-size:11px}.crisp-heading{gap:4px;margin-bottom:4px}.crisp-health{height:20px}.crisp-health strong{font-size:12px;line-height:16px}.crisp-values{font-size:12px;gap:2px 6px;margin-top:3px}.crisp-clock{font-size:24px}.crisp-round{font-size:11px}.crisp-score{font-size:12px}.crisp-buff{font-size:11px}.crisp-training{font-size:12px;padding:3px 5px}.crisp-training b{font-size:13px}.crisp-player{display:none}}

 /* Restore the arcade silhouette while keeping text at native resolution. */
 .crisp-hud{background:linear-gradient(180deg,#070f20f5,#101c30d9);border-bottom:2px solid #897749;padding:12px 18px;gap:8px 22px;box-shadow:inset 0 2px #e6cc9255}
 .crisp-side{position:relative;padding-left:76px;min-height:110px}.crisp-side.right-side{padding-left:0;padding-right:76px}
 .crisp-portrait{position:absolute;left:0;top:0;width:64px;height:86px;image-rendering:pixelated;object-fit:cover;background:#142238;border-left:3px solid var(--accent);border-bottom:3px solid #536482;box-shadow:3px 3px #020611}
 .right-side .crisp-portrait{left:auto;right:0;border-left:0;border-right:3px solid var(--accent);transform:scaleX(-1)}
 .crisp-name{font-size:17px;letter-spacing:.3px;color:#f5eddb}.right-side .crisp-heading{flex-direction:row-reverse}
 .crisp-health{height:22px;border:2px solid #b4bdc8;border-bottom-color:#42536a;box-shadow:2px 2px #020611}.crisp-fill{background:linear-gradient(180deg,#ffffff99 0 3px,transparent 3px),var(--accent)}.right-side .crisp-fill{margin-left:auto}
 .crisp-meters{display:grid;gap:5px;margin-top:7px}.crisp-meter{height:5px;background:#27334b;border:1px solid #61718b;box-shadow:1px 1px #030713}.crisp-meter.noble{height:8px;background:#30273e;border-color:#8e7da5}.crisp-meter-fill{height:100%;background:#8cceff;transition:width .12s linear}.noble .crisp-meter-fill{background:#c9adff}.right-side .crisp-meter-fill{margin-left:auto}.noble.ready .crisp-meter-fill{background:repeating-linear-gradient(90deg,#ffe4a0 0 12px,#fff2c9 12px 16px);box-shadow:0 0 6px #edce7866}
 .crisp-values{gap:4px 10px;font-size:12px;align-items:center}.crisp-seals{margin-left:auto;letter-spacing:3px;color:#ffa5bd;font-size:17px;line-height:1}.crisp-np{color:#d5c1f7}.crisp-center{border:2px solid #6d6250;border-top:3px solid #e6cc92;box-shadow:3px 3px #020611;background:#111e31}.crisp-clock{font-family:Georgia,serif;font-size:36px;color:#fff4d7}.crisp-round{letter-spacing:1px}.crisp-score{border-top:1px solid #6e624c;padding-top:4px}.crisp-training{justify-self:center;width:auto;min-width:320px;background:#0c182bec;border:1px solid #9b8759;box-shadow:3px 3px #030713;color:#f6dda5}
 @media(max-width:850px),(pointer:coarse){.crisp-hud{padding:6px;gap:5px 8px}.crisp-side{padding-left:42px;min-height:80px}.crisp-side.right-side{padding-right:42px;padding-left:0}.crisp-portrait{width:35px;height:48px}.crisp-name{font-size:12px;letter-spacing:0}.crisp-heading{margin-bottom:3px}.crisp-health{height:18px}.crisp-health strong{font-size:11px;line-height:14px}.crisp-meters{gap:3px;margin-top:4px}.crisp-meter{height:4px}.crisp-meter.noble{height:6px}.crisp-values{font-size:11px;gap:3px 5px}.crisp-seals{font-size:13px;letter-spacing:1px}.crisp-clock{font-size:26px}.crisp-training{min-width:0;font-size:12px;padding:3px 8px}.crisp-buff{font-size:11px}}
 @media(prefers-reduced-motion:reduce){.crisp-meter-fill{transition:none}}
 `;document.head.append(style);
 const root=document.createElement('div');root.className='crisp-hud';root.hidden=true;root.setAttribute('aria-label','경기 상태');$('battle').parentElement.append(root);
 const node=(tag,cls,parent)=>{const n=document.createElement(tag);n.className=cls;parent.append(n);return n};
 const sides=[];
 for(let i=0;i<3;i++){
  if(i===1){const middle=node('div','crisp-center',root);node('div','crisp-round',middle);node('div','crisp-clock',middle);node('div','crisp-score',middle);continue}
  const side=node('section','crisp-side'+(i===2?' right-side':''),root),portrait=node('canvas','crisp-portrait',side),head=node('div','crisp-heading',side),name=node('strong','crisp-name',head),player=node('span','crisp-player',head),bar=node('div','crisp-health',side),fill=node('div','crisp-fill',bar),hp=node('strong','',bar),meters=node('div','crisp-meters',side),mpBar=node('div','crisp-meter',meters),mpFill=node('div','crisp-meter-fill',mpBar),npBar=node('div','crisp-meter noble',meters),npFill=node('div','crisp-meter-fill',npBar),values=node('div','crisp-values',side),mana=node('span','',values),np=node('span','crisp-np',values),seals=node('span','crisp-seals',values),buff=node('div','crisp-buff',side);portrait.width=128;portrait.height=172;portrait.setAttribute('aria-hidden','true');sides.push({side,portrait,portraitChar:null,name,player,fill,hp,mana,np,seals,buff,mpFill,npBar,npFill});
 }
 const round=root.querySelector('.crisp-round'),clock=root.querySelector('.crisp-clock'),score=root.querySelector('.crisp-score'),training=node('div','crisp-training',root);
 const set=(el,value)=>{if(el.textContent!==value)el.textContent=value};
 function update(s,slot){
  root.hidden=!s||!['fight','countdown'].includes(s.phase)||!!s.cinematic||!!s.paused||!!s.closed;if(root.hidden)return;
  sides.forEach((v,i)=>{const p=s.players[i];v.side.hidden=!p;if(!p)return;v.side.classList.toggle('enemy',i!==slot);if(v.portraitChar!==p.char&&GrailArt.portraits[p.char]){const g=v.portrait.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,128,172);g.drawImage(GrailArt.portraits[p.char],0,0,128,172);v.portraitChar=p.char}set(v.name,'P'+(i+1)+' · '+defs[p.char].name);set(v.player,'P'+(i+1)+(i===slot?' · 나':' · 상대'));set(v.hp,Math.ceil(p.hp)+' / '+Math.ceil(p.maxHp||100)+' HP');const width=(Math.max(0,Math.min(1,p.hp/(p.maxHp||100)))*100).toFixed(1)+'%';if(v.fill.style.width!==width)v.fill.style.width=width;set(v.mana,'마나 '+Math.floor(p.mana));set(v.np,p.char==='gojo'?'허식 자'+(p.np>=100?' [U]':' '+Math.floor(p.np)+'%'):p.np>=100?'보구 준비 [U]':'보구 '+Math.floor(p.np)+'%');v.np.classList.toggle('ready',p.np>=100);set(v.seals,'◆'.repeat(Math.max(0,p.seals))+'◇'.repeat(Math.max(0,3-p.seals)));v.seals.setAttribute('aria-label','남은 영주 '+p.seals+'개');v.seals.title='영주 [I] · '+p.seals+'개';v.mpFill.style.width=Math.max(0,Math.min(100,p.mana))+'%';v.npFill.style.width=Math.max(0,Math.min(100,p.np))+'%';v.npBar.classList.toggle('ready',p.np>=100);const status=[];if(p.char==='acheron'){if(p.rainFinishing)status.push('황천의 귀환');else if(p.rainCharges>0)status.push('강화 '+p.rainCharges+'/3 · 적중 '+p.rainHits+'/3');}if(p.shield>0)status.push('보호막 '+Math.ceil(p.shield));if(p.char==='berserker'&&p.godTime>0)status.push('갓 핸드 '+p.godTime.toFixed(1)+'초');set(v.buff,status.join(' · '));v.buff.hidden=!status.length});
  set(round,'R '+(s.round||1));set(clock,s.training?'∞':String(Math.ceil(s.clock)));set(score,(s.score||[0,0]).join(' : '));training.hidden=!s.training;if(s.training){const d=s.players.find(p=>p.dummy),fmt=n=>Number(n||0).toFixed(1);set(training,'연습  |  누적 피해 '+fmt(d?.damageTaken)+'  |  최근 피해 '+fmt(d?.lastDamage))}
 }
 return {update};
})();

const view=$('battle').getContext('2d'),buffer=document.createElement('canvas');buffer.width=640;buffer.height=330;const c=buffer.getContext('2d');
// A shared 4-world-pixel grid for every combat effect and cinematic.
// Reused buffers: no canvas allocation or image loading in the render loop.
const PixelEffects=(()=>{
 const surface=document.createElement('canvas');surface.width=320;surface.height=165;
 const g=surface.getContext('2d',{willReadFrequently:true});
 const colors=new Uint8Array(256),alphas=new Uint8Array(256);
 for(let i=0;i<256;i++){colors[i]=Math.round(i/17)*17;alphas[i]=i<16?0:Math.min(255,Math.round(i/32)*32)}
 function draw(target,paint){
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,320,165);
  g.save();g.scale(.25,.25);g.imageSmoothingEnabled=false;paint(g);g.restore();
  // Quantize alpha as well as color, so antialiased curves and soft glows
  // resolve into discrete pixel clusters instead of translucent smooth edges.
  const pixels=g.getImageData(0,0,320,165),d=pixels.data;
  for(let i=0;i<d.length;i+=4){
   if(d[i+3]<16){d[i+3]=0;continue}
   d[i]=colors[d[i]];d[i+1]=colors[d[i+1]];d[i+2]=colors[d[i+2]];d[i+3]=alphas[d[i+3]];
  }
  g.putImageData(pixels,0,0);target.save();target.imageSmoothingEnabled=false;target.drawImage(surface,0,0,1280,660);target.restore();
 }
 return {draw};
})();

let impactUntil=0,visualTime=0,previousRoster=0;
function text(s,x,y,size=14,color='#fff',align='left'){c.font=`bold ${size}px monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y)}
function draw(now){CrispHUD.update(state,session?.slot);const dt=Math.min(.05,(now-lastFrame)/1000||.016);lastFrame=now;const realTime=now/1000;
 if(!state||(!state.paused&&!state.cinematic))visualTime+=dt;
 if(GrailArt.ready&&now-previousRoster>140&&!state){drawRoster(realTime);previousRoster=now}
 if(state&&GrailArt.ready){const s=state,t=visualTime;c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;
  c.save();if(now<impactUntil&&!s.paused)c.translate(Math.round(Math.sin(now*1.7)*4)*2,0);
  GrailArt.background(c,t);
  s.players.forEach((p,i)=>{if(p.char==='acheron'&&!s.paused&&!s.cinematic&&s.phase==='fight')p=AcheronArt.prepare(p,t,i);const old=DuelMotion.advance(smoothed[i],p,dt,s.paused||!!s.cinematic||s.phase!=='fight');smoothed[i]=old;fighter(c,{...p,...old,airborne:p.y>0||p.vy>0},t)});
  PixelEffects.draw(c,g=>{GrailArt.effects(g,s,t);GojoArt.effects(g,s,t);AcheronArt.effects(g,s,t);AllMightArt.effects(g,s,t)});c.restore();
  if(s.phase==='countdown'){c.fillStyle='#06112e9a';c.fillRect(0,235,1280,100);text(s.phase==='countdown'?String(Math.ceil(s.delay)):s.banner,640,292,54,'#fff1c3','center');text(s.phase==='countdown'?'ROUND '+s.round:'',640,327,15,'#e6e7ef','center')}
  text('F U Y U K I  /  M O O N L I T  R I V E R S I D E',640,641,10,'#d3d9ef','center');
  if(s.cinematic){
   const title=s.cinematic.char==='gojo'?1:(s.cinematic.titleDuration??1);
   if(s.cinematic.elapsed<title)NobleCinema.draw(c,s);
   else PixelEffects.draw(c,g=>NobleCinema.draw(g,s));
  }
  ResultCinema.draw(c,s,session.slot);view.imageSmoothingEnabled=false;view.clearRect(0,0,1280,660);view.drawImage(buffer,0,0,1280,660);
 }
 requestAnimationFrame(draw)
}requestAnimationFrame(draw);

// Room discovery contains only public summaries; joining still uses the server's atomic join.
let roomRows=[],roomsLoading=false,roomsLoaded=false,roomsFailed=false;
function renderRooms(){
 const list=$('roomList');list.replaceChildren();$('roomCount').textContent=roomRows.length;
 const rows=roomRows.filter(r=>!$('onlyOpen').checked||r.joinable);
 if(!rows.length){const empty=document.createElement('div');empty.className='room-empty';
  const title=document.createElement('strong'),hint=document.createElement('p');
  title.textContent=roomsLoading?'방 목록을 불러오고 있어요.':roomsFailed?'방 목록을 불러오지 못했어요.':!roomsLoaded?'대전 서버에 연결하고 있어요.':roomRows.length?'지금은 입장 가능한 방이 없어요.':'첫 번째 결투를 열어보세요.';
  hint.textContent=roomsFailed?'잠시 후 방 새로고침을 눌러 다시 확인하세요.':roomsLoading?'곧 참가할 수 있는 방을 보여드릴게요.':'위의 온라인 방 만들기로 친구를 초대할 수 있어요.';
  empty.append(title,hint);list.append(empty);return;
 }
 for(const r of rows){const row=document.createElement('article');row.className='room-row';
  const icon=document.createElement('span');icon.className='room-icon';icon.textContent=defs[r.host]?.cls?.slice(0,1)||'S';
  icon.style.setProperty('--accent',defs[r.host]?.color||'#dfc390');
  const info=document.createElement('div');info.className='room-info';const name=document.createElement('h3'),sub=document.createElement('p');
  name.textContent=(defs[r.host]?.name||'서번트')+'의 대전방';sub.textContent='ROOM '+r.code+' · 후유키 강변';info.append(name,sub);
  const status=document.createElement('span');status.className='room-status '+(r.joinable?'open':'');status.textContent=r.joinable?'참가 대기':r.phase==='waiting'?'준비 중':r.phase==='ended'?'재대전 대기':'대전 중';
  const count=document.createElement('span');count.className='room-players';count.textContent=r.players+' / '+r.capacity;
  const button=document.createElement('button');button.className=r.joinable?'room-join':'';button.textContent=r.joinable?'입장하기 →':'입장 불가';button.disabled=!r.joinable||entering;button.setAttribute('aria-label',r.code+' 방 '+button.textContent);
  button.onclick=()=>{if(entering)return;$('code').value=r.code;enter('join')};row.append(icon,info,status,count,button);list.append(row);
 }
}
async function refreshRooms(){
 if(roomsLoading)return;roomsLoading=true;roomsFailed=false;$('refreshRooms').disabled=true;$('roomList').setAttribute('aria-busy','true');$('roomsUpdated').textContent='새로고침 중…';if(!roomsLoaded)renderRooms();
 try{const res=await fetch('/api/rooms',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!res.ok)throw Error('목록 요청 실패');const data=await res.json();if(!Array.isArray(data.rooms))throw Error('목록 형식 오류');roomRows=data.rooms;roomsLoaded=true;$('roomsUpdated').textContent='최근 갱신 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
 catch{roomsFailed=true;$('roomsUpdated').textContent='새로고침 실패'+(roomsLoaded?' · 이전 목록 표시 중':'');}
 finally{roomsLoading=false;$('refreshRooms').disabled=false;$('roomList').setAttribute('aria-busy','false');renderRooms()}
}
$('refreshRooms').onclick=refreshRooms;$('onlyOpen').onchange=renderRooms;
refreshRooms();








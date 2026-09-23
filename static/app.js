'use strict';
const $=id=>document.getElementById(id),defs={saber:{name:'알트리아',cls:'SABER',color:'#79c9ff',body:'#274b9d',hair:'#f2d788',style:'균형 · 검술',desc:'L: 스트라이크 에어 · 바람 참격. 보구: 거대 마력 검을 휘두르는 엑스칼리버',np:'EXCALIBUR'},archer:{name:'에미야',cls:'ARCHER',color:'#ff7878',body:'#ae3544',hair:'#e6e8ed',style:'기동 · 투사체',desc:'L: 칼라드볼그 · 0.9초 충전 후 피해 28 · 마나 24. 충전 중 피격 시 취소. 보구: 무한의 검제',np:'UNLIMITED BLADE WORKS'},lancer:{name:'쿠 훌린',cls:'LANCER',color:'#65ede1',body:'#247297',hair:'#244877',style:'속도 · 긴 사거리',desc:'L: 투창 · 게이 볼그를 던져 견제. 보구: 게이 볼그',np:'GAE BOLG'},gil:{name:'길가메시',cls:'ARCHER',color:'#ffd477',body:'#c79b46',hair:'#f1d87e',style:'견제 · 연속 투사체',desc:'세 발의 투사체로 공간을 장악. 보구: 에누마 엘리시',np:'ENUMA ELISH'}};
Object.assign(defs,{berserker:{name:'헤라클레스',cls:'BERSERKER',color:'#dc9464',style:'중량 · 재기',desc:'L: 부검 내려치기 · 준비 0.48초 / 피해 24. U: 갓 핸드 · 체력 12% 회복, 6초 피해 35% 감소, 효과 중 1회 재기(라운드당 1회). 원작 능력을 대전용으로 조정',np:'GOD HAND'},iskandar:{name:'이스칸다르',cls:'RIDER',color:'#e6aa62',style:'중량 · 돌격',desc:'L: 검을 앞세운 돌격 · 피해 22. 보구: 왕의 군세 · 군대와 함께 돌진',np:'IONIOI HETAIROI'},medusa:{name:'메두사',cls:'RIDER',color:'#bf99ec',style:'기동 · 사슬 견제',desc:'L: 사슬 단검 투척 · 피해 14. 보구: 벨레로폰 · 페가수스 돌진',np:'BELLEROPHON'}});
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
function leaveRoom(){DuelSound.reset();window.matchControls?.closeSettings();document.body.classList.remove('pregame','result-active');if(session)api('leave',session).finally(()=>refreshRooms()).catch(()=>{});NobleCinema.draw(c,{});session=null;state=null;generation++;stopTransport();forget();clearKeys();$('lobby').hidden=false;$('game').hidden=true;$('connection').textContent='LOBBY';history.replaceState(null,'',location.pathname)}
$('leave').onclick=leaveRoom;
function applyState(s){DuelSound.observe(s,session?.slot);state=s;updateUI();if(lastHealth&&s.players.some((p,i)=>p.hp<lastHealth[i])){impactUntil=performance.now()+110;}lastHealth=s.players.map(p=>p.hp)}
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
window.addEventListener('keydown',e=>{if(!session||DuelSound.blocked()||state?.phase!=='fight'||$('roomSettings').open||!map[e.code]||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;e.preventDefault();setInputSource('keyboard:'+e.code,[map[e.code]])});
window.addEventListener('keyup',e=>{setInputSource('keyboard:'+e.code,[])});
function clearKeys(){window.arcadeControls?.reset();inputSources.clear();keys.clear();pending.clear();send({type:'input',keys:[]})}
window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearKeys()});
// Original synthesized score and effects: no downloads, no copyrighted samples.
const DuelSound=(()=>{
 const defaults={enabled:true,music:.18,effects:.55};let prefs={...defaults};try{const saved=JSON.parse(localStorage.getItem('grail-audio-v1'));if(saved){prefs.enabled=typeof saved.enabled==='boolean'?saved.enabled:true;for(const k of ['music','effects'])if(Number.isFinite(saved[k]))prefs[k]=Math.max(0,Math.min(1,saved[k]))}}catch{}
 let ctx=null,master=null,music=null,effects=null,noise=null,unlocked=false,previous=null,lastObserve=0,step=0,next=0,mode='',current=null,voices=0;
 const cooldown=new Map();
 function save(){try{localStorage.setItem('grail-audio-v1',JSON.stringify(prefs))}catch{}volumes()}
 function volumes(){if(!ctx)return;master.gain.setTargetAtTime(prefs.enabled&&!document.hidden?.65:0,ctx.currentTime,.025);music.gain.setTargetAtTime(prefs.music*(current?.cinematic?.25:1),ctx.currentTime,.08);effects.gain.setTargetAtTime(prefs.effects,ctx.currentTime,.025)}
 async function unlock(){if(!prefs.enabled||(ctx?.state==='running'&&unlocked))return;try{if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx=new Audio();master=ctx.createGain();music=ctx.createGain();effects=ctx.createGain();const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.12;music.connect(master);effects.connect(master);master.connect(limiter);limiter.connect(ctx.destination);noise=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;volumes()}await ctx.resume();unlocked=true;next=ctx.currentTime}catch{}}
 function tone(freq,duration=.14,amp=.12,type='triangle',when=0,target=null,end=null){if(!ctx||ctx.state!=='running'||!prefs.enabled||document.hidden||voices>=36)return;const t=Math.max(ctx.currentTime,when),o=ctx.createOscillator(),g=ctx.createGain();voices++;o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,amp),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(target||effects);o.onended=()=>{o.disconnect();g.disconnect();voices--};o.start(t);o.stop(t+duration+.015)}
 function hiss(duration=.10,amp=.1,freq=1800,when=0,target=null){if(!ctx||ctx.state!=='running'||!prefs.enabled||document.hidden||voices>=36)return;const t=Math.max(ctx.currentTime,when),src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();voices++;src.buffer=noise;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.7;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);src.connect(filter);filter.connect(g);g.connect(target||effects);src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect();voices--};src.start(t);src.stop(t+duration+.01)}
 const hz=n=>440*2**((n-69)/12);
 function chime(notes,d=.1,amp=.12){if(!ctx)return;notes.forEach((n,i)=>tone(hz(n),.3,amp,'triangle',ctx.currentTime+i*d))}
 function play(kind,key=kind,char=''){
  if(!ctx||!unlocked||!prefs.enabled||document.hidden||prefs.effects===0)return;
  const now=ctx.currentTime;if(now-(cooldown.get(key)??-99)<.09)return;cooldown.set(key,now);
  switch(kind){
   case 'ui':tone(660,.055,.055);break;
   case 'hit':hiss(.08,.20,1300);tone(120,.15,.18,'triangle',0,null,45);break;
   case 'guard':tone(1450,.11,.10,'triangle',0,null,680);hiss(.07,.10,4000);break;
   case 'light':hiss(.09,.09,3300);break;
   case 'heavy':hiss(.18,.15,1700);tone(190,.15,.10,'sawtooth',0,null,75);break;
   case 'dash':hiss(.16,.11,2500);tone(300,.13,.06,'sine',0,null,800);break;
   case 'skill':{
    const f={saber:660,archer:420,lancer:880,gil:1050,iskandar:150,medusa:740,berserker:100}[char]||550;
    tone(f,.32,.12,'triangle',0,null,f*1.6);hiss(.18,.09,char==='berserker'?350:2600);break;
   }
   case 'seal':chime([72,79,84],.075,.13);break;
   case 'np':tone(65,.9,.16,'sine',0,null,180);chime([50,57,62,69,74],.13,.13);hiss(.4,.10,900);break;
   case 'release':hiss(.4,.24,850);tone(110,.6,.22,'triangle',0,null,35);break;
   case 'ready':chime([74,81,86],.09,.09);break;
   case 'count':tone(660,.12,.11,'square');break;
   case 'fight':chime([60,67,72],.07,.16);break;
   case 'win':chime([60,64,67,72,79],.14,.14);break;
   case 'lose':chime([67,63,60,55],.17,.11);break;
   case 'draw':chime([60,67,60],.17,.10);break;
   case 'augment':chime([72,76,83,88],.09,.10);break;
  }
 }
 const castActions=new Set(['skill','caladbolg','strike_air','spear_throw','chain_throw','royal_charge','axe_slam']);
 function observe(s,slot){
  current=s;volumes();const stamp=performance.now(),old=previous;previous=JSON.parse(JSON.stringify({phase:s.phase,round:s.round,code:s.code,delay:s.delay,cinematic:s.cinematic,paused:s.paused,players:s.players,result:s.result}));
  const gap=stamp-lastObserve;lastObserve=stamp;
  if(!old||old.code!==s.code||gap>1200||s.paused||old.paused||document.hidden)return;
  if(s.phase==='countdown'&&Math.ceil(s.delay)!==Math.ceil(old.delay??99))play('count','count:'+Math.ceil(s.delay));
  if(s.phase==='fight'&&old.phase==='countdown')play('fight');
  if(s.phase==='augment'&&old.phase!=='augment')play('augment');
  if(s.cinematic&&!old.cinematic)play('np','np');
  if(!s.cinematic&&old.cinematic&&s.phase==='fight')play('release');
  if(s.result&&!old.result)play(s.result.winner==null?'draw':s.result.winner===slot?'win':'lose');
  if(s.phase!=='fight'||s.cinematic)return;
  s.players.forEach((p,i)=>{const q=old.players[i];if(!q)return;const fresh=p.action!==q.action||p.anim>q.anim+.06;
   if(p.hp<q.hp||p.shield<(q.shield||0)||(p.damageTaken||0)>(q.damageTaken||0))play(p.action==='guard'?'guard':'hit','impact:'+i);
   if(p.seals<q.seals)play('seal','seal:'+i);
   if(p.np>=100&&q.np<100&&i===slot)play('ready');
   if(fresh){if(castActions.has(p.action))play('skill','cast:'+i,p.char);else if(['light','heavy','dash'].includes(p.action))play(p.action,'action:'+i)}
   if(p.action==='np_release'&&fresh&&!old.cinematic)play('release','release:'+i);
  });
 }
 // Eight-bar original minor-key loop; restrained lobby arpeggio, drums in combat.
 const roots=[50,50,46,46,53,53,48,45],melody=[0,7,12,10,7,3,7,12,14,12,7,3,10,7,3,2];
 function schedule(){if(!ctx||ctx.state!=='running'||!prefs.enabled||document.hidden||prefs.music===0)return;
  const s=current,newMode=s?.paused||s?.closed?'silent':s?.phase==='fight'?'fight':s?.phase==='ended'?'result':'lobby';
  if(mode!==newMode){mode=newMode;step=0;next=ctx.currentTime+.04}
  if(mode==='silent'||mode==='result')return;
  if(next<ctx.currentTime-.2)next=ctx.currentTime+.03;
  let count=0;while(next<ctx.currentTime+.15&&count++<3){const beat=step%16,bar=Math.floor(step/16)%8,root=roots[bar],fighting=mode==='fight',t=next;
   if(beat%4===0){tone(hz(root-12),.5,.11,'triangle',t,music);tone(hz(root+7),.65,.035,'sine',t,music)}
   tone(hz(root+12+melody[(beat+bar*2)%16]),fighting?.16:.32,fighting?.055:.035,'triangle',t,music);
   if(fighting&&!s?.cinematic){if(beat%4===0)tone(100,.16,.15,'sine',t,music,35);if(beat%8===4)hiss(.11,.065,1500,t,music);if(beat%2===0)hiss(.035,.025,6500,t,music)}
   step++;next+=(fighting?.145:.22);
  }
 }
 setInterval(schedule,100);
 document.addEventListener('pointerdown',()=>unlock(),{passive:true});document.addEventListener('keydown',()=>unlock());
 document.addEventListener('visibilitychange',()=>{previous=null;if(document.hidden){if(ctx)ctx.suspend().catch(()=>{})}else if(unlocked&&prefs.enabled)unlock()});
 const style=document.createElement('style');style.textContent='.duel-audio{color:#f2ead9;background:#142239;border:3px solid #d5bb7c;box-shadow:6px 6px #030914;width:min(390px,90vw);padding:24px;max-height:85dvh;overflow:auto}.duel-audio::backdrop{background:#030815bb}.duel-audio h2{margin:0 0 16px}.duel-audio label{display:grid;grid-template-columns:1fr auto;gap:8px;margin:18px 0;font-size:15px}.duel-audio input[type=range]{grid-column:1/-1;width:100%;min-height:30px;accent-color:#e6cd94}.duel-audio button{min-height:44px;margin:4px}.duel-audio p{font-size:12px;color:#c3d0e3}';document.head.append(style);
 const dialog=document.createElement('dialog');dialog.className='duel-audio';dialog.setAttribute('aria-label','소리 설정');dialog.innerHTML='<h2>소리 설정</h2><button type="button" data-audio-toggle></button><label>배경음 <output data-music-value></output><input aria-label="배경음 볼륨" data-music type="range" min="0" max="100" step="1"></label><label>효과음 <output data-effects-value></output><input aria-label="효과음 볼륨" data-effects type="range" min="0" max="100" step="1"></label><p>메뉴 · 전투 배경음 / 타격 · 스킬 · 보구 · 승패 효과음</p><button type="button" data-audio-test>효과음 듣기</button><button type="button" data-audio-close>닫기</button>';document.body.append(dialog);
 const toggle=dialog.querySelector('[data-audio-toggle]');function labels(){toggle.textContent=prefs.enabled?'전체 소리 끄기':'전체 소리 켜기';$('sound').textContent=prefs.enabled?'소리 설정 ♪':'소리 설정 · 꺼짐';for(const k of ['music','effects']){dialog.querySelector('[data-'+k+']').value=Math.round(prefs[k]*100);dialog.querySelector('[data-'+k+'-value]').textContent=Math.round(prefs[k]*100)+'%'}}
 toggle.onclick=()=>{prefs.enabled=!prefs.enabled;save();labels();if(prefs.enabled)unlock()};for(const k of ['music','effects'])dialog.querySelector('[data-'+k+']').oninput=e=>{prefs[k]=Number(e.target.value)/100;save();labels()};dialog.querySelector('[data-audio-close]').onclick=()=>dialog.close();dialog.querySelector('[data-audio-test]').onclick=async()=>{await unlock();play('seal')};$('sound').onclick=()=>{clearKeys();dialog.showModal();unlock()};labels();
 document.addEventListener('click',e=>{if(e.target.closest?.('button')&&!dialog.contains(e.target))play('ui')});
 return {observe,reset(){previous=null;current=null;mode='';next=ctx?.currentTime||0},blocked:()=>dialog.open};
})();

// Native-resolution HUD: text never passes through the 640px pixel-art buffer.
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
  sides.forEach((v,i)=>{const p=s.players[i];v.side.hidden=!p;if(!p)return;v.side.classList.toggle('enemy',i!==slot);if(v.portraitChar!==p.char&&GrailArt.portraits[p.char]){const g=v.portrait.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,128,172);g.drawImage(GrailArt.portraits[p.char],0,0,128,172);v.portraitChar=p.char}set(v.name,'P'+(i+1)+' · '+defs[p.char].name);set(v.player,'P'+(i+1)+(i===slot?' · 나':' · 상대'));set(v.hp,Math.ceil(p.hp)+' / '+Math.ceil(p.maxHp||100)+' HP');const width=(Math.max(0,Math.min(1,p.hp/(p.maxHp||100)))*100).toFixed(1)+'%';if(v.fill.style.width!==width)v.fill.style.width=width;set(v.mana,'마나 '+Math.floor(p.mana));set(v.np,p.np>=100?'보구 준비 [U]':'보구 '+Math.floor(p.np)+'%');v.np.classList.toggle('ready',p.np>=100);set(v.seals,'◆'.repeat(Math.max(0,p.seals))+'◇'.repeat(Math.max(0,3-p.seals)));v.seals.setAttribute('aria-label','남은 영주 '+p.seals+'개');v.seals.title='영주 [I] · '+p.seals+'개';v.mpFill.style.width=Math.max(0,Math.min(100,p.mana))+'%';v.npFill.style.width=Math.max(0,Math.min(100,p.np))+'%';v.npBar.classList.toggle('ready',p.np>=100);const status=[];if(p.shield>0)status.push('보호막 '+Math.ceil(p.shield));if(p.char==='berserker'&&p.godTime>0)status.push('갓 핸드 '+p.godTime.toFixed(1)+'초');set(v.buff,status.join(' · '));v.buff.hidden=!status.length});
  set(round,'R '+(s.round||1));set(clock,s.training?'∞':String(Math.ceil(s.clock)));set(score,(s.score||[0,0]).join(' : '));training.hidden=!s.training;if(s.training){const d=s.players.find(p=>p.dummy),fmt=n=>Number(n||0).toFixed(1);set(training,'연습  |  누적 피해 '+fmt(d?.damageTaken)+'  |  최근 피해 '+fmt(d?.lastDamage))}
 }
 return {update};
})();

const view=$('battle').getContext('2d'),buffer=document.createElement('canvas');buffer.width=640;buffer.height=330;const c=buffer.getContext('2d');
let impactUntil=0,visualTime=0,previousRoster=0;
function text(s,x,y,size=14,color='#fff',align='left'){c.font=`bold ${size}px monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y)}
function draw(now){CrispHUD.update(state,session?.slot);const dt=Math.min(.05,(now-lastFrame)/1000||.016);lastFrame=now;const realTime=now/1000;
 if(!state||(!state.paused&&!state.cinematic))visualTime+=dt;
 if(GrailArt.ready&&now-previousRoster>140&&!state){drawRoster(realTime);previousRoster=now}
 if(state&&GrailArt.ready){const s=state,t=visualTime;c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;
  c.save();if(now<impactUntil&&!s.paused)c.translate(Math.round(Math.sin(now*1.7)*4)*2,0);
  GrailArt.background(c,t);
  s.players.forEach((p,i)=>{const old=smoothed[i]||{x:p.x,y:p.y},a=1-Math.exp(-25*dt);old.x+=(p.x-old.x)*a;old.y=p.y<=0?0:old.y+(p.y-old.y)*a;smoothed[i]=old;fighter(c,{...p,...old,airborne:p.y>0||p.vy>0},t)});
  GrailArt.effects(c,s,t);c.restore();
  if(s.phase==='countdown'){c.fillStyle='#06112e9a';c.fillRect(0,235,1280,100);text(s.phase==='countdown'?String(Math.ceil(s.delay)):s.banner,640,292,54,'#fff1c3','center');text(s.phase==='countdown'?'ROUND '+s.round:'',640,327,15,'#e6e7ef','center')}
  text('F U Y U K I  /  M O O N L I T  R I V E R S I D E',640,641,10,'#d3d9ef','center');
  NobleCinema.draw(c,s);ResultCinema.draw(c,s,session.slot);view.imageSmoothingEnabled=false;view.clearRect(0,0,1280,660);view.drawImage(buffer,0,0,1280,660);
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




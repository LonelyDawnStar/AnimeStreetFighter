'use strict';
const $=id=>document.getElementById(id),defs={saber:{name:'알트리아',cls:'SABER',color:'#79c9ff',body:'#274b9d',hair:'#f2d788',style:'균형 · 검술',desc:'L: 스트라이크 에어 · 바람 참격. 보구: 거대 마력 검을 휘두르는 엑스칼리버',np:'EXCALIBUR'},archer:{name:'에미야',cls:'ARCHER',color:'#ff7878',body:'#ae3544',hair:'#e6e8ed',style:'기동 · 투사체',desc:'L: 칼라드볼그 · 0.9초 충전 후 피해 28 · 마나 24. 충전 중 피격 시 취소. 보구: 무한의 검제',np:'UNLIMITED BLADE WORKS'},lancer:{name:'쿠 훌린',cls:'LANCER',color:'#65ede1',body:'#247297',hair:'#244877',style:'속도 · 긴 사거리',desc:'L: 투창 · 게이 볼그를 던져 견제. 보구: 게이 볼그',np:'GAE BOLG'},gil:{name:'길가메시',cls:'ARCHER',color:'#ffd477',body:'#c79b46',hair:'#f1d87e',style:'견제 · 연속 투사체',desc:'세 발의 투사체로 공간을 장악. 보구: 에누마 엘리시',np:'ENUMA ELISH'}};
Object.assign(defs,{berserker:{name:'헤라클레스',cls:'BERSERKER',color:'#dc9464',style:'중량 · 재기',desc:'L: 부검 내려치기 · 준비 0.48초 / 피해 24. U: 갓 핸드 · 체력 12% 회복, 6초 피해 35% 감소, 효과 중 1회 재기(라운드당 1회). 원작 능력을 대전용으로 조정',np:'GOD HAND'},iskandar:{name:'이스칸다르',cls:'RIDER',color:'#e6aa62',style:'중량 · 돌격',desc:'L: 검을 앞세운 돌격 · 피해 22. 보구: 왕의 군세 · 군대와 함께 돌진',np:'IONIOI HETAIROI'},medusa:{name:'메두사',cls:'RIDER',color:'#bf99ec',style:'기동 · 사슬 견제',desc:'L: 사슬 단검 투척 · 피해 14. 보구: 벨레로폰 · 페가수스 돌진',np:'BELLEROPHON'}});
let selected='saber',session=null,state=null,keys=new Set(),pending=new Set(),generation=0,sound=false,audio=null,lastHealth=null,smoothed=[],lastFrame=0;
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
function applyState(s){state=s;updateUI();if(lastHealth&&s.players.some((p,i)=>p.hp<lastHealth[i])){beep();impactUntil=performance.now()+110;}lastHealth=s.players.map(p=>p.hp)}
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
$('sound').onclick=()=>{sound=!sound;if(sound){audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume()}$('sound').textContent=sound?'소리 끄기':'소리 켜기'};function beep(){if(!sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(170,audio.currentTime);o.frequency.exponentialRampToValueAtTime(45,audio.currentTime+.09);g.gain.setValueAtTime(.12,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.13)}
const view=$('battle').getContext('2d'),buffer=document.createElement('canvas');buffer.width=640;buffer.height=330;const c=buffer.getContext('2d');
let impactUntil=0,visualTime=0,previousRoster=0;
function text(s,x,y,size=14,color='#fff',align='left'){c.font=`bold ${size}px monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y)}
function draw(now){const dt=Math.min(.05,(now-lastFrame)/1000||.016);lastFrame=now;const realTime=now/1000;
 if(!state||(!state.paused&&!state.cinematic))visualTime+=dt;
 if(GrailArt.ready&&now-previousRoster>140&&!state){drawRoster(realTime);previousRoster=now}
 if(state&&GrailArt.ready){const s=state,t=visualTime;c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;
  c.save();if(now<impactUntil&&!s.paused)c.translate(Math.round(Math.sin(now*1.7)*4)*2,0);
  GrailArt.background(c,t);
  s.players.forEach((p,i)=>{const old=smoothed[i]||{x:p.x,y:p.y},a=1-Math.exp(-25*dt);old.x+=(p.x-old.x)*a;old.y=p.y<=0?0:old.y+(p.y-old.y)*a;smoothed[i]=old;fighter(c,{...p,...old,airborne:p.y>0||p.vy>0},t)});
  GrailArt.effects(c,s,t);c.restore();GrailArt.hud(c,s,session.slot);
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


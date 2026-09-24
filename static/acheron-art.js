'use strict';
const AcheronArt=(()=>{
 let frames=[],white=[];
 const rect=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,w,h)};
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 function install(art,image,awakened){
  const anchors=[170,500,790,1100,175,480,810,1100,160,485,820,1110,160,485,800,1100].map(x=>x*image.width/1254);
  frames=art.unpack(image,4,anchors,4);const scale=224/frames[0].foot;frames.forEach(f=>f.scale=scale);
  white=art.unpack(awakened,4,[200,675,1125,1560,205,645,1110,1510].map(x=>x*awakened.width/1774),2);white.forEach(f=>f.scale=224/white[0].foot);
  art.frames.acheron={idle:[frames[0]],run:[frames[1],frames[2]],jump:[frames[3]],attack:[frames[4],frames[5],frames[5],frames[0]],guard:[frames[8]],hurt:[frames[9]],dash:[frames[10]],release:[frames[11],frames[12],frames[12],frames[12]]};
  const c=document.createElement('canvas');c.width=96;c.height=116;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(frames[0].canvas,frames[0].pivot-43,2,96,116,0,0,96,116);art.portraits.acheron=c;
 }
 const progress=p=>clamp(1-(p.visualAnim??p.anim)/(p.animMax||.3));
 function frame(p,t){
  const q=progress(p),awakened=p.rainCharges>0||p.rainFinishing;
  if(p.stun>0)return awakened?white[5]:frames[9];
  if(p.action==='octobolt'){
   // Keep the actual .28s release at 33% of the .85s action.
   return awakened?white[q<.24?0:q<.33?7:q<.72?7:0]:frames[q<.24?6:q<.33?4:q<.62?7:q<.85?4:0];
  }
  if(p.action==='light')return frames[q<.12?5:q<.57?7:q<.85?4:0];
  if(p.action==='heavy')return frames[q<.13?5:q<.63?7:q<.88?6:0];
  if(p.action==='acheron_awaken')return frames[12];
  if(p.action==='acheron_finish')return frames[q<.3?13:q<.43?14:q<.82?15:12];
  if(p.action==='rainblade'){
   const step=(Math.max(1,p.rainStep)-1)%3;
   return frames[(step===0?[14,13,12]:step===1?[13,14,12]:[14,15,12])[q<.17?0:q<.8?1:2]];
  }
  if(awakened){
   if(p.action==='dash')return white[6];if(p.y>0)return white[3];if(p.action==='guard')return white[4];if(p.action==='run')return white[1+Math.floor((((p.gait||0)%1+1)%1)*2)];return white[0];
  }
  return null;
 }
 function offset(p){
  if(p.stun>0)return 0;const q=progress(p);
  if(p.action==='octobolt')return q<.33?-8*ease(q/.33):q<.65?18*(1-ease((q-.33)/.32)):0;
  if(['light','heavy','rainblade'].includes(p.action))return 9*Math.sin(Math.PI*q)*(1-q);
  if(p.action==='acheron_finish')return q<.43?-7*ease(q/.43):22*(1-ease((q-.43)/.57));
  return 0;
 }
 function motion(g,p){g.translate(Math.round(offset(p)),0)}
 // Extrapolate the visual timer between network snapshots, never combat state.
 const clocks=[];
 function prepare(p,t,slot){
  let c=clocks[slot];
  if(!c||c.char!==p.char||c.action!==p.action||c.anim!==p.anim){c={char:p.char,action:p.action,anim:p.anim,at:t};clocks[slot]=c}
  return {...p,visualAnim:Math.max(0,p.anim-Math.min(.05,Math.max(0,t-c.at)))};
 }
 function slash(g,x,y,face,reach,phase,color,step=1){
  const q=clamp(phase);if(q>=1)return;
  g.save();g.translate(Math.round(x),Math.round(y));g.scale(face,1);
  const sweep=clamp(q/.28),direction=step%2?1:-1;
  g.globalAlpha=Math.min(1,(1-q)*2.5);g.fillStyle=color;
  const points=[];for(let i=0;i<=18;i++){const a=-1.28+2.3*sweep*i/18;points.push([24+Math.cos(a)*reach,Math.sin(a)*reach*.5*direction])}
  g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x/2)*2,Math.round(y/2)*2):g.moveTo(Math.round(x/2)*2,Math.round(y/2)*2));
  for(let i=points.length-1;i>=0;i--)g.lineTo(24+(points[i][0]-24)*.92,points[i][1]*.92);g.closePath();g.fill();
  g.strokeStyle='#fff0ee';g.lineWidth=3;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
  g.globalAlpha*=.55;g.strokeStyle=color;g.lineWidth=2;g.beginPath();g.moveTo(5,-28*direction);g.lineTo(reach+65,35*direction);g.stroke();g.restore();
 }
 function lightning(g,x,y,face,reach,t,color){
  g.save();g.strokeStyle=color;g.lineWidth=3;g.beginPath();for(let n=0;n<=14;n++){const xx=x+face*reach*n/14,yy=y+Math.sin(n*13+Math.floor(t*15))*24;n?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.stroke();g.restore();
 }
 function effects(g,s,t){
  for(const p of s.players)if(p.char==='acheron'&&['light','heavy'].includes(p.action)&&p.stun<=0){const q=progress(p);if(q<.7)slash(g,p.x+offset(p)*(p.face||1),535-p.y-123,p.face,p.action==='heavy'?175:140,q/.7,'#bd91ed',p.action==='heavy'?2:1)}
  for(const p of s.players)if(p.char==='acheron'&&(p.rainCharges>0||p.rainFinishing)){
   for(let i=0;i<p.rainCharges;i++)rect(g,p.x-15+i*12,535-p.y-240,6,10,'#fb5881');
  }
  for(const f of s.fx)if(f.kind==='rainblade')slash(g,f.x,535-f.y,f.face,215,1-f.life/.45,'#ff3764',f.step);
  for(const sh of s.shots){if(!['octobolt','stygian'].includes(sh.kind))continue;const x=sh.x,y=535-sh.y,finish=sh.kind==='stygian';
   if(sh.delay>0){g.save();g.globalAlpha=.45;rect(g,sh.face>0?x:x-sh.reach,y-2,sh.reach,3,finish?'#ff6c8c':'#bd9dff');g.restore();continue}
   if(finish){
    g.save();g.globalAlpha=Math.min(.22,sh.life*.5);g.fillStyle='#160418';g.fillRect(0,145,1280,430);g.restore();
    slash(g,x,y,sh.face,sh.reach,sh.elapsed/.42,'#ff285b',3);slash(g,x,y-16,sh.face,sh.reach*.9,sh.elapsed/.42,'#c390ff',2);
    lightning(g,x,y,sh.face,sh.reach,t,'#ff89ad');
   }else{slash(g,x,y,sh.face,sh.reach,sh.elapsed/.25,'#bda4ff');lightning(g,x,y,sh.face,sh.reach,t,'#e1d1ff')}
  }
 }
 function body(g,index,x,y,size,angle=0){const f=frames[index];if(!f)return;g.save();g.translate(x,y);g.rotate(angle);g.imageSmoothingEnabled=false;g.drawImage(f.canvas,-f.pivot*f.scale*size,-f.foot*f.scale*size,f.canvas.width*f.scale*size,f.canvas.height*f.scale*size);g.restore()}
 function background(g,t,red=0){
  const sky=g.createLinearGradient(0,0,0,660);sky.addColorStop(0,'#04040d');sky.addColorStop(.65,red?'#361022':'#19132d');sky.addColorStop(1,'#050916');g.fillStyle=sky;g.fillRect(0,0,1280,660);
  // Eclipse over shallow water, rain and reflected light share the same horizon.
  const glow=g.createRadialGradient(885,255,78,885,255,245);glow.addColorStop(0,red?'#e3507255':'#b1a8ed44');glow.addColorStop(1,'#09071300');g.fillStyle=glow;g.fillRect(610,0,550,515);
  g.fillStyle=red?'#eb5b79':'#a39fcf';g.beginPath();g.arc(885,255,102,0,Math.PI*2);g.fill();g.fillStyle='#06060f';g.beginPath();g.arc(881,248,98,0,Math.PI*2);g.fill();
  rect(g,0,465,1280,2,red?'#a94668':'#68648b');
  for(let i=0;i<40;i++){const yy=478+i*4,w=18+i*7;rect(g,885-w/2+Math.sin(t*2+i*.9)*13,yy,w,2,i%3?'#352439':'#92687b')}
  for(let i=0;i<60;i++){const x=(i*157-t*28+1400)%1400,y=(i*93+t*185)%660;rect(g,x,y,2,9+i%8,red?'#bd64714a':'#a49cc13b')}
  for(let i=0;i<13;i++){const x=(i*137+t*40)%1300,y=530+Math.sin(i*2+t)*55;g.save();g.translate(x,y);g.rotate(i+t*.4);rect(g,-5,-2,10,4,red?'#df416c':'#a483ba');g.restore()}
 }
 function streak(g,q,angle=0){
  q=clamp(q);g.save();g.translate(640,330);g.rotate(angle);g.globalAlpha=Math.min(1,q*15,(1-q)*4);
  rect(g,-900,-13,1800,26,'#aa1e5366');rect(g,-900,-5,1800,10,'#ff487c');rect(g,-900,-1,1800,2,'#fff4e8');
  for(let i=0;i<10;i++)rect(g,-850+i*185+q*200,20+i%3*7,95,2,'#e9557f');g.restore();
 }
 function cinema(g,t){
  t=clamp(t/5.2)*5.2;g.save();background(g,t,t>2.1);
  if(t<1.15){
   const q=ease(t/1.15);body(g,11,500-q*28,865-q*18,3.1);
   // Tight eye/hand framing; source pixels are unchanged.
   g.fillStyle='#04040d';g.fillRect(0,0,1280,110);g.fillRect(0,535,1280,125);
   g.strokeStyle='#b19cca';g.lineWidth=1;g.beginPath();g.moveTo(760,340);g.lineTo(1090,340);g.stroke();
   for(let i=0;i<7;i++)rect(g,820+i*27,355,2,30+i%3*16,'#aa4776');
  }else if(t<2.1){
   const q=(t-1.15)/.95;body(g,q<.38?6:q<.55?4:7,450+ease(q)*100,572,1.7);if(q>.4)streak(g,(q-.4)/.6,-.09);
   for(let i=0;i<18;i++)rect(g,330+i*24+q*60,570+i%3*4,9,2,'#af81ae');
  }else if(t<2.65){
   const q=(t-2.1)/.55;g.fillStyle='#06060f';g.fillRect(0,0,1280,660);body(g,12,560,590,1.85);
   g.globalAlpha=1-q;g.fillStyle='#ddcada';g.fillRect(0,324,1280,8);g.globalAlpha=1;
   for(let i=0;i<28;i++)rect(g,(i*131+q*95)%1280,660-(i*77+q*490)%660,2,20,'#da466c');
  }else if(t<3.65){
   const q=(t-2.65);const index=q<.17?14:q<.38?13:15;
   body(g,index,430+ease(q)*245,580,1.72);
   if(q>.18){streak(g,(q-.18)/.82,-.23);for(let i=0;i<16;i++)rect(g,600+i*39+q*160,390-i*9+Math.sin(i)*20,16,2,'#da7797')}
   // A single short impact accent, no repeated flashing.
   if(q>.2&&q<.26){g.globalAlpha=.23;g.fillStyle='#e4d9e5';g.fillRect(0,32,1280,592);g.globalAlpha=1}
  }else{
   const q=ease((t-3.65)/1.55);body(g,12,560-q*40,584,1.75);
   g.save();g.globalAlpha=clamp((t-3.85)*2);for(let i=0;i<3;i++){g.save();g.translate(930+i*53,388);g.rotate(Math.PI/4);rect(g,-8,-8,16,16,'#e9436d');rect(g,-3,-3,6,6,'#ffe6e7');g.restore()}g.restore();
   for(let i=0;i<12;i++)rect(g,280+i*37,577+Math.sin(i+t*2)*4,14,2,'#825b83');
  }
  g.fillStyle='#04040d';g.fillRect(0,0,1280,32);g.fillRect(0,624,1280,36);g.restore();
 }
 return {install,frame,effects,cinema,motion,prepare,get frames(){return frames},get white(){return white}};
})();

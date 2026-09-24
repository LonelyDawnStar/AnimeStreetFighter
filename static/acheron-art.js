'use strict';
const AcheronArt=(()=>{
 let frames=[],white=[],combat=[];
 const rect=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,w,h)};
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 function install(art,image,awakened){
  const anchors=[170,500,790,1100,175,480,810,1100,160,485,820,1110,160,485,800,1100].map(x=>x*image.width/1254);
  frames=art.unpack(image,4,anchors,4);const scale=224/frames[0].foot;frames.forEach(f=>f.scale=scale);
  white=art.unpack(awakened,4,[200,675,1125,1560,205,645,1110,1510].map(x=>x*awakened.width/1774),2);white.forEach(f=>f.scale=224/white[0].foot);
  const updated=new Image();updated.onload=()=>{try{
   const f=DuelMotion.extract(updated,4,'acheron-combat');
   // Standing recovery provides the body scale; raised blades must not shrink the fighter.
   for(let row=0;row<4;row++){const scale=224/f[row*4+3].height;f.slice(row*4,row*4+4).forEach(v=>v.scale=scale)}
   combat=f;
  }catch(e){console.warn('Acheron motion fallback',e)}};updated.src='/assets/acheron-combat-v047.png';
  art.frames.acheron={idle:[frames[0]],run:[frames[1],frames[2]],jump:[frames[3]],attack:[frames[4],frames[5],frames[5],frames[0]],guard:[frames[8]],hurt:[frames[9]],dash:[frames[10]],release:[frames[11],frames[12],frames[12],frames[12]]};
  const c=document.createElement('canvas');c.width=96;c.height=116;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(frames[0].canvas,frames[0].pivot-43,2,96,116,0,0,96,116);art.portraits.acheron=c;
 }
 function frame(p,t){
  if(combat.length){
   const q=clamp(1-p.anim/(p.animMax||.3));
   if(p.action==='octobolt')return combat[(p.rainCharges>0?4:0)+(q<.22?0:q<.34?1:q<.65?2:3)];
   if(p.action==='rainblade'){const row=(Math.max(1,p.rainStep)-1)%3+1;return combat[row*4+(q<.15?0:q<.4?1:q<.8?2:3)]}
   if(p.action==='acheron_finish')return combat[12+(q<.35?0:q<.53?1:q<.78?2:3)];
   if(p.action==='acheron_awaken')return combat[7];
   if(['light','heavy','attack'].includes(p.action)&&!p.rainCharges)return combat[q<.18?0:q<.4?1:q<.75?2:3];
  }
  if(p.action==='octobolt'){const e=((p.animMax||.85)-p.anim)*(p.attackSpeed||1);return p.rainCharges>0?white[e<.28?0:e<.55?7:0]:frames[e<.28?6:e<.55?7:0]}
  if(p.action==='acheron_awaken')return frames[12];
  if(p.action==='acheron_finish')return frames[p.anim>.43?14:15];
  if(p.action==='rainblade'){const progress=1-p.anim/(p.animMax||.3);return frames[progress<.18?12:progress<.78?13+(Math.max(1,p.rainStep)-1)%3:12]}
  if(p.rainCharges>0||p.rainFinishing){
   if(p.stun>0)return white[5];if(p.action==='dash')return white[6];if(p.y>0)return white[3];if(p.action==='guard')return white[4];if(p.action==='run')return white[1+Math.floor(((p.gait||0)%1+1)%1*2)];return white[0];
  }
  return null;
 }
 function slash(g,x,y,face,reach,phase,color,step=1){
  g.save();g.translate(x,y);g.scale(face,1);const q=clamp(phase),rise=step%2?-1:1;g.globalAlpha=Math.min(1,(1-q)*3);g.strokeStyle=color;g.lineWidth=12*(1-q)+2;g.beginPath();g.moveTo(15,-rise*55);g.quadraticCurveTo(reach*.48,rise*95,reach,rise*20);g.stroke();g.strokeStyle='#f6e4ff';g.lineWidth=3;g.stroke();
  for(let n=0;n<12;n++){const xx=35+(n*43+q*100)%Math.max(40,reach-35);rect(g,xx,Math.sin(n*3+q*9)*50,8,3,color)}g.restore();
 }
 function lightning(g,x,y,face,reach,t,color){
  g.save();g.strokeStyle=color;g.lineWidth=3;g.beginPath();for(let n=0;n<=14;n++){const xx=x+face*reach*n/14,yy=y+Math.sin(n*13+Math.floor(t*15))*24;n?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.stroke();g.restore();
 }
 function effects(g,s,t){
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
 function background(g,t){
  g.fillStyle='#050710';g.fillRect(0,0,1280,660);
  for(let n=0;n<45;n++)rect(g,(n*137+t*9)%1280,110+(n*37)%320,2,2,n%5?'#47495d':'#c5c3cc');
  g.strokeStyle='#b73d61';g.lineWidth=3;g.beginPath();g.arc(900,210,126,0,Math.PI*2);g.stroke();g.strokeStyle='#531b36';g.lineWidth=17;g.beginPath();g.arc(900,210,112,0,Math.PI*2);g.stroke();
  rect(g,0,474,1280,3,'#7d526e');for(let i=0;i<25;i++){const w=80+i*13;rect(g,900-w/2+Math.sin(t*1.6+i)*15,487+i*6,w,2,i%3?'#321626':'#724255')}
  for(let n=0;n<16;n++){const x=(n*193+t*45)%1300,y=70+(n*89+t*19)%500;rect(g,x,y,5,3,'#af3152')}
 }
 function pose(g,index,x,y,size){
  const f=combat[index];if(!f){body(g,index<4?11:12,x,y,size);return}
  g.save();g.translate(x,y);g.imageSmoothingEnabled=false;g.drawImage(f.canvas,-f.pivot*f.scale*size,-f.foot*f.scale*size,f.canvas.width*f.scale*size,f.canvas.height*f.scale*size);g.restore();
 }
 function cut(g,q,angle,width=8){
  g.save();g.translate(640,330);g.rotate(angle);g.globalAlpha=Math.min(1,q*12,(1-q)*5);rect(g,-850,-width/2,1700,width,'#fa345f');rect(g,-850,-1,1700,2,'#fff1ed');
  for(let i=0;i<12;i++)rect(g,-700+i*130+q*280,15+i%3*6,80,2,'#981c45');g.restore();
 }
 function cinema(g,t){
  t=clamp(t/5.2)*5.2;g.save();background(g,t);
  // A continuous draw, awakening and single cut. The three playable charges remain unspent.
  if(t<1.25){
   const q=ease(t/1.25);pose(g,q<.72?0:1,450+q*42,700-q*20,2.65);
   g.fillStyle='#050710';g.fillRect(0,0,1280,185);g.fillRect(0,470,1280,190);
   rect(g,0,468,1280,2,'#7d2c56');
   for(let i=0;i<18;i++)rect(g,820+i*23,220+i%3*38,1,130,'#56203c');
  }else if(t<2.15){
   const q=ease((t-1.25)/.9);pose(g,q<.35?1:2,420+q*110,565,1.65);
   cut(g,q,-.055,4+q*8);
  }else if(t<2.75){
   const q=(t-2.15)/.6;g.fillStyle='#0c0710';g.fillRect(0,0,1280,660);
   pose(g,4,540,575,1.7);for(let i=0;i<32;i++)rect(g,(i*113+q*240)%1280,660-((i*79+q*800)%660),2,20,'#9d345a');
   cut(g,q,.12,3);
  }else if(t<3.65){
   const q=clamp((t-2.75)/.9);pose(g,q<.2?4:q<.43?5:q<.8?6:7,490+ease(q)*80,575,1.7);
   if(q>.2)cut(g,(q-.2)/.8,.42,20);
   if(q>.3&&q<.38){g.globalAlpha=.3;g.fillStyle='#fff2ec';g.fillRect(0,0,1280,660);g.globalAlpha=1}
  }else{
   const q=ease((t-3.65)/1.55);pose(g,7,510-q*30,575,1.7);
   g.strokeStyle='#ee587a';g.lineWidth=2;g.beginPath();g.moveTo(770,220);g.lineTo(1110,220);g.stroke();
   for(let i=0;i<3;i++){const a=clamp((t-3.85-i*.15)*4);g.save();g.globalAlpha=a;g.translate(810+i*95,310);g.rotate(Math.PI/4);rect(g,-14,-14,28,28,'#f45b80');rect(g,-7,-7,14,14,'#ffd7dc');g.restore()}
   g.fillStyle='#ebc9dc';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText('다음 평타 3회 강화',905,390);
  }
  g.fillStyle='#050610';g.fillRect(0,0,1280,32);g.fillRect(0,624,1280,36);g.restore();
 }
 return {install,frame,effects,cinema,get combat(){return combat},get frames(){return frames},get white(){return white}};
})();


'use strict';
const MagnusArt=(()=>{
 let frames=[],bike=[],stage;
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 function install(art,image,bikeImage,roadImage){
  stage=roadImage;
  const raw=art.unpack(image,4,Array(20).fill(0),5);
  const xy=[[47,17],[397,17],[779,12],[1122,17],[58,236],[372,273],[774,270],[1130,279],[45,487],[429,484],[745,491],[1140,480],[75,647],[405,681],[744,692],[1097,700],[53,951],[377,890],[750,970],[1110,877]];
  const pivots=[147,120,111,123,141,138,105,104,121,121,117,124,81,116,147,153,117,161,129,136];
  frames=xy.map(([x,y],i)=>{const f=raw.find(f=>f.source.minx===x&&f.source.miny===y);if(!f)throw Error('매그너스 프레임 누락');f.pivot=pivots[i];f.scale=230/211;return f});
  const pieces=art.unpack(bikeImage,9,Array(9).fill(0),1);
  const positions=[[14,91],[432,125],[884,125],[1329,183],[22,554],[487,633],[903,616],[1348,559]];
  bike=positions.map(([x,y],i)=>{const f=pieces.find(f=>f.source.minx===x&&f.source.miny===y);if(!f)throw Error('매그너스 바이크 프레임 누락');f.pivot=i===0?f.canvas.width/2:165;f.scale=.60;return f});
  // Dismount is two disconnected alpha islands, kept together in its own atlas cell.
  const rider=pieces.find(f=>f.source.minx===563&&f.source.miny===486),lower=bike[5];
  const c=document.createElement('canvas');c.width=408;c.height=358;const g=c.getContext('2d');g.drawImage(lower.canvas,0,147);g.drawImage(rider.canvas,76,0);bike[5]={canvas:c,pivot:165,foot:356,scale:.60};
  art.frames.magnus={idle:[frames[0]],run:[frames[1],frames[2],frames[3],frames[2]],attack:[frames[4],frames[5],frames[6],frames[7]],jump:[frames[12]],guard:[frames[13]],hurt:[frames[14]],dash:[frames[15]],release:[frames[16],bike[1],bike[3]]};
  const face=document.createElement('canvas');face.width=96;face.height=116;const fg=face.getContext('2d');fg.imageSmoothingEnabled=false;fg.drawImage(bike[0].canvas,100,0,250,302,0,0,96,116);art.portraits.magnus=face;
 }
 function frame(p,t){
  const q=clamp(1-(p.anim||0)/(p.animMax||1));
  if(p.stun>0)return frames[14];
  if(p.action==='magnus_spin')return frames[q<.09?4:8+Math.floor((q-.09)*24)%4];
  if(p.action==='magnus_bike')return bike[q<.13?1:q<.24?2:3];
  if(p.action==='magnus_exit')return frames[q<.55?17:q<.92?18:0];
  if(['light','heavy'].includes(p.action))return frames[q<.12?4:q<.48?5:q<.78?6:7];
  return null;
 }
 function blast(g,x,y,q,size=130){
  if(q<0||q>=1)return;
  for(let n=0;n<34;n++){
   const a=n*2.399,r=size*q*(.45+n%5*.14),xx=Math.round((x+Math.cos(a)*r)/4)*4,yy=Math.round((y+Math.sin(a)*r*.72)/4)*4;
   const w=Math.max(4,Math.round((1-q)*(16+n%4*8)/4)*4);g.fillStyle=q<.45?(n%3?'#f0ac55':'#fff0ba'):(n%3?'#685a54':'#baa383');g.fillRect(xx,yy,w,w);
  }
 }
 function smoke(g,x,y,t,face,size=1){for(let n=0;n<12;n++){const age=(t*2+n*.083)%1,w=(3+Math.floor(age*5))*size;g.fillStyle=n%2?'#655b5c':'#988675';g.globalAlpha=(1-age)*.6;g.fillRect(Math.round(x-face*age*95*size),Math.round(y-age*18*size),w,w)}g.globalAlpha=1}
 function effects(g,s,t){
  for(const sh of s.shots){
   if(sh.kind==='magnus_spin'&&sh.delay<=0){
    for(let i=0;i<22;i++){const a=t*24+i*.285,r=145;g.fillStyle=i%4?'#bdbec9':'#fff1d6';const x=sh.x+Math.cos(a)*r,y=535-sh.y+Math.sin(a)*35;g.fillRect(Math.round(x/4)*4,Math.round(y/4)*4,8,4)}
   }
   if(sh.kind==='magnus_bike'){
    if(!sh.rider){const f=bike[6];g.save();g.translate(Math.round(sh.x),535);g.scale(sh.face,1);g.imageSmoothingEnabled=false;g.drawImage(f.canvas,-f.pivot*f.scale,-f.foot*f.scale,f.canvas.width*f.scale,f.canvas.height*f.scale);g.restore()}
    smoke(g,sh.x-sh.face*70,520,sh.elapsed,sh.face,2);
   }
  }
  for(const f of s.fx)if(f.kind==='magnus_blast')blast(g,f.x,535-f.y,1-f.life/.48,160);
  for(const p of s.players)if(p.char==='magnus'&&['light','heavy'].includes(p.action)&&p.stun<=0){const q=clamp(1-p.anim/(p.animMax||1));if(q<.65)for(let n=0;n<9;n++){const a=-1+n*.18+q*2;g.fillStyle=n%3?'#b8bbca':'#ffe2b0';g.fillRect(Math.round((p.x+p.face*Math.cos(a)*135)/4)*4,Math.round((415-p.y+Math.sin(a)*60)/4)*4,8,4)}}
 }
 const film=document.createElement('canvas');film.width=384;film.height=198;const g=film.getContext('2d');
 function box(x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
 function actor(f,x,foot,scale){g.drawImage(f.canvas,Math.round(x-f.pivot*scale),Math.round(foot-f.foot*scale),Math.round(f.canvas.width*scale),Math.round(f.canvas.height*scale))}
 function road(t,speed=1){
  const shift=Math.floor(t*speed*13)%384;
  g.drawImage(stage,-shift,0,384,198);g.drawImage(stage,384-shift,0,384,198);
  const near=Math.floor(t*speed*95)%384,sy=Math.floor(stage.height*.65);
  for(let n=0;n<2;n++)g.drawImage(stage,0,sy,stage.width,stage.height-sy,n*384-near,129,384,69);
 }
 function cinema(target,time){
  if(bike.length!==8)return;const t=Math.max(0,Math.min(5.799,time));g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.imageSmoothingEnabled=false;road(t,0);
  if(t<.85){const q=ease(t/.85);box(0,0,384,198,'#080e1c99');actor(bike[0],260-q*12,259,.72+q*.025);for(let i=0;i<8;i++)box((i*61+t*42)%384,25+i*20,12,1,'#c1ac8166')}
  else if(t<1.65){const q=ease((t-.85)/.8);road(t,.1);actor(bike[1],160,184,.37);smoke(g,114,178,t,1,1);for(let n=0;n<6;n++)box(210+n*4,145+n%2,2,1,'#f8d99f')}
  else if(t<2.45){const q=ease((t-1.65)/.8);road(t,q*2);actor(q<.60?bike[2]:bike[3],150+q*20,184,.37);smoke(g,115,179,t,1,1.2)}
  else if(t<3.65){const q=(t-2.45)/1.2;road(t,3.5);actor(bike[3],157+q*16,184,.37);smoke(g,103,179,t,1,1.5);for(let n=0;n<15;n++)box((n*73-t*500)%490+50,17+n*9,20+n%4*9,1,n%2?'#c1b7a0':'#627180')}
  else if(t<4.25){const q=ease((t-3.65)/.6);road(t,2);actor(bike[6],177+q*165,184,.37);actor(frames[17],163-q*36,149-Math.sin(q*Math.PI)*22,.46);smoke(g,110,179,t,1,1.4)}
  else if(t<4.95){const q=(t-4.25)/.7;road(t,.3);actor(frames[q<.6?18:0],125,185,.46);blast(g,335,145,q,115);for(let n=0;n<10;n++)box(280+Math.cos(n*2.4)*q*90,167-Math.sin(q*Math.PI)*(15+n%4*12),3,3,'#8e8c90')}
  else{const q=ease((t-4.95)/.85);road(t,0);actor(frames[19],148,185,.46);smoke(g,332,175,t,1,1.4);if(q>.6){g.globalAlpha=(q-.6)/.4;box(0,0,384,198,'#080d1c');g.globalAlpha=1}}
  box(0,0,384,6,'#080d1c');box(0,192,384,6,'#080d1c');target.save();target.imageSmoothingEnabled=false;target.drawImage(film,0,0,1280,660);target.restore();
 }
 return {install,frame,effects,cinema};
})();

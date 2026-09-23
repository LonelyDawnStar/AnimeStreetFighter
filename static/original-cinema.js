/* Original pixel storyboards, driven solely by the authoritative scene clock.
   Lore references: TMdict Fate/side material Excalibur / Gae Bolg / Enuma Elish;
   FGO material II Heracles profile (God Hand). No recorded footage or frame atlas. */
'use strict';
const OriginalCinema=(()=>{
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=216;
 const g=canvas.getContext('2d'),durations={saber:7.2,lancer:6.4,gil:7.6,berserker:6.6};
 let worlds,currentId='saber';
 const load=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('보구 배경을 불러오지 못했습니다.'));im.src=url});
 const ready=Promise.all([GrailArt.promise,load('/assets/noble-worlds-v033.png')]).then(([,im])=>{worlds=im;if(!GrailArt.ready)throw GrailArt.error});ready.catch(()=>{});
 const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n)};
 const box=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
 function path(points,color,width=1){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.stroke()}
 function sprite(frame,x,y,size,face=1){g.save();g.translate(Math.round(x),Math.round(y));g.scale(face,1);g.drawImage(frame.canvas,-Math.round(frame.pivot*size),-Math.round(frame.foot*size),Math.round(frame.canvas.width*size),Math.round(frame.canvas.height*size));g.restore()}
 function pose(id,set,index,x,y,size){const frames=GrailArt.frames[id][set];sprite(frames[Math.min(index,frames.length-1)],x,y,size)}
 function sky(t,color='#111c36'){
  box(0,0,384,216,color);if(!worlds)return;
  const index={saber:0,lancer:1,gil:2,berserker:3}[currentId],w=worlds.width/2,h=worlds.height/2;
  g.drawImage(worlds,index%2*w,Math.floor(index/2)*h,w,h,-12-Math.round(Math.sin(t*.3)*5),-5,410,230);
  g.globalAlpha=.16;box(0,0,384,216,color);g.globalAlpha=1;
 }
 function particles(t,color,n=45,power=1){for(let i=0;i<n;i++){const x=(i*67+t*(i%5-2)*11+5000)%384,y=216-(i*43+t*(14+i%8)*power)%216;box(x,y,i%4?2:3,2,color)}}
 function focus(id,t,color){sky(t);g.globalAlpha=.6;box(0,0,384,216,'#070b17');g.globalAlpha=1;pose(id,'idle',0,194,342,.94);particles(t,color,25);box(0,0,384,15,'#070910');box(0,201,384,15,'#070910')}
 function ring(x,y,r,color,t,segments=32){for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments+t;box(x+Math.cos(a)*r,y+Math.sin(a)*r,2,4,color)}}
 function saber(t){
  if(t<1.25){focus('saber',t,'#ffe3a9');return}
  sky(t,'#16283e');
  if(t<3.6){const q=ease((t-1.25)/2.35);pose('saber','great',1,174,207,.42);
   for(let j=0;j<64;j++){const a=j*2.399,r=(1-q)*(50+j%12*7)+8;box(186+Math.cos(a)*r,85+Math.sin(a)*r,2,4,j%3?'#efbd69':'#fff2c0')}
   for(let j=0;j<3;j++)box(179-j*2,32,3+j*2,110,['#fff1b2','#f5cb7866','#edb96533'][j]);
   ring(186,85,20+q*20,'#ffe5a2',t*.4);
  }else if(t<4.5){const q=ease((t-3.6)/.9);pose('saber','great',q<.55?1:2,145,208,.42);
   g.save();g.translate(162,130);g.rotate(-1.6+q*1.6);g.drawImage(GrailArt.combatFX.blade,0,-9,180,18);g.restore();particles(t,'#fff0bb',60,4);
  }else if(t<6.65){const q=clamp((t-4.5)/.3);pose('saber','great',2,90,210,.42);
   [82,58,34,12].forEach((h,j)=>box(109,136-h*q/2,275,h*q,['#b8792d66','#f3ba4a','#ffe9a1','#fffcef'][j]));
   for(let j=0;j<25;j++)box(110+(j*37+t*230)%270,107+j%7*9,17+j%4*9,2,j%3?'#ffe3a2':'#ffffff');
   particles(t,'#e0b16d',30,3);
  }else{pose('saber','great',3,145,208,.42);particles(t,'#e4b66c',35,.6)}
 }
 function lancer(t){
  if(t<1.1){focus('lancer',t,'#be4260');return}
  sky(t,'#211324');const f=GrailArt.frames.lancer;
  if(t<2.9){const q=ease((t-1.1)/1.8);pose('lancer','attack',0,136,211,.42);ring(276,118,26-q*9,'#d74b70',t);
   for(let j=0;j<9;j++)path([[30+j*6,188],[100+j*5,160-j*4],[175+j*7,150-j*3],[276,118]],'#aa315f77',1);particles(t,'#d04b67',30);
  }else if(t<3.7){
   // The mark appears before the thrust: visual shorthand for reversed causality.
   box(0,0,384,216,'#100c19');ring(276,112,30,'#eb7790',-t*2);path([[245,112],[308,112]],'#ffcad4',2);path([[276,81],[276,143]],'#ffcad4',2);
   pose('lancer','attack',1,120,211,.42);
  }else if(t<5.25){const q=ease((t-3.7)/.38);pose('lancer','attack',2,90+q*92,211,.42);
   path([[15,166],[92,159],[184,144],[250,125],[302,112]],'#9c234a',10);path([[15,166],[92,159],[184,144],[250,125],[302,112]],'#ff6689',4);
   ring(303,118,12+clamp((t-4)*2)*36,'#f091a0',t);particles(t,'#a62a55',24,3);
  }else{pose('lancer','attack',3,182,211,.42);particles(t,'#a44767',24,.7)}
 }
 function gil(t){
  if(t<1.15){focus('gil',t,'#edc375');return}sky(t,'#211324');
  if(t<3.8){const q=ease((t-1.15)/2.65);pose('gil','release',q<.5?0:1,163,208,.42);
   for(let j=0;j<3;j++){const cx=200+j*9;ring(cx,103,13+j*5,'#e74b70',t*(j%2?-4:4));box(cx,85,3,34,'#f0c08b')}
   for(let j=0;j<42;j++){const a=j*2.4+t*2,r=85*(1-q)+20;box(213+Math.cos(a)*r,104+Math.sin(a)*r,3,3,'#cd355a')}
  }else if(t<6.8){pose('gil','release',2,94,210,.42);const q=clamp((t-3.8)/.5);
   [92,65,35,10].forEach((h,j)=>box(130,118-h*q/2,254,h*q,['#7c1c4966','#bf2857','#ec7184','#ffdeba'][j]));
   for(let k=0;k<5;k++){const x=130+(k*67+t*80)%270;for(let j=0;j<24;j++){const a=j*Math.PI/12+t*(k%2?-5:5);box(x+Math.cos(a)*12,118+Math.sin(a)*45*q,3,3,'#ffc49f')}}
   for(let k=0;k<7;k++){const x=20+k*59;path([[x,0],[x-19,48],[x+9,80],[x-8,117],[x+26,171],[x+15,216]],'#0b0914',4);path([[x+3,0],[x-16,48],[x+12,80]],'#dd6686',1)}
  }else{pose('gil','release',3,146,208,.42);particles(t,'#ab5467',28,.6)}
 }
 function berserker(t){
  if(t<1.1){focus('berserker',t,'#bc8657');return}sky(t,'#1d1823');
  const q=ease((t-1.1)/2.4),phase=t<3.4?0:t<5.6?2:3;
  for(let j=0;j<12;j++){const a=-Math.PI/2+j*Math.PI/6,r=73+q*5,x=192+Math.cos(a)*r,y=110+Math.sin(a)*r;
   g.globalAlpha=clamp((t-1.1)*6-j*.22);g.save();g.translate(x,y);g.rotate(a+Math.PI/2);box(-5,-10,10,20,'#634c39');box(-3,-8,6,16,'#e2b97c');box(-1,-4,2,8,'#fff0c0');g.restore();g.globalAlpha=1;
  }
  pose('berserker','release',phase,192,207,.50);
  if(t>3.4&&t<5.6){const rise=ease((t-3.4)/1.0);for(let j=0;j<7;j++)box(152+j*13,205-rise*(110+j%3*22),3,rise*(110+j%3*22),'#e4b57544');ring(192,112,85,'#e5bb7c',0,48)}
  particles(t,'#d3a571',40,t>3.4?2:1);
 }
 function draw(target,id,time,x=160,y=45,w=960,h=540){
  if(!GrailArt.ready||!worlds||!durations[id])return;currentId=id;const duration=durations[id],t=Math.max(0,Math.min(duration-.001,time));
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.imageSmoothingEnabled=false;g.clearRect(0,0,384,216);
  ({saber,lancer,gil,berserker})[id](t);
  box(0,0,384,7,'#070a12');box(0,209,384,7,'#070a12');
  if(t>duration-.3){g.globalAlpha=(t-duration+.3)/.3;box(0,0,384,216,'#070a12');g.globalAlpha=1}
  target.save();target.imageSmoothingEnabled=false;target.drawImage(canvas,x,y,w,h);target.restore();
 }
 return {ready,draw,durations};
})();

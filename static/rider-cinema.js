/* Original Rider storyboards. Pure server-clock rendering; no client gameplay timers. */
'use strict';
const RiderCinema=(()=>{
 const c=document.createElement('canvas');c.width=384;c.height=216;const g=c.getContext('2d');let worlds;
 const load=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('라이더 보구 배경 로드 실패'));i.src=url});
 const ready=Promise.all([GrailArt.promise,load('/assets/rider-worlds-v031.png')]).then(([,im])=>{worlds=im;if(!GrailArt.ready)throw GrailArt.error});ready.catch(()=>{});
 const clamp=x=>Math.max(0,Math.min(1,x));
 function box(x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
 function sprite(f,x,y,scale){g.drawImage(f.canvas,Math.round(x-f.pivot*scale),Math.round(y-f.foot*scale),Math.round(f.canvas.width*scale),Math.round(f.canvas.height*scale))}
 function world(row,t,zoom=1){g.save();g.translate(192,130);g.scale(zoom,zoom);g.translate(-192,-130);g.drawImage(worlds,0,row*worlds.height/2,worlds.width,worlds.height/2,-20-Math.sin(t*.25)*10,0,424,216);g.restore()}
 function motes(t,king,speed=1){for(let i=0;i<55;i++){const x=(i*73-t*speed*(20+i%9)+10000)%410-10,y=30+(i*39)%180;box(x,y,king?5:2,2,king?'#ffe3a755':'#dcc7ff99')}}
 function ring(t,x,y,power){g.save();g.translate(x,y);g.scale(1,.3);g.strokeStyle='#e9d9ff';g.lineWidth=2;g.beginPath();g.arc(0,0,25+power*80,0,Math.PI*2);g.stroke();for(let i=0;i<20;i++){const a=i*Math.PI/10+t;box(Math.cos(a)*(25+power*80),Math.sin(a)*(25+power*80),3,8,'#c1a5f5')}g.restore()}
 function mount(id,t,x,y,size){const f=GrailArt.mounts[id][Math.floor(t*10)%3];sprite(f,x,y,size)}
 function draw(target,id,time,x=160,y=45,w=960,h=540){
  if(!worlds||!GrailArt.ready)return;const king=id==='iskandar',duration=king?7.5:7,t=Math.max(0,Math.min(duration-.001,time)),f=GrailArt.frames[id];
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.imageSmoothingEnabled=false;box(0,0,384,216,'#101528');
  if(king){
   if(t<1.2){world(0,t,1.2);g.globalAlpha=.65;box(0,0,384,216,'#1b1b30');g.globalAlpha=1;sprite(f.release[0],205,380,.94);motes(t,true)}
   else if(t<2.5){const q=clamp((t-1.2)/1.3);g.save();g.beginPath();g.rect(192-192*q,0,384*q,216);g.clip();world(0,t);g.restore();sprite(f.release[0],192,205,.45);motes(t,true,3);box(192-192*q,0,3,216,'#ffe0a8');box(192+192*q,0,3,216,'#ffe0a8')}
   else if(t<4.15){world(0,t);const q=clamp((t-2.5)/1.1);for(let row=0;row<3;row++)for(let j=0;j<11;j++){g.globalAlpha=q;mount('army',t+j*.07,10+j*38+row*7,130+row*24,.10+row*.04)}g.globalAlpha=1;sprite(f.release[t<3.4?0:2],195,211,.48);motes(t,true,2)}
   else if(t<5.35){world(0,t,1.16);for(let j=0;j<8;j++)mount('army',t+j*.1,j*62-30,176,.22);mount(id,t,210,229,.59);motes(t,true,5)}
   else{world(0,t,1.07);const q=t-5.35;for(let row=0;row<3;row++)for(let j=0;j<7;j++)mount('army',t+j*.08,-290+j*95+q*(130+row*40),146+row*35,.17+row*.08);mount(id,t,-100+q*220,229,.57);motes(t,true,10)}
  }else{
   if(t<1.1){world(1,t,1.2);sprite(f.idle[0],205,375,.90);motes(t,false)}
   else if(t<2.6){world(1,t);const q=clamp((t-1.1)/1.5);sprite(f.release[0],173,214,.42);ring(t,204,190,q);for(let j=0;j<32;j++){const a=j*2.4+t*2,r=95*(1-q)+12;box(205+Math.cos(a)*r,115+Math.sin(a)*r,3,5,'#e6dcff')}g.globalAlpha=q*.22;box(133,38,135,154,'#daceff');g.globalAlpha=1}
   else if(t<4.15){world(1,t,1.05);const q=clamp((t-2.6)/.6);g.globalAlpha=q;mount(id,t,200,233-(t-2.6)*25,.46);g.globalAlpha=1;ring(t,190,201,1);motes(t,false,2)}
   else if(t<5.35){world(1,t,1.3);mount(id,t,195,243,.65);motes(t,false,8);for(let j=0;j<12;j++)box((j*53-t*170)%384,20+j*15,30,1,'#c8a4eb77')}
   else{world(1,t);const q=t-5.35;for(let j=0;j<18;j++)box(-90+q*360-j*12,80+q*52+j%4*8,35,3,'#d4b2ff55');g.save();g.translate(-100+q*365,195+q*5);g.rotate(.18);mount(id,t,0,0,.43);g.restore();motes(t,false,12)}
  }
  // Short final fade joins the live arena without a white full-screen flash.
  if(t>duration-.3){g.globalAlpha=(t-duration+.3)/.3;box(0,0,384,216,'#08101e');g.globalAlpha=1}
  target.save();target.imageSmoothingEnabled=false;target.drawImage(c,x,y,w,h);target.restore();
 }
 return {ready,draw};
})();

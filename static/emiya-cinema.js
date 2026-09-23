/* Original UBW storyboard. All motion is a pure function of the server's scene clock. */
'use strict';
const EmiyaCinema=(()=>{
 const W=384,H=216,duration=460/60;
 const surface=document.createElement('canvas');surface.width=W;surface.height=H;
 const g=surface.getContext('2d');let landscape,poses,frames=[];
 const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('에미야 보구 이미지를 불러오지 못했습니다.'));im.src=src});
 const ready=Promise.all([load('/assets/emiya-ubw-world.png'),load('/assets/emiya-ubw-poses.png')]).then(images=>{
  [landscape,poses]=images;
  // Isolate connected poses: diagonal blades and coat tails extend beyond their nominal grid cells.
  frames=GrailArt.unpack(poses,4,[210,640,1107,1547,212,640,1107,1547],2);
 });ready.catch(()=>{});
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 const box=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
 function sword(x,y,size,angle,bright=false){
  g.save();g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(size,size);
  box(-2,-31,4,34,bright?'#d3eeed':'#5b666b');box(-1,-35,2,36,bright?'#fff0be':'#b7ada0');
  box(-7,1,14,3,'#cc9956');box(-1,4,3,10,'#592d2a');box(-2,13,5,3,'#dcb776');g.restore();
 }
 function gear(x,y,r,turn,alpha){
  g.save();g.globalAlpha=alpha;g.translate(x,y);g.rotate(turn);g.strokeStyle='#211d27';g.lineWidth=r*.16;
  g.beginPath();g.arc(0,0,r*.72,0,Math.PI*2);g.stroke();g.lineWidth=r*.11;g.beginPath();g.arc(0,0,r*.29,0,Math.PI*2);g.stroke();
  for(let i=0;i<20;i++){g.save();g.rotate(i*Math.PI/10);box(-r*.09,-r*.96,r*.18,r*.3,'#211d27');g.restore()}
  for(let i=0;i<6;i++){g.save();g.rotate(i*Math.PI/3);box(-r*.045,-r*.71,r*.09,r*.44,'#211d27');g.restore()}g.restore();
 }
 function actor(frame,x,foot,size=1){
  const f=frames[frame],scale=.285*size;
  g.drawImage(f.canvas,Math.round(x-f.pivot*scale),Math.round(foot-f.foot*scale),Math.round(f.canvas.width*scale),Math.round(f.canvas.height*scale));
 }
 function embers(t,count=50){
  for(let i=0;i<count;i++){const x=(i*61.37+t*(12+i%7))%W,y=H-((i*29.17+t*(15+i%11))%(H+20));g.globalAlpha=.3+(i%4)*.15;box(x,y,i%3===0?2:1,2,i%3?'#f0b96c':'#f8d9af')}g.globalAlpha=1;
 }
 function world(t,zoom=1){
  g.save();g.translate(W/2,H*.6);g.scale(zoom,zoom);g.translate(-W/2,-H*.6);
  g.drawImage(landscape,0,0,W,H);
  gear(78,35,76,t*.07,.65);gear(303,17,108,-t*.055,.8);gear(194,-3,38,t*.13,.4);
  // Thin dust layers cross at different speeds, preserving the silhouette of the sword field.
  g.globalAlpha=.08;for(let i=0;i<5;i++)box(((t*7+i*98)%520)-100,119+i*14,180,3,'#edb579');g.globalAlpha=1;
  g.restore();embers(t);
 }
 function ring(t,power){
  g.save();g.translate(192,182);g.scale(1,.28);g.strokeStyle='#f2c883';g.lineWidth=2;
  g.beginPath();g.arc(0,0,25+power*190,0,Math.PI*2);g.stroke();
  for(let i=0;i<28;i++){const a=i*Math.PI/14+t;box(Math.cos(a)*(25+power*190),Math.sin(a)*(25+power*190),4,7,'#ffdfb0')}g.restore();
 }
 function draw(target,time,x=160,y=45,w=960,h=540){
  if(!landscape||frames.length!==8)return;
  const t=Math.max(0,Math.min(duration-1/60,time));g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.imageSmoothingEnabled=false;
  box(0,0,W,H,'#110f1c');
  if(t<1.15){
   // Tight portrait: a quiet beat before the reality marble opens.
   for(let i=0;i<16;i++)box(0,18+i*12,W,1,i%3?'#261720':'#482027');
   actor(t<.6?0:1,226-t*12,450,3.5+t*.12);
   g.globalAlpha=.65;for(let i=0;i<9;i++)box((i*71+t*150)%W,20+i*23,20+i*5,1,'#f3a280');g.globalAlpha=1;
   embers(t,25);
  }else if(t<2.3){
   const q=ease((t-1.15)/1.15);g.save();g.beginPath();g.rect(W/2-W*q/2,0,W*q,H);g.clip();world(t,1.15);g.restore();
   ring(t,q);actor(t<1.7?1:2,192,193,1.25);embers(t,60);
   g.globalAlpha=(1-q)*.3;box(W/2-W*q/2-3,0,6,H,'#ffdd96');box(W/2+W*q/2-3,0,6,H,'#ffdd96');g.globalAlpha=1;
  }else if(t<3.7){
   const q=ease((t-2.3)/1.4);world(t,1.16-q*.16);actor(2,192,184,1.08-q*.12);
   // Foreground blades move against the background for camera depth.
   sword(32-q*14,207,1.8,-.13);sword(362+q*16,235,2.3,.2);
  }else if(t<5.05){
   const q=ease((t-3.7)/1.35);world(t,1.1);actor(t<4.15?2:3,152,205,1.4);
   for(let i=0;i<17;i++){
    const v=clamp((q-i*.025)*2),sx=28+i*21,sy=164-v*(70+(i%3)*18);
    g.globalAlpha=v;box(sx-5,sy-48,10,60,'#e6b75b22');sword(sx,sy,.55+(i%3)*.07,-.12+q*.2,true);
   }g.globalAlpha=1;embers(t,70);
  }else if(t<6.1){
   const q=ease((t-5.05)/1.05);world(t,1.2);actor(t<5.55?4:5,119-q*8,217,1.65);
   for(let i=0;i<20;i++){const sx=185+(i%7)*31,sy=38+Math.floor(i/7)*48;sword(sx,sy,.75,-.3+q*1.5,true)}
   g.globalAlpha=.3;for(let i=0;i<12;i++)box(150+i*21,22+i%5*34,2,55,'#ffdb90');g.globalAlpha=1;
  }else{
   const q=t-6.1;world(t,1.08);actor(q<.28?6:7,89,209,1.3);
   // Three staggered volleys. The visual cinematic has no gameplay hitboxes.
   for(let i=0;i<39;i++){
    const age=q-(i%13)*.035-Math.floor(i/13)*.32;if(age<0||age>.8)continue;
    const sx=-100+age*900+(i%4)*35,sy=12+(i*37)%180+age*20;
    g.save();g.translate(sx,sy);g.rotate(1.32);g.globalAlpha=.3;
    box(-3,4,6,65,'#fbc777');g.globalAlpha=1;g.restore();sword(sx,sy,.85+(i%3)*.24,1.32,true);
   }
   const flare=Math.max(0,1-Math.abs(q-.55)/.2)*.25;g.globalAlpha=flare;box(0,0,W,H,'#ffe1ab');g.globalAlpha=1;
   if(t>7.35){g.globalAlpha=ease((t-7.35)/.32);box(0,0,W,H,'#090c18');g.globalAlpha=1}
  }
  // Stable pixel grid and letterbox; no wall-clock randomness or accumulated animation state.
  box(0,0,W,8,'#080c17');box(0,H-8,W,8,'#080c17');
  target.save();target.imageSmoothingEnabled=false;target.drawImage(surface,x,y,w,h);target.restore();
 }
 return {ready,draw,duration,get frameCount(){return frames.length}};
})();

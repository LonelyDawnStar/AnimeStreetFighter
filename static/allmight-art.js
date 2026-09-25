'use strict';
const AllMightArt=(()=>{
 let frames=[];
 const clamp=x=>Math.max(0,Math.min(1,x));
 // Explicit boxes avoid row-boundary sorting of the jumping/victory poses.
 const boxes=[[97,9,268,291],[450,9,665,290],[819,9,923,291],[1140,10,1335,290],[48,296,286,557],[407,295,727,556],[765,351,1063,556],[1156,295,1367,556],[75,555,265,764],[406,567,643,811],[785,567,1047,811],[1105,605,1415,808],[33,850,372,1068],[441,822,653,1082],[784,865,1064,1072],[1182,776,1362,1082]];
 function install(art,image){
  // Flood-fill isolates overlapping bounding boxes without neighboring limbs.
  const unpacked=art.unpack(image,4,Array(16).fill(0),4);
  frames=boxes.map(([x,y,x2,y2])=>{const f=unpacked.find(f=>f.source.minx===x&&f.source.miny===y);if(!f)throw Error('올마이트 프레임 누락');f.pivot=(x2-x)/2+1;f.scale=246/282;return f});
  // Body center stays anchored when the fist extends.
  [86,107,52,98,100,100,110,105,95,119,131,117,120,106,110,90].forEach((x,i)=>frames[i].pivot=x);
  art.frames.allmight={idle:[frames[0]],run:[frames[1],frames[2],frames[3],frames[2]],jump:[frames[8]],attack:[frames[4],frames[5],frames[6],frames[7]],guard:[frames[9]],hurt:[frames[10]],dash:[frames[11]],release:[frames[13],frames[14],frames[15]]};
  const c=document.createElement('canvas');c.width=96;c.height=116;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(frames[0].canvas,50,0,96,116,0,0,96,116);art.portraits.allmight=c;
 }
 function frame(p){
  if(p.stun>0)return frames[10];
  const q=clamp(1-(p.anim||0)/(p.animMax||1));
  if(p.action==='united_smash'&&cinemaFrames.length===12)return cinemaFrames[q<.16?4:q<.30?5:q<.39?6:q<.435?7:q<.60?8:q<.77?9:q<.90?10:11];
  if(['detroit','united_smash'].includes(p.action))return frames[q<.24?4:q<.435?13:q<.75?14:7];
  if(['light','heavy'].includes(p.action))return frames[q<.13?4:q<.5?5:q<.78?6:7];
  return null;
 }
 function burst(g,x,y,face,q,size){
  if(q<0||q>=1)return;g.save();g.translate(Math.round(x),Math.round(y));g.scale(face,1);g.globalAlpha=(1-q)*.85;
  for(let i=0;i<18;i++){const a=-1.35+i*.16,r=size*(.18+q*.9),xx=Math.round(Math.cos(a)*r/4)*4,yy=Math.round(Math.sin(a)*r*.55/4)*4;g.fillStyle=i%3?'#ffd46b':'#fff5ce';g.fillRect(xx,yy,14+q*25,4)}
  g.strokeStyle='#fff3c0';g.lineWidth=6;g.beginPath();for(let i=0;i<13;i++){const a=-1.5+i*.25,x=Math.round((Math.cos(a)*(size*q)+20)/4)*4,y=Math.round(Math.sin(a)*size*q*.6/4)*4;i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.restore();
 }
 function effects(g,s,t){
  for(const p of s.players)if(p.char==='allmight'&&p.stun<=0&&['light','heavy'].includes(p.action)){const q=clamp(1-p.anim/(p.animMax||1));burst(g,p.x+p.face*65,535-p.y-143,p.face,q/.7,p.action==='heavy'?150:110)}
  for(const sh of s.shots)if(['detroit','united_smash'].includes(sh.kind)&&sh.delay<=0)burst(g,sh.x,535-sh.y,sh.face,sh.elapsed/.28,sh.reach);
 }
 function pose(g,i,x,foot,scale=1,angle=0){const f=frames[i];if(!f)return;g.save();g.translate(Math.round(x),Math.round(foot));g.rotate(angle);g.scale(scale,scale);g.drawImage(f.canvas,-f.pivot,-f.foot);g.restore()}
 const film=document.createElement('canvas');film.width=384;film.height=216;
 const cg=film.getContext('2d');let cinemaFrames=[],worldImage=null;
 function installCinema(art,poses,world){
  worldImage=world;
  const raw=art.unpack(poses,4,Array(12).fill(0),3);
  const xy=[[45,11],[395,12],[746,24],[1123,13],[21,372],[395,361],[776,340],[1119,378],[31,787],[410,829],[771,768],[1168,705]];
  cinemaFrames=xy.map(([x,y])=>{const f=raw.find(f=>f.source.minx===x&&f.source.miny===y);if(!f)throw Error('궁극기 도트 프레임 누락');f.pivot=f.canvas.width*.5;f.scale=246/330;return f});
 }
 const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 const box=(x,y,w,h,color)=>{cg.fillStyle=color;cg.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
 function actor(i,x,foot,scale=1,lean=0){
  const f=cinemaFrames[i];if(!f)return;cg.save();cg.translate(Math.round(x),Math.round(foot));cg.rotate(lean);
  cg.drawImage(f.canvas,Math.round(-f.canvas.width*.5*scale),Math.round(-f.foot*scale),Math.round(f.canvas.width*scale),Math.round(f.canvas.height*scale));cg.restore();
 }
 function landscape(t,zoom=1,pan=0){
  cg.save();cg.translate(192,130);cg.scale(zoom,zoom);cg.translate(-192+pan,-130);cg.drawImage(worldImage,0,0,384,216);cg.restore();
  for(let i=0;i<25;i++){const x=(i*71.3+t*(9+i%8))%400,y=210-(i*19+t*(8+i%5))%195;box(x,y,1,i%4===0?2:1,i%3?'#c48149':'#f6c876')}
 }
 function speed(t,cx,cy,power){
  cg.save();cg.globalAlpha=power;cg.strokeStyle='#edd5a0';cg.lineWidth=1;
  for(let i=0;i<34;i++){const a=i*2.399,near=80+(i*17+Math.floor(t*24)*23)%65,far=near+35+i%7*8;cg.beginPath();cg.moveTo(Math.round(cx+Math.cos(a)*near),Math.round(cy+Math.sin(a)*near*.7));cg.lineTo(Math.round(cx+Math.cos(a)*far),Math.round(cy+Math.sin(a)*far*.7));cg.stroke()}cg.restore();
 }
 function wind(t,x,y,r,alpha,back=false){
  cg.save();cg.globalAlpha=alpha;cg.lineWidth=2;
  for(let k=0;k<5;k++){
   cg.strokeStyle=k%2?'#e7eff0':'#dda958';cg.beginPath();
   for(let j=0;j<=24;j++){const a=(back?Math.PI:0)+j*Math.PI/24+t*1.8+k*.23,rr=r*(1-k*.11),xx=x+Math.cos(a)*rr,yy=y-k*11+Math.sin(a)*rr*.24;j?cg.lineTo(Math.round(xx),Math.round(yy)):cg.moveTo(Math.round(xx),Math.round(yy))}cg.stroke();
  }cg.restore();
 }
 function debris(t,force){
  for(let i=0;i<34;i++){const a=i*2.399,age=Math.max(0,t-i%5*.02),r=age*(40+i%9*11)*force,x=230+Math.cos(a)*r,y=179+Math.sin(a)*r*.25-age*(40+i%7*10)+age*age*60;cg.save();cg.translate(Math.round(x),Math.round(y));cg.rotate(a+age*(i%2?4:-4));box(-2,-2,3+i%4,3+i%3,i%3?'#4a5468':'#ac8f6a');box(-2,-2,3+i%4,1,'#c7a77a');cg.restore()}
 }
 function cracks(q){
  cg.strokeStyle='#f6cf86';cg.lineWidth=1;
  for(let n=0;n<11;n++){const a=n*2.399;cg.beginPath();cg.moveTo(237,186);for(let k=1;k<6;k++){const r=k*22*q;cg.lineTo(Math.round(237+Math.cos(a)*r+(k%2?4:-4)),Math.round(186+Math.sin(a)*r*.26))}cg.stroke()}
 }
 function caption(text,y,size=14){cg.save();cg.textAlign='center';cg.font='bold '+size+'px monospace';cg.lineWidth=3;cg.strokeStyle='#080d1c';cg.strokeText(text,192,y);cg.fillStyle='#fff0b7';cg.fillText(text,192,y);cg.restore()}
 function cinema(target,time){
  if(!worldImage||cinemaFrames.length!==12)return;
  const t=Math.max(0,Math.min(5.599,time));cg.setTransform(1,0,0,1,0,0);cg.globalAlpha=1;cg.imageSmoothingEnabled=false;box(0,0,384,216,'#080d1c');
  if(t<.85){
   const q=ease(t/.85);landscape(t,1.15,-q*6);box(0,0,384,216,'#06102199');
   // Dedicated face art, with a narrowing eye-line cut rather than enlarged idle art.
   cg.save();cg.beginPath();cg.rect(0,23-q*15,384,169+q*30);cg.clip();actor(t<.55?0:1,247-q*9,245,.90+q*.045);cg.restore();
   speed(t,240,125,.20);box(0,181,116,2,'#dab665');cg.font='bold 11px monospace';cg.fillStyle='#f9d999';cg.fillText('ONE FOR ALL',18,172);
  }else if(t<1.65){
   const q=ease((t-.85)/.8);landscape(t,1.22-q*.15,q*5);wind(t,176,186,62+q*27,.35,true);
   actor(t<1.13?4:t<1.43?5:6,164-q*5,197,.46,q*.025);wind(t,175,192,55+q*18,.40);
   for(let n=0;n<18;n++){const a=n*2.399,r=(1-q)*60+20;box(176+Math.cos(a)*r,152+Math.sin(a)*r*.6,1,2,'#f6dca1')}
  }else if(t<2.25){
   const q=ease((t-1.65)/.6);landscape(t,1.45,q*9);box(0,0,384,216,'#080d1c55');
   actor(t<1.96?2:3,225-q*14,286,.73+q*.055,-q*.04);speed(t,220,105,.35+q*.3);
   caption('UNITED STATES OF',196,16);
  }else if(t<2.78){
   const q=clamp((t-2.25)/.53);landscape(t,1.12+q*.12,-q*8);
   const i=q<.25?5:q<.56?6:7;actor(i,161+q*q*44,204,.49,-.04+q*.12);
   speed(t,233,166,.25+q*.55);
   // Broad curved pressure follows the arm, not a straight laser.
   cg.strokeStyle='#ffe2a0';cg.lineWidth=3;cg.beginPath();cg.arc(210,142,62,-2.4,-2.4+q*2.6);cg.stroke();
  }else if(t<2.92){
   // Brief impact hold; one warm flash, then dark silhouette for readability.
   box(0,0,384,216,t<2.83?'#f6dfae':'#141723');actor(8,217,199,.50);speed(2.8,248,184,.9);caption('SMASH!',64,31);
  }else if(t<4.1){
   const age=t-2.92,q=clamp(age/1.18),shake=(1-q)*2;
   cg.save();cg.translate(Math.round(Math.sin(age*73)*shake),Math.round(Math.cos(age*91)*shake));landscape(t,1.17-q*.14,-q*6);
   cracks(ease(q*3));wind(t,235,185,40+q*230,.8*(1-q*.55),true);
   actor(age<.18?8:9,215,199,.5-q*.055);debris(age,1.5);
   wind(t,235,192,45+q*235,.85*(1-q*.6));
   // Expanding ground-level blast lifts into a spiral, with staggered dust fronts.
   for(let k=0;k<4;k++){const p=clamp((age-k*.11)/.8);if(p>0&&p<1){cg.globalAlpha=(1-p)*.55;cg.strokeStyle=k%2?'#ffe1a1':'#cbd5d8';cg.lineWidth=4-k*.6;cg.beginPath();cg.ellipse(238,188,25+p*260,9+p*46,0,Math.PI,Math.PI*2);cg.stroke();cg.globalAlpha=1}}
   cg.restore();
  }else{
   const q=ease((t-4.1)/1.5);landscape(t,1.04-q*.04,-8);cracks(.9);wind(t,230,191,240+q*40,(1-q)*.25,true);
   actor(t<4.34?10:11,214,198,.43,0);debris(1.18+(t-4.1)*.4,1.2);
   cg.globalAlpha=clamp((t-4.5)/.35);caption('SYMBOL OF PEACE',32,13);cg.globalAlpha=1;
   if(t>5.26){cg.globalAlpha=ease((t-5.26)/.34);box(0,0,384,216,'#080d1c');cg.globalAlpha=1}
  }
  box(0,0,384,7,'#080d1c');box(0,209,384,7,'#080d1c');
  target.save();target.fillStyle='#080d1c';target.fillRect(0,0,1280,660);target.imageSmoothingEnabled=false;target.drawImage(film,64,6,1152,648);target.restore();
 }
 return {install,installCinema,frame,effects,cinema};
})();

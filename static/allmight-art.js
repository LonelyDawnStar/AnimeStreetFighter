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
 function cinema(g,t){
  g.save();g.imageSmoothingEnabled=false;g.fillStyle='#081328';g.fillRect(0,0,1280,660);
  for(let i=0;i<30;i++){const x=((i*137-t*300)%1480+1480)%1480-100;g.fillStyle=i%2?'#112847':'#172d50';g.fillRect(x,40+i*20,180,4)}
  if(t<1.4){
   const q=clamp(t/1.4);g.fillStyle='#d8ab49';g.fillRect(0,474,1280,6);pose(g,0,780-q*30,1120,3.1+q*.15);
   g.fillStyle='#ffd46b';g.font='bold 54px sans-serif';g.fillText('평화의 상징',95,240);g.font='bold 28px monospace';g.fillText('ONE FOR ALL',100,290);
  }else if(t<2.5){const q=(t-1.4)/1.1;pose(g,q<.65?4:13,540-q*40,565,1.65);burst(g,550,315,-1,1-q,260);g.fillStyle='#fff1b3';g.font='bold 30px monospace';g.fillText('UNITED STATES OF...',740,190);
  }else if(t<3.2){const q=(t-2.5)/.7;pose(g,11,280+q*560,555-q*90,1.7,-.1);for(let n=0;n<9;n++){g.fillStyle=n%2?'#ffe48f':'#6ba8dc';g.fillRect(70+n*50,250+n*29,220,5)}}
  else if(t<4.5){const q=(t-3.2)/1.3;g.fillStyle='#182945';g.fillRect(0,545,1280,115);pose(g,q<.10?13:14,810,555,1.7);burst(g,810,460,1,q,570);burst(g,810,460,-1,q,540);
   for(let n=0;n<16;n++){g.fillStyle=n%2?'#60799a':'#f2c576';const x=810+Math.cos(n*2.4)*q*530,y=555-Math.sin(q*Math.PI)*((n%5)*30+30);g.fillRect(Math.round(x/4)*4,Math.round(y/4)*4,10,10)}
   g.fillStyle='#fff1b3';g.font='bold 100px monospace';g.fillText('SMASH!',100,230);
  }else{const q=clamp((t-4.5)/1.1);pose(g,15,760,570,1.7);g.fillStyle='#ffd46b';g.font='bold 52px monospace';g.fillText('ALL MIGHT',130,290);g.font='24px sans-serif';g.fillText('유나이티드 스테이츠 오브 스매시',130,340);g.globalAlpha=q*.65;g.fillStyle='#081328';g.fillRect(0,0,1280,660)}
  g.restore();
 }
 return {install,frame,effects,cinema};
})();

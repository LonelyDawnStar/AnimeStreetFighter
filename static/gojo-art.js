'use strict';
const GojoArt=(()=>{
 const frames=[];let portrait=null;
 const rect=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,w,h)};
 function install(art,image){
  const feet=[328,328,328,324,320,320,320,320,315,315,315,315],pivots=[176,202,202,208,177,203,206,215,180,184,204,172];
  for(let i=0;i<12;i++){
   const c=document.createElement('canvas');c.width=384;c.height=342;const g=c.getContext('2d');g.drawImage(image,-i%4*384,-Math.floor(i/4)*341);
   const im=g.getImageData(0,0,384,342);for(let n=3;n<im.data.length;n+=4)im.data[n]=im.data[n]<128?0:255;g.putImageData(im,0,0);
   frames.push({canvas:c,pivot:pivots[i],foot:feet[i],scale:.82});
  }
  art.frames.gojo={idle:[frames[0]],run:[frames[1],frames[2]],jump:[frames[3]],attack:[frames[4],frames[5],frames[5],frames[0]],guard:[frames[6]],hurt:[frames[7]],dash:[frames[8]],release:[frames[11],frames[11],frames[11],frames[11]]};
  portrait=document.createElement('canvas');portrait.width=110;portrait.height=130;portrait.getContext('2d').drawImage(frames[0].canvas,128,12,110,130,0,0,110,130);art.portraits.gojo=portrait;
 }
 function frame(p,t){
  if(p.action==='void')return frames[9];
  if(p.action==='purple_charge')return frames[11];
  if(p.action==='red')return frames[5];
  return null;
 }
 function orb(g,x,y,r,color,t){
  g.save();for(let j=4;j>=0;j--){const rr=r*(1+j*.16);g.globalAlpha=j?.12:1;g.fillStyle=j?color:'#eeeaff';g.beginPath();for(let n=0;n<20;n++){const a=n*Math.PI/10,xx=Math.round((x+Math.cos(a)*rr)/4)*4,yy=Math.round((y+Math.sin(a)*rr)/4)*4;n?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.closePath();g.fill()}
  g.globalAlpha=1;for(let n=0;n<14;n++){const a=n*Math.PI/7+t*3;rect(g,x+Math.cos(a)*r*1.4,y+Math.sin(a)*r*1.4,6,6,color)}g.restore();
 }
 function background(g,t){
  g.save();g.fillStyle='#020310';g.fillRect(0,0,1280,660);
  for(let i=0;i<150;i++){const a=i*2.39996+t*.03,r=40+(i*47+t*32)%760;rect(g,640+Math.cos(a)*r,260+Math.sin(a)*r*.55,i%9===0?6:2,2,i%3?'#6387bd':'#f0f5ff')}
  for(let j=0;j<7;j++){g.strokeStyle=j%2?'#22436c':'#47658b';g.lineWidth=2;g.beginPath();g.ellipse(640,260,95+j*58,58+j*29,-.3,0,Math.PI*2);g.stroke()}
  g.fillStyle='#01020b';g.beginPath();g.ellipse(640,260,80,63,-.3,0,Math.PI*2);g.fill();
  for(let n=0;n<24;n++)rect(g,n*60,550+(n%3)*8,40,2,'#44618b');g.restore();
 }
 function effects(g,s,t){
  const cast=s.gojoCast;
  if(cast){const p=s.players[cast.owner],q=cast.elapsed/cast.fireAt,x=p.x+p.face*70,y=535-p.y-155;
   if(q<.48)orb(g,x-35,y,12+q*14,'#399bff',t);
   else if(q<.8){orb(g,x-25+(q-.48)*55,y,16,'#399bff',t);orb(g,x+25-(q-.48)*55,y,16,'#ff355a',-t)}
   else orb(g,x,y,24,'#ad61ff',t);
   if(cast.aim){const [dx,dy]=cast.aim;g.save();g.setLineDash([12,12]);g.strokeStyle='#cf9eff99';g.lineWidth=3;g.beginPath();g.moveTo(p.x,390);g.lineTo(p.x+dx*1500,390-dy*1500);g.stroke();g.restore()}
   g.font='bold 20px sans-serif';g.textAlign='center';g.fillStyle='#e4ddff';g.fillText(cast.domain&&cast.elapsed<1.5?'無量空処 · 행동불가':cast.aim?'조준 고정 · 회피!':'蒼 → 赫 → 茈',640,192);
  }
  for(const sh of s.shots){if(!['purple','red'].includes(sh.kind))continue;if(sh.delay>0)continue;const x=sh.x,y=535-sh.y,purple=sh.kind==='purple';
   for(let j=5;j>0;j--){g.save();g.globalAlpha=(6-j)*.07;orb(g,x-Math.sign(sh.v)*j*28,y,sh.radius*(1-j*.1),purple?'#9149ff':'#ff355a',t);g.restore()}
   orb(g,x,y,sh.radius,purple?'#b872ff':'#ff4668',t);
  }
 }
 function cinema(g,scene){
  const t=scene.elapsed,domain=scene.variant==='void';g.save();background(g,t);g.fillStyle='#02030aac';g.fillRect(0,0,1280,660);
  const idx=domain?(t<.85?9:t<1.6?10:11):11,f=frames[idx];
  if(f){g.imageSmoothingEnabled=false;g.save();g.beginPath();g.rect(85,65,1110,500);g.clip();const sourceX=idx===9?116:idx===10?128:82;g.drawImage(f.canvas,sourceX,0,155,150,100,85,496,480);g.restore()}
  if(t>1.25){g.fillStyle='#9be8ff';g.fillRect(293,205,36,4)}
  if(domain&&t>2.1){g.fillStyle='#020512d9';g.fillRect(60,65,1160,500);}
  const tx=domain&&t>2.1?640:900;
  g.textAlign='center';g.fillStyle='#c4dcff';g.font='bold 22px monospace';g.fillText('SATORU GOJO',900,150);
  g.fillStyle='#fff';g.font='bold 60px serif';g.fillText(domain?'領域展開':'虚式',tx,265);g.fillStyle=domain?'#dceeff':'#c394ff';g.font='bold 78px serif';g.fillText(domain?'無量空処':'「茈」',tx,370);
  g.font='bold 25px sans-serif';g.fillStyle='#c2d5ef';g.fillText(domain?'영역전개 · 무량공처':'허식 · 자',tx,438);
  if(!domain){const q=Math.min(1,t/3.5);orb(g,745+q*90,510,22,'#3ca8ff',t);orb(g,1075-q*90,510,22,'#ff4264',-t);if(t>3)orb(g,910,510,30+(t-3)*12,'#ae71ff',t)}
  g.fillStyle='#89bfe4';g.fillRect(100,604,1080*Math.min(1,t/4.5),4);g.font='18px sans-serif';g.fillText(domain?'발동 후 1.5초 행동불가 · 해제 후 회피 가능':'창(蒼) + 혁(赫) → 자(茈)',640,640);g.restore();
 }
 return {install,frame,background,effects,cinema,frames};
})();

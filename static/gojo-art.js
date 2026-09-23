'use strict';
const GojoArt=(()=>{
 const frames=[];let portrait=null;
 const rect=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,w,h)};
 function install(art,image){
  const feet=[328,328,328,324,320,320,320,320,315,315,315,315],pivots=[176,202,202,208,177,203,206,215,180,184,204,172];
  for(let i=0;i<12;i++){
   const c=document.createElement('canvas');c.width=384;c.height=342;const g=c.getContext('2d');g.drawImage(image,-i%4*384,-Math.floor(i/4)*341);
   const im=g.getImageData(0,0,384,342);for(let n=3;n<im.data.length;n+=4)im.data[n]=im.data[n]<128?0:255;g.putImageData(im,0,0);
   frames.push({canvas:c,pivot:pivots[i],foot:feet[i],scale:.72});
  }
  art.frames.gojo={idle:[frames[0]],run:[frames[1],frames[2]],jump:[frames[3]],attack:[frames[4],frames[5],frames[5],frames[0]],guard:[frames[6]],hurt:[frames[7]],dash:[frames[8]],release:[frames[11],frames[11],frames[11],frames[11]]};
  portrait=document.createElement('canvas');portrait.width=110;portrait.height=130;portrait.getContext('2d').drawImage(frames[0].canvas,128,12,110,130,0,0,110,130);art.portraits.gojo=portrait;
 }
 function frame(p,t){
  
  if(p.action==='purple_charge')return frames[p.anim>.35?5:11];
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
   orb(g,x,y,24+Math.min(1,q)*16,'#ad61ff',t);
   if(cast.aim){const [dx,dy]=cast.aim;g.save();g.setLineDash([12,12]);g.strokeStyle='#cf9eff99';g.lineWidth=3;g.beginPath();g.moveTo(p.x,390);g.lineTo(p.x+dx*1500,390-dy*1500);g.stroke();g.restore()}
   g.font='bold 20px sans-serif';g.textAlign='center';g.fillStyle='#e4ddff';g.fillText('허식 자 · 발사 준비',640,192);
  }
  for(const sh of s.shots){if(!['purple','red'].includes(sh.kind))continue;if(sh.delay>0)continue;const x=sh.x,y=535-sh.y,purple=sh.kind==='purple';
   for(let j=5;j>0;j--){g.save();g.globalAlpha=(6-j)*.07;orb(g,x-Math.sign(sh.v)*j*28,y,sh.radius*(1-j*.1),purple?'#9149ff':'#ff355a',t);g.restore()}
   orb(g,x,y,sh.radius,purple?'#b872ff':'#ff4668',t);
  }
 }
 const cinemaFrames=[];let cinematicFailed=false;
 function installCinema(image){
  if(cinemaFrames.length)return;
  for(let i=0;i<8;i++){const c=document.createElement('canvas');c.width=384;c.height=480;const g=c.getContext('2d');g.drawImage(image,i%4*384,Math.floor(i/4)*512,384,480,0,0,384,480);const data=g.getImageData(0,0,384,480);for(let n=3;n<data.data.length;n+=4)data.data[n]=data.data[n]<128?0:255;const labels=new Int32Array(384*480),stack=new Int32Array(384*480);let id=0,best=0,bestCount=0;
   for(let start=0;start<labels.length;start++){if(labels[start]||data.data[start*4+3]===0)continue;id++;let top=0,count=0;stack[top++]=start;labels[start]=id;while(top){const n=stack[--top],x=n%384,y=Math.floor(n/384);count++;for(const v of [x?n-1:-1,x<383?n+1:-1,y?n-384:-1,y<479?n+384:-1])if(v>=0&&!labels[v]&&data.data[v*4+3]){labels[v]=id;stack[top++]=v}}if(count>bestCount){bestCount=count;best=id}}
   for(let n=0;n<labels.length;n++)if(labels[n]!==best)data.data[n*4+3]=0;
   g.putImageData(data,0,0);cinemaFrames.push(c)}
 }
 // Optional art must never block room entry or the existing sprite loader.
 const cinemaImage=new Image();cinemaImage.onload=()=>{try{installCinema(cinemaImage)}catch{cinematicFailed=true}};cinemaImage.onerror=()=>{cinematicFailed=true};cinemaImage.src='/assets/gojo-cinema-v044.png';
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 function pose(g,index,x,y,size,angle=0){
  g.save();g.translate(Math.round(x/2)*2,Math.round(y/2)*2);g.rotate(angle);g.imageSmoothingEnabled=false;
  if(cinemaFrames[index])g.drawImage(cinemaFrames[index],-192*size,-480*size,384*size,480*size);
  else {const f=frames[index<2?10:index<6?5:11];if(f)g.drawImage(f.canvas,80,0,270,180,-192*size,-480*size,384*size,480*size)}
  g.restore();
 }
 function caption(g,small,big,x,y,color='#c7dfff'){
  g.textAlign='center';g.font='bold 20px sans-serif';g.fillStyle=color;g.fillText(small,x,y-58);g.font='bold 64px serif';g.fillStyle='#fff';g.fillText(big,x,y);rect(g,x-70,y+20,140,3,color);
 }
 function trails(g,t,power,color){
  g.save();g.strokeStyle=color;g.lineWidth=2;
  for(let i=0;i<48;i++){const y=50+(i*113)%560,x=(i*179-t*power)%1600;g.globalAlpha=.1+(i%4)*.07;g.beginPath();g.moveTo(x,y);g.lineTo(x+60+i%5*40,y);g.stroke()}g.restore();
 }
 function cinema(g,scene){
  const t=Math.max(0,Math.min(6.4,scene.elapsed));g.save();g.imageSmoothingEnabled=false;
  g.fillStyle='#040918';g.fillRect(0,0,1280,660);
  for(let n=0;n<30;n++){const x=(n*79+t*16)%1280,y=80+(n*137)%500;rect(g,x,y,2,2,n%3?'#264264':'#8ea2cc')}
  trails(g,t,t>5.2?1600:60,t<2.65?'#679acb':t<3.65?'#d86c8c':'#a779e0');
  if(t<1.6){
   const q=ease(t/1.6),idx=t<.45?0:t<1.1?1:2;
   pose(g,idx,590+q*90,1040-q*150,2.1-q*.35,-.025+q*.025);
   g.fillStyle='#020510';g.fillRect(0,0,1280,100);g.fillRect(0,550,1280,110);
   g.fillStyle='#9fdfff';g.font='20px monospace';g.textAlign='left';g.fillText('SATORU GOJO',70,600);
   if(t>1.05){g.globalAlpha=clamp((t-1.05)*2);rect(g,0,304,1280,2,'#9fe8ff');g.globalAlpha=1;}
  }else if(t<2.65){
   const q=ease((t-1.6)/1.05);pose(g,2,350+q*36,605,1.12,-.03+q*.02);
   const x=500-q*14,y=352-q*12;orb(g,x,y,18+q*29,'#248dff',t);
   for(let i=0;i<28;i++){const a=i*2.4+t*4,r=35+(1-(t*1.4+i*.13)%1)*140;rect(g,x+Math.cos(a)*r,y+Math.sin(a)*r,5,5,'#6bcaff')}
   caption(g,'術式順転','蒼',925,330,'#62c9ff');
  }else if(t<3.65){
   const q=ease(t-2.65);pose(g,3,365+q*60,610,1.15,.025-q*.02);orb(g,540+q*40,320,26+q*27,'#ff315c',t);
   for(let i=0;i<24;i++){const a=i*Math.PI/12,r=35+((t*2+i*.1)%1)*115;rect(g,565+Math.cos(a)*r,320+Math.sin(a)*r,6,3,'#ff758a')}
   caption(g,'術式反転','赫',935,330,'#ff809a');
  }else if(t<4.65){
   const q=ease(t-3.65);pose(g,q<.48?4:5,640,630+q*35,1.28+q*.12,0);
   orb(g,380+q*235,395-q*50,42-q*12,'#369bff',t);orb(g,900-q*235,395-q*50,42-q*12,'#ff355a',-t);
   if(q>.6)orb(g,640,345,12+(q-.6)*100,'#bd7aff',t);
   g.fillStyle='#eee6ff';g.textAlign='center';g.font='22px sans-serif';g.fillText('蒼  ×  赫',640,95);
  }else if(t<5.25){
   const q=ease((t-4.65)/.6);pose(g,6,320-q*25,620,1.17,-q*.045);orb(g,590+q*70,335,54+q*18,'#b474ff',t);
   caption(g,'HOLLOW PURPLE','虚式「茈」',930,300,'#c7a2ff');
   for(let i=0;i<24;i++){const a=i*Math.PI/12,r=135-q*65;rect(g,650+Math.cos(a)*r,335+Math.sin(a)*r,8,4,'#e0baff')}
  }else{
   const q=clamp((t-5.25)/1.15);g.save();g.translate(-q*110,Math.sin(t*39)*(1-q)*3);pose(g,7,280-q*30,625,1.12,-.04*(1-q));
   const x=640+q*1300;for(let j=6;j>0;j--){g.globalAlpha=.09*(7-j);orb(g,x-j*95,330,65-j*5,'#a369ff',t)}g.globalAlpha=1;orb(g,x,330,82,'#bc8bff',t);g.restore();
   for(let i=0;i<26;i++){const x=(i*137-q*1700)%1450;rect(g,x,515+(i%5)*18,30,3,'#8471a6')}
   g.fillStyle='#e1ccff';g.font='bold 28px sans-serif';g.textAlign='center';g.fillText('허식 · 자',640,100);
   if(q>.82){g.fillStyle='#040918';g.globalAlpha=ease((q-.82)/.18)*.7;g.fillRect(0,0,1280,660);g.globalAlpha=1;}
  }
  g.fillStyle='#050913';g.fillRect(0,0,1280,26);g.fillRect(0,638,1280,22);rect(g,0,656,1280*(t/6.4),4,'#a6bfff');g.restore();
 }
 return {install,installCinema,frame,background,effects,cinema,frames};
})();


'use strict';
const output=document.getElementById('motionCanvas'),display=output.getContext('2d');
const mini=document.createElement('canvas');mini.width=640;mini.height=310;const g=mini.getContext('2d');
let time=0,last=0,paused=false,face=1;
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'재생':'일시 정지'};
document.getElementById('facing').onclick=()=>face*=-1;
GrailArt.promise.then(()=>document.getElementById('status').textContent=GrailArt.ready?'READY · SIX SERVANTS':GrailArt.error.message);
function draw(now){
 const dt=Math.min(.05,(now-last)/1000||0);last=now;if(!paused)time+=dt*Number(document.getElementById('speed').value);
 if(GrailArt.ready){
  g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;g.fillStyle='#0c1832';g.fillRect(0,0,1280,620);
  const action=document.getElementById('motion').value,cycle=time%1.1;
  ['saber','archer','lancer','gil','iskandar','medusa'].forEach((char,i)=>{
   const duration=action==='skill'?.5:char==='lancer'?.58:.52;
   const p={char,x:110+i*212,y:0,face,stun:0,inv:0,action,anim:0,animMax:duration};
   if(action==='heavy'||action==='skill'){p.anim=Math.max(0,duration-cycle);if(!p.anim)p.action='idle'}
   if(action==='jump'){p.y=Math.sin(cycle/1.1*Math.PI)*95;p.action='idle'}
   if(action==='hurt'){p.stun=.2;p.action='idle'}
   if(action==='dash')p.x+=face*(cycle/1.1-.5)*75;
   GrailArt.fighter(g,p,time,.72,510);
   g.fillStyle='#efce91';g.font='bold 20px monospace';g.textAlign='center';g.fillText(['SABER','EMIYA','CU CHULAINN','GILGAMESH','ISKANDAR','MEDUSA'][i],110+i*212,564);
   if(action==='skill'&&char==='gil'&&cycle<.8){GrailArt.effects(g,{shots:[{x:p.x+face*(cycle*240),y:145,v:face*670,weapon:['longsword','spear','axe','greatsword','halberd','sickle'][Math.floor(time/1.1)%6],kind:'skill',delay:cycle<.14?.1:0}],fx:[]},time)}
  });
  display.imageSmoothingEnabled=false;display.drawImage(mini,0,0,1280,620);
 }
 requestAnimationFrame(draw);
}requestAnimationFrame(draw);

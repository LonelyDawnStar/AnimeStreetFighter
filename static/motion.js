'use strict';
// Use the game's original sprites. Locomotion timing remains distance-driven.
const DuelMotion=(()=>{
 let art=null;
 function start(source){art=source}
 function frame(p){
  if(!art||p.action!=='run'||p.moving===false||p.stun>0||p.y>0||p.airborne)return null;
  const phase=((p.gait||0)%1+1)%1;
  const awakened=p.char==='acheron'&&(p.rainCharges>0||p.rainFinishing);
  const bank=awakened?[AcheronArt.white[1],AcheronArt.white[2]]:art.frames[p.char]?.run;
  if(!bank?.length)return null;
  return bank[Math.min(bank.length-1,Math.floor(phase*bank.length))];
 }
 function advance(previous,p,dt,frozen=false){
  const old=previous&&previous.char===p.char?previous:{char:p.char,x:p.x,y:p.y,gait:0};
  const moving=!frozen&&p.action==='run'&&p.moving!==false&&p.stun<=0&&p.y===0&&p.vy===0;
  const x=moving?old.x+(p.x-old.x)*(1-Math.exp(-25*dt)):p.x,dx=x-old.x;
  const gait=moving&&Math.abs(dx)<55?(old.gait||0)+dx*(p.face||1)/(p.char==='berserker'?170:145):(old.gait||0);
  return {char:p.char,x,y:p.y<=0?0:old.y+(p.y-old.y)*(1-Math.exp(-25*dt)),gait};
 }
 return {start,frame,advance};
})();

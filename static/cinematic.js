'use strict';
const NobleCinema=(()=>{
 const names={gojo:'HOLLOW PURPLE',saber:'EXCALIBUR',archer:'UNLIMITED BLADE WORKS',lancer:'GAE BOLG',gil:'ENUMA ELISH',iskandar:'IONIOI HETAIROI',medusa:'BELLEROPHON',berserker:'GOD HAND'};
 const subtitles={gojo:'허식 「자」 · 虚式「茈」',saber:'약속된 승리의 검',archer:'무한의 검제',lancer:'게이 볼그',gil:'에누마 엘리시',iskandar:'왕의 군세',medusa:'기영의 고삐 · 벨레로폰',berserker:'열두 번의 시련 · 갓 핸드'};
 const durations={...OriginalCinema.durations,archer:460/60,iskandar:7.5,medusa:7};
 const ready=Promise.all([EmiyaCinema.ready,RiderCinema.ready,OriginalCinema.ready]);ready.catch(()=>{});
 function draw(g,state){const scene=state.cinematic;if(!scene)return;
  const titleDuration=scene.char==='gojo'?1:(scene.titleDuration??1);
  if(scene.elapsed<titleDuration){
   const width=Math.min(1280,Math.floor(scene.elapsed/.45*1280/8)*8);
   g.save();g.beginPath();g.rect(0,215,width,230);g.clip();g.fillStyle='#08132bed';g.fillRect(0,215,1280,230);
   g.fillStyle='#ddbd73';g.fillRect(0,215,1280,4);g.fillRect(0,441,1280,4);g.fillRect(280,219,4,222);
   const face=GrailArt.portraits[scene.char];g.imageSmoothingEnabled=false;if(face)g.drawImage(face,40,223,218,218);
   g.textAlign='left';g.font='16px monospace';g.fillText('NOBLE PHANTASM / TIME STOP',328,268);
   g.font='bold 38px monospace';g.fillText(names[scene.char],328,337);g.font='24px sans-serif';g.fillText(subtitles[scene.char],328,390);
   if(width<1280){g.fillStyle='#fff4bd';g.fillRect(width-8,215,8,230)}g.restore();return;
  }
  if(scene.char==='gojo'){const elapsed=Math.max(0,scene.elapsed-titleDuration)*6.4/Math.max(.001,scene.duration-titleDuration);GojoArt.cinema(g,{...scene,elapsed});return;}
  g.save();g.fillStyle='#040914';g.fillRect(0,0,1280,660);
  const rate=scene.playbackRate||Math.max(1,durations[scene.char]/Math.max(.001,scene.duration-titleDuration));
  const t=Math.max(0,(scene.elapsed-titleDuration)*rate);
  if(scene.char==='archer')EmiyaCinema.draw(g,t);
  else if(['iskandar','medusa'].includes(scene.char))RiderCinema.draw(g,scene.char,t);
  else OriginalCinema.draw(g,scene.char,t);
  g.fillStyle='#dab96f';g.fillRect(160,39,960,3);g.fillRect(160,589,960,3);g.font='bold 28px monospace';g.textAlign='center';g.fillText(names[scene.char],640,625);
  g.fillStyle='#81bed8';g.fillRect(160,648,Math.floor(960*Math.min(1,scene.elapsed/scene.duration)),3);g.restore();
 }
 return {ready,draw,durations,names,subtitles};
})();



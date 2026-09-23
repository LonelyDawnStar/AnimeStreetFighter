'use strict';
const NobleCinema=(()=>{
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
 const pixels=document.createElement('canvas');pixels.width=320;pixels.height=180;
 const pg=pixels.getContext('2d',{willReadFrequently:true});let active=false,lastTime=-1;
 video.onseeked=()=>{lastTime=-1};
 const ready=Promise.all([EmiyaCinema.ready,LancerCinema.ready,GilCinema.ready,RiderCinema.ready,(async()=>{const r=await fetch('/assets/saber-np.mp4');if(!r.ok)throw Error('궁극기 영상 로드 실패');const blob=await r.blob();await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('이 브라우저에서 궁극기 영상을 재생할 수 없습니다.'));video.src=URL.createObjectURL(blob);video.load()})})()]);
 // Keep a handled rejection until the join/restore flow reports the error.
 ready.catch(()=>{});
 function draw(g,state){const scene=state.cinematic;
  if(!scene){if(active){video.pause();active=false;lastTime=-1}return}
  const titleDuration=scene.titleDuration||0;
  if(scene.elapsed<titleDuration){
   video.pause();active=false;lastTime=-1;
   const width=Math.min(1280,Math.floor(scene.elapsed/.45*1280/8)*8);
   g.save();g.beginPath();g.rect(0,215,width,230);g.clip();
   g.fillStyle='#08132bd9';g.fillRect(0,215,1280,230);
   g.fillStyle='#ddbd73';g.fillRect(0,215,1280,4);g.fillRect(0,441,1280,4);g.fillRect(280,219,4,222);
   const face=GrailArt.portraits[scene.char];g.imageSmoothingEnabled=false;if(face)g.drawImage(face,40,223,218,218);
   g.textAlign='left';g.font='16px monospace';g.fillText('NOBLE PHANTASM / TIME STOP',328,268);
   g.font='bold 38px monospace';g.fillText({saber:'EXCALIBUR',archer:'UNLIMITED BLADE WORKS',lancer:'GAE BOLG',gil:'ENUMA ELISH',iskandar:'IONIOI HETAIROI',medusa:'BELLEROPHON'}[scene.char],328,337);
   g.font='24px sans-serif';g.fillText({saber:'약속된 승리의 검',archer:'무한의 검제',lancer:'게이 볼그',gil:'에누마 엘리시',iskandar:'왕의 군세',medusa:'기영의 고삐 · 벨레로폰'}[scene.char],328,390);
   if(width<1280){g.fillStyle='#fff4bd';g.fillRect(width-8,215,8,230)}g.restore();return;
  }
  g.fillStyle='#040914';g.fillRect(0,0,1280,660);
  const sourceDuration={saber:460/60,archer:460/60,lancer:LancerCinema.duration,gil:GilCinema.duration,iskandar:7.5,medusa:7}[scene.char];
  const playbackRate=scene.playbackRate||Math.max(1,sourceDuration/Math.max(.001,scene.duration-titleDuration));
  const animationTime=(scene.elapsed-titleDuration)*playbackRate;
  if(scene.char==='saber'){
   const target=Math.min(animationTime,Math.max(0,(video.duration||scene.duration)-1/60));
   if(video.readyState>=2){
    video.playbackRate=playbackRate;
    if(!active||Math.abs(video.currentTime-target)>.12||(state.paused&&Math.abs(video.currentTime-target)>.02)){if(!video.seeking)video.currentTime=target}
    if(state.paused){video.pause()}else if(video.paused&&!video.ended)video.play().catch(()=>{});
    active=true;
    if(video.currentTime!==lastTime){lastTime=video.currentTime;pg.imageSmoothingEnabled=true;pg.drawImage(video,0,0,320,180);const frame=pg.getImageData(0,0,320,180);for(let i=0;i<frame.data.length;i+=4)for(let c=0;c<3;c++)frame.data[i+c]=Math.round(frame.data[i+c]/24)*24;pg.putImageData(frame,0,0)}
    g.imageSmoothingEnabled=false;g.drawImage(pixels,160,45,960,540);
   }
  }else if(scene.char==='archer'){
   if(active){video.pause();active=false;lastTime=-1}
   EmiyaCinema.draw(g,animationTime);
  }else if(scene.char==='lancer'){
   if(active){video.pause();active=false;lastTime=-1}
   LancerCinema.draw(g,animationTime);
  }else if(scene.char==='gil'){
   if(active){video.pause();active=false;lastTime=-1}
   GilCinema.draw(g,animationTime);
  }else if(['iskandar','medusa'].includes(scene.char)){
   if(active){video.pause();active=false;lastTime=-1}
   RiderCinema.draw(g,scene.char,animationTime);
  }else{
   const p=state.players[scene.owner];GrailArt.fighter(g,{...p,x:640,y:0,action:'idle',moving:false},scene.elapsed,1.6,510);
   const face=GrailArt.portraits[scene.char];if(face)g.drawImage(face,100,100,240,280);
  }
  g.fillStyle='#dab96f';g.fillRect(160,39,960,3);g.fillRect(160,589,960,3);g.font='bold 28px monospace';g.textAlign='center';g.fillText({saber:'EXCALIBUR',archer:'UNLIMITED BLADE WORKS',lancer:'GAE BOLG',gil:'ENUMA ELISH',iskandar:'IONIOI HETAIROI',medusa:'BELLEROPHON'}[scene.char],640,625);
  g.fillStyle='#81bed8';g.fillRect(160,648,Math.floor(960*scene.elapsed/scene.duration),3);
 }
 return {ready,draw};
})();

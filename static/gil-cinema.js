/* Pixel frame sequence; playback follows the authoritative server scene clock. */
'use strict';
const GilCinema=(()=>{
 let manifest, pages=[];
 const ready=(async()=>{
  const response=await fetch('/assets/gil-pixel/manifest.json');
  if(!response.ok)throw Error('에누마 엘리시 프레임 정보 로딩 실패');
  manifest=await response.json();
  pages=await Promise.all(manifest.pages.map(name=>new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>resolve(image);
   image.onerror=()=>reject(Error('에누마 엘리시 프레임 로딩 실패: '+name));
   image.src='/assets/gil-pixel/'+name;
  })));
 })();
 ready.catch(()=>{});
 function draw(target,time,x=160,y=45,w=960,h=540){
  if(!manifest||!pages.length)return;
  const frame=Math.min(manifest.frameCount-1,Math.max(0,Math.floor(time*manifest.fps)));
  const page=Math.floor(frame/manifest.framesPerPage),cell=frame%manifest.framesPerPage;
  target.save();target.imageSmoothingEnabled=false;
  target.drawImage(pages[page],cell%manifest.columns*manifest.width,Math.floor(cell/manifest.columns)*manifest.height,manifest.width,manifest.height,x,y,w,h);
  target.restore();
 }
 return {ready,draw,get duration(){return manifest?manifest.duration:17}};
})();

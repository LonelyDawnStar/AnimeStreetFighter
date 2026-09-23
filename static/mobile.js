'use strict';
// Pure direction mapping is shared by the control and regression checks.
function arcadeDirections(dx,dy,radius){
 const x=dx/radius,y=dy/radius,result=[];
 if(Math.hypot(x,y)<.22)return result;
 if(x<-.32)result.push('left');else if(x>.32)result.push('right');
 if(y<-.48)result.push('jump');else if(y>.48)result.push('guard');
 return result;
}
(()=>{
 const stick=$('joystick'),knob=$('stickKnob'),game=$('game'),pointers=new Map();let stickPointer=null;
 const touch=matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints>0;document.body.classList.toggle('touch-device',touch);
 if(touch)$('fullscreen').before($('sound'));
 const active=()=>!!session&&!game.hidden;
 function reset(){
  stickPointer=null;setInputSource('joystick',[]);knob.style.transform='translate(0px, 0px)';stick.classList.remove('on');
  for(const [id,b] of pointers){setInputSource('touch:'+id,[]);b.classList.remove('on')}pointers.clear();
 }
 window.arcadeControls={reset};
 function move(e){
  if(e.pointerId!==stickPointer)return;e.preventDefault();const box=stick.getBoundingClientRect(),radius=box.width*.28;
  let dx=e.clientX-(box.left+box.width/2),dy=e.clientY-(box.top+box.height/2),distance=Math.hypot(dx,dy);
  if(distance>radius){dx*=radius/distance;dy*=radius/distance}
  knob.style.transform=`translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;setInputSource('joystick',arcadeDirections(dx,dy,radius));
 }
 stick.addEventListener('pointerdown',e=>{if(!active()||stickPointer!==null||e.button>0)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('on');move(e)});
 stick.addEventListener('pointermove',move);
 for(const name of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;setInputSource('joystick',[]);knob.style.transform='translate(0px, 0px)';stick.classList.remove('on')});
 document.querySelectorAll('[data-key]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{if(!active()||e.button>0)return;e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b);setInputSource('touch:'+e.pointerId,[b.dataset.key]);b.classList.add('on')});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);setInputSource('touch:'+e.pointerId,[]);if(![...pointers.values()].includes(b))b.classList.remove('on')});
  b.addEventListener('contextmenu',e=>e.preventDefault());
 });
 stick.addEventListener('contextmenu',e=>e.preventDefault());
 function layout(){document.body.classList.toggle('match-active',!game.hidden);if(game.hidden)reset()}
 new MutationObserver(layout).observe(game,{attributes:true,attributeFilter:['hidden']});layout();
 window.addEventListener('resize',clearKeys);window.addEventListener('orientationchange',clearKeys);
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else error('이 브라우저는 전체 화면을 지원하지 않아요. 가로로 돌려 플레이해 주세요.')}catch{error('전체 화면을 열지 못했어요. 가로 화면으로 계속 플레이할 수 있어요.')}};
 document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'전체 화면 해제':'전체 화면'});
})();

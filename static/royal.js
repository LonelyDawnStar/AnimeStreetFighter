'use strict';
(()=>{
 const stats={acheron:[270,125,9],gojo:[285,100,9],saber:[270,120,10],archer:[290,112,9],lancer:[295,138,8],gil:[240,95,8],iskandar:[245,125,11],medusa:[310,118,8],berserker:[225,145,12]};
 const sigil=$('grailSigil').getContext('2d');
 sigil.fillStyle='#6f542b';sigil.fillRect(12,12,72,2);sigil.fillRect(12,82,72,2);sigil.fillRect(12,12,2,72);sigil.fillRect(82,12,2,72);
 const pixels=['0001111111111000','0011111111111100','0011100000011100','1111100000011111','1101100000011011','1101110000111011','0111111001111110','0000111111110000','0000011111100000','0000001111000000','0000001111000000','0000001111000000','0000111111110000','0001111111111000'];
 pixels.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1'){sigil.fillStyle=y%3===0?'#fff0b2':y%3===1?'#d6aa57':'#a87b3b';sigil.fillRect(24+x*3,26+y*3,3,3)}}));
 for(const [x,y]of [[48,8],[8,48],[84,48],[48,84]]){sigil.fillStyle='#ffe1a0';sigil.fillRect(x-2,y-2,5,5)}
 let last='',lastDraw=0;
 function render(now){
  if(!state&&GrailArt.ready&&now-lastDraw>100){lastDraw=now;
   if(last!==selected){last=selected;$('dossierName').textContent=defs[selected].name;$('contractClass').textContent=defs[selected].cls;$('nobleName').textContent=defs[selected].np;['statSpeed','statReach','statPower'].forEach((id,i)=>$(id).textContent=stats[selected][i])}
   const g=$('selectedArt').getContext('2d');g.clearRect(0,0,240,190);g.imageSmoothingEnabled=false;GrailArt.fighter(g,{char:selected,x:120,y:0,action:'idle',moving:false,face:1},now/1000,selected==='berserker'?.65:.7,185);
  }requestAnimationFrame(render);
 }requestAnimationFrame(render);
 GrailArt.promise.then(()=>{if(!GrailArt.ready)return;const g=$('vaultCanvas').getContext('2d');g.imageSmoothingEnabled=false;const names=['longsword','spear','axe','greatsword','halberd','sickle'],labels=['LONGSWORD','SPEAR','BATTLE AXE','GREATSWORD','HALBERD','SICKLE'];names.forEach((name,i)=>{const x=110+(i%3)*220,y=45+Math.floor(i/3)*110;g.fillStyle='#152237';g.fillRect(x-99,y-30,198,85);GrailArt.drawWeapon(g,x+70,y,1,name);g.fillStyle='#dac08b';g.font='10px monospace';g.textAlign='center';g.fillText(labels[i],x,y+40)})});
})();



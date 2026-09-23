'use strict';
// Pixel tiles are drawn on the same low-resolution surface as the fighters.
window.ResultCinema=(()=>{
 const glyphs={V:['10001','10001','10001','10001','10001','01010','00100'],I:['11111','00100','00100','00100','00100','00100','11111'],C:['01111','10000','10000','10000','10000','10000','01111'],T:['11111','00100','00100','00100','00100','00100','00100'],O:['01110','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],A:['01110','10001','10001','11111','10001','10001','10001'],W:['10001','10001','10001','10101','10101','10101','01010']};
 const clamp=x=>Math.max(0,Math.min(1,x));
 function title(g,word,y,t,color){const unit=12,x=(1280-(word.length*6-1)*unit)/2;for(let n=0;n<word.length;n++){const progress=clamp((t-.15-n*.065)/.5),offset=Math.round((1-progress)**3*160/4)*4;g.globalAlpha=progress;glyphs[word[n]].forEach((row,j)=>[...row].forEach((bit,i)=>{if(bit==='1'){g.fillStyle='#000b';g.fillRect(x+(n*6+i)*unit+4,y+j*unit+offset+6,unit,unit);g.fillStyle=color;g.fillRect(x+(n*6+i)*unit,y+j*unit+offset,unit-2,unit-2)}}))}g.globalAlpha=1}
 function draw(g,s,slot){const r=s.result;if(!r||s.closed||!['between','ended'].includes(s.phase))return;const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,t=reduced?r.duration:Math.min(r.elapsed,r.duration),win=r.winner===slot,drawn=r.winner==null,color=drawn?'#a2cde4':win?'#ffe2a0':'#bdc4e8';
 g.save();g.imageSmoothingEnabled=false;g.fillStyle='rgba(5,10,23,'+(.86*clamp(t/.25))+')';g.fillRect(0,0,1280,660);
 g.globalAlpha=clamp(t/.5);g.fillStyle=color;g.fillRect(160,92,960,4);g.fillRect(160,462,960,4);g.textAlign='center';g.font='bold 20px sans-serif';g.fillText(r.final?'MATCH COMPLETE':'ROUND '+r.round+' COMPLETE',640,74);g.globalAlpha=1;
 title(g,drawn?'DRAW':win?'VICTORY':'DEFEAT',136,t,color);
 // A rising pixel crest, gold for victory and silver for defeat.
 const cy=270-Math.round(clamp(t/1.2)*12);g.fillStyle=color;[[0,0,8,32],[16,12,8,20],[32,0,8,32],[0,32,40,8]].forEach(([x,y,w,h])=>g.fillRect(620+x,cy+y,w,h));
 g.globalAlpha=clamp((t-.7)/.4);
 s.players.forEach((p,i)=>{const x=i?910:370,face=GrailArt.portraits[p.char];g.fillStyle=i===r.winner?'#493d29':'#20283d';g.fillRect(x-205,310,410,118);if(face)g.drawImage(face,x-192,315,108,108);g.textAlign='left';g.fillStyle=i===r.winner?'#ffe2a0':'#c7cfe4';g.font='bold 25px sans-serif';g.fillText('P'+(i+1)+' · '+(drawn?'무승부':i===r.winner?'승리':'패배'),x-68,350);g.font='20px sans-serif';g.fillText(defs[p.char].name+(i===slot?' (나)':''),x-68,387)});
 g.textAlign='center';g.fillStyle='#fff2d2';g.font='bold 30px monospace';g.fillText(r.score.join(' : '),640,399);
 if(!r.final){g.font='18px sans-serif';g.fillText('잠시 후 다음 라운드',640,514)}else if(t<r.duration){g.font='18px sans-serif';g.fillText('최종 결과 확인 중',640,514)}
 g.globalAlpha=1;g.restore();}
 return {draw};
})();

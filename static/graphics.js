/* Pixel art texture loader and renderer. All fighting state remains server-owned. */
'use strict';
const GrailArt=(()=>{
 const art={ready:false,failed:false,frames:{},portraits:{},stage:null};
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
 const load=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('그래픽을 불러오지 못했습니다: '+url));im.src=url});
 // Extract disconnected sprites from the transparent atlas. Flood-fill keeps a
 // neighboring pose out of a wide sword frame even when their rectangles overlap.
 function unpack(image,groups,anchors,rows=3){
  const surface=make(image.width,image.height),g=surface.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
  const pixels=g.getImageData(0,0,surface.width,surface.height),data=pixels.data,w=surface.width,h=surface.height;
  const labels=new Int32Array(w*h),stack=new Int32Array(w*h),parts=[];let id=0;
  for(let start=0;start<w*h;start++){
   if(labels[start]||data[start*4+3]<80)continue;
   id++;let count=0,top=0,minx=w,maxx=0,miny=h,maxy=0;stack[top++]=start;labels[start]=id;
   while(top){const index=stack[--top],x=index%w,y=Math.floor(index/w);count++;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);
    for(const n of [x>0?index-1:-1,x<w-1?index+1:-1,y>0?index-w:-1,y<h-1?index+w:-1]){if(n>=0&&!labels[n]&&data[n*4+3]>=80){labels[n]=id;stack[top++]=n}}
   }
   if(count>3000)parts.push({id,minx,maxx,miny,maxy});
  }
  if(parts.length!==groups*rows)throw Error('스프라이트 프레임을 확인하지 못했습니다.');
  parts.sort((a,b)=>Math.floor((a.miny+a.maxy)/2/(h/rows))-Math.floor((b.miny+b.maxy)/2/(h/rows))||a.minx-b.minx);
  return parts.map((p,i)=>{
   const canvas=make(p.maxx-p.minx+3,p.maxy-p.miny+3),ctx=canvas.getContext('2d'),out=ctx.createImageData(canvas.width,canvas.height);
   for(let y=p.miny;y<=p.maxy;y++)for(let x=p.minx;x<=p.maxx;x++){let src=y*w+x;if(labels[src]!==p.id)continue;const dest=((y-p.miny+1)*canvas.width+x-p.minx+1)*4;out.data.set(data.subarray(src*4,src*4+4),dest)}
   ctx.putImageData(out,0,0);
   return {canvas,pivot:anchors[i]-p.minx+1,foot:canvas.height-2,source:p};
  });
 }
 function portrait(frame,x,y,w,h){const face=make(w,h),g=face.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(frame.canvas,x,y,w,h,0,0,w,h);return face}
 art.promise=Promise.all([load('/assets/riverside.png'),load('/assets/saber-v05.png'),load('/assets/servants.png'),load('/assets/archer-motion-v04.png'),load('/assets/lancer-motion-v04.png'),load('/assets/gil-motion-v04.png'),load('/assets/gil-weapon.png'),load('/assets/treasury-v06.png'),load('/assets/saber-plant-v015.png'),load('/assets/gil-ea-v016.png'),load('/assets/emiya-caladbolg-v021.png'),load('/assets/saber-greatslash-v025.png'),load('/assets/saber-strike-air-v025.png'),load('/assets/lancer-throw-v025.png'),load('/assets/lancer-source-v025.png'),load('/assets/combat-effects-v024.png'),load('/assets/iskandar-v031.png'),load('/assets/medusa-v031.png'),load('/assets/rider-mounts-v031.png'),load('/assets/berserker-v033.png'),load('/assets/gojo-v043.png'),load('/assets/acheron-v046.png'),load('/assets/acheron-awakened-v046.png')]).then(([stage,saber,others,archerMotion,lancerMotion,gilMotion,weapon,treasury,saberPlant,gilEa,caladBow,saberGreat,saberAir,lancerThrow,lancerSource,combatEffects,iskandar,medusa,mounts,berserker,gojoImage,acheronImage,acheronAwakened])=>{
  art.stage=stage;
  const sf=unpack(saber,4,[166,480,790,1120,174,487,801,1128,170,478,802,1124,169,476,788,1120],4);
  sf.forEach(f=>f.scale=.77);
  // The generated first row changes foot placement; cycling it looks like walking.
  art.frames.saber={idle:[sf[0]],run:sf.slice(4,8),attack:sf.slice(8,12),guard:[sf[12]],jump:[sf[13]],hurt:[sf[14]],dash:[sf[15]]};
  const plant=unpack(saberPlant,2,[.25,.75,.25,.75].map(x=>x*saberPlant.width),2);
  const plantScale=sf[0].foot*.77/plant[0].foot;plant.forEach(f=>f.scale=plantScale);art.frames.saber.release=plant;
  const of=unpack(others,3,[207,647,1060,205,632,998,195,610,999]);
  ['archer','lancer','gil'].forEach((k,i)=>art.frames[k]={idle:[of[i*3]],run:[of[i*3+1]],attack:[of[i*3+2]]});
  const motions=[
   ['archer',archerMotion,[185,567,930,1288,195,556,927,1300,190,568,905,1245],.71],
   ['lancer',lancerMotion,[183,549,927,1290,178,500,880,1292,180,570,911,1245],.68],
   ['gil',gilMotion,[205,570,920,1280,195,570,925,1280,190,555,925,1260],.65],
  ];
  for(const [id,image,anchors,scale]of motions){
   const frames=unpack(image,4,anchors);frames.forEach(f=>f.scale=scale);
   Object.assign(art.frames[id],{run:frames.slice(0,4),attack:frames.slice(4,8),guard:[frames[8]],jump:[frames[9]],hurt:[frames[10]],dash:[frames[11]]});
  }
  // Dedicated bow-only sprites; no sword attack frame is reused for Caladbolg.
  const bowRects=[[0,0,768,518,400,515],[768,0,768,518,312,515],[0,518,768,506,400,477],[768,518,768,506,320,477]];
  art.frames.archer.bow=bowRects.map(([x,y,w,h,pivot,foot],index)=>{
   const canvas=make(w,h);canvas.getContext('2d').drawImage(caladBow,x,y,w,h,0,0,w,h);
   // Normalize the bow costume to the idle sprite's measured crimson palette.
   // Run once when loading, not during rendering; preserve transparent pixels.
   const cg=canvas.getContext('2d'),pixels=cg.getImageData(0,0,w,h),data=pixels.data;
   for(let n=0;n<data.length;n+=4){
    if(data[n+3]<80)continue;
    const r=data[n],g=data[n+1],b=data[n+2];
    if(r>45&&r>g*1.6&&r>b*1.4){
     data[n]=Math.max(0,r*.72-5);data[n+1]=g*.8+14;data[n+2]=b*.7+14;
    }else{data[n]=r*.93;data[n+1]=g*.93;data[n+2]=b*.93}
   }
   cg.putImageData(pixels,0,0);
   return {canvas,pivot,foot,scale:index===3?.525:.54};
  });
  // Explicit atlas rectangles avoid joining adjacent weapon tips. Feet are anchored per pose.
  const bounds=[[0,0,384,530,155,520],[384,0,384,530,143,520],[768,0,384,530,156,520],[1152,0,384,530,200,520],[0,550,368,474,139,408],[368,550,400,474,132,408],[775,550,443,474,168,408],[1218,550,318,474,120,408]];
  art.gilNP=bounds.map(([x,y,w,h,pivot,foot])=>{const canvas=make(w,h);canvas.getContext('2d').drawImage(gilEa,x,y,w,h,0,0,w,h);return {canvas,pivot,foot,scale:.68}});
  art.frames.gil.release=[art.gilNP[4],art.gilNP[5],art.gilNP[6],art.gilNP[7]];
  function cut(image,x,y,w,h){const c=make(w,h);c.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);return c}
  // v0.25: native source-pixel scale, not a generated character's total height.
  function sourcePose(image,i,scale,head){return {canvas:cut(image,i%2*768,Math.floor(i/2)*512,768,512),pivot:350,foot:460,scale,head}}
  art.frames.saber.air=art.frames.saber.attack.map((f,i)=>({...f,canvas:cut(f.canvas,0,0,f.canvas.width,f.canvas.height),head:[12,44,3,2][i]}));
  art.frames.saber.great=[0,1,2,3].map((i)=>sourcePose(saberGreat,i,.77,[219,236,254,204][i]));
  art.frames.lancer.throw=[0,1,2,3].map((i)=>sourcePose(lancerThrow,i,.68,[207,222,225,196][i]));
  // Preserve Saber's original body pixel-for-pixel. Only blade regions use the edit.
  const bladeAreas=[[195,195,139,56],[390,175,124,84],[412,369,115,135],[307,349,100,100]];
  for(let i=0;i<4;i++){
   const original=cut(saberAir,i%2*768,Math.floor(i/2)*512,768,512).getContext('2d').getImageData(0,0,768,512),target=art.frames.saber.great[i].canvas,cg=target.getContext('2d'),im=cg.getImageData(0,0,768,512);
   const [bx,by,bw,bh]=bladeAreas[i];
   for(let y=0;y<512;y++)for(let x=0;x<768;x++)if(!(x>=bx&&x<bx+bw&&y>=by&&y<by+bh)){const n=(y*768+x)*4;im.data.set(original.data.subarray(n,n+4),n)}
   cg.putImageData(im,0,0);
   const base=art.frames.saber.attack[i];
   art.frames.saber.great[i]={...base,canvas:cut(target,350-base.pivot,460-base.foot,base.canvas.width,base.canvas.height),head:[12,44,3,2][i]};
  }
  // Keep each complete pose intact: rectangular head patches also copied old spears.
  art.combatFX={blade:cut(combatEffects,315,175,580,185),air:cut(combatEffects,920,65,600,420),impact:cut(combatEffects,900,525,630,440)};
  // Reuse the wind-up spear's actual shaft and tip, omitting the gripping hand.
  const spear=make(330,36),sg=spear.getContext('2d');sg.imageSmoothingEnabled=false;
  sg.drawImage(lancerThrow,1140,200,145,24,0,4,240,24);
  sg.drawImage(lancerThrow,1285,199,98,34,232,1,98,34);
  art.combatFX.spear=spear;
  art.weaponFrame=unpack(weapon,1,[56],1)[0];
  art.treasury=unpack(treasury,1,[0,0,0,0,0,0],6);
  // Portrait rectangles are relative to each isolated idle texture.
  art.portraits.saber=portrait(sf[0],77,0,108,118);
  art.portraits.archer=portrait(of[0],87,0,98,110);
  art.portraits.lancer=portrait(of[3],128,44,110,125);
  art.portraits.gil=portrait(of[6],87,0,112,125);
  for(const [id,image,anchors,scale]of [['iskandar',iskandar,[170,510,830,1140,155,455,810,1110,170,475,775,1045],.74],['medusa',medusa,[175,525,825,1140,164,455,790,1110,183,475,794,1080],.62]]){
   const f=unpack(image,4,anchors,3);f.forEach(frame=>frame.scale=scale);
   art.frames[id]={idle:[f[0]],run:[f[1],f[2],f[3],f[2]],attack:[f[4],f[5],f[6],f[0]],guard:[f[7]],jump:[f[8]],hurt:[f[9]],dash:[f[1]],release:[f[10],f[10],f[11],f[11]]};
   art.portraits[id]=portrait(f[0],id==='iskandar'?120:105,0,105,130);
  }
  const mounted=unpack(mounts,3,[250,670,1090,250,670,1090,250,670,1090],3);
  // Horse bodies (not wing tips) share an anchor: wing motion must not move the rider.
  mounted.forEach((f,i)=>{f.scale=i<3?.94:i<6?.66:.83;f.foot=(i<3?380:i<6?780:1190)-f.source.miny+1});
  art.mounts={iskandar:mounted.slice(0,3),army:mounted.slice(3,6),medusa:mounted.slice(6,9)};
  // Fixed atlas rectangles and measured foot pivots: one scale for every pose.
  const br=[[0,0,384,337,175,324],[384,0,384,337,221,327],[768,0,410,337,224,327],[1184,0,352,340,200,337],
   [0,337,384,343,217,337],[384,340,384,340,192,333],[768,340,422,340,190,333],[1190,340,346,340,169,335],
   [0,684,384,340,192,303],[384,684,384,340,216,303],[768,684,422,340,209,303],[1190,684,346,340,168,303]];
  const bf=br.map(([x,y,w,h,pivot,foot])=>({canvas:cut(berserker,x,y,w,h),pivot,foot,scale:.84}));
  art.frames.berserker={idle:[bf[0]],run:[bf[1],bf[2]],jump:[bf[3]],attack:[bf[4],bf[5],bf[6],bf[0]],guard:[bf[7]],hurt:[bf[8]],dash:[bf[9]],release:[bf[11],bf[10],bf[10],bf[11]]};
  art.portraits.berserker=portrait(bf[0],139,19,110,130);
  GojoArt.install(art,gojoImage);AcheronArt.install(art,acheronImage,acheronAwakened);art.ready=true;return art;
 }).catch(e=>{art.failed=true;art.error=e;return art});
 function rect(g,x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
 function label(g,str,x,y,size,color='#f9e4b0',align='left'){g.fillStyle=color;g.font=`bold ${size}px monospace`;g.textAlign=align;g.fillText(str,x,y)}
 function frameFor(p,t){const f=art.frames[p.char];if(!f)return null;
  if(p.char==='acheron'){const custom=AcheronArt.frame(p,t);if(custom)return custom;}
  if(p.char==='gojo'){const custom=GojoArt.frame(p,t);if(custom)return custom;}
  if(p.char==='berserker'&&p.action==='god_hand')return f.release[2];
  if(p.action==='axe_slam'){const e=(p.animMax-p.anim)*(p.attackSpeed||1);return f.attack[e<.48?0:e<.62?1:e<.95?2:3]}
  if(['iskandar','medusa'].includes(p.char)&&p.action==='np_release'&&(p.animMax-p.anim)>=.35)return art.mounts[p.char][Math.floor((p.animMax-p.anim)*10)%3];
  if(['royal_charge','chain_throw'].includes(p.action)){const e=(p.animMax-p.anim)*(p.attackSpeed||1);return f.attack[e<.15?0:e<(p.char==='iskandar'?.32:.25)?1:e<.53?2:3]}
  if(p.char==='saber'&&p.action==='np_release'){const e=(p.animMax||1.4)-p.anim;return f.great[e<.18?0:e<.48?1:e<1.05?2:3]}
  if(p.char==='gil'&&p.action==='np_release'){const e=(p.animMax||3)-p.anim;return f.release[e<.18?0:e<.35?1:e<2.75?2:3]}
  if(p.stun>0&&f.hurt)return f.hurt[0];
  if(p.action==='np_release'){
   const elapsed=Math.max(0,(p.animMax||1.1)-p.anim);
   return (f.release||f.attack)[elapsed<.18?0:elapsed<.35?1:elapsed<.7?2:3];
  }
  if(p.action==='strike_air'){const e=(p.animMax-p.anim)*(p.attackSpeed||1);return f.air[e<.1?0:e<.24?1:e<.46?2:3]}
  if(p.action==='spear_throw'){const e=(p.animMax-p.anim)*(p.attackSpeed||1);return f.throw[e<.12?0:e<.30?1:e<.53?2:3]}
  if(p.action==='caladbolg'){const e=((p.animMax||1.15)-p.anim)*(p.attackSpeed||1);return f.bow[e<.18?0:e<.9?1:e<1.02?2:3]}
  if(['light','heavy','skill','np'].includes(p.action)){
   const duration=p.animMax|| (p.action==='np'?1.4:p.action==='skill'?.5:p.action==='heavy'?.52:.27);
   const progress=Math.max(0,Math.min(.999,1-p.anim/duration));return f.attack[Math.min(f.attack.length-1,Math.floor(progress*f.attack.length))];
  }
  if(p.action==='dash'&&f.dash)return f.dash[0];
  if((p.airborne??(p.y>0))&&f.jump)return f.jump[0];
  if(p.action==='guard'&&f.guard)return f.guard[0];
  if(p.action==='run'&&p.moving!==false)return f.run[Math.floor(t*9)%f.run.length];
  return f.idle[Math.floor(t*5)%f.idle.length];
 }
 art.fighter=(g,p,t,size=1,ground=535)=>{
  if(!art.ready)return;
  const f=frameFor(p,t);if(!f)return;
  const action=['light','heavy','skill','np'].includes(p.action),isRun=p.action==='run'&&p.moving!==false;
  const bob=['np_release','strike_air','spear_throw','caladbolg','axe_slam','god_hand'].includes(p.action)?0:(p.airborne??(p.y>0))?0:Math.round(Math.sin(t*(isRun?16:3))*(isRun?2:1));
  g.save();g.imageSmoothingEnabled=false;g.translate(Math.round(p.x),Math.round(ground-p.y+bob));
  g.scale((p.face||1)*size,size);const scale=f.scale||.65;
  if(p.inv>0||p.dashInv>0)g.globalAlpha=Math.floor(t*20)%2?.5:.85;
  const draw=()=>g.drawImage(f.canvas,-Math.round(f.pivot*scale),-Math.round(f.foot*scale),Math.round(f.canvas.width*scale),Math.round(f.canvas.height*scale));
  if(p.action==='dash'){g.save();g.globalAlpha=.2;g.translate(-55,0);draw();g.translate(-45,0);draw();g.restore()}
  if(p.stun>0){g.translate(-5,0);g.globalAlpha=.65+Math.abs(Math.sin(t*60))*.35}
  if(p.action==='np_release'&&['archer','lancer','gil'].includes(p.char)){
   const e=Math.max(0,(p.animMax||1.1)-p.anim),charge=Math.min(1,e/.35);
   const color={saber:'#ffe991',archer:'#c1e6ff',lancer:'#ff5279',gil:'#ff5572'}[p.char];
   // Dedicated wind-up, release and follow-through, on the same authoritative timer as the projectile.
   if(p.char==='gil'&&e>=.35&&e<2.75)g.translate(-2-Math.round(Math.sin(e*65)*2),0);
   if(p.char!=='saber'&&p.char!=='gil')g.translate(e<.35?-Math.round(charge*12):Math.round(22*Math.max(0,1-(e-.35)/.75)),0);
   g.save();g.globalAlpha=p.char==='gil'&&e>=.35&&e<2.75?.85:e<.35?.35+charge*.6:Math.max(0,1-(e-.35)/.75);
   for(let n=0;n<24;n++){const a=n*Math.PI/12+e*8,r=e<.35?95-charge*35:65+(e-.35)*140;rect(g,Math.cos(a)*r,-125+Math.sin(a)*r,6,10,color)}
   if(p.char==='saber'){
    if(e>=.35)for(let n=0;n<32;n++){const a=n*Math.PI/16,r=28+(e-.35)*135;rect(g,Math.cos(a)*r,Math.sin(a)*r*.2,9,3,n%3?color:'#fffbea')}
   }else if(p.char==='lancer'){rect(g,e<.35?-100:25,-124,e<.35?180:270,8,color)}
   else if(p.char==='archer'){for(let n=0;n<7;n++){g.save();g.translate(-110+n*38,-80-n%3*28);g.rotate(-.7);rect(g,0,-120*charge,5,120*charge,color);g.restore()}}
   else{for(let j=0;j<3;j++)for(let n=0;n<20;n++){const a=n*Math.PI/10+e*(j%2?-20:20);rect(g,115+j*15+Math.cos(a)*(20+j*12),-155+Math.sin(a)*(12+j*10),5,3,j===1?'#ffdeb0':color)}}
   g.restore();
  }
  if(p.godTime>0){
   for(let j=0;j<12;j++){const a=j*Math.PI/6+t*.6;rect(g,Math.cos(a)*95,-130+Math.sin(a)*132,5,10,j===0&&p.godReady?'#fff1cd':'#dca76c99')}
  }
  draw();
  if(p.action==='caladbolg'){
   const e=Math.max(0,((p.animMax||1.15)-p.anim)*(p.attackSpeed||1)),q=Math.min(1,e/.9);
   if(e<.9){
    for(let n=0;n<18;n++){const a=n*2.4+e*8,r=55*(1-q)+10;rect(g,113+Math.cos(a)*r,-162+Math.sin(a)*r,4,4,n%2?'#ff9a5b':'#e8e9ff')}
    rect(g,-40,-235,100,5,'#382c42');rect(g,-40,-235,100*q,5,'#ffdba4');
   }
  }
  if(p.action==='guard'){
   for(let n=0;n<16;n++){const a=-1.2+n*.16;rect(g,38+Math.cos(a)*38,-120+Math.sin(a)*95,5,12,'#adf3ff')}
  }
  if(action&&p.anim>0&&p.action!=='np'&&p.char!=='gil'&&p.char!=='lancer'&&p.char!=='gojo'&&p.char!=='acheron'){
   g.save();g.globalAlpha=Math.min(.8,p.anim*3);const color=p.char==='lancer'?'#ff708c':p.char==='archer'?'#e3ecff':'#d4f7ff';
   for(let n=0;n<22;n++){const a=-1.15+n*.10,r=105;rect(g,32+Math.cos(a)*r,-128+Math.sin(a)*64,n<12?10:6,5,color)}g.restore();
  }
  if(action&&p.anim>0&&p.char==='lancer'){
   for(let j=0;j<5;j++)rect(g,55+j*15,-118+j%2,20,3,j%2?'#b02c5a':'#ff829b');
  }
  if(p.char==='gil'&&action){for(let j=0;j<3;j++)for(let n=0;n<16;n++){const a=n*Math.PI/8;rect(g,-45-j*25+Math.cos(a)*14,-120-j*27+Math.sin(a)*23,4,4,'#ffe596')}}
  g.restore();
 };
 art.background=(g,t)=>{
  g.imageSmoothingEnabled=false;g.drawImage(art.stage,0,0,1280,660);
  // Foreground drifting petals and small river glints stay on the pixel grid.
  for(let i=0;i<24;i++){let x=(i*173+t*(11+i%5))%1360-40,y=105+(i*59+t*(9+i%3))%455;rect(g,x,y,4+(i%3)*2,3,'#f6b5d38a')}
  for(let i=0;i<20;i++){const a=.15+.25*Math.max(0,Math.sin(t*3+i));g.globalAlpha=a;rect(g,255+(i*87)%825,337+(i*17)%75,10,2,'#d5e9ff')}g.globalAlpha=1;
 };
 art.hud=(g,s,slot)=>{
  g.save();g.imageSmoothingEnabled=false;
  const gradient=g.createLinearGradient(0,0,0,146);gradient.addColorStop(0,'#080f1bf5');gradient.addColorStop(1,'#080f1bc0');g.fillStyle=gradient;g.fillRect(0,0,1280,144);
  rect(g,24,143,1232,1,'#e6cb9244');
  const ids={saber:'SABER',archer:'ARCHER',lancer:'LANCER',gil:'GILGAMESH',iskandar:'ISKANDAR',medusa:'MEDUSA',berserker:'BERSERKER'};
  for(let i=0;i<2;i++){
   const p=s.players[i],right=i===1,x=right?728:112,w=440,px=right?1192:24,accent=i===slot?'#85dbc9':'#e6cb92';
   rect(g,px,22,64,80,'#1a293d');rect(g,px,22,2,80,accent);
   if(p&&art.portraits[p.char]){const face=art.portraits[p.char];g.save();g.beginPath();g.rect(px+3,24,58,76);g.clip();if(right){g.translate(px+61,0);g.scale(-1,1);g.drawImage(face,0,24,58,76)}else g.drawImage(face,px+3,24,58,76);g.restore()}
   label(g,p?ids[p.char]:'WAITING',right?x+w:x,31,15,'#edf1f7',right?'right':'left');
   label(g,i===slot?'YOU / P'+(i+1):'OPPONENT',right?x:x+w,31,9,accent,right?'left':'right');
   rect(g,x,44,w,18,'#442e3b');const hp=Math.round(w*Math.max(0,Math.min(1,(p?.hp??100)/(p?.maxHp||100))));
   rect(g,right?x+w-hp:x,44,hp,18,accent);rect(g,right?x+w-hp:x,44,hp,3,i===slot?'#c4f7e9':'#fff0d0');
   label(g,p?Math.ceil(p.hp)+' / '+(p.maxHp||100)+' HP':'—',right?x:x+w,78,10,'#cbd6e5',right?'left':'right');
   if(p){
    const mana=Math.round(w*Math.max(0,Math.min(100,p.mana))/100),np=Math.round(w*Math.max(0,Math.min(100,p.np))/100);
    rect(g,x,89,w,4,'#263347');rect(g,right?x+w-mana:x,89,mana,4,'#7ab5e9');
    rect(g,x,102,w,6,'#2b2b40');rect(g,right?x+w-np:x,102,np,6,p.np>=100?'#ffe4a6':'#b6a0e6');
    label(g,p.np>=100?'[ U ] NOBLE PHANTASM READY':'MP '+Math.floor(p.mana)+'  /  NP '+Math.floor(p.np)+'%',right?x+w:x,124,10,p.np>=100?'#ffe4a6':'#95a6bc',right?'right':'left');
    label(g,'◆'.repeat(p.seals)+'◇'.repeat(3-p.seals),right?x:x+w,124,12,'#e796a8',right?'left':'right');
   }
  }
  rect(g,590,18,100,99,'#121f30');rect(g,590,18,100,2,'#e6cb92');
  label(g,'ROUND '+(s.round||1),640,36,10,'#a4b1c3','center');
  label(g,s.training?'∞':String(Math.ceil(s.clock)).padStart(2,'0'),640,83,43,'#eef1f6','center');
  label(g,(s.score||[0,0]).join('  :  '),640,108,12,'#e6cb92','center');
  s.players.forEach((p,i)=>{if(p.char==='berserker')label(g,p.godTime>0?'GOD HAND '+p.godTime.toFixed(1)+'s · '+(p.godReady?'재기 준비':'재기 소진'):(p.reviveUsed?'재기 소진':'재기 1회'),i?1240:40,135,12,'#e9bc7d',i?'right':'left')});
  if(s.training){const d=s.players.find(p=>p.dummy);label(g,'TRAINING / DAMAGE '+(d?.damageTaken||0)+' / LAST '+(d?.lastDamage||0),640,164,12,'#e6cb92','center')}
  g.restore();
 };
 art.effects=(g,s,t)=>{
  for(const p of s.players){if(p.shield>0){const w=84*Math.min(1,p.shield/(p.maxHp||100));rect(g,p.x-42,535-p.y-280,84,6,'#243247');rect(g,p.x-42,535-p.y-280,w,6,'#b5c8ff')}}
  for(const f of s.fx){if(f.kind==='aug_ring'){const y=535-f.y,q=1-f.life/.5,r=f.radius*Math.max(.1,q);for(let j=0;j<36;j++){const angle=j*Math.PI/18;rect(g,f.x+Math.round(Math.cos(angle)*r/4)*4,y+Math.round(Math.sin(angle)*r*.45/4)*4,8,8,f.color)}}}
  for(const sh of s.shots){if(['purple','red','octobolt','stygian'].includes(sh.kind))continue;const dir=Math.sign(sh.v),y=535-sh.y,x=sh.x;
   if(sh.kind==='aug_orb'||sh.kind==='aug_nova'){
    if(sh.delay>0){rect(g,x-10,y-10,20,20,'#baa9ff55');continue}
    if(sh.kind==='aug_nova')continue;
    const size=sh.radius>30?28:14;rect(g,x-size,y-size,size*2,size*2,'#8570cb');rect(g,x-size+4,y-size+4,size*2-8,size*2-8,'#d8d1ff');rect(g,x-4,y-size-4,8,size*2+8,'#fff5dc');for(let n=1;n<=4;n++)rect(g,x-dir*(size+n*12),y-4,8,8,'#b6a4ec');continue;
   }
   if(sh.kind==='axe_slam'){
    if(sh.delay>0){const owner=s.players[sh.owner];rect(g,owner.x-42,535-owner.y-290,84,4,'#372322');rect(g,owner.x-42,535-owner.y-290,84*Math.max(0,1-sh.delay/(.48/(owner.attackSpeed||1))),4,'#f0bc80')}
    continue;
   }
   if(['army_charge','pegasus_charge','royal_charge','chain_throw'].includes(sh.kind)){
    if(sh.delay>0)continue;const owner=s.players[sh.owner],face=sh.face||1;
    if(sh.kind==='chain_throw'){
     g.save();g.strokeStyle='#b7acd4';g.lineWidth=3;g.beginPath();g.moveTo(owner.x+face*55,535-owner.y-120);g.lineTo(x,y);g.stroke();g.translate(x,y);g.scale(face,1);g.fillStyle='#e1def0';g.beginPath();g.moveTo(23,0);g.lineTo(-16,-7);g.lineTo(-8,0);g.lineTo(-16,7);g.closePath();g.fill();g.restore();
    }else{
     if(sh.kind==='army_charge')for(let j=4;j>=1;j--){const f=art.mounts.army[(Math.floor(sh.elapsed*10)+j)%3],scale=.44+j*.025;g.save();g.translate(owner.x-face*(95+j*62),535-j%2*22);g.scale(face,1);g.drawImage(f.canvas,-f.pivot*scale,-f.foot*scale,f.canvas.width*scale,f.canvas.height*scale);g.restore()}
     for(let j=0;j<16;j++)rect(g,owner.x-face*(35+j*13),520-(j*7+sh.elapsed*70)%35,10,3,sh.kind==='pegasus_charge'?'#e0ccff88':'#dbb57866');
    }continue;
   }
   if(sh.kind==='caladbolg'){
    if(sh.delay>0)continue;
    g.save();g.translate(x,y);g.scale(dir,1);
    rect(g,-155,-12,144,24,'#ff813d40');rect(g,-120,-5,120,10,'#ffbc76');rect(g,-98,-2,103,4,'#fff6da');
    for(let n=0;n<26;n++){const xx=-104+n*4,yy=Math.sin(n*.8-t*32)*11;rect(g,xx,yy,7,4,n%2?'#e4daff':'#a48ad4')}
    for(let n=0;n<7;n++)rect(g,-n*4,-n*2,5,4+n*4,'#fff3cd');
    g.restore();continue;
   }
   if(sh.kind==='ea_beam'){
    const direction=sh.face||1,len=direction>0?1280-x:x,age=sh.elapsed||0;
    g.save();g.translate(x,y);g.scale(direction,1);
    if(sh.delay<=0){
     const fade=Math.min(1,(sh.life||0)/.18),pulse=1+Math.sin(age*48)*.07;
     g.globalAlpha=fade;
     [112,86,62,38,14].forEach((height,i)=>rect(g,0,-height*pulse/2,len,height*pulse,['#75144180','#b61e55bb','#ef426b','#ffadad','#fff4d7'][i]));
     for(let n=0;n<28;n++){const bx=(n*79+age*1300)%Math.max(1,len);rect(g,bx,Math.sin(n*2+age*24)*38,22+n%4*7,3,n%3?'#ffdbb1':'#fff8e1')}
     for(let j=0;j<7;j++){const cx=(j*167+age*650)%Math.max(1,len);for(let n=0;n<20;n++){const a=n*Math.PI/10+age*12;rect(g,cx+Math.cos(a)*12,Math.sin(a)*46,5,5,'#ff7995')}}
    }
    for(let n=0;n<28;n++){const a=n*Math.PI/14+t*18;rect(g,Math.cos(a)*18,Math.sin(a)*(sh.delay>0?24:50),6,5,n%2?'#ff668c':'#ffe4b0')}
    g.restore();continue;
   }
   if(sh.kind==='greatslash'){
    const e=sh.elapsed||0,direction=sh.face||1,owner=s.players[sh.owner];
    const q=Math.max(0,Math.min(1,(e-.48)/.34));
    const hand=e<.18?[-15,-180]:e<.48?[25,-162]:e<1.05?[39,-67]:[-41,-85];
    let angle=e<.18?-Math.PI/2:e<.48?-2.15:-2.15+2.32*q;
    const length=e<.48?180+Math.min(1,e/.48)*140:320+380*q;
    const fade=e>1.05?Math.max(0,(1.4-e)/.35):1;
    g.save();g.translate(owner.x+direction*hand[0],535-owner.y+hand[1]);g.scale(direction,1);g.globalAlpha=fade;
    if(e>=.48&&e<.88){for(let j=4;j>=1;j--){g.save();g.globalAlpha=fade*(.05+j*.018);g.rotate(angle-j*.11);g.drawImage(art.combatFX.blade,0,-length*.075,length,length*.15);g.restore()}}
    g.rotate(angle);g.imageSmoothingEnabled=false;
    // Blade base remains attached to the gold crossguard in each pose.
    g.drawImage(art.combatFX.blade,0,-length*.075,length,length*.15);
    g.restore();continue;
   }
   if(sh.kind==='strike_air'||sh.kind==='spear_throw'){
    if(sh.delay>0)continue;
    const spear=sh.kind==='spear_throw',sprite=spear?art.combatFX.spear:art.combatFX.air;
    g.save();g.translate(x,y);g.scale(sh.face||dir||1,1);g.imageSmoothingEnabled=false;
    const w=spear?330*.68:185,h=spear?36*.68:130;
    g.drawImage(sprite,-(spear?w:100),-h/2,w,h);g.restore();continue;
   }
   if(sh.weapon){
    if(sh.delay>0){
     g.save();g.globalAlpha=.8;
     for(let n=0;n<20;n++){const a=n*Math.PI/10;rect(g,x-dir*70+Math.cos(a)*14,y+Math.sin(a)*30,4,4,'#ffe8a1')}
     art.drawWeapon(g,x,y,dir,sh.weapon,.5);g.restore();
    }else{
     for(let j=1;j<5;j++)rect(g,x-dir*(90+j*10),y-2,7,3,'#dfb94b');
     art.drawWeapon(g,x,y,dir,sh.weapon);
    }
    continue;
   }
   if(sh.delay>0)continue;
   if(sh.kind==='np'&&s.players[sh.owner]?.char==='archer'){
    // One authoritative hitbox, a visual volley of projected blades.
    for(let j=0;j<7;j++){g.save();g.translate(x-dir*(j%3)*26,y-54+j*18);g.scale(dir,1);
     rect(g,-110,0,84,3,'#f4ac6970');rect(g,-60,-2,58,5,'#ebdfc0');rect(g,-57,-2,53,2,'#ffffff');rect(g,-64,-7,4,15,'#c98c54');rect(g,-79,0,15,3,'#733b36');g.restore()}
   }
   else if(sh.kind==='np'&&s.players[sh.owner]?.char==='lancer'){
    g.save();g.translate(x,y);g.scale(dir,1);
    rect(g,-245,-11,240,22,'#d52b6260');rect(g,-230,-4,224,8,'#ff527d');rect(g,-170,-1,170,3,'#ffe1db');
    for(let j=0;j<8;j++){rect(g,-16-j*9,-3-j*3,12,3,'#f46a90');rect(g,-16-j*9,j*3,12,3,'#f46a90')}
    g.restore();
   }
   else if(sh.kind==='np'&&s.players[sh.owner]?.char==='gil'){
    g.save();g.translate(x,y);g.scale(dir,1);
    for(let j=0;j<5;j++){const r=62-j*12;g.fillStyle=['#640f4050','#a51c5080','#e43c60aa','#ff9899cc','#fff1c9'][j];g.beginPath();g.moveTo(-155,0);g.lineTo(-45,-r);g.lineTo(0,0);g.lineTo(-45,r);g.closePath();g.fill()}
    for(let j=0;j<3;j++)for(let n=0;n<24;n++){const a=n*Math.PI/12+t*(j%2?-16:16);rect(g,-30-j*35+Math.cos(a)*15,Math.sin(a)*(40-j*5),5,4,j%2?'#fff0c3':'#ff6688')}
    g.restore();
   }
   else if(sh.kind==='np'){for(let j=0;j<6;j++)rect(g,x-dir*(180+j*12),y-32+j*5,180+j*12,64-j*10,['#473b9090','#608ef8bb','#91d9ff','#e0f9ff','#fff6c9','#ffffff'][j]);}
   else{for(let j=0;j<7;j++)rect(g,x-dir*j*8,y-4+j%2,10,6,j<3?'#fff4d2':sh.color)}
  }
  for(const f of s.fx){if(f.kind==='rebirth'){
   g.save();g.globalAlpha=Math.min(1,f.life*2);for(let j=0;j<12;j++){const a=j*Math.PI/6,r=65+(1-f.life/.7)*100;rect(g,f.x+Math.cos(a)*r,535-f.y+Math.sin(a)*r,7,16,'#e9bc7d')}g.restore();continue;
  }if(f.kind==='greatimpact'){
   g.save();g.globalAlpha=Math.min(1,f.life*5);g.imageSmoothingEnabled=false;
   g.drawImage(art.combatFX.impact,f.x-145,535-f.y-190,290,200);g.restore();continue;
  }if(f.kind==='caladburst'){
   g.save();g.globalAlpha=Math.min(1,f.life*4);const radius=18+(1-f.life/.45)*100;
   for(let n=0;n<40;n++){const a=n*Math.PI/20;rect(g,f.x+Math.cos(a)*radius,535-f.y+Math.sin(a)*radius,10,6,n%2?'#ffd9a4':'#bbaaed')}
   g.restore();continue;
  }g.save();g.globalAlpha=Math.min(1,f.life*5);for(let i=0;i<12;i++){const a=i*Math.PI/6,r=18+(1-f.life/.25)*35;rect(g,f.x+Math.cos(a)*r,535-f.y+Math.sin(a)*r,7,5,i%2?'#fff7d6':f.color)}g.restore()}
 };
 art.drawWeapon=(g,x,y,dir,kind='forked_blade',alpha=1)=>{
  g.save();g.globalAlpha*=alpha;g.translate(Math.round(x),Math.round(y));g.scale(dir,1);g.imageSmoothingEnabled=false;
  const index=['longsword','spear','axe','greatsword','halberd','sickle'].indexOf(kind);
  if(index>=0&&art.treasury){const f=art.treasury[index],w=index===1||index===4?154:128,h=Math.round(w*f.canvas.height/f.canvas.width);g.drawImage(f.canvas,-w,-Math.floor(h/2),w,h)}
  else if(kind==='forked_blade'&&art.weaponFrame){g.drawImage(art.weaponFrame.canvas,-116,-13,116,27)}
  else{rect(g,-86,-2,80,5,'#f3dba0');rect(g,-67,-6,4,13,'#d1a04b');rect(g,-98,-2,30,5,'#af5436');rect(g,-6,-1,6,3,'#fff4d3')}
  g.restore();
 };
 art.frameFor=frameFor;art.unpack=unpack;return art;
})();



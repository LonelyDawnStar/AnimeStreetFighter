'use strict';
const DuelMotion=(()=>{
 const banks={},errors=[];
 const groups=[["walk-e",["gojo","lancer"],4,"047"],["saber-walk",["saber"],2,"048"],["archer-walk",["archer"],2,"048"],["gil-walk",["gil"],2,"048"],["iskandar-walk",["iskandar"],2,"048"],["medusa-walk",["medusa"],2,"048"],["berserker-walk",["berserker"],2,"048"],["acheron-walk",["acheron"],2,"048"],["acheron_white-walk",["acheron_white"],2,"048"]];
 const load=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(url));im.src=url});
 const atlas={"walk-e":[[0,0,193,313,96.652,311,311],[215,0,154,312,79.713,310,310],[430,0,93,313,46.5,311,311],[645,0,195,313,95.232,311,311],[0,313,206,303,99.571,301,301],[215,313,179,301,86.534,299,299],[430,313,92,303,46.5,301,301],[645,313,201,303,93.464,301,301],[0,626,187,307,93.907,305,305],[215,626,182,306,98.513,304,304],[430,626,163,308,91.195,306,306],[645,626,215,307,99.688,305,305],[0,939,200,280,103.943,278,278],[215,939,191,280,102.669,278,278],[430,939,179,279,92.628,277,277],[645,939,206,279,101.217,277,277]],"acheron-combat":[[0,0,204,239,103.998,237,237],[380,0,247,245,125.5,243,243],[760,0,380,239,171.665,237,237],[1140,0,194,255,99.272,253,253],[0,321,270,312,133.012,310,310],[380,321,336,240,157.054,238,238],[760,321,362,210,161.044,208,208],[1140,321,213,268,108.804,266,266],[0,642,224,202,114.01,200,200],[380,642,297,309,141.197,307,307],[760,642,279,321,138.394,319,319],[1140,642,225,268,115.179,266,266],[0,963,240,238,121.902,236,236],[380,963,362,231,152.525,229,229],[760,963,275,215,136.149,213,213],[1140,963,259,243,127.445,241,241]],"saber-walk":[[0,0,318,404,167.257,402,402],[328,0,304,404,156.14,402,402],[656,0,313,404,155.063,402,402],[984,0,320,403,164.753,401,401],[0,404,328,399,170.391,397,397],[328,404,287,399,143.263,397,397],[656,404,287,398,140.445,396,396],[984,404,327,400,169.268,398,398]],"archer-walk":[[0,0,379,407,196.2,405,405],[386,0,343,407,172.815,405,405],[772,0,305,407,145.135,405,405],[1158,0,365,407,189.287,405,405],[0,407,386,404,199.505,402,402],[386,407,346,402,174.922,400,400],[772,407,307,403,146.882,401,401],[1158,407,375,404,194.549,402,402]],"gil-walk":[[0,0,324,415,186.734,413,413],[325,0,271,415,161.471,413,413],[650,0,214,415,127.5,413,413],[975,0,322,415,185.653,413,413],[0,417,323,416,186.485,414,414],[325,417,268,414,161.264,412,412],[650,417,217,416,130.637,414,414],[975,417,325,417,188.115,415,415]],"iskandar-walk":[[0,0,412,420,243.352,418,418],[439,0,382,426,227.327,424,424],[878,0,323,427,191.113,425,425],[1317,0,428,425,248.119,423,423],[0,427,434,421,253.617,419,419],[439,427,396,424,232.749,422,422],[878,427,313,424,185.291,422,422],[1317,427,439,423,256.423,421,421]],"medusa-walk":[[0,0,354,434,198.549,432,432],[388,0,339,434,195.707,432,432],[776,0,297,438,168.878,436,436],[1164,0,366,434,207.608,432,432],[0,438,388,423,212.371,421,421],[388,438,332,428,192.509,426,426],[776,438,296,428,171.013,426,426],[1164,438,371,426,211.266,424,424]],"berserker-walk":[[0,0,329,397,184.583,395,395],[371,0,317,397,190.953,395,395],[742,0,270,397,170.357,395,395],[1113,0,369,397,216.292,395,395],[0,405,324,401,182.513,399,399],[371,405,321,401,193.527,399,399],[742,405,261,405,163.678,403,403],[1113,405,371,401,217.133,399,399]],"acheron-walk":[[0,0,330,410,187.836,408,408],[339,0,300,408,177.997,406,406],[678,0,270,408,161.448,406,406],[1017,0,338,408,188.383,406,406],[0,410,339,401,189.564,399,399],[339,410,297,402,176.417,400,400],[678,410,271,402,162.757,400,400],[1017,410,336,401,187.789,399,399]],"acheron_white-walk":[[0,0,330,410,188.565,408,408],[340,0,301,411,178.651,409,409],[680,0,278,410,165.825,408,408],[1020,0,338,409,189.88,407,407],[0,411,340,400,191.677,398,398],[340,411,299,403,177.776,401,401],[680,411,279,404,166.579,402,402],[1020,411,339,402,190.273,400,400]]};
 function extract(image,rows,key){
  const entries=atlas[key];if(!entries||entries.length!==rows*4)throw Error('Invalid motion atlas '+key);
  return entries.map(([x,y,w,h,pivot,foot,height])=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);return {canvas,pivot,foot,height,top:1,scale:1}});
 }
 function installGroup(art,key,names,rows,image){
  const f=extract(image,rows,key);
  names.forEach((name,k)=>{if(name.startsWith('unused'))return;const ref=art.frames[name==='acheron_white'?'acheron':name].idle[0],target=ref.foot*(ref.scale||.65),frames=f.slice(k*8,k*8+8);
   const heights=frames.map(f=>f.height).sort((a,b)=>a-b),median=(heights[3]+heights[4])/2;
   // One scale per cycle; per-frame rescaling creates a visible breathing/size pulse.
   const scale=target/median;
   // Atlas rows can be exported at different sizes. Correct the row once, never zoom individual poses.
   const rowMeans=[0,1].map(r=>frames.slice(r*4,r*4+4).reduce((n,f)=>n+f.height,0)/4);
   frames.forEach((frame,i)=>frame.scale=scale*median/rowMeans[Math.floor(i/4)]);banks[name]=frames;
  });
 }
 async function start(art){
  // Sequential optional downloads avoid competing with core startup images.
  for(const [key,names,rows,version]of groups){try{const im=await load('/assets/'+key+'-v'+version+'.png');installGroup(art,key,names,rows,im)}catch(e){errors.push(String(e))}await new Promise(r=>setTimeout(r,0))}
 }
 function frame(p){if(p.action!=='run'||p.moving===false||p.stun>0||p.y>0||p.airborne)return null;const id=p.char==='acheron'&&(p.rainCharges>0||p.rainFinishing)?'acheron_white':p.char,bank=banks[id];if(!bank)return null;const phase=((p.gait||0)%1+1)%1;return bank[Math.floor(phase*8)%8]}
 function advance(previous,p,dt,frozen=false){
  const old=previous&&previous.char===p.char?previous:{char:p.char,x:p.x,y:p.y,gait:0};
  const moving=!frozen&&p.action==='run'&&p.moving!==false&&p.stun<=0&&p.y===0&&p.vy===0;
  const x=moving?old.x+(p.x-old.x)*(1-Math.exp(-25*dt)):p.x,dx=x-old.x;
  const gait=moving&&Math.abs(dx)<55?(old.gait||0)+dx*(p.face||1)/(p.char==='berserker'?170:145):(old.gait||0);
  return {char:p.char,x,y:p.y<=0?0:old.y+(p.y-old.y)*(1-Math.exp(-25*dt)),gait};
 }
 return {start,frame,advance,extract,installGroup,banks,errors};
})();

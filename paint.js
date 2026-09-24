// All material rendering is cached per leaf. No acrylic brush loops run during a page turn.
window.createBookPainter=function(assets){
 const W=600,H=780,INK='#39444b',ROSE='#975963',MUTED='#6b6c64';
 const regions=new Map(),overflow=[]; let g,hit,seed=0,activePage='';
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const tile=canvas(128,128),tg=tile.getContext('2d'),pixels=tg.createImageData(128,128);seed=34;
 for(let i=0;i<pixels.data.length;i+=4){const v=rand();pixels.data[i]=80;pixels.data[i+1]=65;pixels.data[i+2]=43;pixels.data[i+3]=v>.48?Math.floor(rand()*23):0;}tg.putImageData(pixels,0,0);
 function paper(side,cover=false,back=false){
  g.fillStyle=cover?(back?'#ded1ba':'#cc9f99'):'#faf8f0';g.fillRect(0,0,W,H);
  g.save();g.globalAlpha=cover?.9:.56;g.fillStyle=g.createPattern(tile,'repeat');g.fillRect(0,0,W,H);g.restore();
  const grad=g.createLinearGradient(side==='L'?W:0,0,side==='L'?W-35:35,0);grad.addColorStop(0,'#6953432d');grad.addColorStop(.2,'#99836e11');grad.addColorStop(1,'#bca79000');g.fillStyle=grad;g.fillRect(0,0,W,H);
  if(cover){g.lineWidth=.5;for(let y=0;y<H;y+=2.8){g.strokeStyle=y%3<1?'#fff2df12':'#65433e10';g.beginPath();g.moveTo(0,y);g.lineTo(W,y+.4);g.stroke();}for(let x=0;x<W;x+=3.7){g.strokeStyle='#5c3d3710';g.beginPath();g.moveTo(x,0);g.lineTo(x+.7,H);g.stroke();}g.fillStyle='#563d3724';g.fillRect(side==='L'?W-21:18,0,2,H);}
  g.fillStyle=cover?'#fff7e12c':'#fffef16b';g.fillRect(0,0,W,.7);
  g.fillStyle=cover?'#5d463444':'#8d7a5126';g.fillRect(0,H-(cover?1.5:.65),W,cover?1.5:.65);
  g.fillRect(side==='L'?0:W-.65,0,.65,H);
 }
 function paperSlip(x,y,w,h,angle=0,color='#f5eee2'){
  g.save();g.translate(x+w/2,y+h/2);g.rotate(angle);g.shadowColor='#4b3c2923';g.shadowBlur=4;g.shadowOffsetY=2;g.fillStyle=color;g.beginPath();
  for(let xx=0;xx<=w;xx+=10){const px=Math.min(xx,w)-w/2,py=-h/2+(rand()-.5)*2.1;if(xx===0)g.moveTo(px,py);else g.lineTo(px,py);}g.lineTo(w/2,h/2);for(let xx=w;xx>=0;xx-=10)g.lineTo(xx-w/2,h/2+(rand()-.5)*1.9);g.closePath();g.fill();g.restore();
 }
 function heartGroup(x,y,scale=1,color=ROSE,angle=0){g.save();g.translate(x,y);g.rotate(angle);const marks=BOOK_HEART_GROUPS[activePage]||BOOK_HEART_GROUPS['0R'];for(const m of marks)drawPenHeart(g,m.dx*scale,m.dy*scale,m.size*scale,color,m.angle,m.variant);g.restore();}
 function penArrow(x,y,w,h,color=ROSE){
  const rising=h<0,c1=rising?[x+32,y+9]:[x-12,y+h*.8],c2=rising?[x+w-16,y+h+50]:[x+w*.28,y+h*1.18],end=[x+w,y+h];
  g.save();g.strokeStyle=color;g.lineWidth=1.2;g.lineCap='round';g.lineJoin='round';
  g.beginPath();g.moveTo(x,y);g.bezierCurveTo(...c1,...c2,...end);g.stroke();
  const direction=Math.atan2(end[1]-c2[1],end[0]-c2[0]);
  g.translate(...end);g.rotate(direction);g.lineWidth=1.4;
  g.beginPath();g.moveTo(-12,-5.5);g.quadraticCurveTo(-6,-4,1,.3);g.stroke();
  g.lineWidth=.95;g.beginPath();g.moveTo(.2,0);g.quadraticCurveTo(-5,3,-9,7);g.stroke();g.restore();
 }

 function ink(text,x,y,size=30,options={}){g.save();g.translate(x,y);g.rotate(options.rotate||0);g.fillStyle=options.color||INK;g.font=`${options.weight||400} ${size}px ${options.font||'Hand'}`;g.textBaseline='alphabetic';g.textAlign=options.align||'left';g.fillText(text,0,0);g.restore();}
 const markedPhrases=[
  'голоса ваших близких','сколько любви было вокруг вас',
  'личный семейный архив','послания, которые откроете спустя годы',
  'каждый помнит её по-своему','Каждый из вас отдельно','услышите самих себя',
  'обращение близкого человека','моментами, которые вы могли не увидеть',
  'в особенный день, спустя годы','секретом для получателя',
  'впервые слышите','вместе запечатаете до выбранной даты',
  'по-настоящему вам дорого','Личные письма останутся между вами',
  'с вашей особенной даты','только для вас двоих','личные письма при этом не будут видны гостям'
 ];
 function marker(x,y,w,size,line){g.save();g.globalCompositeOperation='multiply';g.fillStyle='#d5b44e60';g.beginPath();g.moveTo(x-3,y-size*.49);g.lineTo(x+w+3,y-size*.57+Math.sin(line)*2);g.lineTo(x+w+1,y+2);g.quadraticCurveTo(x+w*.5,y-1,x-4,y+3);g.closePath();g.fill();g.restore();}
 function lines(text,x,y,width,size=29,opts={}){
  g.save();g.font=`400 ${size}px ${opts.font||'Note'}`;
  const normalized=text.replace(/\s+/g,' ').trim(),lh=opts.lineHeight||size*1.58;
  const marks=opts.font==='Hand'?[]:markedPhrases.filter(t=>normalized.includes(t)).map(t=>({start:normalized.indexOf(t),end:normalized.indexOf(t)+t.length}));
  let row='',line=0,offset=0;
  const emit=()=>{const xx=x+Math.sin(line*2.3+seed)*1.1,yy=y+line*lh;
   for(const {start,end} of marks)if(offset<end&&offset+row.length>start){const from=Math.max(0,start-offset),to=Math.min(row.length,end-offset);marker(xx+g.measureText(row.slice(0,from)).width,yy,g.measureText(row.slice(from,to)).width,size,line);}
   ink(row,xx,yy,size,{...opts,font:opts.font||'Note',rotate:Math.sin(line*1.7)*.0017});offset+=row.length+1;line++;
  };
  for(const word of normalized.split(' ')){const trial=row?row+' '+word:word;if(g.measureText(trial).width>width&&row){emit();row=word;}else row=trial;}
  if(row)emit();g.restore();return y+line*lh;
 }
 function paragraphs(texts,x,y,width,size=29,opts={}){for(const t of texts)y=lines(t,x,y,width,size,opts)+(opts.gap??17);if(y>778)overflow.push({page:activePage,y,text:texts.at(-1)});return y;}
 function title(text,x=63,y=87,width=475,size=46){return lines(text,x,y,width,size,{font:'Hand',lineHeight:size*1.06,gap:0})+17;}
 function heart(x,y,s=27,color=ROSE,rotation=-.16){const variant=(Math.round(x*13+y*7+s)+Number(activePage.slice(0,-1))*3)%12;drawPenHeart(g,x,y,s,color,rotation,variant);}
 function underline(x,y,w,color=ROSE){g.save();g.strokeStyle=color;g.lineWidth=1.3;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+w*.25,y+4,x+w*.6,y-3,x+w,y+1);g.stroke();g.restore();}
 function tape(x,y,w=92,a=-.08){
  const h=22,onBack=activePage[0]==='7',onCover=activePage[0]==='0'||onBack;
  g.save();g.translate(x,y);g.rotate(a);g.shadowColor=onCover?'#51433337':'#82766518';g.shadowBlur=onCover?1.1:1.5;g.shadowOffsetY=.7;
  const grad=g.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,onBack?'#fff6e3da':onCover?'#f1dfbca8':'#c8b79150');grad.addColorStop(.45,onBack?'#f8edd4dc':onCover?'#e4cfa0b5':'#ded2ad70');grad.addColorStop(1,onBack?'#efdfbcc9':onCover?'#e5ce9e9e':'#caba9358');
  g.fillStyle=grad;g.beginPath();g.moveTo(0,1);g.lineTo(w,0);for(let yy=0;yy<=h;yy+=3)g.lineTo(w+(yy%6===0?1.5:-1),yy);g.lineTo(0,h);for(let yy=h;yy>=0;yy-=3)g.lineTo(yy%6===0?-1:1.5,yy);g.closePath();g.fill();
  g.shadowColor='transparent';g.strokeStyle=onCover?'#80674159':'#9a895b19';g.lineWidth=.65;g.beginPath();g.moveTo(1,h-.5);g.lineTo(w-1,h-1);g.stroke();
  g.strokeStyle=onCover?'#fff9e694':'#fff9e027';g.lineWidth=.7;g.beginPath();g.moveTo(4,3);g.lineTo(w-3,2);g.stroke();
  if(onCover){g.strokeStyle='#fffbe344';g.lineWidth=.55;g.beginPath();g.moveTo(w*.72,4);g.quadraticCurveTo(w*.75,10,w*.70,18);g.stroke();}
  g.restore();
 }
 const stemAnchors={rose:[.65,.85],cosmos:[.49,.87],eucalyptus:[.51,.86],lavender:[.52,.86],fern:[.51,.875],sweetpea:[.58,.84],ginkgo:[.49,.83],flowerHead:[.76,.72]};
 function botanical(name,x,y,w,angle=0,withTape=true){const img=assets[name];if(!img)return;g.save();g.translate(x,y);g.rotate(angle);g.shadowColor='#3e39252b';g.shadowBlur=1;g.shadowOffsetX=.6;g.shadowOffsetY=1;g.drawImage(img,-w/2,-w/2,w,w);
  if(withTape){const point=stemAnchors[name]||[.5,.84],u=(point[0]-.5)*w,v=(point[1]-.5)*w,tw=Math.min(90,w*(name==='flowerHead'?.34:.23));g.translate(u,v);g.rotate(name==='flowerHead'?-.55:name==='rose'?-.20:.16);tape(-tw/2,-11,tw,0);}g.restore();
 }

 function region(x,y,w,h,angle,action,label){hit.push({x,y,w,h,angle,action,label});}
 function photo(id,x,y,w,h,angle=0,caption=null,{interactive=true,crop=.5,taped=true,penHeart=false}={}){const img=assets['p'+id];g.save();g.translate(x+w/2,y+h/2);g.rotate(angle);g.shadowColor='#3c30272b';g.shadowBlur=5;g.shadowOffsetX=1;g.shadowOffsetY=3;g.fillStyle='#fffdf6';g.fillRect(-w/2,-h/2,w,h);g.shadowColor='transparent';const pad=w*.055,foot=Math.max(39,w*.15),iw=w-pad*2,ih=h-pad-foot;const sx=-w/2+pad,sy=-h/2+pad;if(img){const ratio=Math.max(iw/img.width,ih/img.height),sw=iw/ratio,sh=ih/ratio;g.drawImage(img,(img.width-sw)/2,(img.height-sh)*crop,sw,sh,sx,sy,iw,ih);}const sheen=g.createLinearGradient(sx,sy,sx+iw,sy+ih);sheen.addColorStop(0,'#ffffff12');sheen.addColorStop(.45,'#ffffff00');sheen.addColorStop(1,'#0000000c');g.fillStyle=sheen;g.fillRect(sx,sy,iw,ih);g.strokeStyle='#cec7b444';g.lineWidth=.5;g.strokeRect(-w/2+.5,-h/2+.5,w-1,h-1);const captionText=caption??PHOTO_INFO[id].caption,maxCaptionWidth=w*(penHeart?.76:.90);let captionSize=penHeart?Math.min(25,w*.095):Math.min(28,w*.11);g.font=`400 ${captionSize}px Pen`;const measured=g.measureText(captionText).width;if(measured>maxCaptionWidth){captionSize*=maxCaptionWidth/measured;g.font=`400 ${captionSize}px Pen`;}g.save();g.translate(penHeart?-12:0,h/2-foot*.32);g.rotate(Math.sin(id*1.7)*.012);g.textAlign='center';g.fillStyle=INK;g.fillText(captionText,0,0);g.restore();if(penHeart)heart(w*.385,h/2-foot*.55,10.5,'#343c3e',-.23);if(taped)tape(-w*.19,-h/2-8,w*.38,-angle*.22);g.restore();if(interactive)region(x,y,w,h,angle,{type:'photo',id},'Открыть фотографию: '+PHOTO_INFO[id].caption);}
 function noteCard(text,x,y,w,h,angle=0){g.save();g.translate(x+w/2,y+h/2);g.rotate(angle);g.shadowColor='#584c3625';g.shadowBlur=9;g.shadowOffsetY=5;g.fillStyle='#f3eadb';g.fillRect(-w/2,-h/2,w,h);g.shadowColor='transparent';g.strokeStyle='#8293a521';g.lineWidth=.6;for(let yy=-h/2+47;yy<h/2-10;yy+=36){g.beginPath();g.moveTo(-w/2+20,yy);g.lineTo(w/2-20,yy);g.stroke();}lines(text,-w/2+26,-h/2+44,w-52,27,{lineHeight:36});g.restore();}
 function envelope(x,y,w,h,label,key,angle=0,color='#eaded0'){
  const img=assets['env_'+key];
  g.save();g.translate(x+w/2,y+h/2);g.rotate(angle);
  g.shadowColor='#392f242b';g.shadowBlur=4;g.shadowOffsetX=.8;g.shadowOffsetY=2;
  if(img)g.drawImage(img,-w/2,-h/2,w,h);
  else{g.fillStyle=color;g.fillRect(-w/2,-h/2,w,h);}
  g.shadowColor='transparent';
  if(key!=='invite'&&assets.waxSeal){
   const tips={misha:[.5027,.6865],ksusha:[.5,.6897],together:[.4965,.6941]},tip=tips[key];
   const s=Math.min(48,h*.25),sealX=w*(tip[0]-.5),sealY=h*(tip[1]-.5+.018);
   g.save();g.translate(sealX,sealY);g.rotate(key==='misha'?-.18:key==='ksusha'?.12:-.05);
   g.drawImage(assets.waxSeal,-s/2,-s/2,s,s);g.restore();
  }
  if(!img)ink(label,0,h*.4,27,{align:'center',color:'#7d5056'});
  g.restore();
  if(key==='invite')region(x,y,w,h,angle,{type:'envelope',key},'Открыть конверт: '+label);
  else region(x,y,w,h,angle,{type:'sealed',key},'Запечатанный конверт: '+label);
 }

 function number(n,side){ink(String(n),side==='L'?56:544,746,21,{align:side==='L'?'left':'right',color:'#89827a'});}
 function draw(i,side,pw){activePage=i+side;const c=canvas(pw,Math.round(pw*1.3));g=c.getContext('2d');g.scale(pw/W,pw/W);seed=710+i*95+(side==='R'?41:0);hit=[];paper(side,i===0||i===7,i===7);const p=BOOK_CONTENT[i].paragraphs;
 if(i===0){
  g.save();g.translate(300,123);g.rotate(-.025);paperSlip(-224,-65,448,152,0,'#f7f2e8');
  g.font='400 54px Note';const first=g.measureText('Миша').width,last=g.measureText('Ксюша').width;g.font='400 32px Note';const and=g.measureText('и').width;const total=first+last+and+34,start=-total/2;
  ink('Миша',start,17,54,{font:'Note'});ink('и',start+first+17,17,32,{font:'Note'});ink('Ксюша',start+first+and+34,17,54,{font:'Note'});
  ink('наша история',2,65,29,{font:'Pen',align:'center',color:'#594441',rotate:-.008});g.restore();
  paperSlip(156,249,317,378,.035,'#e4d4bd');
  photo(4,151,239,298,389,-.057,'всё начинается с вас',{interactive:false,penHeart:true});
  botanical('rose',467,480,312,.28,true);
  ink('беречь',77,498,28,{font:'Pen',rotate:-.16,color:'#523b39'});penArrow(96,510,57,48,'#523b39');
  heartGroup(450,243,.82,'#503b38',.22);
  ink('Фотографии сохраняют день.',300,690,32,{align:'center',color:'#4a3935'});ink('История возвращает в него.',300,727,32,{align:'center',color:'#4a3935'});
 }
 if(i===1&&side==='L'){
  title('Чтобы важное оставалось рядом',57,83,450,47);
  paragraphs([p[0],p[1]],64,222,466,28,{lineHeight:41,gap:23});
  heartGroup(446,692,.8,ROSE,-.1);
 }
 if(i===1&&side==='R'){
  paragraphs(p.slice(2),65,83,470,26,{lineHeight:37,gap:18});
  photo(8,75,402,235,302,-.075,'это мгновение',{crop:.4});
  photo(2,338,467,177,237,.105,'переверни',{crop:.45});
  botanical('cosmos',328,568,250,-.09,true);
  heartGroup(282,434,.7,'#5d5147',-.2);
 }
 if(i===2&&side==='L'){title('Ваша уникальная история',60,85,470,46);paragraphs([p[0]],67,192,455,28,{lineHeight:43});photo(1,70,310,266,344,-.06,'ваша история');photo(10,326,411,196,257,.085,'два взгляда',{crop:.55});ink('А что помнишь ты?',91,707,31,{font:'Pen',rotate:-.035,color:ROSE});heartGroup(429,362,.85,'#4c4944',-.3);}
 if(i===2&&side==='R'){noteCard(p[1],70,58,461,207,-.015);tape(246,48,101,.045);paragraphs(p.slice(2),69,328,457,29,{lineHeight:46,gap:28});botanical('flowerHead',467,685,131,-.29,true);ink('Нажмите на снимок —',72,679,26,{font:'Pen',color:ROSE});ink('у него есть оборот.',79,712,26,{font:'Pen',color:ROSE});}
 if(i===3&&side==='L'){title('Глазами близких',60,86,470,51);photo(3,68,186,315,426,-.034,'самые близкие',{crop:.7});botanical('eucalyptus',442,367,470,-.22,true);heartGroup(142,147,.77,ROSE,.06);envelope(312,571,245,111,'Приглашение близким','invite',-.035,'#e6e8dc');ink('Сколько любви в одном дне',64,718,30,{font:'Pen',rotate:-.025,color:ROSE});}
 if(i===3&&side==='R'){paragraphs(p,69,96,460,28,{lineHeight:43,gap:24});}
 if(i===4&&side==='L'){title('Письма в будущее',61,77,477,49);paragraphs([p[0]],65,152,470,27,{lineHeight:41});envelope(57,302,234,136,'Мише','misha',-.055);envelope(319,327,230,135,'Ксюше','ksusha',.046,'#eee0dc');paragraphs([p[1]],64,518,465,26,{lineHeight:39,gap:0});}
 if(i===4&&side==='R'){paragraphs([p[2]],65,87,468,26,{lineHeight:39});envelope(139,258,349,160,'Будущим нам','together',-.035,'#e1e4d8');botanical('lavender',118,355,224,-.52,true);paragraphs(p.slice(3),63,469,470,25,{lineHeight:36,gap:13});}
 if(i===5&&side==='L'){photo(7,59,86,283,389,-.05,'ваше самое дорогое',{crop:.52});photo(5,368,143,166,225,.065,'Ксюша',{taped:true});photo(6,328,419,183,241,.047,'Уже часть вашей истории',{taped:true});botanical('fern',230,576,283,.57,true);ink('соберём по кусочкам',180,708,31,{font:'Pen',rotate:-.014,color:ROSE});}
 if(i===5&&side==='R'){title('Мы бережно оформим вашу историю',64,84,470,47);paragraphs(p.slice(0,2),68,255,460,30,{lineHeight:49,gap:26});noteCard(p[2],85,535,434,169,-.02);heartGroup(440,716,.75,ROSE,.05);}
 if(i===6&&side==='L'){
  ink('и столько всего впереди…',71,99,40,{rotate:-.025,color:ROSE});
  photo(9,173,171,330,438,.062,'день за днём',{crop:.52});
  botanical('sweetpea',145,472,342,-.13,true);
  heartGroup(418,234,.98,'#484341',.21);
  ink('не забыть это чувство',71,676,29,{font:'Pen',rotate:-.045,color:ROSE});penArrow(370,675,111,-57);
  ink('Миша и Ксюша',244,726,33,{rotate:.005});
 }
 if(i===6&&side==='R'){
  paragraphs(p,70,113,455,29,{lineHeight:45,gap:35});
  paperSlip(78,492,449,167,-.027,'#eee5d3');tape(248,482,84,.10);
  ink('Вместе. Каждую секунду.',105,550,34,{color:ROSE,rotate:-.02});underline(108,565,301);
  ink('с того самого дня',112,613,27,{font:'Pen',rotate:-.03,color:'#62645b'});
  region(83,501,429,139,-.027,{type:'counter'},'Выбрать дату для счётчика Мы вместе');
  heartGroup(427,611,.83,'#58504a',.1);
  ink('а дальше — целая жизнь',75,717,30,{font:'Pen',rotate:-.022,color:ROSE});
 }
 if(i===7){botanical('ginkgo',298,307,336,-.30,true);ink('История продолжается',300,539,46,{align:'center',rotate:-.013});ink('Миша и Ксюша',299,601,35,{align:'center',color:'#594835'});heart(300,642,24,'#594835');}
 if(i>0&&i<7){number((i-1)*2+(side==='L'?1:2),side);if(side==='R'){g.save();g.shadowColor='#5b4e3022';g.shadowBlur=3;g.fillStyle='#ede7d9';g.beginPath();g.moveTo(573,780);g.quadraticCurveTo(584,773,600,751);g.lineTo(600,780);g.closePath();g.fill();g.shadowColor='transparent';g.strokeStyle='#b5a68c55';g.lineWidth=.6;g.beginPath();g.moveTo(573,780);g.quadraticCurveTo(592,775,600,751);g.stroke();g.restore();}}
 if(i===0){g.save();const glow=g.createRadialGradient(125,105,10,180,210,620);glow.addColorStop(0,'#fff2d716');glow.addColorStop(.55,'#ffe9cc08');glow.addColorStop(1,'#ffe9cc00');g.fillStyle=glow;g.fillRect(0,0,W,H);g.restore();}
 regions.set(i+side,hit);return c;}
 return {drawLeaf:draw,drawSpread(i,pw){return {L:i===0?null:draw(i,'L',pw),R:i===7?null:draw(i,'R',pw)}},getRegions:(i,side)=>regions.get(i+side)||[],overflow,assets};
};

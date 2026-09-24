(()=>{'use strict';
const $=id=>document.getElementById(id),content=BOOK_CONTENT,assets={};
let engine,painter,reader,current=0,step=0,manualMode=false,reading=false,lastWidth=0,lastHeight=0;
let viewerOpen=false,origin=null,originRect=null,animation=null,flipTimer=null,photoFlipped=false,objectEpoch=0,closing=false;
const layer=$('object-layer'),stage=$('object-stage'),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const modeWanted=()=>manualMode,stepToSpread=s=>s===0?0:s===13?7:Math.ceil(s/2);
function loadImage(key,url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{assets[key]=im;resolve()};im.onerror=()=>reject(new Error(url));im.src=url;});}
const counter=createTogetherCounter({note:$('counter-note'),input:$('together-date'),output:$('counter-value')});
const ready=Promise.all([...['invite','misha','ksusha','together'].map(key=>loadImage('env_'+key,'assets/'+(key==='invite'?'invite-v2':key+'-address-top')+'.webp')),loadImage('waxSeal','assets/wax-seal-dusty-rose.webp'),document.fonts.load('400 32px Hand'),document.fonts.load('400 29px Note'),document.fonts.load('400 28px Pen'),...Array.from({length:10},(_,i)=>loadImage('p'+(i+1),'assets/'+(i+1)+'.jpg')),...Object.entries({cosmos:'pressed-white-cosmos',flowerHead:'pressed-flower-head',eucalyptus:'pressed-eucalyptus',rose:'pressed-wild-rose-flat',lavender:'pressed-lavender',fern:'pressed-fern',sweetpea:'pressed-sweet-pea',ginkgo:'pressed-ginkgo'}).map(([key,name])=>loadImage(key,'assets/'+name+'.webp'))]);
function updateMeta(){
 const front=current===0,back=current===7;
 $('prev').disabled=front;$('next').disabled=back;
 $('next').querySelector('span').textContent=front?'Открыть':'Дальше';
 $('next').setAttribute('aria-label',front?'Открыть книгу':reading?'Следующая страница':'Следующий разворот');
 $('prev').setAttribute('aria-label',reading?'Предыдущая страница':'Предыдущий разворот');
 $('view-mode').textContent=reading?'Вернуться к книге':'Мобильная версия';
 $('view-mode').setAttribute('aria-label',reading?'Вернуться к перелистыванию книги':'Включить мобильную версию');
 $('view-mode').setAttribute('aria-pressed',String(reading));
 const a=$('accessible-copy');a.replaceChildren();a.hidden=reading;
 if(!reading){const h=document.createElement('h1');h.textContent=content[current].label;a.append(h);for(const t of content[current].paragraphs){const p=document.createElement('p');p.textContent=t;a.append(p);}}
 document.title=front?'Миша и Ксюша — наша история':content[current].title+' — Миша и Ксюша';
 document.body.dataset.pageCache=String(engine?.getCache()||0);document.body.dataset.layoutWarnings=JSON.stringify(painter?.overflow||[]);
}
function hotspot(r,parent,scale,ox=0,oy=0){const sealed=r.action.type==='sealed',b=document.createElement(sealed?'div':'button');b.className='hotspot'+(sealed?' sealed-envelope':'');if(sealed)b.setAttribute('role','img');b.setAttribute('aria-label',r.label);b.style.cssText=`left:${ox+r.x*scale}px;top:${oy+r.y*scale}px;width:${r.w*scale}px;height:${r.h*scale}px;transform:rotate(${r.angle}rad)`;if(!sealed)b.addEventListener('click',()=>openAction(r.action,b));parent.append(b);}
function desktopRegions(){if(!engine||reading)return;const holder=$('hotspots');holder.replaceChildren();if(current===0||current===7)return;const {x0,y0,W}=engine.getLayout();for(const [side,offset] of [['L',0],['R',W]])for(const r of painter.getRegions(current,side))hotspot(r,holder,W/600,x0+offset,y0);}
function changed(i){current=i;if(!reading)step=i===0?0:i===7?13:i*2-1;updateMeta();desktopRegions();}
function readerChanged(s){if(!reading)return;step=s;current=stepToSpread(s);engine.setIndex(current);updateMeta();}
function closeCounter(){counter.close();$('counter-note').hidden=true;}
function turn(dir){if(reading||viewerOpen||engine?.getBusy())return;closeCounter();engine.turn(dir);}
function resize(force=false){if(!engine)return;const next=modeWanted(),width=document.documentElement.clientWidth,height=innerHeight,modeChanged=next!==reading;
 if(viewerOpen&&(width!==lastWidth||Math.abs(height-lastHeight)>120))closeObject(true);if(next&&!reading)engine.setActive(false);reading=next;document.body.classList.toggle('reading-mode',reading);document.body.classList.toggle('spread-mode',!reading);$('book').setAttribute('aria-hidden',String(reading));$('hotspots').hidden=reading;
 if(reading){reader.setActive?.(true);engine.setActive(false);if(modeChanged||force)reader.render(step);else if(width!==lastWidth)reader.resize();}
 else{reader.setActive?.(false);engine.setActive(true);if(!modeChanged&&(width!==lastWidth||height!==lastHeight||force))engine.resize();desktopRegions();}
 lastWidth=document.documentElement.clientWidth;lastHeight=height;updateMeta();
}
function inertBook(value){for(const id of ['book-header','stage','dock','accessible-copy'])$(id).inert=value;}
function showObject(source,type){closeCounter();origin=source;originRect=source?.getBoundingClientRect();viewerOpen=true;closing=false;objectEpoch++;clearTimeout(flipTimer);animation?.cancel();stage.replaceChildren();stage.className='object-stage '+type;layer.hidden=false;layer.setAttribute('aria-hidden','false');inertBook(true);$('return-object').textContent=type==='photo-lift'?'Вернуть в альбом ×':'Убрать в конверт ×';$('object-hint').textContent=type==='photo-lift'?'Коснитесь снимка, чтобы перевернуть':'';$('return-object').focus();return stage;}
function animateLift(){const box=stage.getBoundingClientRect(),r=originRect||box,dx=r.left+r.width/2-(box.left+box.width/2),dy=r.top+r.height/2-(box.top+box.height/2),scale=Math.min(1,(origin?.offsetWidth||r.width)/stage.offsetWidth,(origin?.offsetHeight||r.height)/stage.offsetHeight);
 stage.dataset.returnTransform=`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${scale}) rotate(2deg)`;
 if(reduced())return Promise.resolve(true);
 animation=stage.animate([{transform:stage.dataset.returnTransform,opacity:.7},{transform:'translate(-50%,-50%) translate(0,0) scale(1) rotate(-1deg)',opacity:1}],{duration:570,easing:'cubic-bezier(.22,.75,.15,1)',fill:'both'});
 return animation.finished.then(()=>true,()=>false);
}
function closeObject(immediate=false){if(!viewerOpen||(closing&&immediate!==true))return;closing=true;const epoch=++objectEpoch;clearTimeout(flipTimer);const finish=()=>{if(epoch!==objectEpoch)return;layer.hidden=true;layer.setAttribute('aria-hidden','true');viewerOpen=false;closing=false;animation?.cancel();stage.replaceChildren();inertBook(false);origin?.focus({preventScroll:true});};if(immediate===true||reduced()){finish();return;}const from=getComputedStyle(stage).transform;animation?.cancel();animation=stage.animate([{transform:from,opacity:1},{transform:stage.dataset.returnTransform||'translate(-50%,-50%) scale(.9)',opacity:0}],{duration:340,easing:'cubic-bezier(.32,0,.25,1)'});animation.finished.then(finish,()=>{});}

function showPhoto(id,source){const root=showObject(source,'photo-lift'),info=PHOTO_INFO[id],im=assets['p'+id];const maxH=innerHeight-150,ratio=im.width/im.height,w=Math.max(180,Math.min(480,innerWidth-48,(maxH-70)*ratio+24)),h=(w-24)/ratio+70;root.style.width=w+'px';root.style.height=h+'px';
 const rotor=document.createElement('button');rotor.className='photo-rotor';rotor.setAttribute('aria-label','Перевернуть фотографию');const front=document.createElement('span');front.className='photo-face photo-front';const img=document.createElement('img');img.src=im.src;img.alt=info.alt;const caption=document.createElement('span');caption.className='photo-caption';caption.textContent=info.caption;front.append(img,caption);
 const back=document.createElement('span');back.className='photo-face photo-reverse';const questions={1:'Что вы заметили друг в друге при первой встрече?',10:'Какой поступок до сих пор вспоминаете с нежностью?',8:'Как вы сегодня говорите друг о друге, чему улыбаетесь и за что благодарны?'};const note=document.createElement('span');note.className='photo-memory';note.textContent=questions[id]||'К этому кадру можно будет добавить заметку или голосовое воспоминание об этом дне.';const signature=document.createElement('span');signature.className='photo-signature';signature.textContent='Место для вашей истории';back.append(note,signature);rotor.append(front,back);root.append(rotor);
 photoFlipped=false;let lifting=true;const epoch=objectEpoch;rotor.addEventListener('click',()=>{if(lifting||closing)return;clearTimeout(flipTimer);photoFlipped=!photoFlipped;rotor.classList.toggle('flipped',photoFlipped);});animateLift().then(finished=>{if(!finished||epoch!==objectEpoch||!rotor.isConnected)return;lifting=false;flipTimer=setTimeout(()=>{if(epoch!==objectEpoch||!rotor.isConnected||closing)return;photoFlipped=true;rotor.classList.add('flipped');},reduced()?0:80);});
}
function paragraph(root,text,cls=''){const p=document.createElement('p');p.textContent=text;p.className=cls;root.append(p);}
function openEnvelope(key,source){if(key!=='invite')return;const root=showObject(source,'letter-lift');root.style.width='';root.style.height='';const paper=document.createElement('article');paper.className='letter-object';const h=document.createElement('h2');h.textContent='Приглашение близким';paper.append(h);paragraph(paper,content[3].paragraphs[2]);paragraph(paper,'Вам останется отправить приглашение тем, чьи воспоминания хочется сохранить.','object-note');root.append(paper);animateLift();}
function openCounter(source){const note=$('counter-note'),r=source.getBoundingClientRect();note.hidden=false;counter.open();const box=note.getBoundingClientRect();note.style.left=Math.max(12,Math.min(innerWidth-box.width-12,r.left))+'px';note.style.top=Math.max(78,Math.min(innerHeight-box.height-20,r.top-box.height+30))+'px';$('together-date').focus({preventScroll:true});}
function openAction(a,source){if(viewerOpen||engine?.getBusy()||reader?.busy())return;if(a.type==='photo')showPhoto(a.id,source);if(a.type==='envelope')openEnvelope(a.key,source);if(a.type==='counter')openCounter(source);}
$('close-counter').addEventListener('click',closeCounter);$('prev').addEventListener('click',()=>turn(-1));$('next').addEventListener('click',()=>turn(1));
$('home').addEventListener('click',()=>{if(viewerOpen)return;closeCounter();if(reader?.busy())reader.resize();step=0;if(reading)reader.render(0,-1);else engine.goTo(0);window.scrollTo({top:0,behavior:'instant'});});
$('view-mode').addEventListener('click',()=>{if(viewerOpen||engine?.getBusy()||reader?.busy())return;closeCounter();manualMode=!reading;resize(true);if(!reading)window.scrollTo({top:0,behavior:'instant'});});
$('return-object').addEventListener('click',closeObject);layer.addEventListener('click',e=>{if(e.target===layer)closeObject();});
const holder=$('mobile-book');
document.addEventListener('keydown',e=>{if(viewerOpen){if(e.key==='Escape'){e.preventDefault();closeObject();}if(e.key==='Tab'){const f=[...layer.querySelectorAll('button')],first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}if(e.key==='Escape')closeCounter();});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>resize(),130);});
ready.then(()=>{painter=createBookPainter(assets);reader=createBookReader({holder,assets,painter,onAction:openAction,onStep:readerChanged});engine=createBookEngine({canvas:$('book'),spreads:content,drawSpread:(i,pw)=>painter.drawSpread(i,pw),onChange:changed,onLayout:desktopRegions,onBusy:busy=>{$('hotspots').style.visibility=busy?'hidden':'visible';if(!busy)desktopRegions();},isBlocked:()=>viewerOpen||!$('counter-note').hidden});resize(true);engine.setIndex(0);$('loading').remove();}).catch(error=>{console.error('Book assets could not load',error);$('loading').textContent='Не удалось открыть книгу. Обновите страницу, пожалуйста.';});
})();

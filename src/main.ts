
import { BoardRenderer } from './renderer';
type SymbolKind='rabbit'|'moon'|'lion'|'cat'|'lantern'|'potion'|'heart'|'club'|'spade'|'diamond';
type Token={id:number;type:SymbolKind};
type FreeState={left:number;size:number;moons:number;seen:Set<number>;total:number};
type Giant={row:number;col:number;size:number};
const renderer=new BoardRenderer();
let autoRemaining=0, autoRunning=false;

const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{const el=document.getElementById(id);if(!el)throw new Error('Missing element '+id);return el as T}, N=7, normal:SymbolKind[]=['lion','cat','lantern','potion','heart','club','spade','diamond'];
const symbolImage=(k:SymbolKind)=>'<span class="symbol-art sprite-'+k+'" aria-hidden="true"></span>';
const names={rabbit:'玉兔 WILD',moon:'月亮 WILD',lion:'金獅',cat:'白貓',lantern:'粉紅燈籠',potion:'仙藥瓶',heart:'紅心',club:'梅花',spade:'黑桃',diamond:'方塊'};
const coeff:Partial<Record<SymbolKind,number>>={lion:1.2,cat:1,lantern:.8,potion:.6,heart:.35,club:.35,spade:.35,diamond:.35};
let uid=0,grid:Token[]=[],balance=5000,betIndex=1,busy=false,fast=false,progress=0,free:FreeState|null=null,roundWin=0,multiplier=1,giant:Giant|null=null,bannerTimer:ReturnType<typeof setTimeout>;
const bets=[5,10,20,50,100], fmt=(n:number)=>n.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2}), wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,fast?ms*.45:ms));
function randomInt(n:number){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n}
function token(type:SymbolKind){return {id:++uid,type}}
function pick(){const n=randomInt(1000);return n<5?'rabbit':n<12?'moon':normal[randomInt(normal.length)]}
function makeGrid(){return Array.from({length:49},()=>token(pick()))}
function wild(t:SymbolKind){return t==='rabbit'||t==='moon'}
function neighbors(i:number){const r=Math.floor(i/7),c=i%7;return [r>0?i-7:-1,r<6?i+7:-1,c>0?i-1:-1,c<6?i+1:-1].filter(x=>x>=0)}
function findClusters(board:Token[]){
  if(board.every(t=>wild(t.type)))return [{type:'rabbit',ids:Array.from({length:49},(_,i)=>i),factor:100}];
  const candidates=[];
  for(const type of normal){const seen=new Set();for(let i=0;i<49;i++){if(seen.has(i)||!(board[i].type===type||wild(board[i].type)))continue;const stack=[i],ids=[];seen.add(i);while(stack.length){const at=stack.pop()!;ids.push(at);for(const next of neighbors(at)){if(!seen.has(next)&&(board[next].type===type||wild(board[next].type))){seen.add(next);stack.push(next)}}}if(ids.length>=5&&ids.some(j=>board[j].type===type)){const size=ids.length;const factor=(coeff[type]??0)*(size<8?.25:size<12?.6:size<20?1.3:size<30?3:8);candidates.push({type,ids,factor})}}}
  candidates.sort((a,b)=>b.factor-a.factor);const used=new Set(),accepted=[];for(const c of candidates){if(c.ids.some(i=>used.has(i)))continue;accepted.push(c);c.ids.forEach(i=>used.add(i))}return accepted
}
function collapse(board:Token[],removed:Set<number>,refill=pick){const next=Array(49),moves=new Map();for(let col=0;col<7;col++){const survivors=[];for(let row=0;row<7;row++){const index=row*7+col;if(!removed.has(index))survivors.push({t:board[index],row})}const missing=7-survivors.length;for(let row=0;row<7;row++){if(row<missing){const t=token(refill());next[row*7+col]=t;moves.set(t.id,row-missing-1)}else{const old=survivors[row-missing];next[row*7+col]=old.t;moves.set(old.t.id,old.row)}}}return {grid:next,moves}}
function draw(board:Token[],moves:Map<number,number>|null=null){return renderer.draw(board,moves,giant,fast)}
function hud(){ $('app').classList.toggle('fg',!!free); $('balance').textContent=fmt(balance);$('bet').textContent=fmt(bets[betIndex]);$('win').textContent=fmt(roundWin);['spin','demo','giant-demo','reset','show-demo'].forEach(id=>$<HTMLButtonElement>(id).disabled=busy||autoRunning);$<HTMLButtonElement>('minus').disabled=busy||!!free||betIndex===0;$<HTMLButtonElement>('plus').disabled=busy||!!free||betIndex===bets.length-1;$<HTMLButtonElement>('demo').disabled=busy||!!free;$<HTMLButtonElement>('giant-demo').disabled=busy||!!free;$('mode').textContent=free?`免費 ${free.left} 次`:'一般遊戲';$('free-count').textContent=free?String(free.left):'—';$('rabbit-size').textContent=free?`玉兔 ${free.size} × ${free.size}`:'玉兔 WILD × 月亮 WILD';$('meter-title').textContent=free?'玉兔成長':'月兔寶盒';$('meter-caption').textContent=free?'月亮收集':'消除累積';$('meter-count').textContent=free?`${free.moons} / ${free.size===7?"MAX":fgNeeds[free.size-1]}`:`${progress} / 25`;$('progress').style.width=(free?(free.size===7?1:Math.min(1,free.moons/fgNeeds[free.size-1])):progress/25)*100+'%';document.querySelectorAll<HTMLElement>('.level').forEach(e=>e.classList.toggle('active',Number(e.dataset.level)===multiplier))}
function say(text:string){$('status').textContent=text}
function announce(text:string){clearTimeout(bannerTimer);$('banner').textContent=text;bannerTimer=setTimeout(()=>$('banner').textContent='',2600)}
function award(value:number){const cap=bets[betIndex]*20000;const amount=Math.max(0,Math.min(value,cap-roundWin));roundWin=Math.round((roundWin+amount)*100)/100;balance=Math.round((balance+amount)*100)/100;hud();return roundWin>=cap}
const fgNeeds=[5,5,4,4,3,3,Infinity],fgSpins=[5,4,3,2,2,1,1],fgMult=[1,1,1,1,5,7,10];
async function presentation(title:string,value='',caption='',rabbit=false){
  $('show').hidden=false;$('show').classList.toggle('rabbit-show',rabbit);$('show-title').textContent=title;$('show-value').textContent=value;$('show-caption').textContent=caption;
  await wait(1100);$('show').hidden=true;
}
async function celebrate(amount:number){if(amount<bets[betIndex]*10)return;const tiers=['NICE WIN',...(amount>=bets[betIndex]*25?['BIG WIN']:[]),...(amount>=bets[betIndex]*50?['MEGA WIN']:[])];
  $('show').hidden=false;$('show').classList.remove('rabbit-show');$('show-caption').textContent='本局總贏得';
  for(let i=0;i<tiers.length;i++){$('show-title').textContent=tiers[i];for(let frame=1;frame<=20;frame++){$('show-value').textContent=fmt(amount*(i+frame/20)/tiers.length);await wait(45)}await wait(350)}
  $('show-value').textContent=fmt(amount);await wait(900);$('show').hidden=true;
}
async function collectMoons(board:Token[]){if(!free)return;const state=free;const moons=board.filter(t=>t.type==='moon'&&!state.seen.has(t.id));moons.forEach(t=>state.seen.add(t.id));if(!moons.length)return;free.moons+=moons.length;$('meter').classList.add('charged');hud();await wait(350);
  while(free.size<7&&free.moons>=fgNeeds[free.size-1]){free.moons-=fgNeeds[free.size-1];free.size++;free.left+=fgSpins[free.size-1];await presentation('玉兔升級',free.size+' × '+free.size,'增加 '+fgSpins[free.size-1]+' 次免費旋轉',true)}
  $('meter').classList.remove('charged');hud();
}
function activate(size=1){free={left:fgSpins[size-1],size,moons:0,seen:new Set(),total:0};multiplier=fgMult[size-1];announce(size===7?'巨大玉兔 · 全盤 ×10':'玉兔映月 · 5 次免費旋轉');say('免費回合已就緒，按旋轉開始。');hud()}
async function modifier(){const feature=randomInt(3);$('shell').classList.add(feature===1?'feature-cyan':'feature-gold');$('meter').classList.add('charged');await wait(380);if(feature===0){const indexes=new Set<number>();while(indexes.size<4)indexes.add(randomInt(49));for(const i of indexes)grid[i]=token('moon');announce('月兔寶盒 · 月光百搭');await draw(grid)}else if(feature===1){const type=normal[4+randomInt(4)];grid=grid.map(t=>t.type===type?token('lion'):t);announce('月兔寶盒 · 金獅升級');await draw(grid)}else{const next=multiplier<2?2:multiplier<3?3:multiplier<5?5:10;multiplier=next;announce(`月兔寶盒 · 本局 ×${next}`);hud()}await wait(700);$('shell').classList.remove('feature-gold','feature-cyan');$('meter').classList.remove('charged')}
async function rollColumns(previous:Token[],next:Token[]){await renderer.roll(previous,next,fast);await draw(next)}
async function spin(){if(busy)return;const cost=bets[betIndex],wasFree=!!free;if(!wasFree&&balance<cost){say('體驗幣不足，可按「補充體驗幣」。');return}busy=true;roundWin=0;giant=null;if(wasFree&&free){free.left--;multiplier=fgMult[free.size-1]}else{balance-=cost;multiplier=1}hud();say('月色降臨，符號落下…');$('board-win').textContent='';$('win-history').replaceChildren();let trigger=false,pending=0;try{
  const previous=grid.slice();grid=makeGrid();
  if(wasFree&&free){const size=free.size,row=randomInt(8-size),col=randomInt(8-size);giant={row,col,size};for(let r=row;r<row+size;r++)for(let c=col;c<col+size;c++)grid[r*7+c]=token('rabbit');}else trigger=grid.some(t=>t.type==='rabbit')&&grid.some(t=>t.type==='moon');
  await rollColumns(previous,grid);if(wasFree)await collectMoons(grid);hud();await wait(160);
  for(let cascade=0;cascade<40;cascade++){
    const groups=findClusters(grid);
    if(!groups.length){if(pending>0){pending--;await modifier();continue}break}
    const removed=new Set(groups.flatMap(g=>g.ids));const gain=groups.reduce((sum,g)=>sum+g.factor*cost*multiplier,0);say(`${groups.length} 組連線 · 消除 ${removed.size} 格 · ×${multiplier}`);$('board-win').textContent='+'+fmt(gain);const line=document.createElement('div');line.textContent=removed.size+' 個 · '+fmt(gain);$('win-history').append(line);
    renderer.highlight(removed);await wait(520);const capped=award(gain);
    await renderer.remove(removed,fast);$('board-win').textContent='';giant=null;
    if(!wasFree){progress+=removed.size;while(progress>=25){progress-=25;pending++}}
    const dropped=collapse(grid,removed);grid=dropped.grid;await draw(grid,dropped.moves);if(wasFree)await collectMoons(grid);hud();await wait(150);if(capped){say('已達本局最高 20,000 倍。');break}if(cascade===39)say('本局消除已結算。')
  }
  await celebrate(roundWin);if(wasFree&&free){free.total+=roundWin;if(free.left<=0){await presentation('免費遊戲結束',fmt(free.total),'總贏得');free=null}}else if(trigger){activate();await presentation('免費遊戲','5 次','玉兔與月亮觸發免費回合',true)}say(roundWin?`本局共贏得 ${fmt(roundWin)} 體驗幣${free?' · 免費回合剩 '+free.left+' 次':''}`:`本局未中獎${free?' · 免費回合剩 '+free.left+' 次':''}`);
}catch(error){console.error(error);say('動畫已中止；已派獎金保留，可再次旋轉。')}finally{busy=false;giant=null;hud()}}
$('show-demo').addEventListener('click',async()=>{if(busy)return;busy=true;hud();try{await celebrate(bets[betIndex]*80)}finally{busy=false;hud()}});$('spin').addEventListener('click',()=>{if(!autoRunning)void spin()});$('minus').addEventListener('click',()=>{if(!busy&&!free&&betIndex>0){betIndex--;hud()}});$('plus').addEventListener('click',()=>{if(!busy&&!free&&betIndex<bets.length-1){betIndex++;hud()}});$('demo').addEventListener('click',()=>{if(!busy&&!free){activate();busy=true;hud();presentation('免費遊戲','5 次','試作轉場 · 尚未核對原版',true).finally(()=>{busy=false;hud()})}});$('giant-demo').addEventListener('click',()=>{if(!busy&&!free){activate(7);busy=true;hud();presentation('巨大玉兔','7 × 7 · ×10','最高階免費回合',true).finally(()=>{busy=false;hud()})}});$('speed').addEventListener('click',()=>{fast=!fast;$('speed').textContent=fast?'速度：快速':'速度：一般';$('speed').classList.toggle('active',fast)});$('reset').addEventListener('click',()=>{if(busy)return;balance=5000;roundWin=0;free=null;progress=0;multiplier=1;giant=null;grid=makeGrid();draw(grid);hud();say('體驗幣已補充。')});$('rules').addEventListener('click',()=>$<HTMLDialogElement>('help').showModal());$('close-help').addEventListener('click',()=>$<HTMLDialogElement>('help').close());$('rabbit-emblem').innerHTML=symbolImage('rabbit');
$('auto').addEventListener('click',async()=>{
 if(autoRunning){autoRemaining=0;$('auto').textContent='停止中';return}
 if(busy)return;
 autoRunning=true;autoRemaining=25;hud();
 try{while(autoRemaining>0){if(!free&&balance<bets[betIndex])break;$('auto').textContent='停止 '+autoRemaining;await spin();autoRemaining--;if(autoRemaining>0)await wait(500)}}
 finally{autoRemaining=0;autoRunning=false;$('auto').textContent='AUTO';hud()}
});
$('menu').addEventListener('click',()=>{$('options').hidden=!$('options').hidden});
async function boot(){busy=true;hud();await renderer.init($('board'));grid=makeGrid();await draw(grid);busy=false;hud();say('按下旋轉開始遊戲。')}
void boot().catch(error=>{console.error(error);say('盤面載入失敗，請以本機伺服器或網站開啟。')});


import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
type Item={id:number;type:string};
type Giant={row:number;col:number;size:number};
const SIZE=700,STEP=100;
export class BoardRenderer{
 private app=new Application();
 private layer=new Container();
 private textures=new Map<string,Texture>();
 private cells=new Map<number,Container>();
 private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 async init(host:HTMLElement){
  await this.app.init({width:SIZE,height:SIZE,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,preference:'webgl'});
  host.append(this.app.canvas);this.app.canvas.setAttribute('aria-label','月兔七乘七遊戲盤面');
  const atlas=await Assets.load<Texture>('symbols.png');
  const keys=['rabbit','moon','lion','cat','lantern','potion','heart','club','spade','diamond'];
  const w=atlas.width/5,h=atlas.height/2;
  keys.forEach((key,i)=>this.textures.set(key,new Texture({source:atlas.source,frame:new Rectangle(i%5*w,Math.floor(i/5)*h,w,h)})));
  const grid=new Graphics();
  for(let i=0;i<49;i++)grid.rect(i%7*STEP,Math.floor(i/7)*STEP,STEP,STEP).fill({color:i%2?0x301a19:0x3b2220,alpha:.88}).stroke({color:0x98613b,width:1,alpha:.35});
  const mask=new Graphics().rect(0,0,SIZE,SIZE).fill(0xffffff);
  this.app.stage.addChild(grid,this.layer,mask);this.layer.mask=mask;
 }
 private clear(){for(const child of this.layer.removeChildren())child.destroy({children:true});this.cells.clear()}
 private symbol(type:string){
  const c=new Container();
  if(['lion','cat','lantern','potion'].includes(type))c.addChild(new Graphics().roundRect(3,3,94,94,3).fill({color:0x531936,alpha:.5}).stroke({color:0xd7a84d,width:2}));
  const sprite=new Sprite(this.textures.get(type));sprite.anchor.set(.5);sprite.position.set(50);sprite.width=96;sprite.height=96;c.addChild(sprite);return c;
 }
 private tween(ms:number,update:(p:number)=>void){
  if(this.reduced){update(1);return Promise.resolve()}
  return new Promise<void>(resolve=>{let elapsed=0;const tick=()=>{elapsed+=this.app.ticker.deltaMS;const p=Math.min(1,elapsed/ms);update(p);if(p===1){this.app.ticker.remove(tick);resolve()}};this.app.ticker.add(tick)});
 }
 async draw(board:Item[],moves:Map<number,number>|null,giant:Giant|null,fast:boolean){
  this.clear();const falling:{c:Container;from:number;to:number}[]=[];
  board.forEach((item,i)=>{const c=this.symbol(item.type);c.position.set(i%7*STEP,Math.floor(i/7)*STEP);this.layer.addChild(c);this.cells.set(i,c);
   const old=moves?.get(item.id);if(old!==undefined&&old!==Math.floor(i/7))falling.push({c,from:old*STEP,to:c.y});
   if(giant){const r=Math.floor(i/7),col=i%7;if(r>=giant.row&&r<giant.row+giant.size&&col>=giant.col&&col<giant.col+giant.size)c.visible=false}
  });
  if(giant){const s=this.symbol('rabbit');s.scale.set(giant.size);s.position.set(giant.col*STEP,giant.row*STEP);this.layer.addChild(s)}
  if(falling.length)await this.tween(fast?220:480,p=>{const eased=1-Math.pow(1-p,3);for(const f of falling)f.c.y=f.from+(f.to-f.from)*eased});
 }
 async roll(previous:Item[],next:Item[],fast:boolean){
  this.clear();const keys=['lion','cat','lantern','potion','heart','club','spade','diamond'];
  await Promise.all(Array.from({length:7},async(_,col)=>{
   const strip=new Container();strip.x=col*STEP;this.layer.addChild(strip);const rows=24+col*3,distance=rows*STEP;
   for(let r=0;r<rows+7;r++){const type=r<7?next[r*7+col].type:r>=rows?previous[(r-rows)*7+col].type:keys[Math.floor(Math.random()*keys.length)];const c=this.symbol(type);c.y=r*STEP;strip.addChild(c)}
   strip.y=-distance;const accel=.15,brake=.32,speed=fast?6400:3400,cruise=distance/speed-(accel+brake)/2,total=accel+cruise+brake;
   await this.tween(total*1000,p=>{const t=p*total;const travel=t<accel?speed*t*t/(2*accel):t<accel+cruise?speed*accel/2+speed*(t-accel):distance-speed*(total-t)**2/(2*brake);strip.y=travel-distance});
  }));
 }
 highlight(indices:Set<number>){for(const i of indices){const c=this.cells.get(i);if(c)c.addChildAt(new Graphics().roundRect(1,1,98,98,9).fill({color:0xffcf45,alpha:.34}).stroke({color:0xffee98,width:3}),0)}}
 async remove(indices:Set<number>,fast:boolean){await this.tween(fast?150:320,p=>{for(const i of indices){const c=this.cells.get(i);if(c){c.alpha=1-p;c.scale.set(1-.35*p);c.pivot.set(50);c.position.set(i%7*STEP+50,Math.floor(i/7)*STEP+50)}}})}
}

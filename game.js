import { TAU, clamp, distance, turn, segmentHitsCircle, wavePlan, enemyType, mapForWave, UPGRADES, ENEMIES, WEAPONS } from './core.js';
import { SoundEngine } from './audio.js';
import { Renderer } from './renderer.js';
import { languages, setLocale, t } from './i18n.js';

const $ = id => document.getElementById(id);
const canvas=$('game'),arena=$('arena'),overlay=$('overlay'),dialog=$('settings-dialog');
const panels=['intro-panel','pause-panel','over-panel','upgrade-panel'];
const defaults={volume:.6,muted:false,music:true,shake:!matchMedia('(prefers-reduced-motion: reduce)').matches,effects:true,difficulty:'normal',language:'tr'};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const stored=read('blackout.settings',{});
const settings={...defaults};
for(const key of ['muted','music','shake','effects'])if(typeof stored?.[key]==='boolean')settings[key]=stored[key];
if(typeof stored?.volume==='number')settings.volume=clamp(stored.volume,0,1);
if(['easy','normal','hard'].includes(stored?.difficulty))settings.difficulty=stored.difficulty;
if(languages[stored?.language])settings.language=stored.language;
setLocale(settings.language);
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private mode can disable storage. */}};
const saveSettings=()=>write('blackout.settings',settings);
const sound=new SoundEngine(settings),renderer=new Renderer(canvas,settings);
const keys=new Set();
const pointer={x:600,y:230,screenX:null,screenY:null,down:false};
const bestValue=read('blackout.best',0);
const g={world:{width:1600,height:900},state:'ready',pointer,touch:matchMedia('(pointer:coarse)').matches,
  enemies:[],bullets:[],particles:[],pickups:[],explosions:[],warnings:[],floaters:[],decals:[],wreckSmoke:[],time:0,visualTime:0,shake:0,
  wave:1,score:0,kills:0,best:typeof bestValue==='number'&&Number.isFinite(bestValue)?Math.max(0,bestValue):0,
  combo:0,comboTimer:0,spawnRemaining:0,spawnTimer:0,waveWait:-1,bannerTime:0,hudTimer:0,
  camera:{x:0,y:0,zoom:1},map:mapForWave(1)};
let joystick={x:0,y:0,id:null},firePointer=null,gamePointer=null,lastTime=0,settingsPaused=false,starting=false;
let upgrades={},choices=[];
const pad=(n,length=6)=>String(Math.floor(n)).padStart(length,'0');
const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function setText(selector,text){const element=document.querySelector?.(selector);if(!element)return;const node=[...element.childNodes].find(child=>child.nodeType===Node.TEXT_NODE&&child.nodeValue.trim());if(node)node.nodeValue=` ${text} `;else element.textContent=text;}
function setPlainText(selector,text){const element=document.querySelector?.(selector);if(element)element.textContent=text;}
function applyLanguage(){
  setLocale(settings.language);document.documentElement.lang=settings.language;
  const text={'.online':'online','.mission-meta span':'mission','.mission-meta p':'missionNote','.intro-kicker':'connected','#start':'start','.intro-note':'objective'};
  Object.entries(text).forEach(([selector,key])=>setText(selector,t(key)));
  setPlainText('#intro-panel h2',t('introTitle'));setPlainText('#intro-panel p',t('introText'));
  document.querySelectorAll?.('[data-difficulty]').forEach(button=>setText(`[data-difficulty="${button.dataset.difficulty}"]`,t(button.dataset.difficulty)));
  $('language').value=settings.language;$('language').setAttribute('aria-label',t('language'));
  updateStateText();updateSettingsUI();updateHud();
}

function newPlayer(){return{x:g.world.width*.43,y:g.world.height*.52,vx:0,vy:0,angle:-Math.PI/2,bank:0,pitch:0,health:100,maxHealth:100,cooldown:0,heat:0,overheated:false,invulnerable:0,dashTime:0,dashCooldown:0,rockets:3,maxRockets:3,rocketTimer:0,rocketCooldown:0,muzzle:0};}
g.player=newPlayer();
function resize(){
  const rect=arena.getBoundingClientRect(),old={...g.world};
  g.touch=matchMedia('(pointer:coarse), (max-width:600px)').matches;
  g.world.width=clamp(rect.width*1.3,680,1700);g.world.height=g.world.width*rect.height/rect.width;
  if(old.width&&old.height){
  for(const obj of [g.player,...g.enemies,...g.pickups,...g.decals,...g.bullets,...g.particles,...g.floaters,...g.explosions,...g.warnings,...g.wreckSmoke]){obj.x=obj.x/old.width*g.world.width;obj.y=obj.y/old.height*g.world.height;}
    pointer.x=pointer.x/old.width*g.world.width;pointer.y=pointer.y/old.height*g.world.height;
    if(pointer.screenX!==null){pointer.screenX=pointer.screenX/old.width*g.world.width;pointer.screenY=pointer.screenY/old.height*g.world.height;}
  }
  renderer.resize(g.world,rect,g.map);
  updateCamera(0,true);
}
new ResizeObserver(resize).observe(arena);resize();
function clearInput(){
  keys.clear();pointer.down=false;gamePointer=null;firePointer=null;joystick={x:0,y:0,id:null};$('joystick-knob').style.transform='';
}
function updateStateText(){
  $('feed-status').textContent=t({ready:'ready',playing:'playing',paused:'paused',upgrade:'ready',over:'over'}[g.state]);
  $('mission-status').textContent=t({ready:'menuMission',playing:'playingMission',paused:'pausedMission',upgrade:'playingMission',over:'overMission'}[g.state]);
}
function setState(state,panel){
  g.state=state;clearInput();overlay.hidden=!panel;
  panels.forEach(id=>$(id).hidden=id!==panel);
  $('pause').hidden=state!=='playing';$('touch-controls').hidden=state!=='playing';
  $('bottom-hud').hidden=!['playing','ready'].includes(state);
  arena.classList.toggle('playing',state==='playing');
  sound.setActive(state==='playing');
  updateStateText();
  if(state==='ready'||state==='over')sound.setMusicScene('menu');
}
function focusPanel(id){requestAnimationFrame(()=>$(id).focus({preventScroll:true}));}
function announce(tag,title,note='',duration=2.5){
  $('announcement-tag').textContent=tag;$('announcement-title').textContent=title;$('announcement-note').textContent=note;
  g.bannerTime=duration;$('announcement').classList.add('visible');
}
function activateMenuMusic(){if(g.state==='ready'||g.state==='over')void sound.init();}
async function start(){
  if(dialog.open||starting)return;
  starting=true;
  await sound.init();
  g.player=newPlayer();upgrades={};g.enemies=[];g.bullets=[];g.particles=[];g.pickups=[];g.explosions=[];g.warnings=[];g.floaters=[];g.decals=[];g.wreckSmoke=[];
  g.time=0;g.wave=0;g.score=0;g.kills=0;g.combo=0;g.comboTimer=0;g.shake=0;g.waveWait=-1;
  pointer.x=g.player.x;pointer.y=g.player.y-150;pointer.screenX=null;pointer.screenY=null;
  updateCamera(0,true);
  setState('playing');nextWave();updateHud();canvas.focus({preventScroll:true});
  starting=false;
}
function nextWave(){
  g.wave++;g.plan=wavePlan(g.wave,settings.difficulty);g.spawnRemaining=g.plan.count;g.spawnIndex=0;g.spawnTimer=2.4;g.waveWait=-1;
  g.map=mapForWave(g.wave);g.decals=[];renderer.setMap(g.map);
  $('sector-name').textContent=g.map.name;
  $('wave').innerHTML=`${t('wave')} <b>${pad(g.wave,2)}</b>`;
  announce(g.plan.boss?'KOMUTA ARACI TESPİT EDİLDİ':'DÜŞMAN HATTI HAREKETLENDİ',g.plan.boss?'GOLIATH YAKLAŞIYOR':`DALGA ${pad(g.wave,2)}`,`${g.map.name} · ${g.plan.boss?'Roketlerini hazırla.':g.wave===1?'Hareket et. Mesafeni koru.':'Yeni hedefler. Aynı görev.'}`,3.2);
  sound.play(g.plan.boss?'alert':'wave');
  if(g.plan.boss)spawnEnemy('boss');
  sound.setMusicScene(g.plan.boss?'boss':'waves');
}
function spawnEnemy(forced){
  const {width:W,height:H}=g.world,p=g.player;let x,y;
  for(let attempt=0;attempt<8;attempt++){
    const side=Math.floor(Math.random()*4);x=side===0?-45:side===1?W+45:60+Math.random()*(W-120);y=side===2?-45:side===3?H+45:110+Math.random()*(H-170);
    if(Math.hypot(x-p.x,y-p.y)>300)break;
  }
  const type=forced||enemyType(g.wave,g.spawnIndex++);
  const stats=ENEMIES[type],health=(stats.health+stats.healthPerWave*g.wave)*g.plan.health;
  g.enemies.push({x,y,type,health,maxHealth:health,speed:(stats.speed+Math.min(g.wave*stats.speedPerWave,stats.speedWaveCap))*stats.speedMultiplier,points:stats.points,radius:stats.radius,angle:Math.atan2(p.y-y,p.x-x),turret:0,cooldown:stats.initialCooldown+Math.random()*stats.initialRandom,charge:0,hit:0,seed:Math.random()*TAU});
}
function burst(x,y,color,count=10,force=1,smoke=false){
  const limit=settings.effects?650:180,amount=settings.effects?count:Math.ceil(count*.45);
  for(let i=0;i<amount&&g.particles.length<limit;i++){
    const a=Math.random()*TAU,speed=(30+Math.random()*170)*force,life=smoke?1.1+Math.random():.15+Math.random()*.5;
    g.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,maxLife:life,color,size:smoke?6+Math.random()*12:1+Math.random()*2.5,smoke});
  }
}
function explosion(x,y,size=75){
  g.explosions.push({x,y,size,life:.5,maxLife:.5});burst(x,y,'#f9c57f',30,size/65);burst(x,y,'#28342a',10,.45,true);
  g.shake=Math.max(g.shake,size/10);sound.play('explode',x/g.world.width*2-1);
}
function float(text,x,y,color='#e2eda9',big=false){g.floaters.push({text,x,y,life:1.2,color,big});}
function gun(){
  const p=g.player,w=WEAPONS.gun,a=p.angle+(Math.random()-.5)*w.spread,speed=w.speed;
  g.bullets.push({x:p.x+Math.cos(a)*39,y:p.y+Math.sin(a)*39,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:w.life,friendly:true,damage:w.damage+(upgrades.damage||0)*w.damagePerUpgrade,kind:'gun'});
  p.cooldown=w.cooldown*Math.pow(w.cooldownUpgradeFactor,upgrades.fireRate||0);p.muzzle=w.muzzleTime;
  p.heat=Math.min(1,p.heat+w.heatPerShot);
  if(p.heat>=1){p.overheated=true;float('TOP AŞIRI ISINDI',p.x,p.y-55,'#ffb586',true);}
  sound.play('shot',p.x/g.world.width*1.4-.7);
}
const rocketRecharge=()=>WEAPONS.rocket.rechargeTime*Math.pow(WEAPONS.rocket.rechargeUpgradeFactor,upgrades.rockets||0);
function launchRocket(){
  const p=g.player,w=WEAPONS.rocket;if(g.state!=='playing'||!p.rockets||p.rocketCooldown>0)return;
  let target=null,dist=Infinity;
  for(const e of g.enemies){const d=distance(e,g.touch?p:pointer);if(d<dist){target=e;dist=d;}}
  const a=target?Math.atan2(target.y-p.y,target.x-p.x):p.angle;
  g.bullets.push({x:p.x,y:p.y,vx:Math.cos(a)*w.launchSpeed,vy:Math.sin(a)*w.launchSpeed,life:w.life,friendly:true,damage:w.damage+(upgrades.damage||0)*w.damagePerUpgrade,kind:'rocket',target,trail:0});
  p.rockets--;p.rocketCooldown=w.launchCooldown;sound.play('rocket');updateHud();
}
function dash(){
  const p=g.player;if(g.state!=='playing'||p.dashCooldown>0)return;
  const move=movement(),len=Math.hypot(move.x,move.y),a=len>.1?Math.atan2(move.y,move.x):p.angle;
  p.vx=Math.cos(a)*850;p.vy=Math.sin(a)*850;p.dashTime=.22;p.invulnerable=.55;p.dashCooldown=3.5*Math.pow(.87,upgrades.engine||0);
  burst(p.x,p.y,'#b2c382',12,.6);sound.play('dash');
}
function movement(){
  let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joystick.x;
  let y=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+joystick.y;
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}return{x,y};
}
function updateCamera(dt,instant=false){
  const {width:W,height:H}=g.world,camera=g.camera,p=g.player;
  camera.zoom=matchMedia('(prefers-reduced-motion: reduce)').matches?1:1.08;
  const x=clamp(p.x-W/(2*camera.zoom),0,W-W/camera.zoom),y=clamp(p.y-H/(2*camera.zoom),0,H-H/camera.zoom);
  const response=instant?1:1-Math.exp(-3*dt);
  camera.x=clamp(camera.x+(x-camera.x)*response,0,W-W/camera.zoom);
  camera.y=clamp(camera.y+(y-camera.y)*response,0,H-H/camera.zoom);
  if(pointer.screenX!==null){pointer.x=camera.x+pointer.screenX/camera.zoom;pointer.y=camera.y+pointer.screenY/camera.zoom;}
}
function hitEnemy(e,damage){
  if(e.health<=0)return;
  e.health-=damage;e.hit=.12;burst(e.x,e.y,'#ebd99c',4,.5);
  if(e.health<=0){
    g.kills++;g.combo=g.comboTimer>0?g.combo+1:1;g.comboTimer=4;
    const multiplier=Math.min(5,1+Math.floor(g.combo/3)),points=e.points*multiplier;g.score+=points;
    float(`+${points}${multiplier>1?' ×'+multiplier:''}`,e.x,e.y-35,'#e0efa6',multiplier>1);
    const stats=ENEMIES[e.type];
    explosion(e.x,e.y,stats.deathExplosion);
    if(e.type==='kamikaze'&&distance(e,g.player)<stats.explosionRadius+17)damagePlayer(stats.projectileDamage);
    if(!['drone','kamikaze','boss'].includes(e.type))g.wreckSmoke.push({x:e.x,y:e.y,life:8,timer:0});
    if(e.type==='boss')sound.setMusicScene('waves');
    if(e.type!=='drone'&&e.type!=='kamikaze'){g.decals.push({x:e.x,y:e.y,angle:e.angle,size:e.type==='boss'?48:26});if(g.decals.length>55)g.decals.shift();}
    if(g.kills%4===0||e.type==='boss')g.pickups.push({x:clamp(e.x,40,g.world.width-40),y:clamp(e.y,120,g.world.height-60),life:25});
  }else sound.play('hit',e.x/g.world.width*2-1);
}
function damagePlayer(amount){
  const p=g.player;if(p.invulnerable>0||g.state!=='playing')return;
  p.health=Math.max(0,p.health-amount*g.plan.damage);p.invulnerable=.65;g.shake=10;g.combo=0;g.comboTimer=0;
  burst(p.x,p.y,'#f5c78d',14);sound.play('damage');
  $('damage-flash').classList.remove('hit');void $('damage-flash').offsetWidth;$('damage-flash').classList.add('hit');
  if(p.health<=25&&p.health>0)announce('KRİTİK GÖVDE HASARI','İKMAL TOPLA','Yeşil ikmal paketleri gövdeyi onarır.',1.8);
  if(p.health<=0)endGame();updateHud();
}
function detonate(b){
  explosion(b.x,b.y,135);
  for(const e of g.enemies){const d=distance(e,b);if(d<135+e.radius)hitEnemy(e,b.damage*(1-clamp(d/230,0,.65)));}
  g.bullets.forEach(other=>{if(!other.friendly&&distance(other,b)<135)other.life=0;});
}
function fireEnemy(e){
  const a=e.turret,p=g.player,kind=e.type,stats=ENEMIES[kind];
  if(kind==='aa'){
    if(!e.burstRemaining)e.burstRemaining=stats.shotCount;
    const angle=Math.random()*TAU,range=e.burstRemaining===stats.shotCount?0:Math.sqrt(Math.random())*stats.warningSpread;
    g.warnings.push({x:clamp(p.x+Math.cos(angle)*range,0,g.world.width),y:clamp(p.y+Math.sin(angle)*range,0,g.world.height),life:stats.warningDelay,radius:stats.explosionRadius,damage:stats.projectileDamage});
    e.burstRemaining--;
    e.cooldown=e.burstRemaining?stats.burstInterval:stats.fireInterval+Math.random()*stats.fireRandom;
  }else{
    for(let i=0;i<stats.shotCount;i++){
      const angle=a+(i-(stats.shotCount-1)/2)*stats.spread,speed=stats.projectileSpeed+Math.min(g.wave*stats.projectileSpeedPerWave,stats.projectileSpeedCap);
      g.bullets.push({x:e.x+Math.cos(a)*30,y:e.y+Math.sin(a)*30,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:stats.projectileLife,friendly:false,kind:kind==='rocketSemi'?'enemyRocket':'shell',damage:stats.projectileDamage,turn:stats.rocketTurn,acceleration:stats.rocketAcceleration,maxSpeed:stats.rocketMaxSpeed,trail:0});
    }
    const multiplier=kind==='rocketSemi'?stats[`${settings.difficulty}Interval`]:1;
    e.cooldown=(stats.fireInterval-Math.min(g.wave*stats.fireWaveReduction,stats.fireWaveReductionCap)+Math.random()*stats.fireRandom)*multiplier;
  }
  burst(e.x+Math.cos(a)*33,e.y+Math.sin(a)*33,'#f0c185',4,.3);sound.play('enemy');
}
function update(dt){
  const p=g.player,W=g.world.width,H=g.world.height;g.time+=dt;g.shake=Math.max(0,g.shake-dt*35);
  p.cooldown-=dt;p.invulnerable-=dt;p.dashTime-=dt;p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.rocketCooldown-=dt;p.muzzle-=dt;
  const move=movement(),speed=270*Math.pow(1.12,upgrades.engine||0),response=1-Math.exp(-(Math.hypot(move.x,move.y)>.01?10:3)*dt);
  if(p.dashTime<=0){p.vx+=(move.x*speed-p.vx)*response;p.vy+=(move.y*speed-p.vy)*response;}
  p.x=clamp(p.x+p.vx*dt,34,W-34);p.y=clamp(p.y+p.vy*dt,104,H-42);
  if((p.x===34&&p.vx<0)||(p.x===W-34&&p.vx>0))p.vx=0;
  if((p.y===104&&p.vy<0)||(p.y===H-42&&p.vy>0))p.vy=0;
  updateCamera(dt);
  if(g.touch){let nearest=null,near=Infinity;for(const e of g.enemies){if(e.health<=0)continue;const d=distance(p,e);if(d<near){nearest=e;near=d;}}if(nearest)p.angle=turn(p.angle,Math.atan2(nearest.y-p.y,nearest.x-p.x),dt*14);else if(Math.hypot(move.x,move.y)>.2)p.angle=turn(p.angle,Math.atan2(move.y,move.x),dt*8);}
  else p.angle=turn(p.angle,Math.atan2(pointer.y-p.y,pointer.x-p.x),dt*22);
  const forward=p.vx*Math.cos(p.angle)+p.vy*Math.sin(p.angle);
  const lateral=-p.vx*Math.sin(p.angle)+p.vy*Math.cos(p.angle);
  const tiltResponse=1-Math.exp(-7*dt);
  p.bank+=(clamp(lateral/270,-1,1)*.3-p.bank)*tiltResponse;
  p.pitch+=(clamp(forward/270,-1,1)*.2-p.pitch)*tiltResponse;
  const firing=pointer.down||keys.has('Space');
  if(p.overheated||!firing){p.heat=Math.max(0,p.heat-dt/WEAPONS.gun.coolTime);if(p.overheated&&p.heat===0)p.overheated=false;}
  if(firing&&!p.overheated&&p.cooldown<=0)gun();
  if(p.rockets<p.maxRockets){p.rocketTimer+=dt;const delay=rocketRecharge();if(p.rocketTimer>=delay){p.rockets++;p.rocketTimer=0;}}else p.rocketTimer=0;
  if(g.spawnRemaining>0){g.spawnTimer-=dt;if(g.spawnTimer<=0){spawnEnemy();g.spawnRemaining--;g.spawnTimer=g.plan.interval;}}
  for(const e of g.enemies){
    if(e.health<=0)continue;e.hit=Math.max(0,e.hit-dt);
    const stats=ENEMIES[e.type],a=Math.atan2(p.y-e.y,p.x-e.x),d=distance(e,p),stop=stats.stopDistance;
    let vx=0,vy=0;
    if(d>stop){vx=Math.cos(a)*e.speed;vy=Math.sin(a)*e.speed;}
    if(stats.strafeSpeed){vx+=Math.cos(a+Math.PI/2)*Math.sin(g.time*1.3+e.seed)*stats.strafeSpeed;vy+=Math.sin(a+Math.PI/2)*Math.sin(g.time*1.3+e.seed)*stats.strafeSpeed;}
    // Gentle separation keeps armor from stacking into one unreadable target.
    for(const other of g.enemies){if(e===other||other.health<=0)continue;const dist=distance(e,other),min=e.radius+other.radius+9;if(dist>0&&dist<min){vx+=(e.x-other.x)/dist*(min-dist)*1.5;vy+=(e.y-other.y)/dist*(min-dist)*1.5;}}
    e.x+=vx*dt;e.y+=vy*dt;if(Math.hypot(vx,vy)>3)e.angle=turn(e.angle,Math.atan2(vy,vx),dt*stats.turnRate);
    if(e.type!=='drone'&&e.type!=='kamikaze'){
      const direction=vx*Math.cos(e.angle)+vy*Math.sin(e.angle)<0?-1:1;
      e.trackPhase=((e.trackPhase||0)-direction*Math.hypot(vx,vy)*dt/(e.type==='boss'?1.8:1))%6;
    }
    e.turret=turn(e.turret,a,dt*stats.turretRate);e.cooldown-=dt;e.charge=clamp(1-e.cooldown/.7,0,1);
    if(e.type!=='kamikaze'&&e.cooldown<=0&&e.x>0&&e.x<W&&e.y>60&&e.y<H)fireEnemy(e);
    if(distance(e,p)<e.radius+22){if(e.type==='kamikaze')hitEnemy(e,e.health);else damagePlayer(stats.contactDamage);}
    if(g.state!=='playing')return;
  }
  for(const b of g.bullets){
    if(b.life<=0)continue;
    const ox=b.x,oy=b.y;
    if(b.kind==='rocket'){
      if(b.target?.health<=0)b.target=g.enemies.find(e=>e.health>0)||null;
      const speed=Math.min(WEAPONS.rocket.maxSpeed,Math.hypot(b.vx,b.vy)+WEAPONS.rocket.acceleration*dt);
      const a=b.target?turn(Math.atan2(b.vy,b.vx),Math.atan2(b.target.y-b.y,b.target.x-b.x),dt*WEAPONS.rocket.turnRate):Math.atan2(b.vy,b.vx);
      b.vx=Math.cos(a)*speed;b.vy=Math.sin(a)*speed;
      b.trail-=dt;if(b.trail<=0){burst(b.x,b.y,'#c1b89b',1,.12,true);b.trail=.035;}
    }else if(b.kind==='enemyRocket'){
      const speed=Math.min(b.maxSpeed,Math.hypot(b.vx,b.vy)+b.acceleration*dt);
      const a=turn(Math.atan2(b.vy,b.vx),Math.atan2(p.y-b.y,p.x-b.x),dt*b.turn);
      b.vx=Math.cos(a)*speed;b.vy=Math.sin(a)*speed;
      b.trail-=dt;if(b.trail<=0){burst(b.x,b.y,'#c1b89b',1,.12,true);b.trail=.035;}
    }
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.friendly){
      let target=null,nearest=Infinity;
      for(const e of g.enemies)if(e.health>0&&segmentHitsCircle(ox,oy,b.x,b.y,e.x,e.y,e.radius+(b.kind==='rocket'?8:2))){const d=Math.hypot(e.x-ox,e.y-oy);if(d<nearest){target=e;nearest=d;}}
      if(target){b.life=0;if(b.kind==='rocket')detonate(b);else hitEnemy(target,b.damage);}
      else if(b.kind==='rocket'&&b.life<=0)detonate(b);
    }else if(segmentHitsCircle(ox,oy,b.x,b.y,p.x,p.y,17)){b.life=0;damagePlayer(b.damage);if(g.state!=='playing')return;}
    if(b.x < -90 || b.x > W+90 || b.y < -90 || b.y > H+90)b.life=0;
  }
  g.bullets=g.bullets.filter(b=>b.life>0);g.enemies=g.enemies.filter(e=>e.health>0);
  for(const warning of g.warnings){
    warning.life-=dt;
    if(warning.life<=0){explosion(warning.x,warning.y,warning.radius);if(distance(warning,p)<warning.radius+17)damagePlayer(warning.damage);if(g.state!=='playing')return;}
  }
  g.warnings=g.warnings.filter(warning=>warning.life>0);
  g.pickups=g.pickups.filter(item=>{
    item.life-=dt;const d=distance(item,p);
    if(d<90&&p.health<p.maxHealth){item.x+=(p.x-item.x)*dt*4;item.y+=(p.y-item.y)*dt*4;}
    if(d<28&&p.health<p.maxHealth){p.health=Math.min(p.maxHealth,p.health+30);float('+30 ONARIM',p.x,p.y-45);burst(item.x,item.y,'#dbea9b',15);sound.play('pickup');return false;}
    return item.life>0;
  });
  if(!g.spawnRemaining&&!g.enemies.length&&!g.warnings.length){
    if(g.waveWait<0){g.waveWait=1.4;g.bullets=g.bullets.filter(b=>b.friendly);g.score+=g.wave*100;float(`DALGA TAMAMLANDI +${g.wave*100}`,p.x,p.y-65,'#e5f1ac',true);}
    else{g.waveWait-=dt;if(g.waveWait<=0){showUpgrades();return;}}
  }
  g.comboTimer-=dt;if(g.comboTimer<=0)g.combo=0;
  if(g.bannerTime>0){g.bannerTime-=dt;if(g.bannerTime<=0)$('announcement').classList.remove('visible');}
  g.hudTimer-=dt;if(g.hudTimer<=0){updateHud();g.hudTimer=.08;}
}
function updateEffects(dt){
  for(const source of g.wreckSmoke){
    source.life-=dt;source.timer-=dt;
    if(source.life>0&&source.timer<=0&&g.particles.length<(settings.effects?650:180)){
      const life=3.5+Math.random()*1.5;
      g.particles.push({x:source.x+(Math.random()-.5)*12,y:source.y-10,vx:(Math.random()-.5)*12,vy:-28-Math.random()*24,life,maxLife:life,smoke:true,persistent:true,color:'#111812b8',size:8+Math.random()*7});
      source.timer=settings.effects?0.24:0.5;
    }
  }
  g.wreckSmoke=g.wreckSmoke.filter(source=>source.life>0);
  for(const p of g.particles){
    const drag=p.persistent?0.35:p.smoke?1.5:3;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*drag);p.vy*=Math.exp(-dt*drag);p.life-=dt;
  }
  g.particles=g.particles.filter(p=>p.life>0);
  for(const e of g.explosions)e.life-=dt;g.explosions=g.explosions.filter(e=>e.life>0);
  for(const f of g.floaters){f.y-=dt*30;f.life-=dt;}g.floaters=g.floaters.filter(f=>f.life>0);
}
function updateHud(){
  const p=g.player,percent=Math.ceil(p.health/p.maxHealth*100),multiplier=Math.min(5,1+Math.floor(g.combo/3));
  $('health').textContent=percent;$('health-fill').style.width=`${percent}%`;$('health-fill').style.background=percent<=25?'#ee9b6b':'#dbea9b';
  $('hull-status').textContent=percent<=25?'KRİTİK':percent<=60?'HASARLI':'SAĞLAM';$('hull-status').style.color=percent<=25?'#ee9b6b':'';
  $('score').textContent=pad(g.score);$('best').textContent=pad(Math.max(g.best,g.score));
  $('hostiles').textContent=g.state==='ready'?t('scanning'):`${g.enemies.length+g.spawnRemaining} ${t('hostiles')}`;
  $('flight-time').textContent=`${t('flight')} ${clock(g.time)}`;
  $('dash-status').textContent=p.dashCooldown>0?`${p.dashCooldown.toFixed(1)} s` :t('readyLabel');
  $('dash-fill').style.width=`${(1-p.dashCooldown/(3.5*Math.pow(.87,upgrades.engine||0)))*100}%`;
  $('dash-ability').classList.toggle('cooldown',p.dashCooldown>0);
  $('rocket-status').textContent=`${p.rockets} / ${p.maxRockets}`;
  $('rocket-fill').style.width=`${p.rockets===p.maxRockets?100:p.rocketTimer/rocketRecharge()*100}%`;
  $('rocket-ability').classList.toggle('cooldown',p.rockets===0);
  $('heat-status').textContent=p.overheated?t('cooling'):`%${Math.round(p.heat*100)}`;
  $('heat-fill').style.width=`${p.heat*100}%`;
  $('heat-ability').classList.toggle('overheated',p.overheated);
  $('heat-meter').setAttribute('aria-valuenow',String(Math.round(p.heat*100)));
  $('heat-meter').setAttribute('aria-valuetext',p.overheated?'Aşırı ısındı, soğuyor':`%${Math.round(p.heat*100)}`);
  $('touch-dash').disabled=p.dashCooldown>0;$('touch-rocket').disabled=p.rockets===0;
  $('combo').hidden=multiplier<2;$('combo-value').textContent=`×${multiplier}`;
  const boss=g.enemies.find(e=>e.type==='boss');$('boss-hud').hidden=!boss||g.state==='over';
  if(boss)$('boss-fill').style.width=`${clamp(boss.health/boss.maxHealth*100,0,100)}%`;
}
function showUpgrades(){
  g.bullets=[];g.bannerTime=0;$('announcement').classList.remove('visible');
  const available=UPGRADES.filter(u=>(upgrades[u.id]||0)<u.max&&(u.id!=='repair'||g.player.health<g.player.maxHealth*.8));
  choices=available.map(value=>({value,sort:Math.random()})).sort((a,b)=>a.sort-b.sort).slice(0,3).map(item=>item.value);
  if(!choices.length)choices=[UPGRADES.find(u=>u.id==='repair')];
  $('upgrade-note').textContent=`Dalga ${g.wave} tamamlandı. Bir geliştirme seç, uçuşa devam et.`;
  $('upgrade-cards').replaceChildren();
  choices.forEach((u,i)=>{
    const button=document.createElement('button');button.className='upgrade-card';button.type='button';
    button.innerHTML=`<span>${u.icon}</span><kbd>${i+1}</kbd><strong>${u.title}</strong><p>${u.description}</p><small>${u.detail} &nbsp; ↗</small>`;
    button.addEventListener('click',()=>selectUpgrade(u.id));$('upgrade-cards').append(button);
  });
  setState('upgrade','upgrade-panel');sound.play('upgrade');requestAnimationFrame(()=>$('upgrade-cards').firstElementChild?.focus({preventScroll:true}));updateHud();
}
function selectUpgrade(id){
  if(g.state!=='upgrade'||dialog.open||!choices.some(c=>c.id===id))return;
  upgrades[id]=(upgrades[id]||0)+1;const p=g.player;
  if(id==='armor'){p.maxHealth+=25;p.health=Math.min(p.maxHealth,p.health+35);}
  if(id==='repair')p.health=p.maxHealth;
  if(id==='rockets'){p.maxRockets++;p.rockets=p.maxRockets;p.rocketTimer=0;}
  p.invulnerable=1;p.dashCooldown=0;setState('playing');sound.play('ui');nextWave();canvas.focus({preventScroll:true});updateHud();
}
function pause(){if(g.state!=='playing')return;setState('paused','pause-panel');focusPanel('resume');}
async function resume(){if(g.state!=='paused'||dialog.open)return;await sound.init();setState('playing');canvas.focus({preventScroll:true});}
function endGame(){
  const previous=g.best;g.best=Math.max(g.best,g.score);write('blackout.best',g.best);
  explosion(g.player.x,g.player.y,140);g.bannerTime=0;$('announcement').classList.remove('visible');$('boss-hud').hidden=true;
  $('record-label').textContent=g.score>previous?'YENİ REKOR. Bu gökyüzü seni hatırlayacak.':'Her uçuş bir tecrübe. Tekrar havalan.';
  $('result-score').textContent=g.score.toLocaleString('tr-TR');$('result-wave').textContent=pad(g.wave,2);$('result-kills').textContent=g.kills;$('result-time').textContent=clock(g.time);
  setState('over','over-panel');focusPanel('retry');
}
function updateSettingsUI(){
  $('volume').value=settings.volume*100;$('volume-value').textContent=`${Math.round(settings.volume*100)}%`;
  ['music','shake','effects'].forEach(id=>$(id).checked=settings[id]);
  $('sound-toggle').setAttribute('aria-pressed',String(settings.muted));$('sound-toggle').setAttribute('aria-label',settings.muted?'Sesi aç':'Sesi kapat');
  document.querySelectorAll('[data-difficulty]').forEach(button=>{const selected=button.dataset.difficulty===settings.difficulty;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
}
function toggleMute(){settings.muted=!settings.muted;sound.init();sound.configure();saveSettings();updateSettingsUI();}
function openSettings(){settingsPaused=g.state==='playing';if(settingsPaused)pause();dialog.showModal();sound.init();}
function closeSettings(){dialog.close();if(settingsPaused){settingsPaused=false;resume();}}
$('settings-open').addEventListener('click',openSettings);$('settings-close').addEventListener('click',closeSettings);$('settings-done').addEventListener('click',closeSettings);
dialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
$('volume').addEventListener('input',event=>{settings.volume=event.target.value/100;sound.init();sound.configure();saveSettings();updateSettingsUI();});
for(const id of ['music','shake','effects'])$(id).addEventListener('change',()=>{settings[id]=$(id).checked;sound.configure();saveSettings();if(id==='effects')resize();});
$('sound-toggle').addEventListener('click',toggleMute);
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-frame').requestFullscreen();}catch{announce('TARAYICI BİLGİSİ','TAM EKRAN KULLANILAMIYOR','Tarayıcının tam ekran komutunu kullanabilirsin.',3);}
});
$('fullscreen-exit').addEventListener('click',()=>document.exitFullscreen());
if(!document.fullscreenEnabled)$('fullscreen').hidden=true;
$('language').addEventListener('change',event=>{settings.language=event.target.value;saveSettings();applyLanguage();});
document.addEventListener('pointerdown',activateMenuMusic,{once:true});
document.addEventListener('keydown',activateMenuMusic,{once:true});
document.querySelectorAll('[data-difficulty]').forEach(button=>button.addEventListener('click',()=>{settings.difficulty=button.dataset.difficulty;saveSettings();updateSettingsUI();sound.init();sound.play('ui');}));
for(const id of ['start','retry','restart'])$(id).addEventListener('click',start);
$('resume').addEventListener('click',resume);$('pause').addEventListener('click',pause);
window.addEventListener('keydown',event=>{
  if(dialog.open||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
  const code=event.code;
  if(event.target.closest('button')&&code==='Space')return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(code)&&g.state==='playing')event.preventDefault();
  if(event.repeat)return;
  if(code==='Escape'||code==='KeyP'){if(g.state==='playing')pause();else if(g.state==='paused')resume();return;}
  if(code==='KeyM'){toggleMute();return;}
  if(g.state==='upgrade'&&/^Digit[123]$/.test(code)){const choice=choices[Number(code.slice(-1))-1];if(choice)selectUpgrade(choice.id);return;}
  if(g.state!=='playing')return;
  keys.add(code);if(code==='ShiftLeft'||code==='ShiftRight')dash();if(code==='KeyE')launchRocket();
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{clearInput();if(g.state==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(g.state==='playing')pause();}});
function pointerPosition(event){const rect=canvas.getBoundingClientRect();pointer.screenX=(event.clientX-rect.left)/rect.width*g.world.width;pointer.screenY=(event.clientY-rect.top)/rect.height*g.world.height;pointer.x=g.camera.x+pointer.screenX/g.camera.zoom;pointer.y=g.camera.y+pointer.screenY/g.camera.zoom;}
canvas.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;g.touch=false;pointerPosition(event);});
canvas.addEventListener('pointerdown',event=>{
  if(g.state!=='playing')return;
  if(event.pointerType==='touch'){g.touch=true;return;}
  if(event.button===0){pointerPosition(event);pointer.down=true;gamePointer=event.pointerId;canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});sound.init();}
  if(event.button===2){event.preventDefault();launchRocket();}
});
const releaseCanvas=event=>{if(event.pointerId===gamePointer){pointer.down=false;gamePointer=null;}};
canvas.addEventListener('pointerup',releaseCanvas);canvas.addEventListener('pointercancel',releaseCanvas);canvas.addEventListener('lostpointercapture',releaseCanvas);canvas.addEventListener('contextmenu',event=>event.preventDefault());
const stick=$('joystick');
function moveStick(event){const rect=stick.getBoundingClientRect(),dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2,length=Math.hypot(dx,dy),radius=rect.width*.35,factor=Math.min(1,radius/(length||1));joystick.x=dx*factor/radius;joystick.y=dy*factor/radius;$('joystick-knob').style.transform=`translate(${dx*factor}px,${dy*factor}px)`;}
stick.addEventListener('pointerdown',event=>{if(g.state!=='playing'||joystick.id!==null)return;event.preventDefault();g.touch=true;joystick.id=event.pointerId;stick.setPointerCapture(event.pointerId);moveStick(event);});
stick.addEventListener('pointermove',event=>{if(event.pointerId===joystick.id)moveStick(event);});
const releaseStick=event=>{if(event.pointerId===joystick.id){joystick={x:0,y:0,id:null};$('joystick-knob').style.transform='';}};
for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,releaseStick);
$('touch-fire').addEventListener('pointerdown',event=>{if(g.state!=='playing')return;event.preventDefault();g.touch=true;pointer.down=true;firePointer=event.pointerId;$('touch-fire').setPointerCapture(event.pointerId);sound.init();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touch-fire').addEventListener(type,event=>{if(event.pointerId===firePointer){pointer.down=false;firePointer=null;}});
$('touch-dash').addEventListener('pointerdown',event=>{event.preventDefault();g.touch=true;dash();});$('touch-rocket').addEventListener('pointerdown',event=>{event.preventDefault();g.touch=true;launchRocket();});
function frame(time){
  const dt=Math.min((time-(lastTime||time))/1000,.05);lastTime=time;
  if(!document.hidden){
    if(g.state==='playing'){g.visualTime+=dt;update(dt);updateEffects(dt);}
    else if(g.state==='ready'||g.state==='over'){if(!matchMedia('(prefers-reduced-motion:reduce)').matches)g.visualTime+=dt;updateEffects(dt);}
    sound.update(g.state==='playing'?Math.hypot(g.player.vx,g.player.vy)/300:0);
    renderer.draw(g,dt);
  }
  requestAnimationFrame(frame);
}
applyLanguage();requestAnimationFrame(frame);

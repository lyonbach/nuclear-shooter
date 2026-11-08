import { TAU, seededRandom, clamp } from './core.js';

const path = (c, points, fill, stroke) => {
  c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); }
};
function ellipse(c,x,y,rx,ry,color) { c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill(); }

export class Renderer {
  constructor(canvas, settings) { this.canvas=canvas; this.ctx=canvas.getContext('2d',{alpha:false}); this.settings=settings; }
  resize(world, rect, map) {
    this.world=world;
    const dpr=Math.min(window.devicePixelRatio||1,this.settings.effects?2:1.3);
    this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);
    this.scale=this.canvas.width/world.width;
    this.terrain=document.createElement('canvas');this.terrain.width=Math.ceil(world.width);this.terrain.height=Math.ceil(world.height);
    this.setMap(map);
  }
  setMap(map) { this.map=map;this.makeTerrain(); }
  makeTerrain() {
    const c=this.terrain.getContext('2d'),W=this.world.width,H=this.world.height,r=seededRandom(this.map.seed);
    const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,this.map.colors[0]);g.addColorStop(.5,this.map.colors[1]);g.addColorStop(1,this.map.colors[2]);c.fillStyle=g;c.fillRect(0,0,W,H);
    // Grain is baked into the terrain once rather than regenerated each frame.
    for(let i=0;i<W*H/80;i++){c.fillStyle=r()>.5?'#c6bd8a0b':'#17291c0b';c.fillRect(r()*W,r()*H,r()*4+1,r()*2+1);}
    for(let i=0;i<38;i++){
      let x=r()*W,y=r()*H;c.strokeStyle=i%2?'#a4a57b0e':'#263b2915';c.lineWidth=10+r()*45;
      c.beginPath();c.moveTo(x-130,y+80);c.bezierCurveTo(x-90,y-40,x+50,y+80,x+190,y-70);c.stroke();
    }
    // Broad colored landforms distinguish each sector without obscuring combat.
    for(let i=0;i<16;i++){
      const x=r()*W,y=r()*H,rx=35+r()*140,ry=15+r()*65;
      c.globalAlpha=.12;ellipse(c,x,y,rx,ry,this.map.accent);c.globalAlpha=1;
    }
    if(this.map.layout==='valley'){
      c.beginPath();c.moveTo(W*.1,-60);c.bezierCurveTo(W*.3,H*.2,W*.06,H*.54,W*.32,H+60);
      c.strokeStyle='#356b7b';c.lineWidth=105;c.stroke();c.strokeStyle='#75b5b566';c.lineWidth=70;c.stroke();
      c.strokeStyle='#c2dfc655';c.lineWidth=2;c.setLineDash([25,35]);c.stroke();c.setLineDash([]);
    }else if(this.map.layout==='canyon'){
      for(let i=0;i<7;i++){
        const x=W*(.06+i*.15);c.beginPath();c.moveTo(x,-30);c.bezierCurveTo(x+100,H*.25,x-100,H*.6,x+50,H+30);
        c.strokeStyle=i%2?'#563d4b44':'#e5a07844';c.lineWidth=25+i*5;c.stroke();
      }
    }
    // Old supply road, tyre tracks, and dusty shoulders.
    c.beginPath();
    if(this.map.layout==='valley'){c.moveTo(-80,H*.25);c.bezierCurveTo(W*.3,H*.15,W*.45,H*.65,W*.72,H*.5);c.bezierCurveTo(W*.9,H*.4,W*.85,H*.75,W+100,H*.8);}
    else if(this.map.layout==='canyon'){c.moveTo(W*.2,-80);c.bezierCurveTo(W*.6,H*.15,W*.28,H*.42,W*.52,H*.65);c.bezierCurveTo(W*.7,H*.85,W*.83,H*.65,W*.91,H+100);}
    else{c.moveTo(-80,H*.68);c.bezierCurveTo(W*.24,H*.43,W*.43,H*.9,W*.65,H*.61);c.bezierCurveTo(W*.84,H*.36,W*.91,H*.56,W+100,H*.24);}
    c.strokeStyle='#9a96754a';c.lineWidth=105;c.stroke();c.strokeStyle='#343f3288';c.lineWidth=76;c.stroke();
    c.strokeStyle='#b4ac7733';c.lineWidth=2;c.setLineDash([18,24]);c.stroke();c.setLineDash([]);
    // Secondary access road.
    c.beginPath();c.moveTo(W*.72,-30);c.lineTo(W*.72,H*.4);c.lineTo(W*.84,H*.48);c.lineWidth=39;c.strokeStyle='#424c3855';c.stroke();
    // Sparse scrub and rocks, kept low contrast so projectiles read clearly.
    for(let i=0;i<210;i++){
      const x=r()*W,y=r()*H,size=2+r()*11;
      if(r()>.44){ellipse(c,x+3,y+4,size*1.2,size*.65,'#24322630');ellipse(c,x,y,size,size*.63,'#46523a');ellipse(c,x-2,y-2,size*.62,size*.4,'#7e8461');}
      else {for(let j=0;j<3;j++)ellipse(c,x+r()*9,y+r()*9,size*.5,size*.35,'#35463250');}
    }
    // Concrete landing area.
    const landing=this.map.layout==='valley'?[.68,.22]:this.map.layout==='canyon'?[.24,.68]:[.35,.37];
    c.save();c.translate(W*landing[0],H*landing[1]);c.rotate(-.13);c.fillStyle='#1b281c22';c.fillRect(-92,-83,200,186);c.fillStyle='#85867244';c.fillRect(-99,-94,188,176);
    c.strokeStyle='#d2d1a44d';c.lineWidth=2;c.strokeRect(-87,-82,164,152);c.beginPath();c.arc(-5,-6,57,0,TAU);c.stroke();
    c.fillStyle='#d1d0a45c';c.font='bold 63px Arial';c.textAlign='center';c.fillText('H',-5,16);
    c.font='8px monospace';c.fillStyle='#c4c69a77';c.fillText('NIGHTHAWK / 07',-5,63);c.restore();
    if(this.map.layout==='valley'){this.compound(c,W*.78,H*.76,.84);this.compound(c,W*.38,H*.24,.72);}
    else if(this.map.layout==='canyon'){this.compound(c,W*.72,H*.25,.84);this.compound(c,W*.53,H*.82,.72);}
    else{this.compound(c,W*.8,H*.2,.84);this.compound(c,W*.14,H*.8,.72);}
    // Sector grid and survey marks.
    c.strokeStyle='#e4edb009';c.lineWidth=1;
    for(let x=0;x<W;x+=100){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
    for(let y=0;y<H;y+=100){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    c.font='8px monospace';c.fillStyle='#d3d6b533';c.textAlign='left';
    for(let x=90;x<W;x+=260)for(let y=150;y<H-100;y+=250){c.fillText('+',x,y);c.fillText(`${Math.round(x/10)}.${Math.round(y/10)}`,x+10,y+2);}
    c.save();c.translate(W*.69,H*.85);c.rotate(-.2);c.font='bold 45px Arial';c.fillStyle='#d7d8b620';c.fillText(this.map.name,0,0);c.restore();
  }
  compound(c,x,y,s) {
    c.save();c.translate(x,y);c.scale(s,s);c.rotate(.08);
    c.fillStyle='#28352233';c.fillRect(-110,-95,240,200);
    c.strokeStyle='#a6a78b55';c.lineWidth=1;c.strokeRect(-125,-112,263,232);
    for(let i=-120;i<130;i+=17){c.fillStyle='#c3c1a45c';c.fillRect(i,-115,2,6);c.fillRect(i,117,2,6);}
    const building=(bx,by,w,h)=>{
      c.fillStyle='#18241e55';c.fillRect(bx+9,by+12,w,h);
      c.fillStyle='#3d493c';c.fillRect(bx,by,w,h);c.fillStyle='#78816b';c.fillRect(bx+3,by+3,w-6,h-8);
      c.fillStyle='#858e76';c.fillRect(bx+3,by+3,w-6,4);c.fillStyle='#434f42';c.fillRect(bx+8,by+h-8,w-16,5);
      c.strokeStyle='#46533f';c.lineWidth=2;for(let xx=bx+12;xx<bx+w-8;xx+=12){c.beginPath();c.moveTo(xx,by+8);c.lineTo(xx,by+h-13);c.stroke();}
      c.fillStyle='#4b5747';c.fillRect(bx+w*.4,by+8,15,13);c.fillStyle='#a1aa83';c.fillRect(bx+w*.4,by+8,15,3);
    };
    building(-98,-80,104,58);building(27,-78,80,112);building(-98,2,58,78);
    for(let i=0;i<3;i++){c.fillStyle=i===1?'#7c7954':'#596b4e';c.fillRect(-19+i*34,62,28,48);c.strokeStyle='#25382266';for(let j=0;j<5;j++)c.strokeRect(-16+i*34,65+j*8,22,4);}
    for(const [lx,ly] of [[-120,-107],[130,113]]){ellipse(c,lx,ly,7,7,'#d6d8951a');ellipse(c,lx,ly,2,2,'#e2da9b');}
    c.restore();
  }
  helicopter(c,p,t,ghost=false) {
    c.save();c.translate(p.x,p.y);
    if(!ghost){c.save();c.translate(13,19);c.rotate(p.angle);ellipse(c,-3,0,37,16,'#0b170c4d');c.fillStyle='#0b170c33';c.fillRect(-31,-43,3,86);c.restore();}
    c.rotate(p.angle);if(ghost)c.globalAlpha=.3;
    // Tail boom, horizontal stabilizers, pods and skids.
    path(c,[[-14,-6],[-55,-3],[-62,0],[-54,4],[-14,6]],'#728471','#c2cba755');
    path(c,[[-46,-3],[-53,-18],[-57,-18],[-55,0],[-54,17],[-48,17]],'#81947b');
    c.fillStyle='#283d33';c.fillRect(-16,-19,36,4);c.fillRect(-16,15,36,4);c.fillStyle='#475f4c';c.fillRect(-10,-23,22,7);c.fillRect(-10,16,22,7);
    c.fillStyle='#9aa484';c.fillRect(4,-22,19,3);c.fillRect(4,19,19,3);
    path(c,[[-25,-9],[-17,-15],[12,-14],[30,-7],[35,0],[28,9],[11,14],[-18,13],[-26,6]],'#8b9a78','#c1cba460');
    path(c,[[-21,-8],[-11,-11],[4,-10],[4,10],[-13,11],[-21,5]],'#657b61');
    path(c,[[9,-11],[26,-6],[30,-1],[11,-1]],'#263e35','#bbd9b144');
    path(c,[[11,2],[29,2],[25,7],[9,11]],'#2e4c3d','#bbd9b144');
    c.fillStyle='#b5c096';c.fillRect(-8,-10,3,20);c.fillStyle='#3c503f';c.fillRect(-14,-7,5,14);
    c.fillStyle='#a7b590';c.fillRect(26,-2,14,4);c.fillStyle='#e0e5b9';c.fillRect(37,-1,3,2);
    c.save();c.translate(-54,0);c.rotate(t*42);c.fillStyle='#d8dfb6aa';c.fillRect(-1,-12,2,24);c.fillRect(-12,-1,24,2);c.restore();
    c.save();c.translate(-5,0);c.rotate(t*49);
    c.strokeStyle='#e7eed92c';c.lineWidth=2;c.beginPath();c.arc(0,0,45,0,TAU);c.stroke();
    for(let i=0;i<4;i++){c.rotate(Math.PI/2);path(c,[[0,-2],[46,-3],[44,0],[0,2]],'#e2e7cc99');}
    ellipse(c,0,0,5,5,'#374e3e');ellipse(c,-1,-1,2,2,'#c3caa9');c.restore();
    if(Math.sin(t*5)>0)ellipse(c,-51,0,2,2,'#f7a26d');ellipse(c,1,-19,1.5,1.5,'#c1ed95');
    c.restore();
  }
  enemy(c,e,t) {
    c.save();c.translate(e.x,e.y);c.rotate(e.angle);
    const boss=e.type==='boss';if(boss)c.scale(1.8,1.8);
    if(e.type==='drone'){
      ellipse(c,7,12,23,13,'#10231633');
      c.strokeStyle='#545d4a';c.lineWidth=5;c.beginPath();c.moveTo(-13,-13);c.lineTo(13,13);c.moveTo(-13,13);c.lineTo(13,-13);c.stroke();
      for(const x of [-14,14])for(const y of [-14,14]){ellipse(c,x,y,9,9,'#283b2e88');c.save();c.translate(x,y);c.rotate(t*52);c.fillStyle='#c3c8a366';c.fillRect(-10,-1,20,2);c.restore();}
      path(c,[[-10,-7],[7,-8],[15,0],[7,8],[-10,7]],'#a19c76','#d1ba9366');ellipse(c,8,0,3,3,'#e9a173');
    }else{
      c.fillStyle='#14231655';c.fillRect(-22+6,-21+7,47,46);
      c.fillStyle='#27352a';c.fillRect(-23,-22,43,11);c.fillRect(-23,11,43,11);
      c.fillStyle='#606749';for(let x=-21;x<19;x+=6){c.fillRect(x,-21,3,9);c.fillRect(x,12,3,9);}
      path(c,[[-25,-11],[-15,-16],[17,-16],[25,-8],[25,8],[15,16],[-20,16]],boss?'#727356':'#8c8e69','#b4b38a55');
      c.fillStyle='#a3a078';c.fillRect(-16,-12,29,3);c.fillStyle='#535f45';c.fillRect(-20,-7,8,14);
      c.save();c.rotate((e.turret??e.angle)-e.angle);
      path(c,[[-9,-10],[9,-10],[16,-5],[16,5],[8,10],[-9,10],[-13,4],[-13,-4]],'#a49f75','#c5b68966');
      c.fillStyle='#b5ac7b';c.fillRect(5,-3,e.type==='artillery'?37:27,6);c.fillStyle='#4c5940';c.fillRect(e.type==='artillery'?35:27,-4,5,8);
      ellipse(c,-1,-1,5,5,'#5b674a');c.fillStyle='#dc9a6c';c.fillRect(-4,-2,6,2);c.restore();
      c.strokeStyle='#c5b78866';c.lineWidth=1;c.beginPath();c.moveTo(-14,-12);c.lineTo(-18,-32);c.stroke();
    }
    if(e.hit>0){c.globalAlpha=clamp(e.hit*5,0,.65);ellipse(c,0,0,22,17,'#fff6c4');c.globalAlpha=1;}
    if(e.charge>.4){c.strokeStyle=`rgba(243,151,94,${e.charge*.6})`;c.lineWidth=1;c.beginPath();c.arc(0,0,31,0,TAU*e.charge);c.stroke();}
    c.restore();
    if(e.health<e.maxHealth&&e.type!=='boss'){c.fillStyle='#0f1b0eaa';c.fillRect(e.x-17,e.y-35,34,3);c.fillStyle='#e7b181';c.fillRect(e.x-17,e.y-35,34*e.health/e.maxHealth,3);}
  }
  draw(g,dt) {
    const c=this.ctx,W=g.world.width,H=g.world.height,t=g.visualTime,camera=g.camera,zoom=camera.zoom;
    c.setTransform(this.scale,0,0,this.scale,0,0);c.clearRect(0,0,W,H);
    c.setTransform(this.scale*zoom,0,0,this.scale*zoom,-camera.x*this.scale*zoom,-camera.y*this.scale*zoom);
    c.save();if(this.settings.shake&&g.shake>0){c.translate((Math.random()-.5)*g.shake,(Math.random()-.5)*g.shake);}
    c.drawImage(this.terrain,0,0,W,H);
    for(const d of g.decals){c.save();c.translate(d.x,d.y);c.rotate(d.angle);ellipse(c,0,0,d.size,d.size*.66,'#1c211c88');ellipse(c,0,0,d.size*.65,d.size*.42,'#0c150d66');c.fillStyle='#4a4b37';c.fillRect(-11,-6,21,12);c.restore();}
    // A very slow cloud shadow drifts over the map.
    if(this.settings.effects){c.save();c.translate(camera.x*.3,camera.y*.3);const x=(t*12)%(W+600)-300,cloud=c.createRadialGradient(x,H*.35,30,x,H*.35,380);cloud.addColorStop(0,'#14231524');cloud.addColorStop(1,'#14231500');c.fillStyle=cloud;c.fillRect(-W,-H,W*3,H*3);c.restore();}
    for(const p of g.pickups){
      const bob=Math.sin(t*3+p.x)*2;c.strokeStyle='#d7ed9c44';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,23+Math.sin(t*3)*3,0,TAU);c.stroke();
      c.save();c.translate(p.x,p.y+bob);c.rotate(Math.PI/4);c.fillStyle='#1c321d';c.fillRect(-12,-12,24,24);c.strokeStyle='#d4e89a';c.strokeRect(-12,-12,24,24);c.rotate(-Math.PI/4);
      c.fillStyle='#dbea9b';c.fillRect(-3,-8,6,16);c.fillRect(-8,-3,16,6);c.restore();
    }
    for(const e of g.enemies)this.enemy(c,e,t);
    if(g.state==='ready'){this.enemy(c,{x:W*.7,y:H*.73,angle:-2.2,type:'tank',health:3,maxHealth:3},t);this.enemy(c,{x:W*.87,y:H*.57,angle:-2.5,type:'tank',health:3,maxHealth:3},t);}
    for(const b of g.bullets){
      if(b.kind==='rocket'){c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));c.fillStyle='#e4dfb2';c.fillRect(-9,-2,15,4);c.fillStyle='#ffcc79';c.fillRect(-19,-2,10,4);c.restore();}
      else {c.strokeStyle=b.friendly?'#f4f1ab':'#ffac77';c.lineWidth=b.friendly?2:3;c.lineCap='round';c.beginPath();const len=b.friendly?20:13,sp=Math.hypot(b.vx,b.vy)||1;c.moveTo(b.x-b.vx/sp*len,b.y-b.vy/sp*len);c.lineTo(b.x,b.y);c.stroke();if(!b.friendly)ellipse(c,b.x,b.y,3,3,'#ffd2a5');}
    }
    if(g.player.health>0){
      if(g.player.dashTime>0){for(let i=1;i<4;i++)this.helicopter(c,{...g.player,x:g.player.x-g.player.vx*.026*i,y:g.player.y-g.player.vy*.026*i},t,true);}
      c.globalAlpha=g.player.invulnerable>0&&Math.floor(t*18)%2===0?.55:1;this.helicopter(c,g.player,t);c.globalAlpha=1;
      if(g.player.invulnerable>0){c.strokeStyle='#dbea9b40';c.lineWidth=1;c.beginPath();c.arc(g.player.x,g.player.y,43,0,TAU);c.stroke();}
      if(g.player.muzzle>0){c.save();c.translate(g.player.x,g.player.y);c.rotate(g.player.angle);path(c,[[36,-5],[59,0],[36,5],[43,0]],'#fff2a8');c.restore();}
    }
    for(const p of g.particles){c.globalAlpha=clamp(p.life/p.maxLife,0,1);if(p.smoke){ellipse(c,p.x,p.y,p.size*(1+(1-p.life/p.maxLife)*2),p.size,p.color);}else{c.strokeStyle=p.color;c.lineWidth=p.size;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.025,p.y-p.vy*.025);c.stroke();}}c.globalAlpha=1;
    for(const e of g.explosions){const progress=1-e.life/e.maxLife;c.globalAlpha=(1-progress)*.75;c.strokeStyle='#ffcf8b';c.lineWidth=3*(1-progress);c.beginPath();c.arc(e.x,e.y,e.size*progress,0,TAU);c.stroke();if(progress<.4){const flash=c.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size*.6);flash.addColorStop(0,'#fff6c9aa');flash.addColorStop(1,'#ffc06b00');c.fillStyle=flash;c.fillRect(e.x-e.size,e.y-e.size,e.size*2,e.size*2);}}c.globalAlpha=1;
    for(const f of g.floaters){c.globalAlpha=clamp(f.life,0,1);c.font=`bold ${f.big?19:12}px monospace`;c.fillStyle=f.color;c.textAlign='center';c.fillText(f.text,f.x,f.y);}c.globalAlpha=1;
    // Enemy arrival indicators give the pilot time to react.
    if(g.state==='playing')for(const e of g.enemies){const left=camera.x,right=left+W/zoom,top=camera.y,bottom=top+H/zoom;if(e.x<left+15||e.x>right-15||e.y<top+15||e.y>bottom-15){const x=clamp(e.x,left+18,right-18),y=clamp(e.y,top+100/zoom,bottom-70/zoom);c.save();c.translate(x,y);c.rotate(Math.atan2(e.y-(top+H/(2*zoom)),e.x-(left+W/(2*zoom))));path(c,[[6,0],[-5,-5],[-5,5]],'#efaa76');c.restore();}}
    c.restore();
    c.setTransform(this.scale,0,0,this.scale,0,0);
    if(g.state==='playing'&&!g.touch){
      const x=(g.pointer.x-camera.x)*zoom,y=(g.pointer.y-camera.y)*zoom;c.save();c.translate(x,y);c.strokeStyle='#f1f6c3bb';c.lineWidth=1;c.beginPath();c.arc(0,0,12,0,TAU);c.moveTo(-21,0);c.lineTo(-7,0);c.moveTo(7,0);c.lineTo(21,0);c.moveTo(0,-21);c.lineTo(0,-7);c.moveTo(0,7);c.lineTo(0,21);c.stroke();ellipse(c,0,0,1.5,1.5,'#f6f7c5');c.restore();
    }
    // Target tracking radar, with a faint scanning line.
    if(g.state==='playing'&&W>1000){const x=95,y=H-100,r=44;c.save();c.translate(x,y);ellipse(c,0,0,r,r,'#111f12aa');c.strokeStyle='#c9df8a38';c.lineWidth=1;for(const rr of [r*.5,r]){c.beginPath();c.arc(0,0,rr,0,TAU);c.stroke();}c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();c.strokeStyle='#dbea9b77';c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(t*1.3)*r,Math.sin(t*1.3)*r);c.stroke();for(const e of g.enemies)ellipse(c,(e.x/W-.5)*r*1.7,(e.y/H-.5)*r*1.7,2,2,'#efae7c');ellipse(c,(g.player.x/W-.5)*r*1.7,(g.player.y/H-.5)*r*1.7,2.5,2.5,'#def2a1');c.restore();}
  }
}

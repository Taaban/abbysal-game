const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d',{alpha:false});
// Polyfill roundRect for older Android Chrome
if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    this.beginPath();this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath();return this;
  };
}
let W,H;

// ── THEMES ────────────────────────────────────────────────────────────────────
const THEMES=[
  {name:'THE SHALLOWS',  scoreAt:0,    bg:'#00020f',ambient:[0,14,38],  orbHue:[140,300],borderColor:'rgba(0,180,255,.07)', titleColor:'#00ffe7',playerHue:185,hunterDangerHue:10, hunterSafeHue:120,bgHue:200},
  {name:'MIDNIGHT ZONE', scoreAt:200,  bg:'#03000e',ambient:[20,0,40],  orbHue:[260,340],borderColor:'rgba(180,0,255,.07)', titleColor:'#c060ff',playerHue:270,hunterDangerHue:310,hunterSafeHue:160,bgHue:280},
  {name:'VOLCANIC RIFT', scoreAt:500,  bg:'#0e0200',ambient:[40,8,0],   orbHue:[0,60],   borderColor:'rgba(255,80,0,.07)',  titleColor:'#ff6020',playerHue:25, hunterDangerHue:355,hunterSafeHue:55, bgHue:30},
  {name:'THE VOID',      scoreAt:1000, bg:'#000008',ambient:[0,0,20],   orbHue:[200,260],borderColor:'rgba(80,80,255,.07)', titleColor:'#8080ff',playerHue:230,hunterDangerHue:270,hunterSafeHue:180,bgHue:240},
  {name:'CRYSTAL ABYSS', scoreAt:2000, bg:'#000e0e',ambient:[0,30,30],  orbHue:[160,200],borderColor:'rgba(0,255,220,.07)', titleColor:'#00ffd0',playerHue:170,hunterDangerHue:340,hunterSafeHue:140,bgHue:180},
];

// ── STATE ─────────────────────────────────────────────────────────────────────
let state='menu'; // menu | playing | paused | dying | dead
let score=0,best=parseInt(localStorage.getItem('ab_best')||'0');
let level=1,xp=0,xpNext=10;
let combo=0,comboTimer=0;
let camX=0,camY=0,camVX=0,camVY=0;
let last=0,loopRunning=false,frameCount=0;
let themeIdx=0,themeTransition=1,prevThemeIdx=0;
let playerHueLerp=185;
let powerupActive=null,powerupTimer=0;
let shakeAmt=0; // screen shake intensity
let energy=0,maxEnergy=100,dashTimer=0;
const WORLD=3200;
const MAX_LEVEL=50;

// Difficulty curve: scales smoothly from level 1 to 50
function diff(){ return Math.min(1,(level-1)/(MAX_LEVEL-1)); } // 0..1
function hunterSpeed(){ return 0.9+diff()*2.8; }         // 0.9..3.7
function trapCount(){ return Math.floor(diff()*6); }      // 0..6 traps at max

const player={
  x:WORLD/2,y:WORLD/2,r:22,displayR:22,
  vx:0,vy:0,hue:185,pulse:0,trail:[],
  alive:true,invincible:0,
  targetX:WORLD/2,targetY:WORLD/2,targetActive:false,
  hp:3,maxHp:3,
};

let orbs=[],hunters=[],traps=[],projectiles=[],powerups=[],particles2=[],floatTexts=[],bgParticles=[];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function rnd(a,b){return Math.random()*(b-a)+a;}
function rndInt(a,b){return Math.floor(rnd(a,b+1));}
function dist2(ax,ay,bx,by){const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}

function initBg(){
  bgParticles=[];
  for(let i=0;i<300;i++)
    bgParticles.push({x:rnd(0,WORLD),y:rnd(0,WORLD),r:rnd(.5,2.2),hue:rnd(160,280),alpha:rnd(.08,.35),pulse:rnd(0,Math.PI*2),ps:rnd(.004,.018)});
}

// ── SPAWN ─────────────────────────────────────────────────────────────────────
// Returns a world position guaranteed to be at least minD from player
function safePos(minD,maxD,margin){
  for(let a=0;a<14;a++){
    const ang=rnd(0,Math.PI*2),d=rnd(minD,maxD);
    const x=clamp(player.x+Math.cos(ang)*d,margin,WORLD-margin);
    const y=clamp(player.y+Math.sin(ang)*d,margin,WORLD-margin);
    if(dist2(x,y,player.x,player.y)>=minD*minD) return {x,y};
  }
  const ang=rnd(0,Math.PI*2);
  return {x:clamp(player.x+Math.cos(ang)*maxD,margin,WORLD-margin),
          y:clamp(player.y+Math.sin(ang)*maxD,margin,WORLD-margin)};
}

function spawnOrb(){
  const th=THEMES[themeIdx];
  const size=rnd(4,16);
  const pos=safePos(150,720,30);
  const isGolden=Math.random()<0.06; // 6% chance of rare golden orb
  const isBig=!isGolden&&Math.random()<0.04; // 4% large orbs
  const finalSize=isGolden?rnd(8,14):isBig?rnd(18,28):size;
  orbs.push({
    x:pos.x,y:pos.y,
    r:finalSize,
    hue:isGolden?50:rnd(th.orbHue[0],th.orbHue[1]),
    pulse:rnd(0,Math.PI*2),ps:rnd(.02,.05),
    vx:rnd(-.4,.4),vy:rnd(-.4,.4),
    value:isGolden?Math.floor(finalSize*4*(1+level*0.03)):isBig?Math.floor(finalSize*2*(1+level*0.03)):Math.max(1,Math.floor(finalSize/3*(1+level*0.03))),
    golden:isGolden,big:isBig,
  });
}

function spawnHunter(forceSmall){
  const th=THEMES[themeIdx];
  const isSmall=forceSmall||Math.random()<.38;
  const baseSize=isSmall?rnd(8,16):(Math.random()<.55?rnd(24,36):rnd(44,60));
  const size=baseSize*(1+diff()*0.3); // Scale enemy size with difficulty (30% max)
  const pos=safePos(280,820,50);
  const hp=size>40?3:size>24?2:1; // large hunters have health
  hunters.push({
    x:pos.x,y:pos.y,
    r:size,
    hue:isSmall?th.hunterSafeHue+rnd(-15,15):th.hunterDangerHue+rnd(-15,15),
    pulse:rnd(0,Math.PI*2),ps:rnd(.01,.025),
    vx:0,vy:0,speed:hunterSpeed()*rnd(.8,1.3),
    aggro:false,wander:rnd(0,Math.PI*2),wanderTimer:0,
    type:'basic',isSmall,
    hp,maxHp:hp,
  });
}

function spawnSpecialEnemy(){
  const pos=safePos(350,900,60);
  const base={x:pos.x,y:pos.y,pulse:rnd(0,Math.PI*2),ps:.015,vx:0,vy:0,aggro:false,wander:rnd(0,Math.PI*2),wanderTimer:0};
  const spd=hunterSpeed();
  const sizeMultiplier=1+diff()*0.3; // Scale special enemy size with difficulty (30% max)
  if(themeIdx===1) hunters.push({...base,r:rnd(28,40)*sizeMultiplier,hue:280,speed:spd*.8,type:'teleporter',teleTimer:rndInt(180,300),isSmall:false,hp:2,maxHp:2});
  else if(themeIdx===2) hunters.push({...base,r:rnd(30,44)*sizeMultiplier,hue:15,speed:spd*1.2,type:'bomber',trail:[],isSmall:false,hp:2,maxHp:2});
  else if(themeIdx===3) hunters.push({...base,r:rnd(36,50)*sizeMultiplier,hue:230,speed:spd*1.5,type:'phantom',isSmall:false,hp:3,maxHp:3});
  else if(themeIdx===4) hunters.push({...base,r:rnd(40,55)*sizeMultiplier,hue:170,speed:spd*.9,type:'splitter',isSmall:false,hp:2,maxHp:2});
}

// ── TRAPS ─────────────────────────────────────────────────────────────────────
function spawnTrap(type){
  const pos=safePos(320,950,80); // traps also keep distance
  const x=pos.x,y=pos.y;
  if(type==='blackhole'){
    traps.push({type,x,y,r:28,pulse:0,ps:.012,
      pullRange:220+diff()*80,  // grows with level
      pullForce:0.18+diff()*.22, // grows with level
      hue:260,shootTimer:0,shotInterval:0,active:true});
  } else if(type==='turret'){
    traps.push({type,x,y,r:18,pulse:0,ps:.02,
      shotInterval:Math.max(60,180-diff()*120), // shoots faster at high level
      shotTimer:rndInt(40,180),
      hue:0,active:true,angle:0});
  } else if(type==='mine'){
    traps.push({type,x,y,r:14,pulse:rnd(0,Math.PI*2),ps:.03,
      triggerR:50,exploded:false,hue:45,active:true});
  } else if(type==='spike_ring'){
    traps.push({type,x,y,r:20,pulse:0,ps:.008,
      spikeR:80+diff()*40,   // outer danger radius
      rotSpeed:.008+diff()*.012,
      hue:180,active:true});
  }
}

function spawnProjectile(tx,ty,fromX,fromY,hue){
  const ang=Math.atan2(ty-fromY,tx-fromX);
  const spd=4+diff()*3;
  projectiles.push({x:fromX,y:fromY,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,r:10,hue,life:180,maxLife:180});
}

function spawnPowerup(){
  const types=['shield','speed','magnet','ghost'];
  const type=types[rndInt(0,types.length-1)];
  const angle=rnd(0,Math.PI*2),d=rnd(200,500);
  powerups.push({
    x:clamp(player.x+Math.cos(angle)*d,40,WORLD-40),
    y:clamp(player.y+Math.sin(angle)*d,40,WORLD-40),
    type,r:12,pulse:rnd(0,Math.PI*2),ps:.04,
    hue:type==='shield'?200:type==='speed'?60:type==='magnet'?300:170,
    label:type==='shield'?'🛡':type==='speed'?'⚡':type==='magnet'?'🧲':'👻',
  });
}

// ── EFFECTS ───────────────────────────────────────────────────────────────────
function shake(amt){shakeAmt=Math.max(shakeAmt,amt);}
function burst(x,y,hue,n,big){
  for(let i=0;i<n;i++){
    const a=rnd(0,Math.PI*2),sp=rnd(big?2:.8,big?7:3);
    particles2.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(big?3:1.5,big?8:4),hue,alpha:1,life:rnd(.35,.75),maxLife:0});
  }
  if(big) shake(n>20?8:4);
}
function floatText(x,y,txt,hue){floatTexts.push({x,y,txt,hue,alpha:1,vy:-1.3,life:1.0});}

// ── INIT ──────────────────────────────────────────────────────────────────────
function initGame(){
  score=0;level=1;xp=0;xpNext=10;combo=0;comboTimer=0;last=0;
  themeIdx=0;prevThemeIdx=0;themeTransition=1;playerHueLerp=185;
  powerupActive=null;powerupTimer=0;frameCount=0;shakeAmt=0;dashCooldown=0;
  energy=0;
  player.x=WORLD/2;player.y=WORLD/2;player.r=22;player.displayR=22;
  player.vx=0;player.vy=0;player.alive=true;player.invincible=90;
  player.hue=185;player.trail=[];player.targetX=WORLD/2;player.targetY=WORLD/2;player.targetActive=false;
  player.hp=3;player.maxHp=3;
  camX=WORLD/2;camY=WORLD/2;camVX=0;camVY=0;
  orbs=[];hunters=[];traps=[];projectiles=[];powerups=[];particles2=[];floatTexts=[];
  for(let i=0;i<36;i++) spawnOrb();
  for(let i=0;i<3;i++) spawnHunter(true);
  for(let i=0;i<3;i++) spawnHunter(false);
  updateHUD();applyThemeCSS();
}

function updateHUD(){
  document.getElementById('scoreEl').textContent=score;
  document.getElementById('bestEl').textContent=best;
  document.getElementById('levelEl').textContent=`${level}/${MAX_LEVEL}`;
  document.getElementById('xpbar').style.width=(xp/xpNext*100)+'%';
  document.getElementById('energyEl').textContent=energy;
  document.getElementById('energybar').style.width=(energy/maxEnergy*100)+'%';
}

function applyThemeCSS(){
  const th=THEMES[themeIdx];
  document.getElementById('xpbar').style.background=`linear-gradient(90deg,${th.titleColor},${th.titleColor}88)`;
  document.getElementById('xpbar').style.boxShadow=`0 0 10px ${th.titleColor}`;
}

function checkTheme(){
  let ni=0;
  for(let i=THEMES.length-1;i>=0;i--){if(score>=THEMES[i].scoreAt){ni=i;break;}}
  if(ni!==themeIdx){
    prevThemeIdx=themeIdx;themeIdx=ni;themeTransition=0;
    const th=THEMES[themeIdx];
    showBanner(th.name,th.titleColor);
    if(themeIdx>0) spawnSpecialEnemy();
    for(const o of orbs) o.hue=rnd(th.orbHue[0],th.orbHue[1]);
    for(const h of hunters){h.hue=h.isSmall?th.hunterSafeHue+rnd(-15,15):th.hunterDangerHue+rnd(-15,15);}
    for(const b of bgParticles){let bh=th.bgHue+rnd(-40,40);b._targetHue=bh;}
    applyThemeCSS();spawnPowerup();
  }
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function showBanner(txt,color){
  const el=document.getElementById('theme-banner');
  el.textContent='— '+txt+' —';el.style.color=color;
  el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2500);
}
function showPowerupBanner(type){
  powerupActive=type;powerupTimer=300;
  const labels={shield:'🛡 SHIELD ACTIVE',speed:'⚡ SPEED BOOST',magnet:'🧲 MAGNET ON',ghost:'👻 GHOST MODE'};
  const el=document.getElementById('powerup-banner');
  el.textContent=labels[type];el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1200);
}
function showCombo(n){
  const el=document.getElementById('combo-pop');
  el.textContent=`×${n} COMBO!`;el.style.left=(W/2-100)+'px';el.style.top=(H*.38)+'px';
  el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),800);
}
function showLevelUp(){
  const el=document.getElementById('level-pop');
  el.textContent=`▲ LEVEL ${level}`;
  el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1300);
}

function doPause(){
  if(state!=='playing') return;
  state='paused';
  const th=THEMES[themeIdx];
  document.getElementById('pauseScore').textContent=score;
  document.getElementById('pauseLevel').textContent=`${level}/${MAX_LEVEL}`;
  document.getElementById('pauseBest').textContent=best;
  document.getElementById('pauseZone').textContent=th.name;
  document.getElementById('pauseZone').style.color=th.titleColor;
  document.getElementById('pauseScreen').classList.remove('hidden');
}
function doResume(){
  state='playing';
  document.getElementById('pauseScreen').classList.add('hidden');
  last=0; // reset timing so first resumed frame isn't huge
}
function doQuit(){
  document.getElementById('pauseScreen').classList.add('hidden');
  state='dead';
  document.getElementById('screenTitle').textContent='ABANDONED';
  document.getElementById('screenSub').textContent='you fled the abyss';
  document.getElementById('screenStats').style.display='flex';
  document.getElementById('finalScore').textContent=score;
  document.getElementById('finalBest').textContent=best;
  document.getElementById('finalLevel').textContent=level;
  document.getElementById('startBtn').textContent='DIVE AGAIN';
  document.getElementById('screen').classList.remove('hidden');
}

function showDead(){
  state='dead';
  document.getElementById('screenTitle').textContent='CONSUMED';
  document.getElementById('screenSub').textContent='you were devoured by the deep';
  document.getElementById('screenStats').style.display='flex';
  document.getElementById('finalScore').textContent=score;
  document.getElementById('finalBest').textContent=best;
  document.getElementById('finalLevel').textContent=level;
  document.getElementById('startBtn').textContent='DIVE AGAIN';
  document.getElementById('screen').classList.remove('hidden');
}

// ── RENDER HELPERS ────────────────────────────────────────────────────────────
function w2s(wx,wy){return{x:wx-camX+W/2,y:wy-camY+H/2};}
function onScr(wx,wy,m){const sx=wx-camX+W/2,sy=wy-camY+H/2;return sx>-m&&sx<W+m&&sy>-m&&sy<H+m;}

function drawGlow(x,y,r,hue,alpha,gm,sat){
  sat=sat??100;
  const g=ctx.createRadialGradient(x,y,0,x,y,r*gm);
  g.addColorStop(0,`hsla(${hue},${sat}%,88%,${alpha})`);
  g.addColorStop(.45,`hsla(${hue},${sat}%,60%,${alpha*.5})`);
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*gm,0,Math.PI*2);ctx.fill();
  ctx.save();
  ctx.shadowColor=`hsl(${hue},${sat}%,65%)`;ctx.shadowBlur=r*2.2;
  ctx.fillStyle=`hsla(${hue+15},${sat}%,93%,${alpha})`;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

const POWERUP_COLORS={shield:'#40c0ff',speed:'#ffee00',magnet:'#ff40ff',ghost:'#40ffcc'};

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
function draw(ts){
  if(!loopRunning) return;
  requestAnimationFrame(draw);
  const dt=last===0?16:Math.min(ts-last,32);
  last=ts;
  if(state!=='playing'&&state!=='dying') return;
  frameCount++;

  // Theme lerps
  themeTransition=Math.min(1,themeTransition+.025);
  const th=THEMES[themeIdx];
  let dh=th.playerHue-playerHueLerp;
  if(dh>180)dh-=360;if(dh<-180)dh+=360;
  playerHueLerp=(playerHueLerp+dh*.04+360)%360;
  if(themeTransition<1) player.hue=playerHueLerp;

  // Camera + screen shake
  camVX+=(player.x-camX)*.065;camVY+=(player.y-camY)*.065;
  camVX*=.78;camVY*=.78;camX+=camVX;camY+=camVY;
  shakeAmt*=.82;
  const sx=shakeAmt>0.3?rnd(-shakeAmt,shakeAmt):0;
  const sy=shakeAmt>0.3?rnd(-shakeAmt,shakeAmt):0;
  ctx.save();ctx.translate(sx,sy);
  player.displayR+=(player.r-player.displayR)*.12;

  // ── BACKGROUND ──
  ctx.fillStyle=th.bg;ctx.fillRect(0,0,W,H);
  const[ar,ag,ab]=th.ambient;
  const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.8);
  bg.addColorStop(0,`rgba(${ar},${ag},${ab},.6)`);bg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  if(frameCount%2===0){
    for(const b of bgParticles){
      b.pulse+=b.ps;
      if(b._targetHue!==undefined){let bd=b._targetHue-b.hue;if(bd>180)bd-=360;if(bd<-180)bd+=360;b.hue=(b.hue+bd*.03+360)%360;}
    }
  }
  for(const b of bgParticles){
    if(!onScr(b.x,b.y,10)) continue;
    const a=b.alpha*(.6+.4*Math.sin(b.pulse)); // Increased base visibility
    const s=w2s(b.x,b.y);
    ctx.fillStyle=`hsla(${b.hue},70%,75%,${a})`; // Brighter color and saturation
    ctx.beginPath();ctx.arc(s.x,s.y,b.r,0,Math.PI*2);ctx.fill();
  }

  // Border
  const c0=w2s(0,0);
  ctx.strokeStyle=th.borderColor;ctx.lineWidth=2;
  ctx.strokeRect(c0.x,c0.y,WORLD,WORLD);

  // ── TRAPS ──
  for(let i=traps.length-1;i>=0;i--){
    const t=traps[i];
    if(!t.active){traps.splice(i,1);continue;}
    t.pulse+=t.ps;

    if(t.type==='blackhole'){
      // ── Black Hole ──
      const s=w2s(t.x,t.y);
      if(onScr(t.x,t.y,t.pullRange)){
        // Event horizon rings - make them brighter and more visible
        ctx.save();
        for(let ring=3;ring>=1;ring--){
          const rr=t.r*(ring+.5)*(.9+.05*Math.sin(t.pulse*2+ring));
          const ra=(.15+.08*ring)*(1-.05*ring); // Increased opacity
          ctx.strokeStyle=`hsla(280,100%,70%,${ra})`; // Brighter purple
          ctx.lineWidth=ring===1?3:2; // Thicker lines
          ctx.shadowColor='rgba(200,0,255,1)';ctx.shadowBlur=20; // Stronger glow
          ctx.beginPath();ctx.arc(s.x,s.y,rr,0,Math.PI*2);ctx.stroke();
        }
        // Dark core - make it more visible with brighter edges
        const bhg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,t.r*3); // Larger gradient
        bhg.addColorStop(0,'rgba(20,0,40,0.9)'); // Less black, more purple
        bhg.addColorStop(.3,'rgba(60,0,120,0.8)'); // Purple core
        bhg.addColorStop(.7,'rgba(100,0,200,0.4)'); // Brighter purple ring
        bhg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=bhg;ctx.beginPath();ctx.arc(s.x,s.y,t.r*3,0,Math.PI*2);ctx.fill();
        // Add a bright inner ring
        ctx.strokeStyle='rgba(150,0,255,0.8)';ctx.lineWidth=2;ctx.shadowBlur=15;
        ctx.beginPath();ctx.arc(s.x,s.y,t.r*1.2,0,Math.PI*2);ctx.stroke();
        ctx.restore();
        // Warning ring - make it more visible
        ctx.save();
        ctx.strokeStyle=`hsla(300,100%,60%,${.12+.08*Math.sin(ts*.003)})`; // Brighter and more opaque
        ctx.lineWidth=2;ctx.setLineDash([6,10]); // More visible dash pattern
        ctx.shadowColor='rgba(200,0,255,0.6)';ctx.shadowBlur=10;
        ctx.beginPath();ctx.arc(s.x,s.y,t.pullRange,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);ctx.restore();
      }

      // Logic: pull everything nearby
      if(state==='playing'){
        const pDx=t.x-player.x,pDy=t.y-player.y;
        const pD2=pDx*pDx+pDy*pDy;
        if(pD2<t.pullRange*t.pullRange&&pD2>1){
          const pD=Math.sqrt(pD2);
          if(powerupActive!=='ghost'){
            player.vx+=pDx/pD*t.pullForce;
            player.vy+=pDy/pD*t.pullForce;
          }
          // Sucked in = die
          if(pD<t.r*1.5&&player.invincible<=0){
            if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);}
            else{
              player.hp--;
              player.invincible=60;
              burst(player.x,player.y,player.hue,12,false);
              if(player.hp<=0){
                burst(player.x,player.y,player.hue,32,true);player.alive=false;setTimeout(showDead,700);state='dying';return;
              } else {
                floatText(player.x,player.y-30,'SUCKED!',260);
              }
            }
          }
        }
        // Pull orbs too
        for(const o of orbs){
          const od=Math.sqrt(dist2(o.x,o.y,t.x,t.y));
          if(od<t.pullRange*.7&&od>1){o.vx+=(t.x-o.x)/od*t.pullForce*.5;o.vy+=(t.y-o.y)/od*t.pullForce*.5;}
        }
      }

    } else if(t.type==='turret'){
      // ── Laser Turret ──
      const s=w2s(t.x,t.y);
      t.angle=Math.atan2(player.y-t.y,player.x-t.x);
      const charging=t.shotTimer<30;
      if(onScr(t.x,t.y,80)){
        const pr=t.r*(.9+.14*Math.sin(t.pulse))*1.6;
        ctx.save();
        // Outer danger glow
        const outerGlow=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,pr*3.5);
        outerGlow.addColorStop(0,charging?'rgba(255,80,0,.22)':'rgba(255,40,40,.1)');
        outerGlow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=outerGlow;ctx.beginPath();ctx.arc(s.x,s.y,pr*3.5,0,Math.PI*2);ctx.fill();
        // Body
        ctx.shadowColor=charging?'rgba(255,140,0,1)':'rgba(255,60,60,1)';ctx.shadowBlur=charging?30:20;
        const tg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,pr);
        tg.addColorStop(0,charging?'hsl(30,100%,90%)':'hsl(0,100%,80%)');
        tg.addColorStop(.5,charging?'hsl(20,100%,60%)':'hsl(0,100%,55%)');
        tg.addColorStop(1,charging?'hsl(10,100%,35%)':'hsl(0,100%,28%)');
        ctx.fillStyle=tg;ctx.beginPath();ctx.arc(s.x,s.y,pr,0,Math.PI*2);ctx.fill();
        // Tick marks
        ctx.strokeStyle=charging?'rgba(255,200,0,.9)':'rgba(255,120,120,.7)';ctx.lineWidth=2;
        for(let tk=0;tk<4;tk++){
          const ta=tk/4*Math.PI*2+t.pulse*.3;
          ctx.beginPath();ctx.moveTo(s.x+Math.cos(ta)*(pr*.7),s.y+Math.sin(ta)*(pr*.7));
          ctx.lineTo(s.x+Math.cos(ta)*(pr+4),s.y+Math.sin(ta)*(pr+4));ctx.stroke();
        }
        // Thick barrel
        ctx.strokeStyle=charging?'rgba(255,200,0,1)':'rgba(255,160,100,1)';
        ctx.lineWidth=5;ctx.lineCap='round';
        ctx.shadowColor=charging?'rgba(255,220,0,1)':'rgba(255,80,0,.9)';ctx.shadowBlur=14;
        const bx=s.x+Math.cos(t.angle)*(pr+20),by=s.y+Math.sin(t.angle)*(pr+20);
        ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(bx,by);ctx.stroke();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fill();
        // Always-on aim laser
        const beamAlpha=charging?(.55+(30-t.shotTimer)/30*.35):.12;
        ctx.strokeStyle=`rgba(255,${charging?80:40},0,${beamAlpha})`;
        ctx.lineWidth=charging?3:1;ctx.shadowColor='rgba(255,60,0,.8)';ctx.shadowBlur=charging?18:4;
        ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(s.x+Math.cos(t.angle)*500,s.y+Math.sin(t.angle)*500);ctx.stroke();
        // Charging pulse ring
        if(charging){
          const cf=(30-t.shotTimer)/30;
          ctx.strokeStyle=`rgba(255,140,0,${.4*cf})`;ctx.lineWidth=2;ctx.shadowBlur=10;
          ctx.beginPath();ctx.arc(s.x,s.y,pr*(1.5+cf*.8),0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();
        ctx.save();ctx.font=`bold 9px 'Share Tech Mono'`;ctx.textAlign='center';
        ctx.fillStyle=charging?'rgba(255,220,0,.95)':'rgba(255,120,120,.75)';
        ctx.shadowColor='rgba(255,0,0,.8)';ctx.shadowBlur=6;
        ctx.fillText('⚠ TURRET',s.x,s.y-pr-10);ctx.restore();
      }
      // Ghost: turret doesn't fire
      if(state==='playing'&&powerupActive!=='ghost'){
        t.shotTimer--;
        if(t.shotTimer<=0){
          spawnProjectile(player.x,player.y,t.x,t.y,0);
          t.shotTimer=t.shotInterval;burst(t.x,t.y,0,8,false);
        }
      }
      // Shield destroys turret on proximity
      if(state==='playing'&&powerupActive==='shield'){
        if(dist2(player.x,player.y,t.x,t.y)<(player.displayR+t.r*2+30)**2){
          burst(t.x,t.y,0,20,true);floatText(t.x,t.y-30,'DESTROYED!',0);t.active=false;
        }
      }

    } else if(t.type==='mine'){
      // ── Spike Mine ──
      const s=w2s(t.x,t.y);
      if(onScr(t.x,t.y,t.triggerR)){
        const pr=t.r*(.9+.18*Math.sin(t.pulse));
        // Danger aura - make it more visible
        ctx.save();
        ctx.strokeStyle=`hsla(45,100%,70%,${.12+.08*Math.sin(ts*.004)})`; // Brighter and more opaque
        ctx.lineWidth=2;ctx.setLineDash([4,8]); // Thicker and more visible
        ctx.shadowColor='rgba(255,200,0,0.8)';ctx.shadowBlur=8;
        ctx.beginPath();ctx.arc(s.x,s.y,t.triggerR,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);
        // Body + spikes - make them more prominent
        ctx.shadowColor='rgba(255,220,0,1)';ctx.shadowBlur=18; // Stronger glow
        ctx.fillStyle=`hsl(50,100%,65%)`; // Brighter yellow
        ctx.beginPath();ctx.arc(s.x,s.y,pr,0,Math.PI*2);ctx.fill();
        for(let sp=0;sp<8;sp++){
          const sa=sp/8*Math.PI*2+t.pulse*.5;
          ctx.strokeStyle='rgba(255,240,100,1)';ctx.lineWidth=3; // Thicker, brighter spikes
          ctx.shadowBlur=12;
          ctx.beginPath();ctx.moveTo(s.x+Math.cos(sa)*(pr*.8),s.y+Math.sin(sa)*(pr*.8));
          ctx.lineTo(s.x+Math.cos(sa)*(pr+12),s.y+Math.sin(sa)*(pr+12));ctx.stroke();
        }
        ctx.restore();
      }
      if(state==='playing'){
        const dd=dist2(player.x,player.y,t.x,t.y);
        // Shield destroys mine instantly
        if(powerupActive==='shield'&&dd<(player.displayR+t.triggerR+20)**2){
          burst(t.x,t.y,45,20,true);floatText(t.x,t.y-30,'DESTROYED!',45);t.active=false;
        } else if(dd<t.triggerR*t.triggerR&&player.invincible<=0){
          burst(t.x,t.y,45,20,true);t.active=false;
          if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);}
          else if(powerupActive!=='ghost'){
            player.hp--;
            player.invincible=60;
            burst(player.x,player.y,player.hue,12,false);
            if(player.hp<=0){
              burst(player.x,player.y,player.hue,32,true);player.alive=false;setTimeout(showDead,700);state='dying';return;
            } else {
              floatText(player.x,player.y-30,'BOOM!',45);
            }
          }
        }
      }

    } else if(t.type==='spike_ring'){
      // ── Rotating Spike Ring ──
      const s=w2s(t.x,t.y);
      t.pulse+=t.rotSpeed;
      if(onScr(t.x,t.y,t.spikeR+20)){
        ctx.save();
        // Center orb
        drawGlow(s.x,s.y,t.r,t.hue,1.0,3.0); // Increased alpha and glow size
        // Spokes
        const numSpokes=6;
        for(let sp=0;sp<numSpokes;sp++){
          const sa=sp/numSpokes*Math.PI*2+t.pulse;
          const ex=s.x+Math.cos(sa)*t.spikeR,ey=s.y+Math.sin(sa)*t.spikeR;
          ctx.strokeStyle=`hsla(${t.hue},100%,75%,.7)`;ctx.lineWidth=2.5; // Thicker, brighter, more opaque
          ctx.shadowColor=`hsl(${t.hue},100%,70%)`;ctx.shadowBlur=12; // Stronger glow
          ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(ex,ey);ctx.stroke();
          // Spike tip
          ctx.fillStyle=`hsl(${t.hue+20},100%,90%)`; // Brighter
          ctx.shadowBlur=16;ctx.beginPath();ctx.arc(ex,ey,6,0,Math.PI*2);ctx.fill(); // Larger
        }
        ctx.restore();
      }
      if(state==='playing'){
        // Shield destroys spike ring
        if(powerupActive==='shield'&&dist2(player.x,player.y,t.x,t.y)<(player.displayR+t.spikeR+20)**2){
          burst(t.x,t.y,t.hue,20,true);floatText(t.x,t.y-30,'DESTROYED!',t.hue);t.active=false;
        } else if(powerupActive!=='ghost'){
          const numSpokes=6;
          for(let sp=0;sp<numSpokes;sp++){
            const sa=sp/numSpokes*Math.PI*2+t.pulse;
            const ex=t.x+Math.cos(sa)*t.spikeR,ey=t.y+Math.sin(sa)*t.spikeR;
            if(dist2(player.x,player.y,ex,ey)<(player.displayR+6)**2&&player.invincible<=0){
              if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);break;}
              else{
                player.hp--;
                player.invincible=60;
                burst(player.x,player.y,player.hue,12,false);
                if(player.hp<=0){
                  burst(player.x,player.y,player.hue,32,true);player.alive=false;setTimeout(showDead,700);state='dying';return;
                } else {
                  floatText(player.x,player.y-30,'SPIKED!',180);
                }
              }
            }
          }
        }
      }
    }
  }

  // ── PROJECTILES ──
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.x+=p.vx;p.y+=p.vy;p.life--;
    if(p.life<=0||p.x<-200||p.x>WORLD+200||p.y<-200||p.y>WORLD+200){projectiles.splice(i,1);continue;}
    if(!onScr(p.x,p.y,40)) continue;
    const s=w2s(p.x,p.y);
    const alpha=Math.min(1,p.life/p.maxLife*2); // stay bright most of lifetime
    // Tail: draw trail behind bullet
    const tailLen=5;
    for(let tl=1;tl<=tailLen;tl++){
      const tx=s.x-p.vx*tl*1.2,ty=s.y-p.vy*tl*1.2;
      const ta=alpha*(1-tl/tailLen)*.5;
      ctx.fillStyle=`rgba(255,${60+tl*10},0,${ta})`;
      ctx.beginPath();ctx.arc(tx,ty,p.r*(1-tl/tailLen*.6),0,Math.PI*2);ctx.fill();
    }
    // Bullet body — large, bright, unmissable
    ctx.save();
    ctx.shadowColor='rgba(255,120,0,1)';ctx.shadowBlur=20;
    const pg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,p.r);
    pg.addColorStop(0,`rgba(255,255,200,${alpha})`);
    pg.addColorStop(.4,`rgba(255,140,0,${alpha})`);
    pg.addColorStop(1,`rgba(255,40,0,${alpha*.8})`);
    ctx.fillStyle=pg;ctx.beginPath();ctx.arc(s.x,s.y,p.r,0,Math.PI*2);ctx.fill();
    // Outer glow ring
    ctx.strokeStyle=`rgba(255,80,0,${alpha*.5})`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(s.x,s.y,p.r+4,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    // Collision with player (ghost = no damage)
    if(state==='playing'&&player.invincible<=0&&powerupActive!=='ghost'){
      if(dist2(player.x,player.y,p.x,p.y)<(player.displayR+p.r)**2){
        projectiles.splice(i,1);
        if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);}
        else{
          player.hp--;
          player.invincible=60;
          burst(player.x,player.y,player.hue,12,false);
          if(player.hp<=0){
            burst(player.x,player.y,player.hue,32,true);player.alive=false;setTimeout(showDead,700);state='dying';return;
          } else {
            floatText(player.x,player.y-30,'HIT!',0);
          }
        }
      }
    }
    // Collision with hunters
    if(state==='playing'){
      for(let j=hunters.length-1;j>=0;j--){
        const h=hunters[j];
        if(dist2(h.x,h.y,p.x,p.y)<(h.r+p.r)**2){
          h.hp--;
          if(h.hp<=0){
            burst(h.x,h.y,h.hue,18,true);
            floatText(h.x,h.y-h.r-10,`DESTROYED`,0);
            hunters.splice(j,1);
            spawnHunter();
          } else {
            burst(h.x,h.y,h.hue,8,false);
          }
          projectiles.splice(i,1);
          break;
        }
      }
    }
  }

  // ── ORBS ──
  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];
    o.pulse+=o.ps;o.x+=o.vx;o.y+=o.vy;
    o.x=clamp(o.x,10,WORLD-10);o.y=clamp(o.y,10,WORLD-10);
    if(o.x<=10||o.x>=WORLD-10)o.vx*=-1;
    if(o.y<=10||o.y>=WORLD-10)o.vy*=-1;
    if(state==='playing'){
      const mdx=player.x-o.x,mdy=player.y-o.y,mdd=Math.sqrt(mdx*mdx+mdy*mdy);
      const mR=powerupActive==='magnet'?300:110,mF=powerupActive==='magnet'?.4:.07;
      if(mdd<mR&&mdd>1){o.vx+=mdx/mdd*mF;o.vy+=mdy/mdd*mF;}
    }
    if(!onScr(o.x,o.y,60)) continue;
    const s=w2s(o.x,o.y);
    const pr=o.r*(.85+.2*Math.sin(o.pulse));
    if(o.golden){
      ctx.save();
      ctx.shadowColor='rgba(255,220,0,.9)';ctx.shadowBlur=pr*2.5;
      // Rotating sparkle arms
      ctx.translate(s.x,s.y);ctx.rotate(ts*.003);
      for(let arm=0;arm<6;arm++){
        const aa=arm/6*Math.PI*2;
        ctx.strokeStyle=`hsla(50,100%,75%,${.3+.2*Math.sin(o.pulse+arm)})`;
        ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(aa)*(pr+8),Math.sin(aa)*(pr+8));ctx.stroke();
      }
      ctx.restore();
      drawGlow(s.x,s.y,pr,50,1.1,3.5);
      // Crown symbol
      ctx.save();ctx.font=`bold ${Math.round(pr*.9)}px serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,240,100,.9)';ctx.shadowColor='rgba(255,200,0,1)';ctx.shadowBlur=8;
      ctx.fillText('★',s.x,s.y+1);ctx.textBaseline='alphabetic';ctx.restore();
    } else if(o.big){
      drawGlow(s.x,s.y,pr,o.hue,1.0,4.0);
      ctx.save();ctx.strokeStyle=`hsla(${o.hue},100%,70%,.35)`;ctx.lineWidth=1.5;
      ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(s.x,s.y,pr+8,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    } else {
      drawGlow(s.x,s.y,pr,o.hue,.9,3.2);
    }
  }

  // ── POWERUP ITEMS ──
  for(const p of powerups){
    p.pulse+=p.ps;
    if(!onScr(p.x,p.y,30)) continue;
    const s=w2s(p.x,p.y);
    const pr=p.r*(.9+.15*Math.sin(p.pulse));
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(ts*.002);
    ctx.strokeStyle=POWERUP_COLORS[p.type];ctx.lineWidth=2;
    ctx.shadowColor=POWERUP_COLORS[p.type];ctx.shadowBlur=14;
    ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,pr+7,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
    drawGlow(s.x,s.y,pr,p.hue,1,3);
    ctx.font=`${Math.round(pr*1.1)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(p.label,s.x,s.y+1);ctx.textBaseline='alphabetic';
  }

  // ── HUNTERS ──
  for(let i=hunters.length-1;i>=0;i--){
    const h=hunters[i];
    const edible=player.displayR>h.r*1.0;
    const canEat=h.r>player.displayR*1.05;

    // Hue drift toward theme
    if(themeTransition<1&&!edible){
      const tHue=h.isSmall?th.hunterSafeHue:th.hunterDangerHue;
      let hd=tHue-h.hue;if(hd>180)hd-=360;if(hd<-180)hd+=360;
      h.hue=(h.hue+hd*.04+360)%360;
    }
    h.pulse+=h.ps;
    const dx=player.x-h.x,dy=player.y-h.y,d2=dx*dx+dy*dy;

    // Special type logic
    if(h.type==='teleporter'&&state==='playing'){
      h.teleTimer--;
      if(h.teleTimer<=0){
        const a=rnd(0,Math.PI*2),td=rnd(280,520);
        const np=safePos(280,520,60);
        burst(h.x,h.y,h.hue,8,false);
        h.x=np.x;h.y=np.y;
        h.teleTimer=rndInt(120,250);burst(h.x,h.y,h.hue,10,false);
      }
    }
    if(h.type==='bomber'&&state==='playing'){
      if(!h.trail)h.trail=[];
      if(frameCount%25===0&&h.trail.length<10) h.trail.push({x:h.x,y:h.y,life:180,r:10,hue:15});
    }

    // AI — separation from other hunters
    let sepX=0,sepY=0;
    for(const o of hunters){
      if(o===h) continue;
      const sdx=h.x-o.x,sdy=h.y-o.y,sd2=sdx*sdx+sdy*sdy;
      const minSep=(h.r+o.r)*1.4;
      if(sd2<minSep*minSep&&sd2>0.01){
        const sd=Math.sqrt(sd2);
        sepX+=sdx/sd*(minSep-sd)*.04;
        sepY+=sdy/sd*(minSep-sd)*.04;
      }
    }

    if(edible){
      const dd=Math.sqrt(d2)+.01;
      h.vx+=(-dx/dd)*.07+sepX;h.vy+=(-dy/dd)*.07+sepY;
      const m=Math.sqrt(h.vx*h.vx+h.vy*h.vy);if(m>h.speed*.9){h.vx=h.vx/m*h.speed*.9;h.vy=h.vy/m*h.speed*.9;}
    } else if(canEat){
      if(d2<580*580)h.aggro=true;else if(d2>760*760)h.aggro=false;
      if(h.aggro){const dd=Math.sqrt(d2)+.01;h.vx+=(dx/dd)*.09+sepX;h.vy+=(dy/dd)*.09+sepY;const m=Math.sqrt(h.vx*h.vx+h.vy*h.vy);if(m>h.speed){h.vx=h.vx/m*h.speed;h.vy=h.vy/m*h.speed;}}
      else{h.vx+=sepX;h.vy+=sepY;}
    } else {
      if(d2<400*400)h.aggro=true;else if(d2>600*600)h.aggro=false;
      if(h.aggro){const dd=Math.sqrt(d2)+.01;h.vx+=(dx/dd)*.055+sepX;h.vy+=(dy/dd)*.055+sepY;}
      else{h.wanderTimer--;if(h.wanderTimer<=0){h.wander=rnd(0,Math.PI*2);h.wanderTimer=rndInt(60,200);}h.vx+=Math.cos(h.wander)*.025+sepX*.5;h.vy+=Math.sin(h.wander)*.025+sepY*.5;}
      const m=Math.sqrt(h.vx*h.vx+h.vy*h.vy),ws=h.speed*(h.aggro?.65:.32);
      if(m>ws){h.vx=h.vx/m*ws;h.vy=h.vy/m*ws;}
    }
    h.vx*=.96;h.vy*=.96;
    // Soft boundary push (walls repel hunters too)
    const wall=60;
    if(h.x<wall)h.vx+=.15;if(h.x>WORLD-wall)h.vx-=.15;
    if(h.y<wall)h.vy+=.15;if(h.y>WORLD-wall)h.vy-=.15;
    h.x=clamp(h.x+h.vx,30,WORLD-30);h.y=clamp(h.y+h.vy,30,WORLD-30);

    // Bomber trail draw
    if(h.type==='bomber'&&h.trail){
      for(let t=h.trail.length-1;t>=0;t--){
        const ft=h.trail[t];ft.life--;ft.r*=.996;
        if(ft.life<=0){h.trail.splice(t,1);continue;}
        if(!onScr(ft.x,ft.y,20)) continue;
        const fs=w2s(ft.x,ft.y);
        drawGlow(fs.x,fs.y,ft.r*(.8+.2*Math.sin(ts*.003)),ft.hue,ft.life/180*.6,2.5);
      }
    }

    if(!onScr(h.x,h.y,100)) continue;
    const s=w2s(h.x,h.y);
    const pr=h.r*(.9+.14*Math.sin(h.pulse));
    const dispHue=edible?130:h.hue;
    const phantomAlpha=h.type==='phantom'?(.45+.2*Math.sin(ts*.004)):1;

    // Danger proximity warning ring (pulsing when dangerous hunter is close)
    if(canEat&&d2<300*300&&!edible){
      const proximity=1-Math.sqrt(d2)/300;
      const wa=(.12+.1*Math.sin(ts*.008))*proximity;
      ctx.save();ctx.strokeStyle=`rgba(255,80,80,${wa})`;ctx.lineWidth=2;
      ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(s.x,s.y,pr+18+Math.sin(ts*.005)*4,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    }

    ctx.save();
    const hg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,pr*4.5);
    hg.addColorStop(0,`hsla(${dispHue},100%,50%,${.13*phantomAlpha})`);hg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=hg;ctx.beginPath();ctx.arc(s.x,s.y,pr*4.5,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=phantomAlpha;
    ctx.shadowColor=`hsl(${dispHue},100%,50%)`;ctx.shadowBlur=pr*2;
    if(h.type==='splitter'){ctx.setLineDash([4,3]);ctx.strokeStyle=`hsl(${dispHue},100%,70%)`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,pr+3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    const hc=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,pr);
    hc.addColorStop(0,`hsl(${dispHue+15},100%,82%)`);hc.addColorStop(1,`hsl(${dispHue},100%,38%)`);
    ctx.fillStyle=hc;ctx.beginPath();ctx.arc(s.x,s.y,pr,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    // Eye
    const eyeAng=edible?Math.atan2(player.y-h.y,player.x-h.x)+Math.PI:Math.atan2(player.y-h.y,player.x-h.x);
    if(d2<650*650){
      const ex=s.x+Math.cos(eyeAng)*pr*.34,ey=s.y+Math.sin(eyeAng)*pr*.34;
      ctx.shadowBlur=0;ctx.fillStyle=edible?'#ffe':'#fff';ctx.beginPath();ctx.arc(ex,ey,pr*.23,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';ctx.beginPath();ctx.arc(ex+Math.cos(eyeAng)*pr*.07,ey+Math.sin(eyeAng)*pr*.07,pr*.12,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();

    if(edible&&d2<320*320&&onScr(h.x,h.y,0)){
      ctx.font=`bold ${clamp(Math.round(h.r*.55),10,14)}px 'Share Tech Mono'`;
      ctx.textAlign='center';ctx.fillStyle='rgba(100,255,150,.9)';
      ctx.shadowColor='rgba(0,255,100,.9)';ctx.shadowBlur=8;
      ctx.fillText('EAT',s.x,s.y-pr-(h.maxHp>1?20:6));ctx.shadowBlur=0;
    }
  }

  // ── PLAYER TRAIL ──
  const tLen=player.trail.length;
  for(let i=0;i<tLen;i++){
    const t=player.trail[i];
    const s=w2s(t.x,t.y);
    ctx.fillStyle=`hsla(${player.hue},100%,68%,${(i/tLen)*.32})`;
    ctx.beginPath();ctx.arc(s.x,s.y,player.displayR*(i/tLen)*.65,0,Math.PI*2);ctx.fill();
  }

  // ── PLAYER ──
  if(player.alive||state==='dying'){
    player.pulse+=.045;
    const pr=player.displayR*(.9+.11*Math.sin(player.pulse));
    const ps=w2s(player.x,player.y);
    const flash=player.invincible>0&&Math.floor(player.invincible/5)%2===0;
    if(powerupActive==='shield'){
      ctx.save();ctx.strokeStyle='rgba(64,192,255,.6)';ctx.lineWidth=3;
      ctx.shadowColor='#40c0ff';ctx.shadowBlur=16;
      ctx.beginPath();ctx.arc(ps.x,ps.y,pr+12+Math.sin(ts*.006)*3,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if(powerupActive==='ghost') ctx.globalAlpha=.45;
    if(!flash){
      drawGlow(ps.x,ps.y,pr,player.hue,1,4.2);
      for(let t=0;t<4;t++){
        const ang=player.pulse*1.1+(t*Math.PI/2);
        ctx.save();ctx.translate(ps.x,ps.y);ctx.rotate(ang);
        ctx.beginPath();ctx.moveTo(0,0);
        for(let k=1;k<=6;k++){const f=k/6;ctx.lineTo(Math.sin(f*Math.PI*2+ts*.0018)*pr*.38*f,-pr*1.35*f);}
        ctx.strokeStyle=`hsla(${player.hue},100%,75%,.22)`;ctx.lineWidth=1.2;
        ctx.shadowColor=`hsl(${player.hue},100%,70%)`;ctx.shadowBlur=7;ctx.stroke();ctx.restore();
      }
    }
    ctx.globalAlpha=1;
    if(player.invincible>0) player.invincible--;
  }

  // ── PARTICLES ──
  for(let i=particles2.length-1;i>=0;i--){
    const p=particles2[i];
    if(p.maxLife===0)p.maxLife=p.life;
    p.x+=p.vx;p.y+=p.vy;p.vx*=.93;p.vy*=.93;p.life-=dt/1000;
    if(p.life<=0){particles2.splice(i,1);continue;}
    const s=w2s(p.x,p.y);
    ctx.fillStyle=`hsla(${p.hue},100%,78%,${p.life/p.maxLife})`;
    ctx.beginPath();ctx.arc(s.x,s.y,p.r*(p.life/p.maxLife),0,Math.PI*2);ctx.fill();
  }

  // ── FLOAT TEXTS ──
  for(let i=floatTexts.length-1;i>=0;i--){
    const f=floatTexts[i];f.y+=f.vy;f.life-=dt/1000;
    if(f.life<=0){floatTexts.splice(i,1);continue;}
    const s=w2s(f.x,f.y);
    ctx.font=`bold 14px 'Orbitron',monospace`;ctx.textAlign='center';
    ctx.fillStyle=`hsla(${f.hue},100%,80%,${Math.min(1,f.life*3)})`;
    ctx.shadowColor=`hsl(${f.hue},100%,60%)`;ctx.shadowBlur=10;
    ctx.fillText(f.txt,s.x,s.y);ctx.shadowBlur=0;
  }

  // ── GUIDE LINE ──
  if(player.targetActive&&player.alive){
    const ps=w2s(player.x,player.y);
    const tx=player.targetX-camX+W/2,ty=player.targetY-camY+H/2;
    const ldx=tx-ps.x,ldy=ty-ps.y,ld=Math.sqrt(ldx*ldx+ldy*ldy);
    if(ld>12){
      const gt=Math.min(1,ld/280),gh=120-gt*120,ga=.35+gt*.28;
      ctx.save();ctx.setLineDash([6,9]);ctx.lineDashOffset=-(ts*.04%15);
      ctx.strokeStyle=`hsla(${gh},100%,65%,${ga})`;ctx.lineWidth=1.5;
      ctx.shadowColor=`hsl(${gh},100%,60%)`;ctx.shadowBlur=6;
      ctx.beginPath();ctx.moveTo(ps.x,ps.y);ctx.lineTo(tx,ty);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
      const dotR=4+Math.sin(ts*.006)*1.5;
      ctx.save();ctx.shadowColor=`hsl(${gh},100%,65%)`;ctx.shadowBlur=10;
      ctx.fillStyle=`hsla(${gh},100%,72%,${ga+.2})`;
      ctx.beginPath();ctx.arc(tx,ty,dotR,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=`hsla(${gh},100%,72%,${ga*.5})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(tx,ty,dotR+5,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }

  // ── POWERUP TIMER BAR ──
  if(powerupActive&&powerupTimer>0){
    const bw=120,bh=6,bx=(W-bw)/2,by=H-30;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle=POWERUP_COLORS[powerupActive];ctx.shadowColor=POWERUP_COLORS[powerupActive];ctx.shadowBlur=8;
    ctx.fillRect(bx,by,bw*(powerupTimer/300),bh);ctx.shadowBlur=0;
    ctx.font=`bold 9px 'Share Tech Mono'`;ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.fillText(powerupActive.toUpperCase(),W/2,by-5);
  }

  // ── PLAYER HEALTH BAR ──
  if(player.maxHp>1){
    const bw=120,bh=6,bx=(W-bw)/2,by=H-50;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(bx,by,bw,bh);
    const hpPct=player.hp/player.maxHp;
    ctx.fillStyle=`hsl(${hpPct*120},100%,55%)`;
    ctx.shadowColor=`hsl(${hpPct*120},100%,55%)`;ctx.shadowBlur=8;
    ctx.fillRect(bx,by,bw*hpPct,bh);ctx.shadowBlur=0;
    ctx.font=`bold 9px 'Share Tech Mono'`;ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.fillText('HEALTH',W/2,by-5);
  }

  // Close screen shake transform
  ctx.restore();

  // ── MINIMAP ──
  {
    const mm=90,pad=14,mmX=W-mm-pad,mmY=H-mm-pad;
    const scale=mm/WORLD;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.55)';
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(mmX,mmY,mm,mm,4);ctx.fill();ctx.stroke();
    // Orbs
    for(const o of orbs){
      ctx.fillStyle=`hsla(${o.hue},80%,70%,.4)`;
      ctx.beginPath();ctx.arc(mmX+o.x*scale,mmY+o.y*scale,1.2,0,Math.PI*2);ctx.fill();
    }
    // Hunters
    for(const h of hunters){
      ctx.fillStyle=player.displayR>h.r?'rgba(80,255,120,.7)':'rgba(255,80,80,.7)';
      ctx.beginPath();ctx.arc(mmX+h.x*scale,mmY+h.y*scale,2,0,Math.PI*2);ctx.fill();
    }
    // Traps
    for(const t of traps){
      ctx.fillStyle='rgba(255,200,0,.6)';
      ctx.beginPath();ctx.arc(mmX+t.x*scale,mmY+t.y*scale,2.5,0,Math.PI*2);ctx.fill();
    }
    // Powerups
    for(const p of powerups){
      ctx.fillStyle='rgba(200,200,255,.8)';
      ctx.beginPath();ctx.arc(mmX+p.x*scale,mmY+p.y*scale,2,0,Math.PI*2);ctx.fill();
    }
    // Player dot
    ctx.fillStyle=`hsl(${player.hue},100%,70%)`;
    ctx.shadowColor=`hsl(${player.hue},100%,60%)`;ctx.shadowBlur=4;
    ctx.beginPath();ctx.arc(mmX+player.x*scale,mmY+player.y*scale,3.5,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.restore();
  }

  // ── DASH COOLDOWN INDICATOR ──
  if(dashCooldown>0){
    dashCooldown--;
    const dcR=14,dcX=W/2,dcY=H-60;
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(dcX,dcY,dcR,0,Math.PI*2);ctx.stroke();
    const pct=1-dashCooldown/90;
    ctx.strokeStyle=`hsl(${player.hue},100%,70%)`;
    ctx.shadowColor=`hsl(${player.hue},100%,60%)`;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(dcX,dcY,-Math.PI/2,-Math.PI/2+pct*Math.PI*2,false);ctx.stroke();
    ctx.shadowBlur=0;ctx.restore();
  }

  if(state!=='playing') return;

  // ── GAME LOGIC ──

  // Player movement + dash
  if(dashTimer>0){
    player.vx*=0.98;player.vy*=0.98;
    dashTimer--;
  } else if(player.targetActive){
    const dx=player.targetX-player.x,dy=player.targetY-player.y,d2=dx*dx+dy*dy;
    if(d2>1){
      const d=Math.sqrt(d2);
      const speedBoost=powerupActive==='speed'?1.6:1;
      const maxSpd=Math.max(2.5,(5.8-player.r*.04))*speedBoost;
      const ds=Math.min(maxSpd,d*.18);
      player.vx+=(dx/d*ds-player.vx)*.18;player.vy+=(dy/d*ds-player.vy)*.18;
    }
  } else {player.vx*=.88;player.vy*=.88;}

  player.x=clamp(player.x+player.vx,20,WORLD-20);player.y=clamp(player.y+player.vy,20,WORLD-20);
  // Soft boundary wall push for player
  const pWall=80;
  if(player.x<pWall)player.vx+=.4*(1-(player.x/pWall));
  if(player.x>WORLD-pWall)player.vx-=.4*(1-((WORLD-player.x)/pWall));
  if(player.y<pWall)player.vy+=.4*(1-(player.y/pWall));
  if(player.y>WORLD-pWall)player.vy-=.4*(1-((WORLD-player.y)/pWall));
  player.trail.push({x:player.x,y:player.y});if(player.trail.length>24)player.trail.shift();

  if(powerupActive){powerupTimer--;if(powerupTimer<=0)powerupActive=null;}

  // Eat orbs
  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];
    if(o.r>=player.displayR*.92) continue;
    if(dist2(player.x,player.y,o.x,o.y)<(player.displayR+o.r*.5)**2){
      burst(o.x,o.y,o.hue,7,false);score+=o.value;xp+=o.value;combo++;comboTimer=110;
      if(o.golden){ energy += 20; energy = Math.min(energy, maxEnergy); }
      if(combo>=3)showCombo(combo);
      if(o.value>=2)floatText(o.x,o.y-o.r-8,`+${o.value}`,o.hue);
      player.r=Math.min(75,player.r+o.r*.045);
      while(xp>=xpNext&&level<MAX_LEVEL){
        xp-=xpNext;xpNext=Math.floor(xpNext*1.2);level++;showLevelUp();
        burst(player.x,player.y,player.hue,20,true);
        player.hue=(player.hue+40)%360;playerHueLerp=player.hue;
        spawnHunter();
        // Spawn traps progressively with level
        const tc=trapCount();
        const trapsToSpawn = Math.min(tc - traps.length, 1 + Math.floor(level/10)); // Spawn more traps at higher levels
        for(let t=0; t<trapsToSpawn && traps.length<tc; t++){
          const trapTypes=['blackhole','turret','mine','spike_ring'];
          spawnTrap(trapTypes[rndInt(0,Math.min(3,Math.floor(level/8)))]);
        }
      }
      if(score>best){best=score;localStorage.setItem('ab_best',best);}
      orbs.splice(i,1);checkTheme();updateHUD();
    }
  }
  if(comboTimer>0)comboTimer--;else combo=0;
  while(orbs.length<34+Math.min(level,20)*2) spawnOrb();

  // Collect powerups
  for(let i=powerups.length-1;i>=0;i--){
    const p=powerups[i];
    if(dist2(player.x,player.y,p.x,p.y)<(player.displayR+p.r)**2){
      showPowerupBanner(p.type);burst(p.x,p.y,p.hue,12,true);powerups.splice(i,1);
    }
  }
  if(frameCount%900===0&&powerups.length<2) spawnPowerup();

  // Maintain trap count
  const tc=trapCount();
  if(traps.length<tc&&frameCount%240===0){
    const trapTypes=['blackhole','turret','mine','spike_ring'];
    spawnTrap(trapTypes[rndInt(0,Math.min(3,Math.floor(level/8)))]);
  }

  // Maintain hunter count
  const hc=6+Math.min(level,20); // Start at 6, scale up to 26 at level 20+
  if(hunters.length<hc&&frameCount%300===0){
    spawnHunter(Math.random()<0.4); // 40% chance of small hunter
  }

  // Hunter collisions
  if(player.invincible<=0){
    for(let i=hunters.length-1;i>=0;i--){
      const h=hunters[i];
      const colD=player.displayR+h.r-6;
      if(dist2(player.x,player.y,h.x,h.y)<colD*colD){
        if(player.displayR>h.r*1.0){
          const pts=Math.floor(h.r*3 * (1 + level * 0.03));
          if(h.type==='splitter'){
            const th2=THEMES[themeIdx];
            for(let s=0;s<2;s++) hunters.push({...h,r:h.r*.55,vx:rnd(-1,1),vy:rnd(-1,1),type:'basic',isSmall:true,hue:th2.hunterSafeHue+rnd(-10,10)});
          }
          burst(h.x,h.y,h.hue,18,true);floatText(h.x,h.y-h.r-10,`+${pts}`,50);
          score+=pts;xp+=pts;player.r=Math.min(75,player.r+h.r*.1);
          while(xp>=xpNext&&level<MAX_LEVEL){
            xp-=xpNext;xpNext=Math.floor(xpNext*1.2);level++;showLevelUp();
            burst(player.x,player.y,player.hue,20,true);
            player.hue=(player.hue+40)%360;playerHueLerp=player.hue;spawnHunter();
          }
          if(score>best){best=score;localStorage.setItem('ab_best',best);}
          hunters.splice(i,1);spawnHunter();checkTheme();updateHUD();
        } else if(h.r>player.displayR*1.05){
          if(powerupActive==='ghost') continue;
          if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=60;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);continue;}
          player.hp--;
          player.invincible=60;
          burst(player.x,player.y,player.hue,12,false);
          if(player.hp<=0){
            burst(player.x,player.y,player.hue,32,true);player.alive=false;setTimeout(showDead,700);state='dying';return;
          } else {
            floatText(player.x,player.y-30,'EATEN!',h.hue);
          }
        }
      }
    }
    // Bomber trail
    for(const h of hunters){
      if(h.type==='bomber'&&h.trail){
        for(const ft of h.trail){
          if(dist2(player.x,player.y,ft.x,ft.y)<(player.displayR+ft.r)**2){
            if(powerupActive==='ghost') continue;
            if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=60;break;}
            player.hp--;
            player.invincible=60;
            burst(player.x,player.y,player.hue,12,false);
            if(player.hp<=0){
              burst(player.x,player.y,player.hue,32,true);player.alive=false;setTimeout(showDead,700);state='dying';return;
            } else {
              floatText(player.x,player.y-30,'BOMBER!',15);
            }
          }
        }
      }
    }
  }
}

// ── INPUT ─────────────────────────────────────────────────────────────────────
function getWP(cx,cy){return{x:cx-W/2+camX,y:cy-H/2+camY};}

canvas.addEventListener('touchstart',e=>{
  if(state==='paused'){doResume();return;}
  if(state!=='playing') return;
  const t=e.touches[0],wp=getWP(t.clientX,t.clientY);
  player.targetX=wp.x;player.targetY=wp.y;player.targetActive=true;
  // Double-tap = dash
  const now=performance.now();
  if(now-lastTap<400&&dashCooldown<=0&&energy>=10){
    const dx=wp.x-player.x,dy=wp.y-player.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    player.vx=dx/d*18;player.vy=dy/d*18;
    dashTimer=10;
    dashCooldown=90;player.invincible=Math.max(player.invincible,14);
    energy -= 10;
    updateHUD();
    burst(player.x,player.y,player.hue,10,false);
  }
  lastTap=now;
},{passive:true});
canvas.addEventListener('touchmove',e=>{
  e.preventDefault();if(state!=='playing') return;
  const t=e.touches[0],wp=getWP(t.clientX,t.clientY);
  player.targetX=wp.x;player.targetY=wp.y;
},{passive:false});
canvas.addEventListener('touchend',()=>{player.targetActive=false;});
canvas.addEventListener('touchcancel',()=>{player.targetActive=false;});

let mouseActive=false;
window.addEventListener('mousemove',e=>{
  if(state!=='playing') return;
  const r=canvas.getBoundingClientRect(),wp=getWP(e.clientX-r.left,e.clientY-r.top);
  player.targetX=wp.x;player.targetY=wp.y;
  if(!mouseActive){mouseActive=true;player.targetActive=true;}
});
canvas.addEventListener('mousedown',e=>{
  if(state!=='playing') return;
  const r=canvas.getBoundingClientRect(),wp=getWP(e.clientX-r.left,e.clientY-r.top);
  player.targetX=wp.x;player.targetY=wp.y;player.targetActive=true;mouseActive=true;
  // Double-click = dash
  const now=performance.now();
  if(now-lastTap<400&&dashCooldown<=0&&energy>=10){
    const dx=wp.x-player.x,dy=wp.y-player.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    player.vx=dx/d*18;player.vy=dy/d*18;
    dashTimer=10;
    dashCooldown=90;player.invincible=Math.max(player.invincible,14);
    energy -= 10;
    updateHUD();
    burst(player.x,player.y,player.hue,10,false);
  }
  lastTap=now;
});
window.addEventListener('mouseleave',()=>{mouseActive=false;player.targetActive=false;});

// Pause shortcuts: Escape or P key
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'||e.key.toLowerCase()==='p'){
    if(state==='playing') doPause();
    else if(state==='paused') doResume();
  }
});

document.getElementById('pauseBtn').addEventListener('click',()=>{
  if(state==='playing') doPause();
});
document.getElementById('resumeBtn').addEventListener('click',doResume);
document.getElementById('quitBtn').addEventListener('click',doQuit);

document.getElementById('startBtn').addEventListener('click',()=>{
  document.getElementById('screen').classList.add('hidden');
  document.getElementById('screenStats').style.display='none';
  initGame();state='playing';
  if(!loopRunning){loopRunning=true;last=0;requestAnimationFrame(draw);}
});

window.addEventListener('resize',resize);
resize();initBg();
document.getElementById('bestEl').textContent=best;
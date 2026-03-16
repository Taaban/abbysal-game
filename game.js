// ═══════════════════════════════════════════════════════════════
// LEADERBOARD (Anthropic API + Artifact Storage)
// ═══════════════════════════════════════════════════════════════
const LB_KEY = 'abyssal_leaderboard_v2';
const MAX_LB_ENTRIES = 50;

async function lbGet() {
  try {
    const r = await window.storage.get(LB_KEY, true);
    if (!r) return [];
    return JSON.parse(r.value);
  } catch(e) { return []; }
}

async function lbSubmit(name, score, level, zone) {
  try {
    let entries = await lbGet();
    const existing = entries.findIndex(e => e.name === name.toUpperCase());
    const entry = { name: name.toUpperCase().slice(0,12), score, level, zone, ts: Date.now() };
    if (existing >= 0) {
      if (entries[existing].score < score) entries[existing] = entry;
    } else {
      entries.push(entry);
    }
    entries.sort((a,b) => b.score - a.score);
    entries = entries.slice(0, MAX_LB_ENTRIES);
    await window.storage.set(LB_KEY, JSON.stringify(entries), true);
    return entries;
  } catch(e) { return null; }
}

async function renderLeaderboard(containerId, bodyId, loadingId, statusId, playerName, fullCols) {
  const loading = document.getElementById(loadingId);
  const table = document.getElementById(containerId.replace('-container','-table').replace('-container2','-table2'));
  const body = document.getElementById(bodyId);
  const status = document.getElementById(statusId);
  loading && (loading.style.display = 'block');
  table && table.classList.add('hidden');

  const entries = await lbGet();
  loading && (loading.style.display = 'none');

  if (!entries || entries.length === 0) {
    if (status) status.textContent = 'No scores yet — be the first!';
    if (table) table.classList.remove('hidden');
    if (body) body.innerHTML = '';
    return;
  }

  if (table) table.classList.remove('hidden');
  if (body) {
    const top = fullCols ? entries.slice(0,20) : entries.slice(0,10);
    const pn = playerName ? playerName.toUpperCase() : null;
    body.innerHTML = top.map((e,i) => {
      const isMe = pn && e.name === pn;
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      return `<tr class="${isMe?'lb-highlight':''}">
        <td class="rank">${medal||('#'+(i+1))}</td>
        <td class="lb-name">${e.name}</td>
        <td class="lb-score">${e.score.toLocaleString()}</td>
        <td class="lb-zone">${e.zone||'—'}</td>
        ${fullCols?`<td style="text-align:right;font-size:10px;color:rgba(150,200,255,.5)">Lv${e.level||1}</td>`:''}
      </tr>`;
    }).join('');
  }
  if (status) {
    const rank = playerName ? entries.findIndex(e=>e.name===playerName.toUpperCase())+1 : 0;
    status.textContent = rank > 0 ? `Your rank: #${rank} of ${entries.length}` : `${entries.length} divers ranked`;
  }
}

// ═══════════════════════════════════════════════════════════════
// SOUND ENGINE  (Web Audio API — fully procedural, no files)
// ═══════════════════════════════════════════════════════════════
const SFX = (() => {
  let _actx = null;
  let masterGain = null;
  let muted = false;

  function getCtx() {
    if (!_actx) {
      _actx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = _actx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(_actx.destination);
    }
    if (_actx.state === 'suspended') _actx.resume();
    return _actx;
  }

  function mkGain(val, dest) {
    const g = getCtx().createGain();
    g.gain.value = val;
    g.connect(dest || masterGain);
    return g;
  }
  function mkOsc(type, freq, dest) {
    const o = getCtx().createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest || masterGain);
    return o;
  }
  function mkNoise(dest) {
    const ac = getCtx();
    const buf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(dest || masterGain);
    return src;
  }
  function t() { return getCtx().currentTime; }

  function eatOrb(size) {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('sine', 300 + size * 18, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.frequency.exponentialRampToValueAtTime((300 + size * 18) * 1.4, now + 0.08);
    o.start(now); o.stop(now + 0.15);
  }

  function eatGolden() {
    if (muted) return;
    const now = t();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const g = mkGain(0);
      const o = mkOsc('sine', freq, g);
      g.gain.setValueAtTime(0, now + i * 0.05);
      g.gain.linearRampToValueAtTime(0.14, now + i * 0.05 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.4);
      o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.45);
    });
  }

  function eatEnemy(size) {
    if (muted) return;
    const now = t();
    const g1 = mkGain(0);
    const o1 = mkOsc('sine', 120 + size * 2, g1);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.35, now + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o1.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    o1.start(now); o1.stop(now + 0.2);
    const filt = getCtx().createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 2;
    filt.connect(masterGain);
    const g2 = mkGain(0, filt);
    const n = mkNoise(g2);
    g2.gain.setValueAtTime(0.28, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    n.start(now); n.stop(now + 0.12);
  }

  function playerHit() {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('sawtooth', 80, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o.frequency.linearRampToValueAtTime(40, now + 0.22);
    o.start(now); o.stop(now + 0.25);
    const g2 = mkGain(0);
    const o2 = mkOsc('square', 440, g2);
    g2.gain.setValueAtTime(0.18, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    o2.start(now); o2.stop(now + 0.07);
  }

  function shieldBlock() {
    if (muted) return;
    const now = t();
    [800, 1200, 1800].forEach((f, i) => {
      const g = mkGain(0);
      const o = mkOsc('triangle', f, g);
      g.gain.setValueAtTime(0.14, now + i * 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + i * 0.05);
      o.frequency.linearRampToValueAtTime(f * 0.85, now + 0.3);
      o.start(now + i * 0.01); o.stop(now + 0.35 + i * 0.05);
    });
  }

  function explosion() {
    if (muted) return;
    const now = t();
    const g1 = mkGain(0);
    const o1 = mkOsc('sine', 60, g1);
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.55, now + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    o1.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    o1.start(now); o1.stop(now + 0.55);
    const filt = getCtx().createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1200;
    filt.connect(masterGain);
    const g2 = mkGain(0, filt);
    const n = mkNoise(g2);
    g2.gain.setValueAtTime(0.45, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    n.start(now); n.stop(now + 0.45);
  }

  function pulse() {
    if (muted) return;
    const now = t();
    const filt = getCtx().createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 80; filt.Q.value = 8;
    filt.connect(masterGain);
    const g = mkGain(0, filt);
    const n = mkNoise(g);
    g.gain.setValueAtTime(0.75, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    filt.frequency.exponentialRampToValueAtTime(400, now + 0.5);
    n.start(now); n.stop(now + 0.65);
    const g2 = mkGain(0);
    const o = mkOsc('sawtooth', 200, g2);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.18, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
    o.start(now); o.stop(now + 0.38);
  }

  function dashSound() {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('square', 200, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o.frequency.exponentialRampToValueAtTime(1800, now + 0.12);
    o.start(now); o.stop(now + 0.16);
    const filt2 = getCtx().createBiquadFilter();
    filt2.type = 'highpass'; filt2.frequency.value = 600;
    filt2.connect(masterGain);
    const g2 = mkGain(0, filt2);
    const n = mkNoise(g2);
    g2.gain.setValueAtTime(0.28, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    n.start(now + 0.05); n.stop(now + 0.28);
  }

  function burstAbility() {
    if (muted) return;
    explosion();
    const now = t() + 0.05;
    const g = mkGain(0);
    const o = mkOsc('sine', 55, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    o.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    o.start(now); o.stop(now + 0.85);
  }

  function levelUp() {
    if (muted) return;
    const now = t();
    [261, 329, 392, 523, 659].forEach((f, i) => {
      const g = mkGain(0);
      const o = mkOsc('triangle', f, g);
      g.gain.setValueAtTime(0, now + i * 0.06);
      g.gain.linearRampToValueAtTime(0.16, now + i * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
      o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.28);
    });
  }

  function zoneChange() {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('sine', 55, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    o.frequency.linearRampToValueAtTime(110, now + 1.2);
    o.frequency.linearRampToValueAtTime(82, now + 2.5);
    o.start(now); o.stop(now + 2.6);
    const g2 = mkGain(0);
    const o2 = mkOsc('sine', 220, g2);
    g2.gain.setValueAtTime(0, now + 0.3);
    g2.gain.linearRampToValueAtTime(0.1, now + 0.8);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    o2.start(now + 0.3); o2.stop(now + 2.1);
  }

  function collectPowerup() {
    if (muted) return;
    const now = t();
    [440, 660, 880].forEach((f, i) => {
      const g = mkGain(0);
      const o = mkOsc('sine', f, g);
      g.gain.setValueAtTime(0, now + i * 0.04);
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.04 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.2);
      o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.22);
    });
  }

  function combo() {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('triangle', 400, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    o.start(now); o.stop(now + 0.2);
  }

  function turretFire() {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('sawtooth', 600, g);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.13, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.frequency.exponentialRampToValueAtTime(120, now + 0.1);
    o.start(now); o.stop(now + 0.14);
  }

  function teleport() {
    if (muted) return;
    const now = t();
    const g = mkGain(0);
    const o = mkOsc('square', 800, g);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    o.start(now); o.stop(now + 0.2);
  }

  function death() {
    if (muted) return;
    const now = t();
    [220, 185, 155, 130].forEach((f, i) => {
      const g = mkGain(0);
      const o = mkOsc('sine', f, g);
      g.gain.setValueAtTime(0, now + i * 0.18);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.18 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35);
      o.start(now + i * 0.18); o.stop(now + i * 0.18 + 0.4);
    });
    const g2 = mkGain(0);
    const o2 = mkOsc('sine', 40, g2);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.38, now + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    o2.frequency.exponentialRampToValueAtTime(20, now + 1.2);
    o2.start(now); o2.stop(now + 1.3);
  }

  // Looping deep ocean ambience
  let _ambOscs = [], _ambGain = null;
  function startAmbience() {
    if (muted || _ambOscs.length) return;
    const ac = getCtx();
    _ambGain = ac.createGain();
    _ambGain.gain.value = 0;
    _ambGain.connect(masterGain);
    [28, 42, 71].forEach(f => {
      const o = ac.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(_ambGain); o.start();
      _ambOscs.push(o);
    });
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ac.createGain();
    lfoG.gain.value = 0.018;
    lfo.connect(lfoG); lfoG.connect(_ambGain.gain);
    lfo.start(); _ambOscs.push(lfo);
    _ambGain.gain.linearRampToValueAtTime(0.04, ac.currentTime + 3);
  }
  function stopAmbience() {
    if (_ambGain) {
      _ambGain.gain.linearRampToValueAtTime(0, (_actx?.currentTime || 0) + 1);
      setTimeout(() => { _ambOscs.forEach(o => { try { o.stop(); } catch(e){} }); _ambOscs = []; _ambGain = null; }, 1300);
    }
  }

  function toggleMute() {
    muted = !muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return {
    eatOrb, eatGolden, eatEnemy,
    playerHit, shieldBlock,
    explosion, pulse, dash: dashSound, burstAbility,
    levelUp, zoneChange,
    collectPowerup, combo,
    turretFire, teleport,
    death,
    startAmbience, stopAmbience,
    toggleMute,
    get muted() { return muted; },
    unlock() { getCtx(); }
  };
})();

// ═══════════════════════════════════════════════════════════════
// GAME ENGINE
// ═══════════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', {alpha:false});
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    this.beginPath();this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath();return this;
  };
}
let W,H;

const THEMES=[
  {name:'THE SHALLOWS',  scoreAt:0,    bg:'#00020f',ambient:[0,14,38],  orbHue:[140,300],borderColor:'rgba(0,180,255,.07)', titleColor:'#00ffe7',playerHue:185,hunterDangerHue:10, hunterSafeHue:120,bgHue:200},
  {name:'MIDNIGHT ZONE', scoreAt:200,  bg:'#03000e',ambient:[20,0,40],  orbHue:[260,340],borderColor:'rgba(180,0,255,.07)', titleColor:'#c060ff',playerHue:270,hunterDangerHue:310,hunterSafeHue:160,bgHue:280},
  {name:'VOLCANIC RIFT', scoreAt:500,  bg:'#0e0200',ambient:[40,8,0],   orbHue:[0,60],   borderColor:'rgba(255,80,0,.07)',  titleColor:'#ff6020',playerHue:25, hunterDangerHue:355,hunterSafeHue:55, bgHue:30},
  {name:'THE VOID',      scoreAt:1000, bg:'#000008',ambient:[0,0,20],   orbHue:[200,260],borderColor:'rgba(80,80,255,.07)', titleColor:'#8080ff',playerHue:230,hunterDangerHue:270,hunterSafeHue:180,bgHue:240},
  {name:'CRYSTAL ABYSS', scoreAt:2000, bg:'#000e0e',ambient:[0,30,30],  orbHue:[160,200],borderColor:'rgba(0,255,220,.07)', titleColor:'#00ffd0',playerHue:170,hunterDangerHue:340,hunterSafeHue:140,bgHue:180},
];

// State
let state='menu';
let score=0,best=parseInt(localStorage.getItem('ab_best')||'0');
let level=1,xp=0,xpNext=10;
let combo=0,comboTimer=0;
let camX=0,camY=0,camVX=0,camVY=0;
let last=0,loopRunning=false,frameCount=0;
let themeIdx=0,themeTransition=1,prevThemeIdx=0;
let playerHueLerp=185;
let powerupActive=null,powerupTimer=0;
let shakeAmt=0;
let energy=0,maxEnergy=100;
let lastTap=0;
let killCount=0;
let killStreak=0,killStreakTimer=0;
let damageMult=1;

// Abilities
const ABILITIES={
  pulse:{ cooldown:0, maxCooldown:300, key:'E', label:'E', icon:'◎', desc:'Emit shockwave' },
  dash:{ cooldown:0, maxCooldown:240, key:'Q', label:'Q', icon:'»', desc:'Warp dash' },
};

const WORLD=3200;
const MAX_LEVEL=50;
function diff(){ return Math.min(1,(level-1)/(MAX_LEVEL-1)); }
function hunterSpeed(){ return 0.9+diff()*2.8; }
function trapCount(){ return Math.floor(diff()*6); }

const player={
  x:WORLD/2,y:WORLD/2,r:22,displayR:22,
  vx:0,vy:0,hue:185,pulse:0,trail:[],
  alive:true,invincible:0,
  targetX:WORLD/2,targetY:WORLD/2,targetActive:false,
  hp:3,maxHp:3,
};

let orbs=[],hunters=[],traps=[],projectiles=[],powerups=[],particles2=[],floatTexts=[],bgParticles=[],shockwaveRings=[];

// Helpers
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
  const isGolden=Math.random()<0.06;
  const isBig=!isGolden&&Math.random()<0.04;
  const finalSize=isGolden?rnd(8,14):isBig?rnd(18,28):size;
  orbs.push({
    x:pos.x,y:pos.y,r:finalSize,
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
  const size=baseSize*(1+diff()*0.8);
  const pos=safePos(280,820,50);
  const hp=size>40?3:size>24?2:1;
  hunters.push({
    x:pos.x,y:pos.y,r:size,
    hue:isSmall?th.hunterSafeHue+rnd(-15,15):th.hunterDangerHue+rnd(-15,15),
    pulse:rnd(0,Math.PI*2),ps:rnd(.01,.025),
    vx:0,vy:0,speed:hunterSpeed()*rnd(.8,1.3),
    aggro:false,wander:rnd(0,Math.PI*2),wanderTimer:0,
    type:'basic',isSmall,hp,maxHp:hp,
  });
}

function spawnSpecialEnemy(){
  const pos=safePos(350,900,60);
  const base={x:pos.x,y:pos.y,pulse:rnd(0,Math.PI*2),ps:.015,vx:0,vy:0,aggro:false,wander:rnd(0,Math.PI*2),wanderTimer:0};
  const spd=hunterSpeed();
  const sm=1+diff()*0.8;
  if(themeIdx===1) hunters.push({...base,r:rnd(28,40)*sm,hue:280,speed:spd*.8,type:'teleporter',teleTimer:rndInt(180,300),isSmall:false,hp:2,maxHp:2});
  else if(themeIdx===2) hunters.push({...base,r:rnd(30,44)*sm,hue:15,speed:spd*1.2,type:'bomber',trail:[],isSmall:false,hp:2,maxHp:2});
  else if(themeIdx===3) hunters.push({...base,r:rnd(36,50)*sm,hue:230,speed:spd*1.5,type:'phantom',isSmall:false,hp:3,maxHp:3});
  else if(themeIdx===4) hunters.push({...base,r:rnd(40,55)*sm,hue:170,speed:spd*.9,type:'splitter',isSmall:false,hp:2,maxHp:2});
}

function spawnTrap(type){
  const pos=safePos(320,950,80);
  const x=pos.x,y=pos.y;
  if(type==='blackhole') traps.push({type,x,y,r:28,pulse:0,ps:.012,pullRange:220+diff()*80,pullForce:0.18+diff()*.22,hue:260,active:true});
  else if(type==='turret') traps.push({type,x,y,r:18,pulse:0,ps:.02,shotInterval:Math.max(60,180-diff()*120),shotTimer:rndInt(40,180),hue:0,active:true,angle:0});
  else if(type==='mine') traps.push({type,x,y,r:14,pulse:rnd(0,Math.PI*2),ps:.03,triggerR:50,exploded:false,hue:45,active:true});
  else if(type==='spike_ring') traps.push({type,x,y,r:20,pulse:0,ps:.008,spikeR:80+diff()*40,rotSpeed:.008+diff()*.012,hue:180,active:true});
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

function shake(amt){shakeAmt=Math.max(shakeAmt,amt);}
function burst(x,y,hue,n,big){
  for(let i=0;i<n;i++){
    const a=rnd(0,Math.PI*2),sp=rnd(big?2:.8,big?7:3);
    particles2.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(big?3:1.5,big?8:4),hue,alpha:1,life:rnd(.35,.75),maxLife:0});
  }
  if(big) shake(n>20?8:4);
}
function floatText(x,y,txt,hue){floatTexts.push({x,y,txt,hue,alpha:1,vy:-1.3,life:1.0});}

// Zone progress pips
function buildZonePips(){
  const zpEl=document.getElementById('zone-progress');
  zpEl.innerHTML='';
  for(let i=THEMES.length-1;i>=0;i--){
    const pip=document.createElement('div');
    pip.className='zone-pip'+(i<themeIdx?' done':i===themeIdx?' current':'');
    pip.title=THEMES[i].name;
    zpEl.appendChild(pip);
  }
}

function initGame(){
  score=0;level=1;xp=0;xpNext=10;combo=0;comboTimer=0;last=0;
  themeIdx=0;prevThemeIdx=0;themeTransition=1;playerHueLerp=185;
  powerupActive=null;powerupTimer=0;frameCount=0;shakeAmt=0;
  energy=0;killCount=0;killStreak=0;killStreakTimer=0;damageMult=1;
  ABILITIES.pulse.cooldown=0;ABILITIES.dash.cooldown=0;
  player.x=WORLD/2;player.y=WORLD/2;player.r=22;player.displayR=22;
  player.vx=0;player.vy=0;player.alive=true;player.invincible=90;
  player.hue=185;player.trail=[];player.targetX=WORLD/2;player.targetY=WORLD/2;player.targetActive=false;
  player.hp=3;player.maxHp=3;
  camX=WORLD/2;camY=WORLD/2;camVX=0;camVY=0;
  orbs=[];hunters=[];traps=[];projectiles=[];powerups=[];particles2=[];floatTexts=[];shockwaveRings=[];
  for(let i=0;i<36;i++) spawnOrb();
  for(let i=0;i<3;i++) spawnHunter(true);
  for(let i=0;i<3;i++) spawnHunter(false);
  buildZonePips();
  updateHUD();applyThemeCSS();
}

function updateHUD(){
  document.getElementById('scoreEl').textContent=score.toLocaleString();
  document.getElementById('bestEl').textContent=best.toLocaleString();
  document.getElementById('levelEl').textContent=`${level}/${MAX_LEVEL}`;
  document.getElementById('xpbar').style.width=(xp/xpNext*100)+'%';
  document.getElementById('energyEl').textContent=energy;
  document.getElementById('energybar').style.width=(energy/maxEnergy*100)+'%';
  document.getElementById('killEl').textContent=killCount;
  // Kill streak
  const streakEl=document.getElementById('streak-hud');
  if(killStreak>=3){
    streakEl.style.display='block';
    document.getElementById('streakEl').textContent=`🔥 ${killStreak} STREAK`;
  } else {
    streakEl.style.display='none';
  }
}

function applyThemeCSS(){
  const th=THEMES[themeIdx];
  document.getElementById('xpbar').style.background=`linear-gradient(90deg,${th.titleColor},${th.titleColor}88)`;
  document.getElementById('xpbar').style.boxShadow=`0 0 10px ${th.titleColor}`;
  buildZonePips();
}

function checkTheme(){
  let ni=0;
  for(let i=THEMES.length-1;i>=0;i--){if(score>=THEMES[i].scoreAt){ni=i;break;}}
  if(ni!==themeIdx){
    prevThemeIdx=themeIdx;themeIdx=ni;themeTransition=0;
    const th=THEMES[themeIdx];
    showBanner(th.name,th.titleColor);
    SFX.zoneChange();
    if(themeIdx>0) spawnSpecialEnemy();
    for(const o of orbs) o.hue=rnd(th.orbHue[0],th.orbHue[1]);
    for(const h of hunters){h.hue=h.isSmall?th.hunterSafeHue+rnd(-15,15):th.hunterDangerHue+rnd(-15,15);}
    for(const b of bgParticles){let bh=th.bgHue+rnd(-40,40);b._targetHue=bh;}
    applyThemeCSS();spawnPowerup();
  }
}

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
function announceAbility(txt){
  const el=document.getElementById('ability-announce');
  el.textContent=txt;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1500);
}

// ── ABILITIES ──────────────────────────────────────────────────
function activatePulse(){
  if(ABILITIES.pulse.cooldown>0) return;
  ABILITIES.pulse.cooldown=ABILITIES.pulse.maxCooldown;
  const range=280;
  let hits=0;
  for(const h of hunters){
    const d2=dist2(player.x,player.y,h.x,h.y);
    if(d2<range*range){
      const d=Math.sqrt(d2)||1;
      // Knock back
      h.vx+=(h.x-player.x)/d*16;
      h.vy+=(h.y-player.y)/d*16;
      // Stun: dedicated timer that blocks AI aggro re-evaluation
      h.stunTimer=150; // ~2.5 seconds at 60fps
      h.aggro=false;
      hits++;
    }
  }
  // Expanding ring particles
  for(let i=0;i<40;i++){
    const a=rnd(0,Math.PI*2),sp=rnd(4,14);
    particles2.push({x:player.x,y:player.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rnd(2,5),hue:player.hue,alpha:1,life:rnd(.3,.6),maxLife:0});
  }
  // Store shockwave ring for rendering
  shockwaveRings.push({x:player.x,y:player.y,r:0,maxR:range,life:1,hue:player.hue});
  SFX.pulse();
  shake(7);
  announceAbility(hits>0?`PULSE — ${hits} stunned`:'PULSE');
}

function activateDash(){
  if(ABILITIES.dash.cooldown>0) return;
  ABILITIES.dash.cooldown=ABILITIES.dash.maxCooldown;
  const fromX=player.x,fromY=player.y;
  // Direction: toward cursor target if set, else toward current velocity direction
  let dx,dy;
  if(player.targetActive){
    dx=player.targetX-player.x;
    dy=player.targetY-player.y;
  } else {
    // Fallback: dash in current movement direction or right
    dx=player.vx||1;dy=player.vy||0;
  }
  const d=Math.sqrt(dx*dx+dy*dy)||1;
  const dashDist=200;
  const nx=clamp(player.x+dx/d*dashDist,30,WORLD-30);
  const ny=clamp(player.y+dy/d*dashDist,30,WORLD-30);
  // Leave ghost trail at origin
  for(let i=0;i<5;i++){
    const frac=i/5;
    const tx=fromX+(nx-fromX)*frac,ty=fromY+(ny-fromY)*frac;
    particles2.push({x:tx,y:ty,vx:rnd(-.5,.5),vy:rnd(-.5,.5),r:player.displayR*(1-frac*.6),hue:player.hue,alpha:1,life:.4,maxLife:0});
  }
  player.x=nx;player.y=ny;
  // Momentum in dash direction, not old velocity
  player.vx=dx/d*6;player.vy=dy/d*6;
  burst(player.x,player.y,player.hue,20,false);
  SFX.dash();
  player.invincible=Math.max(player.invincible,40);
  announceAbility('WARP DASH');
}

function doPause(){
  if(state!=='playing') return;
  state='paused';
  const th=THEMES[themeIdx];
  document.getElementById('pauseScore').textContent=score.toLocaleString();
  document.getElementById('pauseLevel').textContent=`${level}/${MAX_LEVEL}`;
  document.getElementById('pauseBest').textContent=best.toLocaleString();
  document.getElementById('pauseKills').textContent=killCount;
  document.getElementById('pauseZone').textContent=th.name;
  document.getElementById('pauseZone').style.color=th.titleColor;
  document.getElementById('pauseScreen').classList.remove('hidden');
}
function doResume(){
  state='playing';
  document.getElementById('pauseScreen').classList.add('hidden');
  last=0;
}
function doQuit(){
  document.getElementById('pauseScreen').classList.add('hidden');
  finishGame('ABANDONED','you fled the abyss');
}

async function finishGame(titleTxt,subTxt){
  SFX.stopAmbience();
  if(score>best){best=score;localStorage.setItem('ab_best',best);}
  const pName=document.getElementById('playerNameInput').value.trim()||'DIVER';
  const th=THEMES[themeIdx];
  // Submit to leaderboard
  await lbSubmit(pName, score, level, th.name);

  state='dead';
  document.getElementById('screenTitle').textContent=titleTxt;
  document.getElementById('screenSub').textContent=subTxt;
  document.getElementById('screenStats').style.display='flex';
  document.getElementById('finalScore').textContent=score.toLocaleString();
  document.getElementById('finalBest').textContent=best.toLocaleString();
  document.getElementById('finalLevel').textContent=level;
  document.getElementById('finalKills').textContent=killCount;
  document.getElementById('finalZone').textContent=th.name;
  document.getElementById('startBtn').textContent='DIVE AGAIN';
  document.getElementById('screen').classList.remove('hidden');
  // Refresh leaderboard on menu
  setTimeout(()=>renderLeaderboard('lb-container','lb-body','lb-loading','lb-status',pName,false),400);
}

function showDead(){
  finishGame('CONSUMED','you were devoured by the deep');
}

// Render helpers
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

// ── MAIN LOOP ──────────────────────────────────────────────────
function draw(ts){
  if(!loopRunning) return;
  requestAnimationFrame(draw);
  const dt=last===0?16:Math.min(ts-last,32);
  last=ts;
  if(state!=='playing'&&state!=='dying') return;
  frameCount++;

  themeTransition=Math.min(1,themeTransition+.025);
  const th=THEMES[themeIdx];
  let dh=th.playerHue-playerHueLerp;
  if(dh>180)dh-=360;if(dh<-180)dh+=360;
  playerHueLerp=(playerHueLerp+dh*.04+360)%360;
  if(themeTransition<1) player.hue=playerHueLerp;

  camVX+=(player.x-camX)*.065;camVY+=(player.y-camY)*.065;
  camVX*=.78;camVY*=.78;camX+=camVX;camY+=camVY;
  shakeAmt*=.82;
  const sx=shakeAmt>0.3?rnd(-shakeAmt,shakeAmt):0;
  const sy=shakeAmt>0.3?rnd(-shakeAmt,shakeAmt):0;
  ctx.save();ctx.translate(sx,sy);
  player.displayR+=(player.r-player.displayR)*.12;

  // Background
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
    const a=b.alpha*(.6+.4*Math.sin(b.pulse));
    const s=w2s(b.x,b.y);
    ctx.fillStyle=`hsla(${b.hue},70%,75%,${a})`;
    ctx.beginPath();ctx.arc(s.x,s.y,b.r,0,Math.PI*2);ctx.fill();
  }

  const c0=w2s(0,0);
  ctx.strokeStyle=th.borderColor;ctx.lineWidth=2;
  ctx.strokeRect(c0.x,c0.y,WORLD,WORLD);

  // ── TRAPS ──
  for(let i=traps.length-1;i>=0;i--){
    const t=traps[i];
    if(!t.active){traps.splice(i,1);continue;}
    t.pulse+=t.ps;

    if(t.type==='blackhole'){
      const s=w2s(t.x,t.y);
      if(onScr(t.x,t.y,t.pullRange)){
        ctx.save();
        for(let ring=3;ring>=1;ring--){
          const rr=t.r*(ring+.5)*(.9+.05*Math.sin(t.pulse*2+ring));
          const ra=(.15+.08*ring)*(1-.05*ring);
          ctx.strokeStyle=`hsla(280,100%,70%,${ra})`;ctx.lineWidth=ring===1?3:2;
          ctx.shadowColor='rgba(200,0,255,1)';ctx.shadowBlur=20;
          ctx.beginPath();ctx.arc(s.x,s.y,rr,0,Math.PI*2);ctx.stroke();
        }
        const bhg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,t.r*3);
        bhg.addColorStop(0,'rgba(20,0,40,0.9)');bhg.addColorStop(.3,'rgba(60,0,120,0.8)');
        bhg.addColorStop(.7,'rgba(100,0,200,0.4)');bhg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=bhg;ctx.beginPath();ctx.arc(s.x,s.y,t.r*3,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(150,0,255,0.8)';ctx.lineWidth=2;ctx.shadowBlur=15;
        ctx.beginPath();ctx.arc(s.x,s.y,t.r*1.2,0,Math.PI*2);ctx.stroke();
        ctx.restore();
        ctx.save();ctx.strokeStyle=`hsla(300,100%,60%,${.12+.08*Math.sin(ts*.003)})`;
        ctx.lineWidth=2;ctx.setLineDash([6,10]);ctx.shadowColor='rgba(200,0,255,0.6)';ctx.shadowBlur=10;
        ctx.beginPath();ctx.arc(s.x,s.y,t.pullRange,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);ctx.restore();
      }
      if(state==='playing'){
        const pDx=t.x-player.x,pDy=t.y-player.y,pD2=pDx*pDx+pDy*pDy;
        if(pD2<t.pullRange*t.pullRange&&pD2>1){
          const pD=Math.sqrt(pD2);
          if(powerupActive!=='ghost'){player.vx+=pDx/pD*t.pullForce;player.vy+=pDy/pD*t.pullForce;}
          if(pD<t.r*1.5&&player.invincible<=0){
            if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);SFX.shieldBlock();}
            else{
              player.hp--;player.invincible=60;burst(player.x,player.y,player.hue,12,false);SFX.playerHit();
              if(player.hp<=0){burst(player.x,player.y,player.hue,32,true);player.alive=false;SFX.death();setTimeout(showDead,700);state='dying';ctx.restore();return;}
              else floatText(player.x,player.y-30,'SUCKED!',260);
            }
          }
        }
        for(const o of orbs){
          const od=Math.sqrt(dist2(o.x,o.y,t.x,t.y));
          if(od<t.pullRange*.7&&od>1){o.vx+=(t.x-o.x)/od*t.pullForce*.5;o.vy+=(t.y-o.y)/od*t.pullForce*.5;}
        }
      }
    } else if(t.type==='turret'){
      const s=w2s(t.x,t.y);
      t.angle=Math.atan2(player.y-t.y,player.x-t.x);
      const charging=t.shotTimer<30;
      if(onScr(t.x,t.y,80)){
        const pr=t.r*(.9+.14*Math.sin(t.pulse))*1.6;
        ctx.save();
        const outerGlow=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,pr*3.5);
        outerGlow.addColorStop(0,charging?'rgba(255,80,0,.22)':'rgba(255,40,40,.1)');outerGlow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=outerGlow;ctx.beginPath();ctx.arc(s.x,s.y,pr*3.5,0,Math.PI*2);ctx.fill();
        ctx.shadowColor=charging?'rgba(255,140,0,1)':'rgba(255,60,60,1)';ctx.shadowBlur=charging?30:20;
        const tg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,pr);
        tg.addColorStop(0,charging?'hsl(30,100%,90%)':'hsl(0,100%,80%)');tg.addColorStop(.5,charging?'hsl(20,100%,60%)':'hsl(0,100%,55%)');tg.addColorStop(1,charging?'hsl(10,100%,35%)':'hsl(0,100%,28%)');
        ctx.fillStyle=tg;ctx.beginPath();ctx.arc(s.x,s.y,pr,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=charging?'rgba(255,200,0,.9)':'rgba(255,120,120,.7)';ctx.lineWidth=2;
        for(let tk=0;tk<4;tk++){const ta=tk/4*Math.PI*2+t.pulse*.3;ctx.beginPath();ctx.moveTo(s.x+Math.cos(ta)*(pr*.7),s.y+Math.sin(ta)*(pr*.7));ctx.lineTo(s.x+Math.cos(ta)*(pr+4),s.y+Math.sin(ta)*(pr+4));ctx.stroke();}
        ctx.strokeStyle=charging?'rgba(255,200,0,1)':'rgba(255,160,100,1)';ctx.lineWidth=5;ctx.lineCap='round';
        ctx.shadowColor=charging?'rgba(255,220,0,1)':'rgba(255,80,0,.9)';ctx.shadowBlur=14;
        const bx=s.x+Math.cos(t.angle)*(pr+20),by=s.y+Math.sin(t.angle)*(pr+20);
        ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(bx,by);ctx.stroke();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fill();
        const beamAlpha=charging?(.55+(30-t.shotTimer)/30*.35):.12;
        ctx.strokeStyle=`rgba(255,${charging?80:40},0,${beamAlpha})`;ctx.lineWidth=charging?3:1;
        ctx.shadowColor='rgba(255,60,0,.8)';ctx.shadowBlur=charging?18:4;
        ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(s.x+Math.cos(t.angle)*500,s.y+Math.sin(t.angle)*500);ctx.stroke();
        if(charging){const cf=(30-t.shotTimer)/30;ctx.strokeStyle=`rgba(255,140,0,${.4*cf})`;ctx.lineWidth=2;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(s.x,s.y,pr*(1.5+cf*.8),0,Math.PI*2);ctx.stroke();}
        ctx.restore();
        ctx.save();ctx.font=`bold 9px 'Share Tech Mono'`;ctx.textAlign='center';
        ctx.fillStyle=charging?'rgba(255,220,0,.95)':'rgba(255,120,120,.75)';ctx.shadowColor='rgba(255,0,0,.8)';ctx.shadowBlur=6;
        ctx.fillText('⚠ TURRET',s.x,s.y-pr-10);ctx.restore();
      }
      if(state==='playing'&&powerupActive!=='ghost'){
        t.shotTimer--;
        if(t.shotTimer<=0){spawnProjectile(player.x,player.y,t.x,t.y,0);t.shotTimer=t.shotInterval;burst(t.x,t.y,0,8,false);SFX.turretFire();}
      }
      if(state==='playing'&&powerupActive==='shield'){
        if(dist2(player.x,player.y,t.x,t.y)<(player.displayR+t.r*2+30)**2){burst(t.x,t.y,0,20,true);floatText(t.x,t.y-30,'DESTROYED!',0);t.active=false;}
      }
    } else if(t.type==='mine'){
      const s=w2s(t.x,t.y);
      if(onScr(t.x,t.y,t.triggerR)){
        const pr=t.r*(.9+.18*Math.sin(t.pulse));
        ctx.save();
        ctx.strokeStyle=`hsla(45,100%,70%,${.12+.08*Math.sin(ts*.004)})`;ctx.lineWidth=2;ctx.setLineDash([4,8]);
        ctx.shadowColor='rgba(255,200,0,0.8)';ctx.shadowBlur=8;
        ctx.beginPath();ctx.arc(s.x,s.y,t.triggerR,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.shadowColor='rgba(255,220,0,1)';ctx.shadowBlur=18;ctx.fillStyle=`hsl(50,100%,65%)`;
        ctx.beginPath();ctx.arc(s.x,s.y,pr,0,Math.PI*2);ctx.fill();
        for(let sp=0;sp<8;sp++){const sa=sp/8*Math.PI*2+t.pulse*.5;ctx.strokeStyle='rgba(255,240,100,1)';ctx.lineWidth=3;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(s.x+Math.cos(sa)*(pr*.8),s.y+Math.sin(sa)*(pr*.8));ctx.lineTo(s.x+Math.cos(sa)*(pr+12),s.y+Math.sin(sa)*(pr+12));ctx.stroke();}
        ctx.restore();
      }
      if(state==='playing'){
        const dd=dist2(player.x,player.y,t.x,t.y);
        if(powerupActive==='shield'&&dd<(player.displayR+t.triggerR+20)**2){burst(t.x,t.y,45,20,true);floatText(t.x,t.y-30,'DESTROYED!',45);t.active=false;}
        else if(dd<t.triggerR*t.triggerR&&player.invincible<=0){
          burst(t.x,t.y,45,20,true);t.active=false;SFX.explosion();
          if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);}
          else if(powerupActive!=='ghost'){
            player.hp--;player.invincible=60;burst(player.x,player.y,player.hue,12,false);SFX.playerHit();
            if(player.hp<=0){burst(player.x,player.y,player.hue,32,true);player.alive=false;SFX.death();setTimeout(showDead,700);state='dying';ctx.restore();return;}
            else floatText(player.x,player.y-30,'BOOM!',45);
          }
        }
      }
    } else if(t.type==='spike_ring'){
      const s=w2s(t.x,t.y);
      t.pulse+=t.rotSpeed;
      if(onScr(t.x,t.y,t.spikeR+20)){
        ctx.save();drawGlow(s.x,s.y,t.r,t.hue,1.0,3.0);
        const numSpokes=6;
        for(let sp=0;sp<numSpokes;sp++){
          const sa=sp/numSpokes*Math.PI*2+t.pulse;
          const ex=s.x+Math.cos(sa)*t.spikeR,ey=s.y+Math.sin(sa)*t.spikeR;
          ctx.strokeStyle=`hsla(${t.hue},100%,75%,.7)`;ctx.lineWidth=2.5;ctx.shadowColor=`hsl(${t.hue},100%,70%)`;ctx.shadowBlur=12;
          ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(ex,ey);ctx.stroke();
          ctx.fillStyle=`hsl(${t.hue+20},100%,90%)`;ctx.shadowBlur=16;ctx.beginPath();ctx.arc(ex,ey,6,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }
      if(state==='playing'){
        if(powerupActive==='shield'&&dist2(player.x,player.y,t.x,t.y)<(player.displayR+t.spikeR+20)**2){burst(t.x,t.y,t.hue,20,true);floatText(t.x,t.y-30,'DESTROYED!',t.hue);t.active=false;}
        else if(powerupActive!=='ghost'){
          const numSpokes=6;
          for(let sp=0;sp<numSpokes;sp++){
            const sa=sp/numSpokes*Math.PI*2+t.pulse;
            const ex=t.x+Math.cos(sa)*t.spikeR,ey=t.y+Math.sin(sa)*t.spikeR;
            if(dist2(player.x,player.y,ex,ey)<(player.displayR+6)**2&&player.invincible<=0){
              if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);break;}
              else{
                player.hp--;player.invincible=60;burst(player.x,player.y,player.hue,12,false);SFX.playerHit();
                if(player.hp<=0){burst(player.x,player.y,player.hue,32,true);player.alive=false;SFX.death();setTimeout(showDead,700);state='dying';ctx.restore();return;}
                else floatText(player.x,player.y-30,'SPIKED!',180);
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
    const alpha=Math.min(1,p.life/p.maxLife*2);
    const tailLen=5;
    for(let tl=1;tl<=tailLen;tl++){
      const tx=s.x-p.vx*tl*1.2,ty=s.y-p.vy*tl*1.2;
      const ta=alpha*(1-tl/tailLen)*.5;
      ctx.fillStyle=`rgba(255,${60+tl*10},0,${ta})`;
      ctx.beginPath();ctx.arc(tx,ty,p.r*(1-tl/tailLen*.6),0,Math.PI*2);ctx.fill();
    }
    ctx.save();
    ctx.shadowColor='rgba(255,120,0,1)';ctx.shadowBlur=20;
    const pg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,p.r);
    pg.addColorStop(0,`rgba(255,255,200,${alpha})`);pg.addColorStop(.4,`rgba(255,140,0,${alpha})`);pg.addColorStop(1,`rgba(255,40,0,${alpha*.8})`);
    ctx.fillStyle=pg;ctx.beginPath();ctx.arc(s.x,s.y,p.r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(255,80,0,${alpha*.5})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,p.r+4,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    if(state==='playing'&&player.invincible<=0&&powerupActive!=='ghost'){
      if(dist2(player.x,player.y,p.x,p.y)<(player.displayR+p.r)**2){
        projectiles.splice(i,1);
        if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=80;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);}
        else{
          player.hp--;player.invincible=60;burst(player.x,player.y,player.hue,12,false);SFX.playerHit();
          if(player.hp<=0){burst(player.x,player.y,player.hue,32,true);player.alive=false;SFX.death();setTimeout(showDead,700);state='dying';ctx.restore();return;}
          else floatText(player.x,player.y-30,'HIT!',0);
        }
      }
    }
    if(state==='playing'){
      for(let j=hunters.length-1;j>=0;j--){
        const h=hunters[j];
        if(dist2(h.x,h.y,p.x,p.y)<(h.r+p.r)**2){
          h.hp--;
          if(h.hp<=0){
            burst(h.x,h.y,h.hue,18,true);floatText(h.x,h.y-h.r-10,'DESTROYED',0);SFX.explosion();
            hunters.splice(j,1);spawnHunter();
            killCount++;killStreak++;killStreakTimer=180;
            updateHUD();
          } else burst(h.x,h.y,h.hue,8,false);
          projectiles.splice(i,1);break;
        }
      }
    }
  }

  // ── ORBS ──
  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];
    o.pulse+=o.ps;o.x+=o.vx;o.y+=o.vy;
    o.x=clamp(o.x,10,WORLD-10);o.y=clamp(o.y,10,WORLD-10);
    if(o.x<=10||o.x>=WORLD-10)o.vx*=-1;if(o.y<=10||o.y>=WORLD-10)o.vy*=-1;
    if(state==='playing'){
      const mdx=player.x-o.x,mdy=player.y-o.y,mdd=Math.sqrt(mdx*mdx+mdy*mdy);
      const mR=powerupActive==='magnet'?300:110,mF=powerupActive==='magnet'?.4:.07;
      if(mdd<mR&&mdd>1){o.vx+=mdx/mdd*mF;o.vy+=mdy/mdd*mF;}
    }
    if(!onScr(o.x,o.y,60)) continue;
    const s=w2s(o.x,o.y);
    const pr=o.r*(.85+.2*Math.sin(o.pulse));
    if(o.golden){
      ctx.save();ctx.shadowColor='rgba(255,220,0,.9)';ctx.shadowBlur=pr*2.5;
      ctx.translate(s.x,s.y);ctx.rotate(ts*.003);
      for(let arm=0;arm<6;arm++){
        const aa=arm/6*Math.PI*2;
        ctx.strokeStyle=`hsla(50,100%,75%,${.3+.2*Math.sin(o.pulse+arm)})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(aa)*(pr+8),Math.sin(aa)*(pr+8));ctx.stroke();
      }
      ctx.restore();
      drawGlow(s.x,s.y,pr,50,1.1,3.5);
      ctx.save();ctx.font=`bold ${Math.round(pr*.9)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,240,100,.9)';ctx.shadowColor='rgba(255,200,0,1)';ctx.shadowBlur=8;
      ctx.fillText('★',s.x,s.y+1);ctx.textBaseline='alphabetic';ctx.restore();
    } else if(o.big){
      drawGlow(s.x,s.y,pr,o.hue,1.0,4.0);
      ctx.save();ctx.strokeStyle=`hsla(${o.hue},100%,70%,.35)`;ctx.lineWidth=1.5;ctx.setLineDash([3,5]);
      ctx.beginPath();ctx.arc(s.x,s.y,pr+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    } else {
      drawGlow(s.x,s.y,pr,o.hue,.9,3.2);
    }
  }

  // ── POWERUP ITEMS ──
  for(const p of powerups){
    p.pulse+=p.ps;if(!onScr(p.x,p.y,30)) continue;
    const s=w2s(p.x,p.y);const pr=p.r*(.9+.15*Math.sin(p.pulse));
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(ts*.002);
    ctx.strokeStyle=POWERUP_COLORS[p.type];ctx.lineWidth=2;ctx.shadowColor=POWERUP_COLORS[p.type];ctx.shadowBlur=14;
    ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,pr+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    drawGlow(s.x,s.y,pr,p.hue,1,3);
    ctx.font=`${Math.round(pr*1.1)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(p.label,s.x,s.y+1);ctx.textBaseline='alphabetic';
  }

  // ── SHOCKWAVE RINGS ──
  for(let i=shockwaveRings.length-1;i>=0;i--){
    const sw=shockwaveRings[i];
    sw.r+=sw.maxR/18; // expand over ~18 frames
    sw.life-=1/18;
    if(sw.life<=0){shockwaveRings.splice(i,1);continue;}
    const s=w2s(sw.x,sw.y);
    ctx.save();
    ctx.strokeStyle=`hsla(${sw.hue},100%,75%,${sw.life*.7})`;
    ctx.lineWidth=3*(sw.life);
    ctx.shadowColor=`hsl(${sw.hue},100%,65%)`;ctx.shadowBlur=12*sw.life;
    ctx.beginPath();ctx.arc(s.x,s.y,sw.r,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  // ── HUNTERS ──
  for(let i=hunters.length-1;i>=0;i--){
    const h=hunters[i];
    const edible=player.displayR>h.r*1.0;
    const canEat=h.r>player.displayR*1.05;
    if(themeTransition<1&&!edible){
      const tHue=h.isSmall?th.hunterSafeHue:th.hunterDangerHue;
      let hd=tHue-h.hue;if(hd>180)hd-=360;if(hd<-180)hd+=360;
      h.hue=(h.hue+hd*.04+360)%360;
    }
    h.pulse+=h.ps;
    const dx=player.x-h.x,dy=player.y-h.y,d2=dx*dx+dy*dy;
    if(h.type==='teleporter'&&state==='playing'){
      h.teleTimer--;
      if(h.teleTimer<=0){const np=safePos(280,520,60);burst(h.x,h.y,h.hue,8,false);h.x=np.x;h.y=np.y;h.teleTimer=rndInt(120,250);burst(h.x,h.y,h.hue,10,false);SFX.teleport();}
    }
    if(h.type==='bomber'&&state==='playing'){
      if(!h.trail)h.trail=[];
      if(frameCount%25===0&&h.trail.length<10) h.trail.push({x:h.x,y:h.y,life:180,r:10,hue:15});
    }
    let sepX=0,sepY=0;
    for(const o of hunters){
      if(o===h) continue;
      const sdx=h.x-o.x,sdy=h.y-o.y,sd2=sdx*sdx+sdy*sdy;
      const minSep=(h.r+o.r)*1.4;
      if(sd2<minSep*minSep&&sd2>0.01){const sd=Math.sqrt(sd2);sepX+=sdx/sd*(minSep-sd)*.04;sepY+=sdy/sd*(minSep-sd)*.04;}
    }
    if(edible){
      const dd=Math.sqrt(d2)+.01;h.vx+=(-dx/dd)*.07+sepX;h.vy+=(-dy/dd)*.07+sepY;
      const m=Math.sqrt(h.vx*h.vx+h.vy*h.vy);if(m>h.speed*.9){h.vx=h.vx/m*h.speed*.9;h.vy=h.vy/m*h.speed*.9;}
    } else if(h.stunTimer>0){
      // Stunned: coast on knockback velocity, no AI steering
      h.stunTimer--;
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
    const wall=60;
    if(h.x<wall)h.vx+=.15;if(h.x>WORLD-wall)h.vx-=.15;
    if(h.y<wall)h.vy+=.15;if(h.y>WORLD-wall)h.vy-=.15;
    h.x=clamp(h.x+h.vx,30,WORLD-30);h.y=clamp(h.y+h.vy,30,WORLD-30);
    if(h.type==='bomber'&&h.trail){
      for(let t=h.trail.length-1;t>=0;t--){
        const ft=h.trail[t];ft.life--;ft.r*=.996;
        if(ft.life<=0){h.trail.splice(t,1);continue;}
        if(!onScr(ft.x,ft.y,20)) continue;
        const fs=w2s(ft.x,ft.y);drawGlow(fs.x,fs.y,ft.r*(.8+.2*Math.sin(ts*.003)),ft.hue,ft.life/180*.6,2.5);
      }
    }
    if(!onScr(h.x,h.y,100)) continue;
    const s=w2s(h.x,h.y);
    const pr=h.r*(.9+.14*Math.sin(h.pulse));
    const dispHue=edible?130:h.hue;
    const phantomAlpha=h.type==='phantom'?(.45+.2*Math.sin(ts*.004)):1;
    if(canEat&&d2<300*300&&!edible){
      const proximity=1-Math.sqrt(d2)/300;const wa=(.12+.1*Math.sin(ts*.008))*proximity;
      ctx.save();ctx.strokeStyle=`rgba(255,80,80,${wa})`;ctx.lineWidth=2;ctx.setLineDash([4,6]);
      ctx.beginPath();ctx.arc(s.x,s.y,pr+18+Math.sin(ts*.005)*4,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
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
    // HP bar for multi-hp hunters
    if(h.maxHp>1&&d2<400*400){
      const bw=pr*2,bx=s.x-pr,by=s.y-pr-8;
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(bx,by,bw,3);
      ctx.fillStyle=`hsl(${h.hp/h.maxHp*120},100%,55%)`;ctx.fillRect(bx,by,bw*(h.hp/h.maxHp),3);
    }
    ctx.globalAlpha=1;
    const eyeAng=edible?Math.atan2(player.y-h.y,player.x-h.x)+Math.PI:Math.atan2(player.y-h.y,player.x-h.x);
    if(d2<650*650){
      const ex=s.x+Math.cos(eyeAng)*pr*.34,ey=s.y+Math.sin(eyeAng)*pr*.34;
      ctx.shadowBlur=0;ctx.fillStyle=edible?'#ffe':'#fff';ctx.beginPath();ctx.arc(ex,ey,pr*.23,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';ctx.beginPath();ctx.arc(ex+Math.cos(eyeAng)*pr*.07,ey+Math.sin(eyeAng)*pr*.07,pr*.12,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    // Stun indicator: blue crackle ring
    if(h.stunTimer>0){
      const stunAlpha=Math.min(1,h.stunTimer/30)*(.5+.5*Math.sin(ts*.02));
      ctx.save();ctx.strokeStyle=`rgba(100,180,255,${stunAlpha})`;ctx.lineWidth=2;
      ctx.shadowColor='rgba(100,200,255,.8)';ctx.shadowBlur=8;
      ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.arc(s.x,s.y,pr+6,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    }
    if(edible&&d2<320*320&&onScr(h.x,h.y,0)){
      ctx.font=`bold ${clamp(Math.round(h.r*.55),10,14)}px 'Share Tech Mono'`;
      ctx.textAlign='center';ctx.fillStyle='rgba(100,255,150,.9)';
      ctx.shadowColor='rgba(0,255,100,.9)';ctx.shadowBlur=8;
      ctx.fillText('EAT',s.x,s.y-pr-(h.maxHp>1?20:6));ctx.shadowBlur=0;
    }
  }

  // Player trail
  const tLen=player.trail.length;
  for(let i=0;i<tLen;i++){
    const t=player.trail[i];const s=w2s(t.x,t.y);
    ctx.fillStyle=`hsla(${player.hue},100%,68%,${(i/tLen)*.32})`;
    ctx.beginPath();ctx.arc(s.x,s.y,player.displayR*(i/tLen)*.65,0,Math.PI*2);ctx.fill();
  }

  // Player
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

  // Particles
  for(let i=particles2.length-1;i>=0;i--){
    const p=particles2[i];
    if(p.maxLife===0)p.maxLife=p.life;
    p.x+=p.vx;p.y+=p.vy;p.vx*=.93;p.vy*=.93;p.life-=dt/1000;
    if(p.life<=0){particles2.splice(i,1);continue;}
    const s=w2s(p.x,p.y);
    ctx.fillStyle=`hsla(${p.hue},100%,78%,${p.life/p.maxLife})`;
    ctx.beginPath();ctx.arc(s.x,s.y,p.r*(p.life/p.maxLife),0,Math.PI*2);ctx.fill();
  }

  // Float texts
  for(let i=floatTexts.length-1;i>=0;i--){
    const f=floatTexts[i];f.y+=f.vy;f.life-=dt/1000;
    if(f.life<=0){floatTexts.splice(i,1);continue;}
    const s=w2s(f.x,f.y);
    ctx.font=`bold 14px 'Orbitron',monospace`;ctx.textAlign='center';
    ctx.fillStyle=`hsla(${f.hue},100%,80%,${Math.min(1,f.life*3)})`;
    ctx.shadowColor=`hsl(${f.hue},100%,60%)`;ctx.shadowBlur=10;
    ctx.fillText(f.txt,s.x,s.y);ctx.shadowBlur=0;
  }

  // Guide line
  if(player.targetActive&&player.alive){
    const ps=w2s(player.x,player.y);
    const tx=player.targetX-camX+W/2,ty=player.targetY-camY+H/2;
    const ldx=tx-ps.x,ldy=ty-ps.y,ld=Math.sqrt(ldx*ldx+ldy*ldy);
    if(ld>12){
      const gt=Math.min(1,ld/280),gh=120-gt*120,ga=.35+gt*.28;
      ctx.save();ctx.setLineDash([6,9]);ctx.lineDashOffset=-(ts*.04%15);
      ctx.strokeStyle=`hsla(${gh},100%,65%,${ga})`;ctx.lineWidth=1.5;ctx.shadowColor=`hsl(${gh},100%,60%)`;ctx.shadowBlur=6;
      ctx.beginPath();ctx.moveTo(ps.x,ps.y);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);ctx.restore();
      const dotR=4+Math.sin(ts*.006)*1.5;
      ctx.save();ctx.shadowColor=`hsl(${gh},100%,65%)`;ctx.shadowBlur=10;
      ctx.fillStyle=`hsla(${gh},100%,72%,${ga+.2})`;ctx.beginPath();ctx.arc(tx,ty,dotR,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=`hsla(${gh},100%,72%,${ga*.5})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(tx,ty,dotR+5,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }

  // ── BOTTOM UI PANEL (all elements use consistent Y anchors, no overlap) ──
  // Layout from bottom up:
  //   H-6  : xp bar (CSS)
  //   H-9  : energy bar (CSS)
  //   H-28 : kill counter (CSS, left side)
  //   H-30 : HP bar
  //   H-50 : powerup timer bar (only when active)
  //   H-72 : ability arcs center-row  (burst dot on right of arcs)

  // 1. HP bar — bottom center, just above the CSS bars
  {
    const bw=140,bh=5,bx=(W-bw)/2,by=H-30;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(bx-1,by-1,bw+2,bh+2);
    ctx.fillStyle='rgba(255,255,255,.05)';ctx.fillRect(bx,by,bw,bh);
    const hpPct=player.hp/player.maxHp;
    ctx.fillStyle=`hsl(${hpPct*120},100%,55%)`;ctx.shadowColor=`hsl(${hpPct*120},100%,55%)`;ctx.shadowBlur=6;
    ctx.fillRect(bx,by,bw*hpPct,bh);ctx.shadowBlur=0;
    for(let i=1;i<player.maxHp;i++){
      ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(bx+bw/player.maxHp*i-0.5,by,1,bh);
    }
    ctx.font=`7px 'Share Tech Mono'`;ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.fillText('HP',W/2,by-3);
  }

  // 2. Powerup timer — sits above HP bar
  if(powerupActive&&powerupTimer>0){
    const bw=120,bh=4,bx=(W-bw)/2,by=H-50;
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle=POWERUP_COLORS[powerupActive];ctx.shadowColor=POWERUP_COLORS[powerupActive];ctx.shadowBlur=6;
    ctx.fillRect(bx,by,bw*(powerupTimer/300),bh);ctx.shadowBlur=0;
    ctx.font=`7px 'Share Tech Mono'`;ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.55)';
    ctx.fillText(powerupActive.toUpperCase(),W/2,by-3);
  }

  // 3. Ability arcs — row at H-72 center, burst dot to the right
  {
    const abKeys=Object.keys(ABILITIES);
    const arcR=13,arcSpacing=40;
    const totalW=(abKeys.length-1)*arcSpacing;
    const startX=W/2-totalW/2;
    const cy=H-72;
    abKeys.forEach((name,idx)=>{
      const ab=ABILITIES[name];
      const cx=startX+idx*arcSpacing;
      const rdy=ab.cooldown<=0;
      ctx.save();
      // Background ring
      ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,cy,arcR,0,Math.PI*2);ctx.stroke();
      // Progress arc
      if(!rdy){
        const prog=1-(ab.cooldown/ab.maxCooldown);
        ctx.strokeStyle=`hsl(${player.hue},100%,55%)`;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(cx,cy,arcR,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);ctx.stroke();
      } else {
        ctx.strokeStyle=`hsl(${player.hue},100%,60%)`;ctx.lineWidth=2;
        ctx.shadowColor=`hsl(${player.hue},100%,50%)`;ctx.shadowBlur=6;
        ctx.beginPath();ctx.arc(cx,cy,arcR,0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle=rdy?'rgba(255,255,255,.9)':'rgba(255,255,255,.3)';
      ctx.font=`bold 11px 'Share Tech Mono'`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(ab.icon,cx,cy);ctx.textBaseline='alphabetic';
      ctx.font=`7px 'Share Tech Mono'`;ctx.fillStyle='rgba(255,255,255,.35)';
      ctx.fillText(ab.key,cx,cy+arcR+9);
      ctx.restore();
    });
    // Burst dot — right of ability arcs, same row
    const burstX=startX+totalW+arcSpacing;
    const rdy=energy>=25;
    ctx.save();
    ctx.strokeStyle=rdy?`hsl(${player.hue},100%,65%)`:'rgba(255,255,255,.1)';
    ctx.lineWidth=2;
    if(rdy){ctx.shadowColor=`hsl(${player.hue},100%,55%)`;ctx.shadowBlur=6;}
    ctx.beginPath();ctx.arc(burstX,cy,arcR,0,Math.PI*2);ctx.stroke();
    if(rdy){
      const prog=energy/maxEnergy;
      ctx.strokeStyle=`hsl(${player.hue},100%,70%)`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(burstX,cy,arcR,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle=rdy?'rgba(255,255,255,.8)':'rgba(255,255,255,.25)';
    ctx.font=`bold 9px 'Share Tech Mono'`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('2x',burstX,cy);ctx.textBaseline='alphabetic';
    ctx.font=`7px 'Share Tech Mono'`;ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.fillText('DBL',burstX,cy+arcR+9);
    ctx.restore();
  }

  ctx.restore(); // end shake

  // Minimap — positioned to not overlap kill counter (bottom-right)
  {
    const mm=80,pad=14,mmX=W-mm-pad,mmY=H-mm-22;
    const scale=mm/WORLD;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(mmX,mmY,mm,mm,4);ctx.fill();ctx.stroke();
    for(const o of orbs){ctx.fillStyle=`hsla(${o.hue},80%,70%,.4)`;ctx.beginPath();ctx.arc(mmX+o.x*scale,mmY+o.y*scale,1.2,0,Math.PI*2);ctx.fill();}
    for(const h of hunters){ctx.fillStyle=player.displayR>h.r?'rgba(80,255,120,.7)':'rgba(255,80,80,.7)';ctx.beginPath();ctx.arc(mmX+h.x*scale,mmY+h.y*scale,2,0,Math.PI*2);ctx.fill();}
    for(const t of traps){ctx.fillStyle='rgba(255,200,0,.6)';ctx.beginPath();ctx.arc(mmX+t.x*scale,mmY+t.y*scale,2.5,0,Math.PI*2);ctx.fill();}
    for(const p of powerups){ctx.fillStyle='rgba(200,200,255,.8)';ctx.beginPath();ctx.arc(mmX+p.x*scale,mmY+p.y*scale,2,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=`hsl(${player.hue},100%,70%)`;ctx.shadowColor=`hsl(${player.hue},100%,60%)`;ctx.shadowBlur=4;
    ctx.beginPath();ctx.arc(mmX+player.x*scale,mmY+player.y*scale,3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.restore();
  }

  if(state!=='playing') return;

  // ── GAME LOGIC ──

  // Cooldowns
  if(ABILITIES.pulse.cooldown>0) ABILITIES.pulse.cooldown--;
  if(ABILITIES.dash.cooldown>0) ABILITIES.dash.cooldown--;

  // Kill streak decay
  if(killStreakTimer>0){killStreakTimer--;if(killStreakTimer<=0){killStreak=0;updateHUD();}}

  // Player movement
  if(player.targetActive){
    const dx=player.targetX-player.x,dy=player.targetY-player.y,d2=dx*dx+dy*dy;
    if(d2>1){
      const d=Math.sqrt(d2);const speedBoost=powerupActive==='speed'?1.6:1;
      const maxSpd=Math.max(2.5,(5.8-player.r*.04))*speedBoost;
      const ds=Math.min(maxSpd,d*.18);
      player.vx+=(dx/d*ds-player.vx)*.18;player.vy+=(dy/d*ds-player.vy)*.18;
    }
  } else {player.vx*=.88;player.vy*=.88;}

  player.x=clamp(player.x+player.vx,20,WORLD-20);player.y=clamp(player.y+player.vy,20,WORLD-20);
  const pWall=80;
  if(player.x<pWall)player.vx+=.4*(1-(player.x/pWall));if(player.x>WORLD-pWall)player.vx-=.4*(1-((WORLD-player.x)/pWall));
  if(player.y<pWall)player.vy+=.4*(1-(player.y/pWall));if(player.y>WORLD-pWall)player.vy-=.4*(1-((WORLD-player.y)/pWall));
  player.trail.push({x:player.x,y:player.y});if(player.trail.length>24)player.trail.shift();
  if(powerupActive){powerupTimer--;if(powerupTimer<=0)powerupActive=null;}

  // Eat orbs
  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];
    if(o.r>=player.displayR*.92) continue;
    if(dist2(player.x,player.y,o.x,o.y)<(player.displayR+o.r*.5)**2){
      burst(o.x,o.y,o.hue,7,false);score+=o.value;xp+=o.value;combo++;comboTimer=110;
      if(o.golden){energy=Math.min(maxEnergy,energy+20);floatText(o.x,o.y-o.r-8,'+20 ENERGY',200);SFX.eatGolden();} else {SFX.eatOrb(o.r);}
      if(combo>=3){showCombo(combo);SFX.combo();}
      if(o.value>=2)floatText(o.x,o.y-o.r-8,`+${o.value}`,o.hue);
      player.r=Math.min(75,player.r+o.r*.045);
      while(xp>=xpNext&&level<MAX_LEVEL){
        xp-=xpNext;xpNext=Math.floor(xpNext*1.2);level++;showLevelUp();SFX.levelUp();
        burst(player.x,player.y,player.hue,20,true);
        player.hue=(player.hue+40)%360;playerHueLerp=player.hue;spawnHunter();
        const tc=trapCount();
        const tts=Math.min(tc-traps.length,1+Math.floor(level/10));
        for(let t=0;t<tts&&traps.length<tc;t++){
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
      showPowerupBanner(p.type);burst(p.x,p.y,p.hue,12,true);powerups.splice(i,1);SFX.collectPowerup();
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
  const hc=6+Math.min(level,20);
  if(hunters.length<hc&&frameCount%300===0) spawnHunter(Math.random()<0.4);

  // Hunter collisions
  if(player.invincible<=0){
    for(let i=hunters.length-1;i>=0;i--){
      const h=hunters[i];
      const colD=player.displayR+h.r-6;
      if(dist2(player.x,player.y,h.x,h.y)<colD*colD){
        if(player.displayR>h.r*1.0){
          const pts=Math.floor(h.r*3*(1+level*0.03));
          const eg=Math.floor(h.r*2*(1+level*0.02));
          const streakMult=1+Math.floor(killStreak/5)*.1;
          const finalPts=Math.floor(pts*streakMult);
          if(h.type==='splitter'){
            const th2=THEMES[themeIdx];
            for(let s=0;s<2;s++) hunters.push({...h,r:h.r*.55,vx:rnd(-1,1),vy:rnd(-1,1),type:'basic',isSmall:true,hue:th2.hunterSafeHue+rnd(-10,10)});
          }
          burst(h.x,h.y,h.hue,18,true);floatText(h.x,h.y-h.r-10,`+${finalPts}`,50);SFX.eatEnemy(h.r);
          if(eg>0)floatText(h.x,h.y-h.r-25,`+${eg}E`,200);
          score+=finalPts;xp+=finalPts;player.r=Math.min(75,player.r+h.r*.1);
          energy=Math.min(maxEnergy,energy+eg);
          killCount++;killStreak++;killStreakTimer=180;
          while(xp>=xpNext&&level<MAX_LEVEL){
            xp-=xpNext;xpNext=Math.floor(xpNext*1.2);level++;showLevelUp();SFX.levelUp();
            burst(player.x,player.y,player.hue,20,true);
            player.hue=(player.hue+40)%360;playerHueLerp=player.hue;spawnHunter();
          }
          if(score>best){best=score;localStorage.setItem('ab_best',best);}
          hunters.splice(i,1);spawnHunter();checkTheme();updateHUD();
        } else if(h.r>player.displayR*1.05){
          if(powerupActive==='ghost') continue;
          if(powerupActive==='shield'){powerupActive=null;powerupTimer=0;player.invincible=60;burst(player.x,player.y,200,12,false);floatText(player.x,player.y-30,'SHIELD!',200);SFX.shieldBlock();continue;}
          player.hp--;player.invincible=60;burst(player.x,player.y,player.hue,12,false);SFX.playerHit();
          killStreak=0;updateHUD();
          if(player.hp<=0){burst(player.x,player.y,player.hue,32,true);player.alive=false;SFX.death();setTimeout(showDead,700);state='dying';return;}
          else floatText(player.x,player.y-30,'EATEN!',h.hue);
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
            player.hp--;player.invincible=60;burst(player.x,player.y,player.hue,12,false);killStreak=0;SFX.playerHit();
            if(player.hp<=0){burst(player.x,player.y,player.hue,32,true);player.alive=false;SFX.death();setTimeout(showDead,700);state='dying';return;}
            else floatText(player.x,player.y-30,'BOMBER!',15);
          }
        }
      }
    }
  }
}

// ── BURST ──────────────────────────────────────────────────────
function doBurst(){
  if(energy<25||state!=='playing') return;
  let converted=0,damaged=0;
  for(let i=hunters.length-1;i>=0;i--){
    const h=hunters[i];
    if(dist2(player.x,player.y,h.x,h.y)<200*200){
      if(converted<3){
        orbs.push({x:h.x,y:h.y,r:Math.max(4,h.r*.8),hue:h.hue,pulse:rnd(0,Math.PI*2),ps:rnd(.02,.05),vx:rnd(-.4,.4),vy:rnd(-.4,.4),value:Math.max(1,Math.floor(h.r*2)),golden:false,big:false});
        hunters.splice(i,1);converted++;killCount++;killStreak++;killStreakTimer=180;
      } else {
        const dmg=Math.floor(25+level*2);h.hp-=dmg;
        if(h.hp<=0){burst(h.x,h.y,h.hue,12,false);hunters.splice(i,1);spawnHunter();killCount++;killStreak++;killStreakTimer=180;}
        else{const dx=h.x-player.x,dy=h.y-player.y,d=Math.sqrt(dx*dx+dy*dy)||1;h.vx+=(dx/d)*8;h.vy+=(dy/d)*8;burst(h.x,h.y,h.hue,8,false);floatText(h.x,h.y-h.r-10,`-${dmg}`,0);}
        damaged++;
      }
    }
  }
  energy-=25;updateHUD();
  SFX.burstAbility();
  burst(player.x,player.y,player.hue,25,true);shake(15);
  let msg='';
  if(converted>0) msg+=`${converted} TO ORBS`;
  if(damaged>0) msg+=(msg?', ':'')+`${damaged} HIT`;
  if(msg) floatText(player.x,player.y-40,msg,player.hue);
}

// ── INPUT ──────────────────────────────────────────────────────
function getWP(cx,cy){return{x:cx-W/2+camX,y:cy-H/2+camY};}

canvas.addEventListener('touchstart',e=>{
  if(state==='paused'){doResume();return;}
  if(state!=='playing') return;
  const t=e.touches[0],wp=getWP(t.clientX,t.clientY);
  player.targetX=wp.x;player.targetY=wp.y;player.targetActive=true;
  const now=performance.now();
  if(now-lastTap<400) doBurst();
  lastTap=now;
},{passive:true});
canvas.addEventListener('touchmove',e=>{
  e.preventDefault();if(state!=='playing') return;
  const t=e.touches[0],wp=getWP(t.clientX,t.clientY);
  player.targetX=wp.x;player.targetY=wp.y;
},{passive:false});
canvas.addEventListener('touchend',()=>player.targetActive=false);
canvas.addEventListener('touchcancel',()=>player.targetActive=false);

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
  const now=performance.now();
  if(now-lastTap<400) doBurst();
  lastTap=now;
});
window.addEventListener('mouseleave',()=>{mouseActive=false;player.targetActive=false;});

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='escape'||k==='p'){if(state==='playing')doPause();else if(state==='paused')doResume();}
  if(k==='e'&&state==='playing') activatePulse();
  if(k==='q'&&state==='playing') activateDash();
});

// Buttons
document.getElementById('pauseBtn').addEventListener('click',()=>{if(state==='playing')doPause();});
document.getElementById('resumeBtn').addEventListener('click',doResume);
document.getElementById('quitBtn').addEventListener('click',doQuit);
document.getElementById('pauseLbBtn').addEventListener('click',()=>{
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('lbScreen').classList.remove('hidden');
  renderLeaderboard('lb-container2','lb-body2','lb-loading2','lb-status2',document.getElementById('playerNameInput').value.trim(),true);
});
document.getElementById('lbBtn').addEventListener('click',()=>{
  document.getElementById('lbScreen').classList.remove('hidden');
  renderLeaderboard('lb-container2','lb-body2','lb-loading2','lb-status2',document.getElementById('playerNameInput').value.trim(),true);
});
document.getElementById('lbBackBtn').addEventListener('click',()=>{
  document.getElementById('lbScreen').classList.add('hidden');
  if(state==='paused') document.getElementById('pauseScreen').classList.remove('hidden');
});
document.getElementById('startBtn').addEventListener('click',()=>{
  SFX.unlock();
  document.getElementById('screen').classList.add('hidden');
  document.getElementById('screenStats').style.display='none';
  initGame();state='playing';
  SFX.startAmbience();
  if(!loopRunning){loopRunning=true;last=0;requestAnimationFrame(draw);}
});

// Load leaderboard on start
window.addEventListener('resize',resize);
document.getElementById('muteBtn').addEventListener('click',()=>{
  const m=SFX.toggleMute();
  document.getElementById('muteBtn').textContent=m?'🔇':'🔊';
});
resize();initBg();
document.getElementById('bestEl').textContent=best.toLocaleString();
// Restore name
const savedName=localStorage.getItem('ab_name');
if(savedName) document.getElementById('playerNameInput').value=savedName;
document.getElementById('playerNameInput').addEventListener('input',e=>{
  localStorage.setItem('ab_name',e.target.value);
});
// Initial leaderboard load
setTimeout(()=>{
  renderLeaderboard('lb-container','lb-body','lb-loading','lb-status','',false);
},300);

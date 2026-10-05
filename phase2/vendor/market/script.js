/**
 * ============================================================================
 * PROJECT: BLACK MARKET — CURSOR TORCH PUZZLE
 * Environmental Investigation Puzzle
 *
 * Visual Pipeline:
 * - Intro: Cinematic, corrupted boot-up sequence (0 to 3.4s).
 * - Base: Total darkness.
 * - Torch: Soft, organic, multi-layered mask revealing the original full-color scene.
 * - Discovery: Hidden clues and binary codes visible only inside the torch light.
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURATION & PUZZLE DEFINITIONS
// ============================================================================

let DEBUG_MODE = false;

const TORCH_CONFIG = {
  minInvestment: 100,
  maxInvestment: 1000,
  minRadius: 80,
  maxRadius: 230,
  minDuration: 20,
  maxDuration: 180,
  moneyPerSecond: 10,
  maxCapacity: 180,
  rechargeAnimationMs: 500
};

let playerMoney = 1000;

const HOTSPOT_CONFIG = {
  clueRevealRadius: 180,
  riddleRevealRadius: 180
};

// Clues now use decimal values
const NUMBER_CLUES = [
  { id: 1, x: 5.2, y: 12.5, value: 178, rotation: -12, scale: 0.45 },
  { id: 2, x: 92.4, y: 88.1, value: 38, rotation: 15, scale: 0.5 },
  { id: 3, x: 45.8, y: 4.3, value: 141, rotation: -22, scale: 0.4 },
  { id: 4, x: 88.9, y: 15.2, value: 75, rotation: 26, scale: 0.45 },
  { id: 5, x: 12.4, y: 94.9, value: 106, rotation: -14, scale: 0.55 },
  { id: 6, x: 95.1, y: 48.5, value: 219, rotation: 18, scale: 0.4 }
];

const NUMBER_SUM = NUMBER_CLUES.reduce((acc, c) => acc + c.value, 0);
const FINAL_PASSWORD = "10124233";

// ============================================================================
// 2. SIMPLEX NOISE FOR ORGANIC TORCH MOVEMENT
// ============================================================================

class SimplexNoise {
  constructor(seed = 1337) {
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const temp = this.p[i];
      this.p[i] = this.p[j];
      this.p[j] = temp;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
  }

  noise3D(xin, yin, zin) {
    let n0, n1, n2, n3;
    const F3 = 1.0 / 3.0;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const G3 = 1.0 / 6.0;
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const z0 = zin - Z0;

    let i1, j1, k1;
    let i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 < 0) n0 = 0.0;
    else {
      const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
      t0 *= t0;
      n0 = t0 * t0 * (this.grad3[gi0][0]*x0 + this.grad3[gi0][1]*y0 + this.grad3[gi0][2]*z0);
    }

    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 < 0) n1 = 0.0;
    else {
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
      t1 *= t1;
      n1 = t1 * t1 * (this.grad3[gi1][0]*x1 + this.grad3[gi1][1]*y1 + this.grad3[gi1][2]*z1);
    }

    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 < 0) n2 = 0.0;
    else {
      const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
      t2 *= t2;
      n2 = t2 * t2 * (this.grad3[gi2][0]*x2 + this.grad3[gi2][1]*y2 + this.grad3[gi2][2]*z2);
    }

    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 < 0) n3 = 0.0;
    else {
      const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];
      t3 *= t3;
      n3 = t3 * t3 * (this.grad3[gi3][0]*x3 + this.grad3[gi3][1]*y3 + this.grad3[gi3][2]*z3);
    }

    return 32.0 * (n0 + n1 + n2 + n3);
  }
}

const simplex = new SimplexNoise(2026);

// ============================================================================
// 3. CENTRALIZED IMAGE TRANSFORM
// ============================================================================

const transform = {
  sourceWidth: 1024,
  sourceHeight: 571,
  scale: 1,
  renderedWidth: 1024,
  renderedHeight: 571,
  offsetX: 0,
  offsetY: 0,
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
  dpr: 1
};

function updateCoverTransform(viewportW, viewportH) {
  transform.viewportWidth = viewportW;
  transform.viewportHeight = viewportH;

  transform.scale = Math.max(
    viewportW / transform.sourceWidth,
    viewportH / transform.sourceHeight
  );

  transform.renderedWidth = transform.sourceWidth * transform.scale;
  transform.renderedHeight = transform.sourceHeight * transform.scale;

  transform.offsetX = (viewportW - transform.renderedWidth) / 2;
  transform.offsetY = (viewportH - transform.renderedHeight) / 2;
}

function imagePercentToScreen(xPercent, yPercent) {
  const sourceX = (xPercent / 100) * transform.sourceWidth;
  const sourceY = (yPercent / 100) * transform.sourceHeight;
  return {
    x: sourceX * transform.scale + transform.offsetX,
    y: sourceY * transform.scale + transform.offsetY
  };
}

function screenToImagePercent(screenX, screenY) {
  const sourceX = (screenX - transform.offsetX) / transform.scale;
  const sourceY = (screenY - transform.offsetY) / transform.scale;
  return {
    x: (sourceX / transform.sourceWidth) * 100,
    y: (sourceY / transform.sourceHeight) * 100
  };
}

// ============================================================================
// 4. TORCH GEOMETRY (ORGANIC AMOEBA)
// ============================================================================

let hasUserMovedMouse = false;

const torch = {
  targetX: -2000,
  targetY: -2000,
  x: -2000,
  y: -2000,
  smoothing: 0.15,
  baseRadius: 160,
  pointCount: 32,
  points: []
};

for (let i = 0; i < torch.pointCount; i++) {
  torch.points.push({ x: -2000, y: -2000, r: torch.baseRadius });
}

function updateTorchGeometry(timeSec) {
  if (hasUserMovedMouse) {
    torch.x += (torch.targetX - torch.x) * torch.smoothing;
    torch.y += (torch.targetY - torch.y) * torch.smoothing;
  }

  const N = torch.pointCount;
  const t = timeSec * 0.72;

  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const n1 = simplex.noise3D(cosA * 0.85, sinA * 0.85, t * 0.75);
    const n2 = simplex.noise3D(cosA * 1.9 + 1.2, sinA * 1.9 + 1.2, t * 1.3);
    const n3 = simplex.noise3D(cosA * 3.4 + 2.5, sinA * 3.4 + 2.5, t * 2.0);

    const radius = torch.baseRadius + (n1 * 30) + (n2 * 13) + (n3 * 4.5);
    torch.points[i].r = radius;
    torch.points[i].x = torch.x + cosA * radius;
    torch.points[i].y = torch.y + sinA * radius;
  }
}

function traceTorchPath(ctx) {
  const pts = torch.points;
  const N = pts.length;
  if (N < 3) return;

  ctx.beginPath();
  const startMidX = (pts[N - 1].x + pts[0].x) / 2;
  const startMidY = (pts[N - 1].y + pts[0].y) / 2;
  ctx.moveTo(startMidX, startMidY);

  for (let i = 0; i < N; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % N];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
  }
  ctx.closePath();
}

// ============================================================================
// 5. ASSET LOADING & INITIALIZATION
// ============================================================================

const canvas = document.getElementById('reveal-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const normalImage = new Image();
let isLoaded = false;

const numberStates = NUMBER_CLUES.map(c => ({
  id: c.id,
  currentOpacity: 0,
  targetOpacity: 0
}));

function onAssetLoaded() {
  transform.sourceWidth = normalImage.naturalWidth || normalImage.width || 1024;
  transform.sourceHeight = normalImage.naturalHeight || normalImage.height || 571;
  isLoaded = true;
  handleResize();
  console.log(`[BLACK MARKET] Scene verified. Master Coordinate Space: ${transform.sourceWidth}x${transform.sourceHeight}`);
  updateDebugOverlay();
}

normalImage.onload = () => {
  onAssetLoaded();
};

normalImage.src = 'assets/scene.png';

// ============================================================================
// 6. CANVAS SIZING
// ============================================================================

function handleResize() {
  const dpr = window.devicePixelRatio || 1;
  transform.dpr = dpr;

  const displayW = window.innerWidth;
  const displayH = window.innerHeight;

  canvas.width = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';

  updateCoverTransform(displayW, displayH);
  updateDebugOverlay();
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// ============================================================================
// 7. INPUT HANDLING
// ============================================================================

function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function onCursorMove(clientX, clientY) {
  const pos = getCanvasCoords(clientX, clientY);

  if (!hasUserMovedMouse) {
    hasUserMovedMouse = true;
    torch.x = pos.x;
    torch.y = pos.y;
    torch.targetX = pos.x;
    torch.targetY = pos.y;
  } else {
    torch.targetX = pos.x;
    torch.targetY = pos.y;
  }

  if (DEBUG_MODE) {
    const srcPct = screenToImagePercent(pos.x, pos.y);
    const screenPosEl = document.getElementById('debug-screen-pos');
    const sourcePctEl = document.getElementById('debug-source-pct');
    if (screenPosEl) screenPosEl.textContent = `${Math.round(pos.x)}px, ${Math.round(pos.y)}px`;
    if (sourcePctEl) sourcePctEl.textContent = `x: ${srcPct.x.toFixed(2)}%, y: ${srcPct.y.toFixed(2)}%`;
  }
}

window.addEventListener('mousemove', (e) => onCursorMove(e.clientX, e.clientY));

window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) onCursorMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

window.addEventListener('touchstart', (e) => {
  if (e.touches.length > 0) onCursorMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

canvas.addEventListener('click', (e) => {
  if (!DEBUG_MODE) return;
  const pos = getCanvasCoords(e.clientX, e.clientY);
  const srcPct = screenToImagePercent(pos.x, pos.y);
  const coordText = `{ x: ${srcPct.x.toFixed(2)}, y: ${srcPct.y.toFixed(2)} }`;

  console.log(`[CALIBRATION] Source Image Coordinates:`, coordText, `(Screen: ${Math.round(pos.x)}, ${Math.round(pos.y)})`);

  const lastClickEl = document.getElementById('debug-last-click');
  if (lastClickEl) {
    lastClickEl.textContent = coordText;
    lastClickEl.style.color = '#00ffaa';
    setTimeout(() => { if (lastClickEl) lastClickEl.style.color = '#ffde59'; }, 500);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(coordText).catch(() => {});
  }
});



// ============================================================================
// 8. CLUE & RIDDLE RENDERING
// ============================================================================

function drawDecimalClue(ctx, clue, state) {
  const clueScreen = imagePercentToScreen(clue.x, clue.y);
  const dist = Math.hypot(torch.x - clueScreen.x, torch.y - clueScreen.y);

  state.targetOpacity = (dist < HOTSPOT_CONFIG.clueRevealRadius) ? 1.0 : 0.0;
  state.currentOpacity += (state.targetOpacity - state.currentOpacity) * 0.15;

  if (state.currentOpacity < 0.01) return;

  ctx.save();
  ctx.translate(clueScreen.x, clueScreen.y);
  ctx.rotate((clue.rotation * Math.PI) / 180);
  
  // Apply scale
  const scale = transform.scale * clue.scale;
  ctx.scale(scale, scale);

  ctx.font = '600 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = clue.value.toString();

  ctx.globalCompositeOperation = 'overlay';

  // Barely visible scratch mark
  ctx.fillStyle = `rgba(0, 0, 0, ${(state.currentOpacity * 0.15).toFixed(3)})`;
  ctx.fillText(text, 1, 1);

  const a = (state.currentOpacity * 0.12).toFixed(3);
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ctx.fillText(text, 0, 0);

  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

// ============================================================================
// 9. CINEMATIC INTRO RENDERING
// ============================================================================

function drawCinematicIntro(ctx, elapsed, viewW, viewH) {
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  
  if (elapsed > 0.2 && elapsed < 3.2) {
    ctx.fillStyle = 'rgba(255,255,255,0.01)';
    for(let y = 0; y < viewH; y += 4) {
        ctx.fillRect(0, y, viewW, 1);
    }
  }

  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = viewW / 2;
  const cy = viewH / 2;

  let currentText = "";
  if (elapsed > 0.5 && elapsed < 1.2) currentText = "CONNECTING TO BLACK_MARKET.SYS...";
  else if (elapsed >= 1.2 && elapsed < 1.9) currentText = "DECRYPTING NODE [0x9A4F]...";
  else if (elapsed >= 1.9 && elapsed < 2.6) currentText = "CRITICAL ERROR: SURVEILLANCE OFFLINE";
  else if (elapsed >= 2.6 && elapsed < 3.2) currentText = "SWITCHING TO MANUAL OPTICS";

  if (currentText) {
      const isGlitch = Math.random() > 0.85;
      let t1 = currentText;
      if (Math.random() > 0.7) {
          t1 = currentText.split('').map(c => Math.random() > 0.9 ? String.fromCharCode(33 + Math.random()*50) : c).join('');
      }

      if (isGlitch) {
          ctx.fillStyle = 'rgba(255, 0, 80, 0.8)';
          ctx.fillText(t1, cx - 3 + (Math.random()-0.5)*10, cy + (Math.random()-0.5)*4);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
          ctx.fillText(t1, cx + 3 + (Math.random()-0.5)*10, cy + (Math.random()-0.5)*4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillText(t1, cx, cy);
  }

  if (elapsed > 0.5 && elapsed < 3.2 && Math.random() > 0.7) {
      const h = Math.random() * 40 + 5;
      const y = Math.random() * viewH;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, y, viewW, h);
  }

  if (elapsed > 3.2) {
      const intensity = Math.max(0, 1.0 - (elapsed - 3.2) / 0.2); 
      ctx.fillStyle = `rgba(255,255,255,${intensity})`;
      ctx.fillRect(0, 0, viewW, viewH);
  }

  ctx.restore();
}

// ============================================================================
// 10. DEBUG CALIBRATION
// ============================================================================

function drawDebugCalibration(ctx) {
  if (!DEBUG_MODE || !isLoaded) return;

  ctx.save();
  CLUES.forEach(clue => {
    const p = imagePercentToScreen(clue.x, clue.y);

    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.moveTo(p.x - 8, p.y);
    ctx.lineTo(p.x + 8, p.y);
    ctx.moveTo(p.x, p.y - 8);
    ctx.lineTo(p.x, p.y + 8);
    ctx.stroke();

    ctx.font = 'bold 9px Consolas, Monaco, monospace';
    ctx.fillStyle = '#0d1217';
    ctx.fillRect(p.x + 7, p.y - 12, 40, 13);
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 7, p.y - 12, 40, 13);

    ctx.fillStyle = '#00ffaa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`C${clue.id} ${clue.color[0].toUpperCase()}`, p.x + 9, p.y - 5);

    const bPos = {
      x: p.x + clue.offsetX * transform.scale,
      y: p.y + clue.offsetY * transform.scale
    };
    ctx.strokeStyle = 'rgba(255, 220, 89, 0.6)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(bPos.x, bPos.y);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  RIDDLE_FRAGMENTS.forEach(frag => {
    const p = imagePercentToScreen(frag.x, frag.y);
    ctx.strokeStyle = 'rgba(0, 190, 255, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#00b4ff';
    ctx.font = 'bold 9px Consolas, Monaco, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`RIDDLE ${frag.id}`, p.x, p.y - 10);
  });
  ctx.restore();
}

function updateDebugOverlay() {
  const overlay = document.getElementById('debug-overlay');
  if (!overlay) return;
  overlay.style.display = DEBUG_MODE ? 'block' : 'none';

  if (!DEBUG_MODE) return;
  const dimEl = document.getElementById('debug-dim');
  const transEl = document.getElementById('debug-transform');
  if (dimEl) dimEl.textContent = `${transform.sourceWidth} x ${transform.sourceHeight}`;
  if (transEl) transEl.textContent = `${transform.scale.toFixed(3)}x | off: (${Math.round(transform.offsetX)}, ${Math.round(transform.offsetY)})`;
}

// ============================================================================

// 11. CINEMATIC FX & STATE MACHINE
// ============================================================================

const CinematicFX = {
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),
  get layer() { return document.getElementById('cinematic-layer'); },
  get text() { return document.getElementById('cinematic-text'); },
  
  showBlack: () => {
    CinematicFX.layer.style.display = 'flex';
    CinematicFX.layer.style.backgroundColor = '#000000';
    CinematicFX.text.innerText = '';
    CinematicFX.text.style.opacity = '0';
    CinematicFX.text.className = 'cinematic-text';
  },

  hideLayer: () => {
    CinematicFX.layer.style.backgroundColor = 'transparent';
    CinematicFX.layer.style.pointerEvents = 'none';
    CinematicFX.text.style.opacity = '0';
    setTimeout(() => { CinematicFX.layer.style.display = 'none'; }, 500);
  },

  playIntro: async () => {
    CinematicFX.showBlack();
    CinematicFX.text.innerText = 'SYSTEM OVERRIDE INITIATED...';
    CinematicFX.text.style.color = '#ff3c3c';
    CinematicFX.text.classList.add('fragmented');
    CinematicFX.text.style.opacity = '1';
    
    await CinematicFX.sleep(1000);
    
    // Bright red flash
    CinematicFX.layer.style.backgroundColor = '#ff0000';
    await CinematicFX.sleep(50);
    CinematicFX.layer.style.backgroundColor = '#000000';
    
    CinematicFX.text.innerText = 'BLACK MARKET';
    CinematicFX.text.style.fontSize = '32px';
    CinematicFX.text.classList.remove('fragmented');
    CinematicFX.text.classList.add('glitch-major');
    
    await CinematicFX.sleep(1500);
    
    CinematicFX.text.innerText = 'INITIALIZING TERMINAL...';
    CinematicFX.text.style.fontSize = '18px';
    CinematicFX.text.classList.remove('glitch-major');
    CinematicFX.text.classList.add('glitch-micro');
    
    await CinematicFX.sleep(800);
    
    CinematicFX.text.style.opacity = '0';
    await CinematicFX.sleep(400);
    CinematicFX.hideLayer();
  },

  playDeath: async () => {
    CinematicFX.showBlack();
    CinematicFX.layer.style.backgroundColor = 'rgba(0,0,0,0.9)';
    await CinematicFX.sleep(1000);
    
    CinematicFX.layer.style.backgroundColor = '#000000';
    CinematicFX.text.innerText = "Death can be the greatest opportunity of your life.";
    CinematicFX.text.style.fontSize = '16px';
    CinematicFX.text.classList.add('fragmented');
    CinematicFX.text.style.opacity = '0.4';
    
    await CinematicFX.sleep(500);
    CinematicFX.text.classList.remove('fragmented');
    CinematicFX.text.classList.add('glitch-micro');
    CinematicFX.text.style.opacity = '1';
    
    await CinematicFX.sleep(200);
    CinematicFX.text.classList.remove('glitch-micro');
    
    await CinematicFX.sleep(2500);
    CinematicFX.text.classList.add('glitch-medium');
    await CinematicFX.sleep(300);
    CinematicFX.text.style.opacity = '0';
    await CinematicFX.sleep(500);
    
    CinematicFX.hideLayer();
  },

  playResurrection: async () => {
    CinematicFX.showBlack();
    await CinematicFX.sleep(500);
    
    CinematicFX.text.innerText = "I'm offering you resurrection, a second life.";
    CinematicFX.text.style.fontSize = '18px';
    CinematicFX.text.classList.add('fragmented');
    CinematicFX.text.style.opacity = '0.3';
    
    await CinematicFX.sleep(400);
    CinematicFX.text.classList.remove('fragmented');
    CinematicFX.text.style.opacity = '1';
    
    await CinematicFX.sleep(2000);
    CinematicFX.text.classList.add('glitch-major');
    
    await CinematicFX.sleep(400);
    CinematicFX.text.style.opacity = '0';
    await CinematicFX.sleep(800);
    
    CinematicFX.hideLayer();
  },

  playAccessGranted: async () => {
    CinematicFX.showBlack();
    CinematicFX.layer.style.backgroundColor = 'rgba(10,0,0,0.9)';
    CinematicFX.layer.classList.add('scan-sweep');
    
    CinematicFX.text.innerText = "ACCESS GRANTED";
    CinematicFX.text.style.color = "#00ffaa";
    CinematicFX.text.style.fontSize = '24px';
    CinematicFX.text.style.opacity = '1';
    
    await CinematicFX.sleep(2000);
    CinematicFX.hideLayer();
  }
};

const appState = {
  mode: 'init', // init, intro, puzzle, dying, dead, password, success
  fuel: 0,
  maxFuel: 0,
  targetRadius: 160
};

let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsUpdateTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const deltaMs = now - lastFrameTime;
  lastFrameTime = now;
  const timeSec = now * 0.001;

  frameCount++;
  if (now - lastFpsUpdateTime > 500) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
    frameCount = 0;
    lastFpsUpdateTime = now;
    if (DEBUG_MODE) {
      const fpsEl = document.getElementById('debug-fps');
      if (fpsEl) fpsEl.textContent = `${fps} FPS`;
    }
  }

  if (DEBUG_MODE) {
    const dm = document.getElementById('debug-money');
    const df = document.getElementById('debug-fuel');
    const dd = document.getElementById('debug-duration');
    const dr = document.getElementById('debug-radius');
    
    if (dm) dm.textContent = `₹${playerMoney}`;
    if (df) df.textContent = `${appState.maxFuel > 0 ? ((appState.fuel / appState.maxFuel)*100).toFixed(1) : 0}%`;
    if (dd) dd.textContent = `${appState.fuel.toFixed(1)}s / ${appState.maxFuel.toFixed(1)}s`;
    if (dr) dr.textContent = `${torch.baseRadius.toFixed(1)}px (Max: ${appState.targetRadius.toFixed(1)}px)`;

    const dnums = document.getElementById('debug-numbers');
    const dsum = document.getElementById('debug-sum');
    const dbinary = document.getElementById('debug-binary');
    if (dnums) dnums.textContent = NUMBER_CLUES.map(c => c.value).join(', ');
    if (dsum) dsum.textContent = NUMBER_SUM.toString();
    if (dbinary) dbinary.textContent = FINAL_PASSWORD;
  }

  const dpr = transform.dpr || 1;
  const viewW = transform.viewportWidth;
  const viewH = transform.viewportHeight;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);

  if (!isLoaded || appState.mode === 'init' || appState.mode === 'intro' || appState.mode === 'dead' || appState.mode === 'success') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, viewW, viewH);
    return;
  }

  // PUZZLE MODE
  if (appState.mode === 'puzzle' || appState.mode === 'dying') {
    appState.fuel -= deltaMs / 1000;
    if (appState.fuel < 0) appState.fuel = 0;

    const ratio = appState.maxFuel > 0 ? (appState.fuel / appState.maxFuel) : 0;
    
    // Update timer in HUD
    const timeDisplay = document.getElementById('hud-time-display');
    if (timeDisplay) {
        const totalSeconds = Math.max(0, Math.ceil(appState.fuel));
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        const timeStr = `${m}:${s}`;
        
        if (timeDisplay.innerText !== timeStr) {
            timeDisplay.innerText = timeStr;
            if (ratio < 0.2) {
                timeDisplay.classList.remove('glitch-micro');
                void timeDisplay.offsetWidth;
                timeDisplay.classList.add('glitch-micro');
            } else {
                timeDisplay.classList.remove('glitch-micro');
            }
        }
    }
    
    const smooth = ratio * ratio * (3 - 2 * ratio);
    const mult = 0.45 + 0.55 * smooth;
    
    let finalRadius = appState.targetRadius * mult;
    let alpha = 1.0;
    
    if (ratio < 0.7) {
      alpha = 0.4 + (ratio / 0.7) * 0.6;
    }
    
    // Death flicker sequence
    if (ratio < 0.15) {
      const flickerStr = (0.15 - ratio) / 0.15;
      if (Math.random() < 0.5 * flickerStr) {
        finalRadius *= (1.0 - Math.random() * 0.4 * flickerStr);
        alpha -= Math.random() * 0.6 * flickerStr;
      }
    }
    
    torch.baseRadius = finalRadius;
    torch.alpha = Math.max(0, alpha);

    // Check if dead
    if (appState.fuel <= 0 && appState.mode === 'puzzle') {
      appState.mode = 'dying';
      triggerDeathSequence();
    }
  }

  updateTorchGeometry(timeSec);

  // If fuel is 0 and dying, torch might just be black
  if (appState.fuel <= 0) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, viewW, viewH);
    if (DEBUG_MODE) drawDebugCalibration(ctx);
    return;
  }

  // Draw Full Color Scene
  ctx.drawImage(
    normalImage,
    transform.offsetX,
    transform.offsetY,
    transform.renderedWidth,
    transform.renderedHeight
  );

  // Draw Clues (masked by torch)
  NUMBER_CLUES.forEach((clue, index) => {
    drawDecimalClue(ctx, clue, numberStates[index]);
  });

  // Torch Mask
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(25px)';
  const tAlpha = torch.alpha !== undefined ? torch.alpha : 1.0;
  ctx.fillStyle = `rgba(255, 255, 255, ${tAlpha})`;
  
  traceTorchPath(ctx);
  ctx.fill();
  
  ctx.filter = 'none';

  // Fill background
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#000000'; 
  ctx.fillRect(0, 0, viewW, viewH);

  // Reset for next frame
  ctx.globalCompositeOperation = 'source-over';

  if (DEBUG_MODE) {
    drawDebugCalibration(ctx);
  }
}

requestAnimationFrame(animate);
handleResize();

// ============================================================================
// 12. DOM LISTENERS & GAME LOGIC
// ============================================================================

function updateFundsDisplay() {
  const hubFunds = document.getElementById('hub-funds');
  const resFunds = document.getElementById('resurrection-funds');
  const investFunds = document.getElementById('invest-funds');
  const hudMoney = document.getElementById('hud-money-display');
  
  const text = `${BLACK_MARKET_CONFIG.currencySymbol}${playerMoney}`;
  if (hubFunds) hubFunds.innerText = text;
  if (resFunds) resFunds.innerText = text;
  if (investFunds) investFunds.innerText = text;
  if (hudMoney) hudMoney.innerText = text;
}

async function triggerDeathSequence() {
  const hud = document.getElementById('hud-container');
  const pwd = document.getElementById('password-trigger-new');
  const rid = document.getElementById('btn-riddle');
  if (hud) hud.style.display = 'none';
  if (pwd) pwd.style.display = 'none';
  if (rid) rid.style.display = 'none';
  
  await CinematicFX.playDeath();
  
  appState.mode = 'dead';
  const resScreen = document.getElementById('resurrection-screen');
  if (resScreen) resScreen.style.display = 'block';
}

let marketplace;

document.addEventListener('DOMContentLoaded', async () => {
  const currentTeam = TeamService.getCurrentTeam();
  const state = await TeamService.getTeamState(currentTeam);
  playerMoney = state.money;
  
  const hudTeam = document.getElementById('hud-team-display');
  if (hudTeam) hudTeam.innerText = currentTeam.replace('_', ' ');
  
  marketplace = new Marketplace();
  updateFundsDisplay();

  // If already unlocked, show hub directly
  if (state.blackMarketUnlocked) {
      const cinLayer = document.getElementById('cinematic-layer');
      if (cinLayer) cinLayer.style.display = 'none';
      document.getElementById('scene-container').style.display = 'none';
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.style.display = 'none';
      const hub = document.getElementById('black-market-hub');
      if (hub) hub.style.display = 'flex';
      appState.mode = 'success';
      return;
  }

  // START INITIAL INTRO
  appState.mode = 'intro';
  await CinematicFX.playIntro();
  
  // Wait for initial invest instead of going straight to puzzle
  appState.mode = 'invest';
  const investScreen = document.getElementById('invest-screen');
  if (investScreen) investScreen.style.display = 'block';

  // INVEST LOGIC (Initial Entry)
  const btnInvest = document.getElementById('btn-invest');
  if (btnInvest) {
    btnInvest.addEventListener('click', async () => {
      const amount = parseInt(document.getElementById('invest-input').value, 10);
      const errorEl = document.getElementById('invest-error');
      
      if (isNaN(amount) || amount < 0) {
        errorEl.innerText = "INVALID FUNDS.";
        return;
      }
      if (amount < TORCH_CONFIG.minInvestment) {
        errorEl.innerText = `MINIMUM ${BLACK_MARKET_CONFIG.currencySymbol}${TORCH_CONFIG.minInvestment} REQUIRED.`;
        return;
      }
      
      btnInvest.innerText = "PROCESSING...";
      btnInvest.classList.add('processing');
      
      try {
        playerMoney = await TeamService.deductFunds(TeamService.getCurrentTeam(), amount);
        updateFundsDisplay();
      } catch (err) {
        errorEl.innerText = err.message;
        btnInvest.innerText = "[ IGNITE ]";
        btnInvest.classList.remove('processing');
        return;
      }
      
      let t = (amount - TORCH_CONFIG.minInvestment) / (TORCH_CONFIG.maxInvestment - TORCH_CONFIG.minInvestment);
      t = Math.max(0, Math.min(1, t));
      
      const radius = TORCH_CONFIG.minRadius + t * (TORCH_CONFIG.maxRadius - TORCH_CONFIG.minRadius);
      const duration = TORCH_CONFIG.minDuration + t * (TORCH_CONFIG.maxDuration - TORCH_CONFIG.minDuration);
      
      appState.fuel = duration;
      appState.maxFuel = duration;
      appState.targetRadius = radius;
      torch.baseRadius = 1; // Start tiny, then animate in
      
      document.getElementById('invest-screen').style.display = 'none';
      btnInvest.innerText = "[ IGNITE ]";
      btnInvest.classList.remove('processing');
      
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      torch.x = viewW / 2;
      torch.y = viewH / 2;
      torch.targetX = viewW / 2;
      torch.targetY = viewH / 2;
      hasUserMovedMouse = true;
      
      const hud = document.getElementById('hud-container');
      if (hud) hud.style.display = 'flex';
      
      if (BLACK_MARKET_CONFIG.finalCode.enabled) {
        const pwd = document.getElementById('password-trigger-new');
        if (pwd) pwd.style.display = 'block';
      }
      if (BLACK_MARKET_CONFIG.riddle.enabled) {
        const rid = document.getElementById('btn-riddle');
        if (rid) rid.style.display = 'block';
      }
      
      appState.mode = 'puzzle';
    });
  }

  // RESURRECTION LOGIC
  const btnResurrect = document.getElementById('btn-resurrect');
  if (btnResurrect) {
    btnResurrect.addEventListener('click', async () => {
      const amount = parseInt(document.getElementById('resurrection-input').value, 10);
      const errorEl = document.getElementById('resurrection-error');
      
      if (isNaN(amount) || amount < 0) {
        errorEl.innerText = "INVALID FUNDS.";
        return;
      }
      if (amount < TORCH_CONFIG.minInvestment) {
        errorEl.innerText = `MINIMUM ${BLACK_MARKET_CONFIG.currencySymbol}${TORCH_CONFIG.minInvestment} REQUIRED.`;
        return;
      }
      
      btnResurrect.innerText = "PROCESSING...";
      btnResurrect.classList.add('processing');
      
      try {
        playerMoney = await TeamService.deductFunds(TeamService.getCurrentTeam(), amount);
        updateFundsDisplay();
      } catch (err) {
        errorEl.innerText = err.message;
        btnResurrect.innerText = "[ RESURRECT ]";
        btnResurrect.classList.remove('processing');
        return;
      }
      
      let t = (amount - TORCH_CONFIG.minInvestment) / (TORCH_CONFIG.maxInvestment - TORCH_CONFIG.minInvestment);
      t = Math.max(0, Math.min(1, t));
      
      const radius = TORCH_CONFIG.minRadius + t * (TORCH_CONFIG.maxRadius - TORCH_CONFIG.minRadius);
      const duration = TORCH_CONFIG.minDuration + t * (TORCH_CONFIG.maxDuration - TORCH_CONFIG.minDuration);
      
      appState.fuel = duration;
      appState.maxFuel = duration;
      appState.targetRadius = radius;
      torch.baseRadius = 1; // start tiny for resurrection animation
      
      document.getElementById('resurrection-screen').style.display = 'none';
      btnResurrect.innerText = "[ RESURRECT ]";
      btnResurrect.classList.remove('processing');
      
      await CinematicFX.playResurrection();
      
      appState.mode = 'puzzle';
      const hud = document.getElementById('hud-container');
      if (hud) hud.style.display = 'flex';
      
      const pwd = document.getElementById('password-trigger-new');
      if (pwd) pwd.style.display = 'block';
      
      const rid = document.getElementById('btn-riddle');
      if (rid) rid.style.display = 'block';
    });
  }

  // Password Entry Logic
  const pwdTrigger = document.getElementById('password-trigger-new');
  if (pwdTrigger) {
    pwdTrigger.addEventListener('click', () => {
      document.getElementById('password-screen').style.display = 'block';
      const hud = document.getElementById('hud-container');
      if (hud) hud.style.display = 'none';
      pwdTrigger.style.display = 'none';
      const rid = document.getElementById('btn-riddle');
      if (rid) rid.style.display = 'none';
      appState.mode = 'password';
      
      const attemptsCount = document.getElementById('code-attempts-count');
      if (attemptsCount && marketplace.teamState) {
          attemptsCount.innerText = marketplace.teamState.codeAttempts.toString().padStart(2, '0');
      }
    });
  }

  const cancelPwd = document.getElementById('btn-cancel-password');
  if (cancelPwd) {
    cancelPwd.addEventListener('click', () => {
      document.getElementById('password-screen').style.display = 'none';
      const hud = document.getElementById('hud-container');
      if (hud) hud.style.display = 'flex';
      const pwd = document.getElementById('password-trigger-new');
      if (pwd) pwd.style.display = 'block';
      if (BLACK_MARKET_CONFIG.riddle.enabled) {
        const rid = document.getElementById('btn-riddle');
        if (rid) rid.style.display = 'block';
      }
      appState.mode = 'puzzle';
    });
  }

  let isSubmitting = false;

  const submitPwd = document.getElementById('btn-submit-password');
  if (submitPwd) {
    submitPwd.addEventListener('click', async () => {
      if (isSubmitting) return;
      
      const input = document.getElementById('password-input').value.trim();
      const msgEl = document.getElementById('password-msg');
      const panel = document.getElementById('password-screen');
      
      if (input === FINAL_PASSWORD) {
        isSubmitting = true;
        msgEl.innerText = "CODE ACCEPTED";
        msgEl.style.color = "#00ffaa";
        document.getElementById('password-input').disabled = true;
        submitPwd.disabled = true;
        document.getElementById('btn-cancel-password').style.display = 'none';
        
        appState.mode = 'success';
        
        const enterMarketplace = () => {
            document.getElementById('scene-container').style.display = 'none';
            document.getElementById('ui-layer').style.display = 'none';
            document.getElementById('password-screen').style.display = 'none';
            document.getElementById('black-market-hub').style.display = 'flex';
            isSubmitting = false;
        };
        
        try {
            const unlockTask = TeamService.unlockBlackMarket(TeamService.getCurrentTeam());
            await Promise.all([
                unlockTask,
                CinematicFX.playAccessGranted()
            ]);
            marketplace.teamState = await TeamService.getTeamState(TeamService.getCurrentTeam());
        } catch (error) {
            console.error("[BLACK MARKET] Unlock animation or save failed:", error);
        } finally {
            enterMarketplace();
        }

      } else {
        msgEl.innerText = "ACCESS DENIED";
        panel.classList.remove('glitch-error');
        void panel.offsetWidth;
        panel.classList.add('glitch-error');
        
        try {
            const newAttempts = await TeamService.recordCodeAttempt(TeamService.getCurrentTeam());
            document.getElementById('code-attempts-count').innerText = newAttempts.toString().padStart(2, '0');
        } catch (err) {
            console.error("[BLACK MARKET] Failed to record code attempt", err);
        }
      }
    });
  }

  // Riddle Logic
  if (BLACK_MARKET_CONFIG.riddle.enabled) {
    const riddleText = document.getElementById('riddle-content-text');
    if (riddleText) riddleText.innerHTML = BLACK_MARKET_CONFIG.riddle.text;
  }
  
  const btnRiddle = document.getElementById('btn-riddle');
  if (btnRiddle) {
    btnRiddle.addEventListener('click', () => {
      document.getElementById('riddle-screen').style.display = 'block';
      const hud = document.getElementById('hud-container');
      if (hud) hud.style.display = 'none';
      const pwd = document.getElementById('password-trigger-new');
      if (pwd) pwd.style.display = 'none';
      btnRiddle.style.display = 'none';
      appState.mode = 'riddle';
    });
  }
  
  const closeRiddle = document.getElementById('btn-close-riddle');
  if (closeRiddle) {
    closeRiddle.addEventListener('click', () => {
      document.getElementById('riddle-screen').style.display = 'none';
      const hud = document.getElementById('hud-container');
      if (hud) hud.style.display = 'flex';
      const pwd = document.getElementById('password-trigger-new');
      if (pwd) pwd.style.display = 'block';
      const rid = document.getElementById('btn-riddle');
      if (rid) rid.style.display = 'block';
      appState.mode = 'puzzle';
    });
  }

});

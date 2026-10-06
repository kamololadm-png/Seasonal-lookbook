/* ===========================================================================
   LANDING GATE
   A dot field that reacts to the cursor, a 3D box that follows it, and a click
   that opens the lid, pops the look book out and wipes into the page.
   script.js waits on window.GATE_READY before it starts its intro.
   =========================================================================== */
(() => {
  const gate = document.getElementById('gate');
  if (!gate) { window.GATE_READY = Promise.resolve(); return; }

  let release; window.GATE_READY = new Promise(r => (release = r));

  const G = {
    spacing: 26,        // dot grid pitch, px
    dot: 1.1,           // resting dot radius
    haloRadius: 190,    // cursor influence, px
    push: 20,           // how far dots flee the cursor
    swell: 3.2,         // how much dots grow near the cursor
    waveSpeed: 1.5,     // shockwave px/ms
    waveWidth: 80,
    tiltX: 10, tiltY: 20,
    openMs: 900,        // click -> wipe starts
  };

  const cv = document.getElementById('gate-fx');
  const ctx = cv.getContext('2d');
  const box = document.getElementById('gate-box');
  const tilt = box.querySelector('.tilt');
  let W, H, DPR, dots = [];
  let mx = -9999, my = -9999, nx = 0, ny = 0;
  let rx = -20, ry = -28, baseX = -20, baseY = -28;
  let shock = null, opened = false, raf, alive = true;

  const ink = '13,13,13';

  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dots = [];
    for (let y = G.spacing / 2; y < H; y += G.spacing)
      for (let x = G.spacing / 2; x < W; x += G.spacing) dots.push(x, y);
  }

  addEventListener('resize', size);
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    nx = (mx / W) * 2 - 1; ny = (my / H) * 2 - 1;
  });

  function frame(now) {
    if (!alive) return;
    ctx.clearRect(0, 0, W, H);

    const R = G.haloRadius, t = now / 1000;
    const ring = shock ? (now - shock.t) * G.waveSpeed : -1;
    const ww = G.waveWidth;

    ctx.fillStyle = `rgba(${ink},.55)`;
    ctx.beginPath();
    for (let i = 0; i < dots.length; i += 2) {
      let x = dots[i], y = dots[i + 1];
      let r = G.dot + 0.35 * Math.sin(t * 1.4 + x * .012 + y * .01);

      let dx = x - mx, dy = y - my, d = Math.hypot(dx, dy);
      if (d < R) {
        const k = Math.pow(1 - d / R, 2);
        x += (dx / (d || 1)) * k * G.push;
        y += (dy / (d || 1)) * k * G.push;
        r += k * G.swell;
      }
      if (shock) {
        const sx = x - shock.x, sy = y - shock.y, sd = Math.hypot(sx, sy);
        const w = Math.exp(-Math.pow((sd - ring) / ww, 2));
        x += (sx / (sd || 1)) * w * 34;
        y += (sy / (sd || 1)) * w * 34;
        r += w * 4.5;
      }
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 6.2832);
    }
    ctx.fill();

    // box follows the cursor, drifts when idle
    const tx = baseX - ny * G.tiltX, ty = baseY + nx * G.tiltY;
    rx += (tx - rx) * .06; ry += (ty - ry) * .06;
    const bob = Math.sin(t * 1.2) * 6;
    tilt.style.transform = `translateY(${bob}px) rotateX(${rx}deg) rotateY(${ry}deg)`;

    raf = requestAnimationFrame(frame);
  }

  function open() {
    if (opened) return;
    opened = true;
    gate.classList.add('open');
    const r = box.getBoundingClientRect();
    shock = { x: r.left + r.width / 2, y: r.top + r.height / 2, t: performance.now() };
    baseX = -8; baseY = 0;                        // square up to face the viewer

    setTimeout(() => {
      gate.classList.add('leaving');              // wipe upward
      release();                                  // look book starts building underneath
    }, G.openMs);

    setTimeout(() => {                            // clean up
      alive = false; cancelAnimationFrame(raf); gate.remove();
    }, G.openMs + 1700);
  }

  gate.addEventListener('click', open);
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  size();
  mx = W / 2; my = H / 2;
  raf = requestAnimationFrame(frame);
  box.focus({ preventScroll: true });
})();


/* ===========================================================================
   SETTINGS
   Everything worth tuning lives here and nowhere else.
   =========================================================================== */

const CFG = {
  // Durations, ms.
  time: {
    morph: 1300,
    mask: 1200,
    card: 1500,
    capSwap: 700,
    capFade: 350,
    capClean: 1500,
    scrollLead: 1300,     // scroll columns leave before everything else
    largeEntry: 150,
    beast: 700,
    animWatch: 2800,      // how long the parallax loop stays awake after a transition

    // Deliberate offsets, not completion waits. Completion is caught by
    // transitionend instead of being calculated — see whenDone().
    capEnter: 400,
    capNudge: 50,
    capSwapAt: 0.7,       // fraction of the move after which a caption swaps text
    resizeSettle: 80,
    textGuard: 1500,
    introFallback: 2000,  // don't wait on the network longer than this
  },

  // Stagger. Seconds for animation delays, ms for queues.
  stagger: {
    col: 0.02,            // morph, by column distance from the large card
    swapCol: 0.02,
    swap: 0.03,           // mirror switch, by column index
    swapMax: 0.20,
    card: 0.10,
    cardMax: 0.35,
    cover: 0.06,
    coverMax: 0.45,
    line: 60,
    capLine: 45,
  },

  // Navigation lock. Its length is not a fixed number — each transition
  // reports how long it will take, because a shorter lock let the next
  // click cut a clip-path animation in half.
  lock: {
    min: 700,
    tail: 60,
  },

  // Grid and ratios. gap and capAllow are vw, exitPad is px.
  grid: {
    gap: 1.3,
    capAllow: 4,
    ratioW: 2.35,         // small card proportion
    ratioH: 3,
    exitPad: 120,
  },

  // Column scroll runs on impulse and friction, not on a position.
  scroll: {
    friction: 0.9,
    wheel: 0.1,
    touch: 0.8,
    minVel: 0.3,
    smooth: 0.15,
    bow: 10,              // how far inertia bows the column edges
    bowMax: 120,
    stretch: 0.0005,      // vertical card stretch from speed
    handoff: 350,
    overlap: 150,         // how far the entry phase reaches into the exit

    revealNew: true,      // cards appearing mid-scroll open with a mask
    newCardMs: 600,
  },

  // Photo swap on gesture.
  cover: {
    step: 50,             // px of gesture per step
    gestureGap: 150,
    // How many overlays to keep. Two is enough: one already fully open as
    // the visible base, one animating. More means more composited layers
    // at once, and that is what causes flicker.
    stack: 2,
    cycle: 5,
  },

  // Cursor reaction. Only the large image of a composition moves.
  parallax: {
    enter: 1.15,          // scale the image settles down from
    amount: 0.04,         // offset amplitude, fraction of size
    follow: 0.03,
    ease: 0.05,
    eps: 0.05,
    falloff: 0.6,         // fraction of the diagonal over which it fades
    floor: 0.2,
  },

  // Shader mode. Everything here is tunable without knowing WebGL.
  shader: {
    key: 'b',
    dprCap: 2,
    samples: 20,          // samples per pixel; the most expensive number here
    hoverRadius: 605,
    centerFade: 200,      // fade right under the cursor
    pullStrength: 0.2,    // smear length
    pullInvert: false,
    threadScale: 10.0,    // noise scale: low = broad streams, high = fine threads
    warpAmount: 0.9,      // 0 = straight smear toward the cursor, higher = chaos
    iridescent: 0.1,
    opacity: 1.3,
    lumaMin: 0.45,        // luma mask bounds: the effect only grabs shadows
    lumaMax: 0.55,
    dither: 1.0,          // dissolves banding from the low sample count
    followLag: 0.0,       // how much the layer trails the cursor, s
    fadeLag: 1.50,        // ramp up and down, s
  },

  // Mask direction, shared by cards and columns.
  mask: { hidden: 'inset(0 0 100% 0)', shown: 'inset(0 0 0 0)' },
};

/* --- Short aliases used by the rest of the file -------------------------- */

const GAP_VW = CFG.grid.gap;
const EXIT_PAD = CFG.grid.exitPad;
const CAP_ALLOW_VW = CFG.grid.capAllow;
const SMALL_RATIO_W = CFG.grid.ratioW;
const SMALL_RATIO_H = CFG.grid.ratioH;
const FALLBACK_RATIO = SMALL_RATIO_W / SMALL_RATIO_H;

const DUR_MS = CFG.time.morph;
const MASK_MS = CFG.time.mask;
const SC_CARD_MS = CFG.time.card;
const CAP_SWAP_MS = CFG.time.capSwap;
const COVER_CAP_MS = CFG.time.capSwap;
const CAP_FADE_MS = CFG.time.capFade;
const CAP_CLEAN_MS = CFG.time.capClean;
const SCROLL_EXIT_LEAD_MS = CFG.time.scrollLead;
const LARGE_ENTRY_DELAY_MS = CFG.time.largeEntry;
const ANIM_WATCH_MS = CFG.time.animWatch;

const COL_STAGGER_S = CFG.stagger.col;
const SWAP_COL_STAGGER_S = CFG.stagger.swapCol;
const SWAP_STAGGER_S = CFG.stagger.swap;
const SWAP_STAGGER_MAX = CFG.stagger.swapMax;
const SC_STAGGER_S = CFG.stagger.card;
const SC_STAGGER_CAP = CFG.stagger.cardMax;
const LINE_STAGGER_MS = CFG.stagger.line;
const CAP_LINE_STAGGER_MS = CFG.stagger.capLine;
const CAP_SLACK_MS = CAP_LINE_STAGGER_MS * 2 + 40;

const MASK_HIDDEN = CFG.mask.hidden;
const MASK_SHOWN = CFG.mask.shown;
const INTRO_LOCK_MS = MASK_MS + SWAP_STAGGER_MAX * 1000 + 100;

const MASK_LOCK_MS = MASK_MS + SWAP_STAGGER_MAX * 1000 + CFG.lock.tail;

const SCROLL_FRICTION = CFG.scroll.friction;

const COVER_STEP_PX = CFG.cover.step;
const COVER_STAGGER_S = CFG.stagger.cover;
const COVER_STAGGER_CAP = CFG.stagger.coverMax;
const COVER_MAX = CFG.cover.stack;
const COVER_GESTURE_GAP = CFG.cover.gestureGap;
const COVER_CYCLE = CFG.cover.cycle;

const ENTER_SCALE = `scale(${CFG.parallax.enter})`;
const REST_SCALE = 'scale(var(--parallax-scale))';

const scStag = idx => Math.min(idx * SC_STAGGER_S, SC_STAGGER_CAP);
const sStag = n => Math.min(n * SWAP_STAGGER_S, SWAP_STAGGER_MAX);

function getVwPx() { return window.innerWidth / 100 }
function getVhPx() { return window.innerHeight / 100 }
let VW_PX = getVwPx();
let VH_PX = getVhPx();
const vw = x => Math.round(x * VW_PX);

document.body.tabIndex = -1;
document.body.focus();

/* ===========================================================================
   DATA
   =========================================================================== */


// The list now lives in index.html (#looks). Same shape as before, so the
// rest of the file is unchanged.
const ITEMS = [...document.querySelectorAll('#looks [data-id]')].map(el => ({
  id: el.dataset.id,
  client: el.dataset.client,
  type: el.dataset.type,
  bg: `url(${el.dataset.img})`,
}));

// image for the stand-in of the large slide
const S2 = `url(${document.getElementById('hero-src').dataset.img})`;

const ITEMS_BY_ID = {};
for (const it of ITEMS) ITEMS_BY_ID[it.id] = it;

/* --- Captions ------------------------------------------------------------ */


const CAPS = {};   // every caption falls back to the look number and style from ITEMS

// fall back along the chain when a card has no caption for the variant
const CAP_CHAIN = {
  small:  ['small'],
  large:  ['large', 'small'],
  wide:   ['wide', 'large', 'small'],
  scroll: ['scroll'],
};

/* --- Compositions --------------------------------------------------------
   Column width: a number is fixed vw, 'ratio' comes from the card
   proportion, 'eq' / 'auto' share what is left. A card's vertical anchor
   is the y field.                                                          */

const BASE_LAYOUTS = {
  '1': {
    large: 'A', caps: false, bg: '50% 18%', ratioImgH: 10.5, cols: [
      { w: 40, items: [{ id: 'A', y: 'fullTall', size: 'cover', pos: '50% 0%' }] },
      { w: 'eq', items: [] },
      { w: 'ratio', items: [{ id: 'B', y: 'top' }, { id: 'F', y: 'bottom' }] },
      { w: 'ratio', items: [{ id: 'C', y: 'top' }, { id: 'G', y: 'bottom' }] },
      { w: 'ratio', items: [{ id: 'D', y: 'top' }, { id: 'H', y: 'bottom' }] },
      { w: 'ratio', items: [{ id: 'E', y: 'top' }, { id: 'I', y: 'bottom' }] },
      { w: 'eq', items: [] },
    ],
  },

  '2': {
    large: 'A', caps: false, bg: '50% 18%', fitStack: true, cols: [
      { w: 40, items: [{ id: 'A', y: 'full', size: 'cover', pos: '50% 0%' }] },
      { w: 23.3, items: [] },
      { w: 15, items: [{ id: 'D', y: 'bStackTop' }, { id: 'H', y: 'bStackBottom' }] },
      { w: 15, items: [{ id: 'E', y: 'bStackTop' }, { id: 'I', y: 'bStackBottom' }] },
    ],
  },

  '3': {
    large: 'H', caps: false, bg: '50% 18%', fitStack: true, scroll: true, scrollCols: [2, 3], cols: [
      { w: 40, items: [{ id: 'H', y: 'full', imgH: 'fill', cap: 'bottom', size: 'cover', pos: '50% 55%' }] },
      { w: 14.6, items: [] },
      { w: 14.6, items: [] },
      { w: 15, items: [] },
      { w: 'auto', items: [] },
    ],
  },

  '4': {
    large: 'F', caps: false, bg: '50% 18%', capVariant: 'wide', cols: [
      { w: 40, items: [{ id: 'F', y: 'full', imgH: { pct: 100 }, cap: 'bottom', size: 'cover', pos: '50% 30%' }] },
      { w: 33.3, items: [{ id: 'H', y: 'baseTop', imgH: { pct: 80 }, cap: 'below', size: 'cover', pos: '50% 40%' }] },
      { w: 'auto', items: [{ id: 'E', y: 'baseTop', imgH: { pct: 60 }, cap: 'below', size: 'cover', pos: '50% 35%' }] },
    ],
  },

  '5': {
    large: 'K', caps: false, bg: '50% 18%', scroll: true, scrollCols: [2], scrollGap: true, scrollNoCaps: true, cols: [
      { w: 40, items: [{ id: 'K', y: 'full', cap: 'bottom', size: '130%', pos: '50% 60%' }] },
      { w: 14.6, items: [] },
      { w: 15, items: [] },
      { w: 'auto', items: [] },
    ],
  },
};

/**
 * A mirrored composition is the same one with its columns reversed.
 * Scroll column indices are remapped to the new order and reversed too,
 * so each column keeps the direction it was moving in.
 */
function mirrorOf(L) {
  const n = L.cols.length;
  const out = { ...L, cols: [...L.cols].reverse() };
  if (L.scrollCols) out.scrollCols = L.scrollCols.map(i => n - 1 - i).reverse();
  return out;
}

const LAYOUTS = {};
for (const [id, L] of Object.entries(BASE_LAYOUTS)) {
  LAYOUTS[id] = L;
  LAYOUTS[id + 'm'] = mirrorOf(L);
}

// these lists are derived from the base compositions as well
const withMirrors = ids => ids.flatMap(i => [i, i + 'm']);

const HERO_LAYOUTS = withMirrors(['2']);
const COVER_LAYOUTS = withMirrors(['1', '2', '4']);
const NO_TEXT_LAYOUTS = new Set(withMirrors(['3']));

const PAIRS = Object.keys(BASE_LAYOUTS).map(id => ({ main: id, mirror: id + 'm' }));

const topbarEl = document.querySelector('.topbar');
const titleEl  = document.querySelector('.topbar-title');

/**
 * Pins the title to the inner (right) edge of the large card for a
 * main composition. For a mirrored composition, the title is left
 * untouched wherever it currently is.
 */
function alignTitle(n, animate) {
  const mirrored = String(n).endsWith('m');
  if (mirrored) return; // leave title in place

  const L = LAYOUTS[n];
  if (!L) return;
  const r = computeRects(n)[L.large];
  if (!r) return;
  const barLeft = topbarEl.getBoundingClientRect().left;
  const canvasLeft = canvas.getBoundingClientRect().left;
  const edgeX = canvasLeft + r.left + r.width;
  const x = edgeX - barLeft - titleEl.offsetWidth;
  if (!animate) titleEl.style.transition = 'none';
  titleEl.style.setProperty('--title-x', Math.round(x) + 'px');
  if (!animate) { titleEl.getBoundingClientRect(); titleEl.style.transition = ''; }
}

/* ===========================================================================
   CAPTIONS
   =========================================================================== */

function capVariant(n, isLarge) {
  return LAYOUTS[n].capVariant || (isLarge ? 'large' : 'small');
}

function capData(id, variant) {
  const src = CAPS[id] || {};
  for (const key of (CAP_CHAIN[variant] || ['small'])) {
    if (src[key]) return src[key];
  }
  const it = ITEMS_BY_ID[id];
  if (variant === 'scroll') {
    return { l: 'look:<br>style:', r: it ? (it.client + '<br>' + it.type).toLowerCase() : '' };
  }
  return { l: 'LOOK:<br>STYLE:', r: it ? (it.client + '<br>' + it.type) : '' };
}

function capColHTML(html, extraCls) {
  const lines = String(html == null ? '' : html).split(/<br\s*\/?>/i);
  return `<span class="t-col${extraCls ? ' ' + extraCls : ''}">`
    + lines.map(l => `<span class="t-mask"><span class="t-text">${l}</span></span>`).join('')
    + `</span>`;
}

function capHTML(d) {
  return capColHTML(d.l) + capColHTML(d.r, 'r');
}

function applyCapText(el, variant) {
  const srcId = el._capSrcId || el.dataset.id;
  const key = variant + '|' + srcId;
  if (el._capKey === key) return false;
  el._capKey = key;
  el._capVariant = variant;
  el.querySelector('.cap').innerHTML = capHTML(capData(srcId, variant));
  return true;
}

function setCapDelay(cap, baseSec, dirUp) {
  if (!cap) return;
  const base = parseFloat(baseSec) || 0;
  cap.querySelectorAll('.t-col').forEach(col => {
    const lines = col.querySelectorAll('.t-text');
    lines.forEach((t, i) => {
      const k = dirUp ? (lines.length - 1 - i) : i;
      t.style.animationDelay = (base + k * CAP_LINE_STAGGER_MS / 1000) + 's';
    });
  });
}

function capShow(cap, { delay = 0, dur, dirUp = false } = {}) {
  if (!cap || cap.classList.contains('show')) return;
  cap.classList.toggle('cover-swap', dur === CAP_SWAP_MS);
  cap.classList.toggle('dir-up', dirUp);
  setCapDelay(cap, delay, dirUp);
  cap.classList.remove('hide');
  cap.classList.add('show');
}

function capHide(cap, { delay = 0, dur, dirUp = false } = {}) {
  if (!cap || !cap.classList.contains('show')) return;
  cap.classList.toggle('cover-swap', dur === CAP_SWAP_MS);
  cap.classList.toggle('dir-up', dirUp);
  setCapDelay(cap, delay, dirUp);
  cap.classList.remove('show');
  cap.classList.add('hide');
}

function capReset(cap) {
  if (!cap) return;
  cap.classList.remove('show', 'hide', 'cover-swap', 'dir-up');
  setCapDelay(cap, 0, false);
}

/* ===========================================================================
   BUILDING THE DOM
   =========================================================================== */

const canvas = document.getElementById('canvas');
const els = {};
let current = 1;

/* Markup that used to be duplicated in the HTML. Declared once here and
   cloned as needed. A <template> with the same id in the HTML wins. */

const ARROW_PREV = '<svg width="15" height="11" viewBox="0 0 15 11" fill="none"><path d="M7.97424 11L4.16276 6.55357H15V4.44643H4.16276L7.97424 0H4.81265L0 5.5L4.81265 11H7.97424Z" fill="currentColor"/></svg>';
const ARROW_NEXT = '<svg width="15" height="11" viewBox="0 0 15 11" fill="none"><path d="M7.02576 11L10.8372 6.55357H0V4.44643H10.8372L7.02576 0H10.1874L15 5.5L10.1874 11H7.02576Z" fill="currentColor"/></svg>';

const ARROWS_HTML = `<div class="svg-arrows">
  <button type="button" class="svg-arrow-wrapper nav-btn is--prev" aria-label="Previous image">
    <span class="svg-arrow original">${ARROW_PREV}</span>
    <span class="svg-arrow duplicate">${ARROW_PREV}</span>
  </button>
  <button type="button" class="svg-arrow-wrapper nav-btn is--next" aria-label="Next image">
    <span class="svg-arrow original">${ARROW_NEXT}</span>
    <span class="svg-arrow duplicate">${ARROW_NEXT}</span>
  </button>
</div>`;

const CUTOUT_HTML = `<svg class="top-svg" width="604" height="160" viewBox="0 0 604 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" fill="var(--bg, #FFFDF3)" d="M0 0H603.27V160H0Z M145.27 79.77Q145.27 102.07 131.92 116.9Q118.57 131.73 94.76 135.68Q98.04 143.51 103.97 146.99Q109.9 150.47 120.6 150.47Q126.28 150.47 132.07 149.68L131.87 165.66Q119.73 167.87 108.55 167.87Q92.83 167.87 82.52 160.68Q72.2 153.48 65.94 136.79Q38.46 134.66 23.28 119.59Q8.1 104.52 8.1 79.77Q8.1 52.95 26.22 37.93Q44.34 22.9 76.64 22.9Q108.93 22.9 127.1 38.08Q145.27 53.27 145.27 79.77ZM116.26 79.77Q116.26 61.73 105.85 51.49Q95.44 41.25 76.64 41.25Q57.55 41.25 47.14 51.41Q36.73 61.57 36.73 79.77Q36.73 98.12 47.33 108.71Q57.94 119.31 76.45 119.31Q95.53 119.31 105.9 109.03Q116.26 98.75 116.26 79.77ZM223.26 137.58Q195.21 137.58 180.32 126.35Q165.42 115.12 165.42 94.24V24.56H193.86V92.42Q193.86 105.63 201.52 112.47Q209.19 119.31 224.03 119.31Q239.26 119.31 247.46 112.15Q255.65 105 255.65 91.63V24.56H284.09V93.05Q284.09 114.25 268.14 125.92Q252.18 137.58 223.26 137.58ZM309.35 136V24.56H337.78V136ZM364.2 136V24.56H471.01V42.59H392.64V70.59H465.13V88.62H392.64V117.97H474.96V136ZM557.19 42.59V136H528.75V42.59H484.89V24.56H601.15V42.59Z"/>
</svg>`;

function makeTpl(id, html) {
  const found = document.getElementById(id);
  if (found && found.content) return found;
  const t = document.createElement('template');
  t.innerHTML = html;
  return t;
}

const arrowsTpl = makeTpl('arrows-tpl', ARROWS_HTML);
const cutoutTpl = makeTpl('cutout-tpl', CUTOUT_HTML);

/** Drops the arrow markup into every empty .svg-slot. */
function fillArrows() {
  document.querySelectorAll('.text-wrapper--main [data-arrows]').forEach(slot => {
    const mask = document.createElement('div');
    mask.className = 't-mask';
    const text = document.createElement('div');
    text.className = 't-text';
    text.appendChild(arrowsTpl.content.cloneNode(true));
    mask.appendChild(text);
    slot.appendChild(mask);
  });
}

/**
 * The mirrored text layer is a clone of the main one with its sides
 * flipped. There is no second set of lines — it is the same text.
 */
function buildMirror() {
  const main = document.querySelector('.text-wrapper--main');
  const mirror = main.cloneNode(true);
  mirror.classList.remove('text-wrapper--main');
  mirror.classList.add('text-wrapper--mirror');

  mirror.querySelectorAll('.visibility').forEach(el => {
    // is--2 → is--2m
    for (const cls of [...el.classList]) {
      if (/^is--\d+$/.test(cls)) {
        el.classList.remove(cls);
        el.classList.add(cls + 'm');
      }
    }

    const s = el.style;
    s.justifySelf = s.justifySelf === 'end' ? 'start' : 'end';
    s.textAlign = s.justifySelf === 'end' ? 'right' : '';

    const ml = s.marginLeft, mr = s.marginRight;
    s.marginLeft = mr || '';
    s.marginRight = ml || '';

    const l = s.left, r = s.right;
    s.left = r || '';
    s.right = l || '';
  });

  main.after(mirror);
}

/** Splits <br> lines into separate masks so they can enter in sequence. */
function initTextSplitting() {
  document.querySelectorAll('.text-wrapper .visibility').forEach(el => {
    const originalMask = el.querySelector('.t-mask');
    const originalText = el.querySelector('.t-text');
    if (!originalMask || !originalText) return;

    const html = originalText.innerHTML;
    if (!/<br\s*\/?>/i.test(html)) return;

    const lines = html.split(/<br\s*\/?>/i);
    const frag = document.createDocumentFragment();

    lines.forEach((lineHtml, i) => {
      const mask = document.createElement('div');
      mask.className = 't-mask';
      const text = document.createElement('div');
      text.className = 't-text';
      text.innerHTML = lineHtml;
      mask.appendChild(text);
      frag.appendChild(mask);
      if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
    });

    originalMask.replaceWith(frag);
  });
}

fillArrows();
buildMirror();
initTextSplitting();

/* --- Cards --------------------------------------------------------------- */

for (const it of ITEMS) {
  const el = document.createElement('div');
  el.className = 'item';
  el.dataset.id = it.id;

  el._capSrcId = it.id;
  el._capRectVariant = 'small';
  el._capKey = 'small|' + it.id;

  el.innerHTML = `<div class="img"><div class="p-wrap"><div class="img-inner" style="background-image:${it.bg}"></div></div></div>`;
  el.appendChild(cutoutTpl.content.cloneNode(true));
  el.insertAdjacentHTML('beforeend', `<div class="cap">${capHTML(capData(it.id, 'small'))}</div>`);

  canvas.appendChild(el);
  els[it.id] = el;
}

const hero = document.createElement('div');
hero.className = 'hero2';
hero.innerHTML = `<div class="img"><div class="p-wrap"><div class="img-inner" style="background-image:${S2}; background-size: 68vw; background-position: 80% 57%"></div></div></div>`;
hero.appendChild(cutoutTpl.content.cloneNode(true));
canvas.appendChild(hero);

/* ===========================================================================
   COLUMN SCROLL
   =========================================================================== */

let scrollY = 0;
let scrollRAF = null;
let scrollActive = false;
let currentVelocity = 0;
let smoothVelocity = 0;

const scrollCols = [];
for (let k = 0; k < 2; k++) {
  const c = document.createElement('div');
  c.className = 'scroll-col';
  canvas.appendChild(c);
  scrollCols.push({ el: c, cards: new Map(), colIndex: null, x: 0, w: 0, cardH: 0, period: 0, offset: 0, fieldH: 0, step: 2, base: 0, noCaps: false });
}

function isScrollLayout(x) { return !!(LAYOUTS[x] && LAYOUTS[x].scroll) }

function scrollItemObj(sc, i) {
  const n = ITEMS.length;
  const step = (sc && sc.step != null) ? sc.step : 2;
  const base = (sc && sc.base != null) ? sc.base : 0;
  const idx = (((i * step + base) % n) + n) % n;
  return ITEMS[idx];
}

function layoutColMetrics(n) {
  const L = LAYOUTS[n];
  const CW = canvas.clientWidth;
  const H = canvas.clientHeight;
  const g = vw(GAP_VW);
  const imgHpx = L.ratioImgH ? vw(L.ratioImgH) : 0;

  const colWpx = new Array(L.cols.length);
  const ratioColW = Math.round(imgHpx * FALLBACK_RATIO);
  let usedFixed = 0, flexCount = 0;
  L.cols.forEach((c, i) => {
    if (c.w === 'auto' || c.w === 'eq') { flexCount++; colWpx[i] = null; }
    else if (c.w === 'ratio') { colWpx[i] = ratioColW; usedFixed += ratioColW; }
    else { const w = vw(c.w); colWpx[i] = w; usedFixed += w; }
  });
  const leftover = Math.max(0, CW - usedFixed - g * (L.cols.length - 1));
  const flexW = flexCount ? Math.floor(leftover / flexCount) : 0;
  for (let i = 0; i < colWpx.length; i++) if (colWpx[i] === null) colWpx[i] = flexW;

  const colX = new Array(L.cols.length);
  let x = 0;
  L.cols.forEach((c, i) => { colX[i] = x; x += colWpx[i] + g; });
  return { H, colX, colWpx };
}

function layoutScrollCols(n) {
  const L = LAYOUTS[n];
  if (!L.scroll) return;
  const m = layoutColMetrics(n);
  const cardW = m.colWpx[L.scrollCols[0]];
  const cardH = Math.max(1, Math.round(cardW * SMALL_RATIO_H / SMALL_RATIO_W));
  const gap = vw(GAP_VW);
  const single = (L.scrollGap === true);

  const scNoCaps = !!L.scrollNoCaps;
  const capSpace = scNoCaps ? 0 : vw(CAP_ALLOW_VW);
  const period = single ? (cardH + gap + capSpace) : (cardH * 2);

  const vpTop = canvas.getBoundingClientRect().top;
  const fieldH = window.innerHeight;

  L.scrollCols.forEach((ci, k) => {
    const sc = scrollCols[k];
    sc.colIndex = ci;
    sc.x = m.colX[ci];
    sc.w = m.colWpx[ci];
    sc.cardH = cardH;
    sc.period = period;
    sc.offset = single ? 0 : (k * cardH);
    sc.step = single ? 1 : 2;
    sc.base = single ? 0 : (k * 5);
    sc.noCaps = scNoCaps;
    sc.fieldH = fieldH;
    sc.el.style.left = sc.x + 'px';
    sc.el.style.width = sc.w + 'px';
    sc.el.style.top = (-vpTop) + 'px';
    sc.el.style.height = fieldH + 'px';
  });

  for (let k = L.scrollCols.length; k < scrollCols.length; k++) {
    const sc = scrollCols[k];
    sc.colIndex = null;
    sc.el.classList.remove('on');
    for (const [i, c] of sc.cards) c.remove();
    sc.cards.clear();
  }
  renderScroll(true);
}

function renderScroll(resize) {
  const v = Math.min(Math.abs(smoothVelocity), CFG.scroll.bowMax);
  const sy = Math.round((1 + v * CFG.scroll.stretch) * 1000) / 1000;
  const pinch = Math.round(v * CFG.scroll.bow) / 100;

  scrollCols.forEach((sc, k) => {
    if (sc.colIndex == null) return;
    const H = sc.fieldH || canvas.clientHeight;
    const { period, offset, cardH } = sc;
    const W = sc.w;

    const colDir = (k === 1) ? -1 : 1;
    const colScrollY = scrollY * colDir;

    const first = Math.floor((colScrollY - offset - cardH) / period) - 1;
    const last = Math.ceil((colScrollY - offset + H) / period) + 1;
    const need = new Set();

    // inertia bows the column edges along a cubic curve
    const clipKey = pinch + '|' + W + '|' + H;
    if (sc._clipKey !== clipKey) {
      sc._clipKey = clipKey;
      sc.el.style.clipPath = pinch === 0
        ? 'none'
        : `path('M 0 0 L ${W} 0 C ${W - pinch} ${H * 0.15}, ${W - pinch} ${H * 0.85}, ${W} ${H} L 0 ${H} C ${pinch} ${H * 0.85}, ${pinch} ${H * 0.15}, 0 0 Z')`;
    }

    for (let i = first; i <= last; i++) {
      need.add(i);
      let c = sc.cards.get(i);
      if (!c) {
        const it = scrollItemObj(sc, i);
        c = document.createElement('div');
        c.className = 'scroll-card';
        c.innerHTML =
          `<div class="img"><div class="p-wrap"><div class="sc-inner" style="background-image:${it.bg}"></div></div></div>`
          + `<div class="cap">${capHTML(capData(it.id, 'scroll'))}</div>`;
        c.style.height = cardH + 'px';
        sc.el.appendChild(c);
        sc.cards.set(i, c);
        if (!sc.noCaps) capShow(c.querySelector('.cap'));
      } else if (resize) {
        c.style.height = cardH + 'px';
      }

      c.style.top = (i * period + offset - colScrollY) + 'px';

      const wrap = c._wrap || (c._wrap = c.querySelector('.p-wrap'));
      if (wrap._sy !== sy) {
        wrap._sy = sy;
        wrap.style.transform = sy === 1 ? 'none' : `scaleY(${sy})`;
      }
    }
    for (const [i, c] of sc.cards) { if (!need.has(i)) { c.remove(); sc.cards.delete(i); } }
  });
}

/** A column moving up opens from the other end. */
function scrollCardOrder(sc, k) {
  const keys = [...sc.cards.keys()].sort((a, b) => a - b);
  return (k === 1) ? keys.reverse() : keys;
}

function scrollShow(n, animate) {
  stopScrollRAF();
  layoutScrollCols(n);
  scrollCols.forEach(sc => { if (sc.colIndex != null) sc.el.classList.add('on'); });
  scrollActive = true;

  scrollCols.forEach(sc => {
    for (const [i, c] of sc.cards) {
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const cap = c.querySelector('.cap');
      img.style.transition = 'none';
      img.style.clipPath = MASK_HIDDEN;
      inner.style.transition = 'none';
      inner.style.transform = 'scale(1.1)';
      capReset(cap);
      cap.classList.remove('show', 'hide');
    }
  });
  canvas.getBoundingClientRect();

  scrollCols.forEach((sc, k) => {
    scrollCardOrder(sc, k).forEach((key, idx) => {
      const c = sc.cards.get(key);
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const cap = c.querySelector('.cap');
      const baseDelay = animate ? (DUR_MS / 5000) : 0;
      const delay = baseDelay + (animate ? scStag(idx) : 0);

      img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
      img.style.transitionDelay = delay + 's';
      img.style.clipPath = MASK_SHOWN;

      inner.style.transition = 'transform ' + SC_CARD_MS + 'ms var(--ease)';
      inner.style.transitionDelay = delay + 's';
      inner.style.transform = 'scale(1)';

      if (sc.noCaps) { capReset(cap); return; }
      setTimeout(() => capShow(cap, { delay: animate ? delay : 0 }), CFG.time.capNudge);
    });
  });
}

function scrollHide(animate) {
  stopScrollRAF();
  let maxDelay = 0;
  let lastImg = null;   // the card that will finish closing last
  scrollCols.forEach((sc, k) => {
    scrollCardOrder(sc, k).forEach((key, idx) => {
      const c = sc.cards.get(key);
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const cap = c.querySelector('.cap');
      const delay = animate ? scStag(idx) : 0;
      if (delay >= maxDelay) { maxDelay = delay; lastImg = img; }

      img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
      img.style.transitionDelay = delay + 's';
      img.style.clipPath = MASK_HIDDEN;

      inner.style.transition = 'transform ' + SC_CARD_MS + 'ms var(--ease)';
      inner.style.transitionDelay = delay + 's';
      inner.style.transform = 'scale(1.1)';

      capHide(cap, { delay });
    });
  });

  const finish = () => {
    scrollCols.forEach(sc => {
      sc.el.classList.remove('on');
      for (const [i, c] of sc.cards) c.remove();
      sc.cards.clear();
    });
    scrollActive = false;
  };
  if (!animate || !lastImg) { finish(); return; }
  whenDone(lastImg, {
    prop: 'clip-path',
    fallbackMs: SC_CARD_MS + maxDelay * 1000 + 400,
  }).then(finish);
}

function startScrollRAF() {
  if (scrollRAF) return;
  const step = () => {
    currentVelocity *= SCROLL_FRICTION;
    if (Math.abs(currentVelocity) < CFG.scroll.minVel) currentVelocity = 0;
    scrollY += currentVelocity;

    smoothVelocity += (currentVelocity - smoothVelocity) * CFG.scroll.smooth;
    if (Math.abs(smoothVelocity) < 0.05) smoothVelocity = 0;

    renderScroll(false);

    if (currentVelocity === 0 && smoothVelocity === 0) { scrollRAF = null; return; }
    scrollRAF = requestAnimationFrame(step);
  };
  scrollRAF = requestAnimationFrame(step);
}

function stopScrollRAF() {
  if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
  if (currentVelocity || smoothVelocity) {
    currentVelocity = 0;
    smoothVelocity = 0;
    renderScroll(false);
  }
}

/* --- Gestures ------------------------------------------------------------ */

window.addEventListener('wheel', (e) => {
  if (busy || maskBusy) { if (isScrollLayout(current) || isCoverLayout(current)) e.preventDefault(); return; }
  if (isCoverLayout(current)) {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) coverScroll(e.deltaX, 'x');
    else coverScroll(e.deltaY, 'y');
    return;
  }
  if (!isScrollLayout(current)) return;
  e.preventDefault();
  currentVelocity += e.deltaY * CFG.scroll.wheel;
  startScrollRAF();
}, { passive: false });

let _touchY = null;
let _touchX = null;

window.addEventListener('touchstart', (e) => {
  if (!isScrollLayout(current) && !isCoverLayout(current)) return;
  _touchY = e.touches[0].clientY;
  _touchX = e.touches[0].clientX;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (busy || maskBusy) { if (isScrollLayout(current) || isCoverLayout(current)) e.preventDefault(); return; }
  if (_touchY == null) return;
  if (isCoverLayout(current)) {
    e.preventDefault();
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = _touchX - x;
    const dy = _touchY - y;
    if (Math.abs(dx) > Math.abs(dy)) coverScroll(dx, 'x');
    else coverScroll(dy, 'y');
    _touchX = x;
    _touchY = y;
    return;
  }
  if (!isScrollLayout(current)) return;
  e.preventDefault();
  const y = e.touches[0].clientY;
  currentVelocity += (_touchY - y) * CFG.scroll.touch;
  _touchY = y;
  startScrollRAF();
}, { passive: false });

window.addEventListener('touchend', () => {
  _touchY = null;
  _touchX = null;
  coverGestureSpent = false;
  coverAccum = 0;
});

/* ===========================================================================
   GEOMETRY
   The one place where a column description becomes pixel rectangles.
   =========================================================================== */

function computeRects(n) {
  const L = LAYOUTS[n];
  const CW = canvas.clientWidth;
  const H = canvas.clientHeight;
  const g = vw(GAP_VW);
  const canvasTop = canvas.getBoundingClientRect().top;
  const imgHpx = L.ratioImgH ? vw(L.ratioImgH) : 0;

  const colWpx = new Array(L.cols.length);
  const isRatio = new Array(L.cols.length);
  const ratioColW = Math.round(imgHpx * FALLBACK_RATIO);

  let usedFixed = 0, flexCount = 0;
  L.cols.forEach((c, i) => {
    isRatio[i] = (c.w === 'ratio');
    if (c.w === 'auto' || c.w === 'eq') { flexCount++; colWpx[i] = null; }
    else if (c.w === 'ratio') { colWpx[i] = ratioColW; usedFixed += ratioColW; }
    else { const w = vw(c.w); colWpx[i] = w; usedFixed += w; }
  });
  const leftover = Math.max(0, CW - usedFixed - g * (L.cols.length - 1));
  const flexW = flexCount ? Math.floor(leftover / flexCount) : 0;
  for (let i = 0; i < colWpx.length; i++) if (colWpx[i] === null) colWpx[i] = flexW;

  let largeColW = 0;
  L.cols.forEach((c, i) => { if (c.items.some(it => it.id === L.large)) largeColW = colWpx[i]; });
  const svgH = largeColW * 160 / 604;
  const baseH = H - svgH;

  const out = {};
  let x = 0;
  L.cols.forEach((c, i) => {
    const colW = colWpx[i];
    const ratioCol = isRatio[i];

    for (const it of c.items) {
      const isLarge = it.id === L.large;

      let computedCap = it.cap || (L.caps ? 'below' : 'none');
      if (isLarge && it.cap !== 'none') computedCap = 'bottom';
      const capBelow = computedCap === 'below';

      const smallImgH = isLarge ? 0
        : (ratioCol ? imgHpx : Math.round(colW * SMALL_RATIO_H / SMALL_RATIO_W));
      const smallBoxH = smallImgH + (capBelow ? vw(CAP_ALLOW_VW) : 0);
      const itemW = colW;
      const fitStackItem = L.fitStack && (it.y === 'bStackTop' || it.y === 'bStackBottom');

      let boxH;
      if (it.y === 'full') boxH = H;
      else if (it.y === 'fullTall') boxH = canvasTop + H;
      else if (it.y === 'baseTop') boxH = baseH;
      else if (fitStackItem) boxH = Math.round((baseH - g) / 2);
      else boxH = smallBoxH;

      let top;
      switch (it.y) {
        case 'full': top = 0; break;
        case 'fullTall': top = -canvasTop; break;
        case 'baseTop': top = svgH; break;
        case 'top': top = 0; break;
        case 'bottom': top = H - boxH; break;
        case 'fillTop': top = 0; break;
        case 'fillBottom': top = boxH + g; break;
        case 'bStackTop': top = H - 2 * boxH - g; break;
        case 'bStackBottom': top = H - boxH; break;
        default: top = 0;
      }

      let calcImgH = 'fill';
      if (it.imgH && it.imgH !== 'fill') {
        if (typeof it.imgH === 'object') {
          const targetH = isLarge ? H : baseH;
          calcImgH = Math.round(targetH * it.imgH.pct / 100);
        } else {
          calcImgH = vw(it.imgH);
        }
      }

      const rect = {
        left: x, top, width: itemW, height: boxH,
        imgH: calcImgH,
        size: it.size || null,
        pos: it.pos || null,
        cap: computedCap,
        capVariant: capVariant(n, isLarge),
        bg: L.bg || 'center',
        large: isLarge,
        svgOffset: it.y === 'fullTall' ? canvasTop : 0,
      };

      if (!isLarge) {
        rect.imgPxH = (calcImgH !== 'fill') ? calcImgH : (fitStackItem ? boxH : smallImgH);
        rect.imgW = itemW;
      } else if (it.ratio) {
        const availW = colW, availH = boxH;
        let fitW = availW, fitH = availW / it.ratio;
        if (fitH > availH) { fitH = availH; fitW = availH * it.ratio; }
        rect.left = x + (availW - fitW) / 2;
        rect.top = top + (availH - fitH) / 2;
        rect.width = fitW;
        rect.height = fitH;
        rect.autoRatio = true;
      }

      rect.col = i;
      out[it.id] = rect;
    }
    x += colW + g;
  });

  // colRank is a column's distance from the large card. Every animation
  // delay is derived from it — that is where the wave comes from.
  const populated = [...new Set(Object.keys(out).map(id => out[id].col))].sort((a, b) => a - b);
  const largeColIdx = out[L.large] ? out[L.large].col : populated[0];
  const largeRank = populated.indexOf(largeColIdx);
  for (const id in out) out[id].colRank = Math.abs(populated.indexOf(out[id].col) - largeRank);

  return out;
}

function setRect(el, r) {
  el.style.left = r.left + 'px';
  el.style.top = r.top + 'px';
  el.style.width = r.width + 'px';
  el.style.height = r.height + 'px';
}

function applyItemStyle(el, r, animate, deferCap) {
  const img = el.querySelector('.img');
  const inner = el.querySelector('.img-inner');
  const cap = el.querySelector('.cap');
  const svg = el.querySelector('.top-svg');
  el._capRectVariant = r.capVariant;
  // caption mode in the current composition: 'bottom', 'below' or 'none'.
  // Photo swapping reads it so it never revives a caption that isn't there.
  el._capMode = r.cap;

  inner.style.backgroundSize = 'cover';
  if (!inner.dataset.covered) inner.style.backgroundPosition = r.pos || r.bg || 'center';

  if (svg) svg.style.top = r.svgOffset ? ('calc(' + r.svgOffset + 'px - 1px)') : '';

  img.style.width = '';
  img.style.flex = '0 0 auto';
  cap.style.width = '';
  img.style.height = (r.large ? (r.imgH === 'fill' ? r.height : r.imgH) : r.imgPxH) + 'px';

  if (!deferCap) {
    if (r.cap === 'none') {
      clearTimeout(el._capT);
      if (cap.classList.contains('show')) {
        cap.classList.remove('show');
        if (animate) cap.classList.add('hide');
      } else if (!animate) {
        cap.classList.remove('show', 'hide');
      }
    } else {
      cap.style.display = 'flex';
      if (r.cap === 'bottom') {
        cap.style.position = 'absolute';
        cap.style.left = '0';
        cap.style.right = '0';
        cap.style.bottom = '0';
      } else {
        cap.style.position = 'static';
        cap.style.left = cap.style.right = cap.style.bottom = '';
      }

      if (!cap.classList.contains('show')) {
        cap.classList.remove('show', 'hide');
        applyCapText(el, r.capVariant);
        if (animate) {
          clearTimeout(el._capT);
          el._capT = setTimeout(() => cap.classList.add('show'), CFG.time.capEnter);
        } else {
          cap.classList.add('show');
        }
      }
    }
  }
  el.style.justifyContent = 'flex-start';
  el.classList.toggle('large', !!r.large);
}

function nearestEdge(r) {
  const center = r.top + r.height / 2;
  return center < canvas.clientHeight / 2 ? 'up' : 'down';
}

function offscreenTop(r) {
  const canvasTop = canvas.getBoundingClientRect().top;
  return nearestEdge(r) === 'up'
    ? -(canvasTop + r.height + EXIT_PAD)
    : canvas.clientHeight + EXIT_PAD;
}

function colDelay(colRank, animate, perCol) {
  if (!animate) return 0;
  const s = (perCol != null) ? perCol : COL_STAGGER_S;
  return (colRank || 0) * s;
}

/**
 * Resolves once a transition of the given property finishes on el.
 *
 * The CSS transitions themselves are untouched — this only changes how
 * the code learns that one ended, instead of adding up duration, delay
 * and slack and guessing.
 *
 * fallbackMs is the safety net: if the transition never started, was
 * interrupted, or the element left the tree, no event arrives and the
 * promise resolves on the old calculation instead.
 */
function whenDone(el, { prop, type = 'transitionend', fallbackMs = 2000, slack = 0 } = {}) {
  return new Promise(resolve => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener(type, onEvent);
      clearTimeout(timer);
      if (slack) setTimeout(resolve, slack);
      else resolve();
    };

    const onEvent = (e) => {
      // ignore events bubbling up from children or other properties
      if (e.target !== el) return;
      if (prop && e.propertyName && e.propertyName !== prop) return;
      finish();
    };

    el.addEventListener(type, onEvent);
    const timer = setTimeout(finish, fallbackMs);
  });
}

/* ===========================================================================
   STAND-IN FOR THE LARGE SLIDE
   =========================================================================== */

let leadTimer = null;
let morphToken = 0;
let heroTimers = [];

function clearHeroTimers() { heroTimers.forEach(clearTimeout); heroTimers = []; }
function afterHero(fn, ms) { const t = setTimeout(fn, ms); heroTimers.push(t); return t; }

function positionHero(n) {
  const rA = computeRects(n)['A'];
  hero.style.left = rA.left + 'px';
  hero.style.top = rA.top + 'px';
  hero.style.width = rA.width + 'px';
  hero.style.height = rA.height + 'px';
}

function updateHero(newN, animate, kind) {
  clearHeroTimers();
  const hImg = hero.querySelector('.img');
  const hSvg = hero.querySelector('.top-svg');
  const aSvg = els['A'].querySelector('.top-svg');
  const canvasTop = canvas.getBoundingClientRect().top;
  const H = canvas.clientHeight;
  const downY = H;
  const upY = -(canvasTop + (aSvg.offsetHeight || H * 0.2) + 40);

  if (kind === 'slideIn') {
    positionHero(newN);
    hero.style.transition = 'none';
    hImg.style.transition = 'none';
    hSvg.style.transition = 'none';
    hero.style.clipPath = 'none';
    hImg.style.clipPath = 'inset(100% 0 0 0)';
    hSvg.style.transform = 'translateY(' + downY + 'px)';
    hero.classList.add('on');
    hero.getBoundingClientRect();
    hero.style.transition = '';
    hImg.style.transition = '';
    hSvg.style.transition = '';
    aSvg.style.transition = '';
    hImg.style.clipPath = MASK_SHOWN;
    hSvg.style.transform = 'translateY(0)';
    aSvg.style.transform = 'translateY(' + upY + 'px)';
    return;
  }

  if (kind === 'slideOut') {
    if (hero.classList.contains('on')) {
      hero.style.transition = '';
      hero.style.clipPath = 'none';
      hImg.style.transition = '';
      hSvg.style.transition = '';
      hImg.style.clipPath = 'inset(100% 0 0 0)';
      hSvg.style.transform = 'translateY(' + downY + 'px)';
    }
    aSvg.style.transition = '';
    aSvg.style.transform = 'translateY(0)';
    if (animate) {
      afterHero(() => { hSvg.style.transition = 'none'; hSvg.style.transform = 'translateY(' + (downY + EXIT_PAD) + 'px)'; }, DUR_MS);
      afterHero(() => { if (!HERO_LAYOUTS.includes(current)) { hero.classList.remove('on'); hSvg.style.transition = ''; } }, DUR_MS + 550);
    } else {
      hero.classList.remove('on');
    }
    return;
  }

  if (kind === 'clipIn') {
    positionHero(newN);
    aSvg.style.transition = 'none';
    aSvg.style.transform = 'translateY(' + upY + 'px)';
    hImg.style.transition = 'none';
    hSvg.style.transition = 'none';
    hero.style.transition = 'none';
    hImg.style.clipPath = MASK_SHOWN;
    hSvg.style.transform = 'translateY(0)';
    hero.style.clipPath = MASK_HIDDEN;
    hero.classList.add('on');
    hero.getBoundingClientRect();
    hero.style.transition = 'clip-path var(--dur) var(--ease)';
    hero.style.clipPath = MASK_SHOWN;
    whenDone(hero, { prop: 'clip-path', fallbackMs: DUR_MS + 400 }).then(() => {
      if (!HERO_LAYOUTS.includes(current)) return;
      hero.style.transition = '';
      hero.style.clipPath = 'none';
    });
    return;
  }

  if (kind === 'clipOut') {
    if (hero.classList.contains('on')) {
      hImg.style.transition = 'none';
      hSvg.style.transition = 'none';
      hero.style.transition = 'none';
      hero.style.clipPath = MASK_SHOWN;
      hero.getBoundingClientRect();
      hero.style.transition = 'clip-path var(--dur) var(--ease)';
      hero.style.clipPath = MASK_HIDDEN;
      whenDone(hero, { prop: 'clip-path', fallbackMs: DUR_MS + 400 }).then(() => {
        if (HERO_LAYOUTS.includes(current)) return;
        hero.classList.remove('on');
        hero.style.transition = '';
        hero.style.clipPath = 'none';
        hImg.style.transition = '';
        hSvg.style.transition = '';
      });
    }
    aSvg.style.transition = 'none';
    aSvg.style.transform = 'translateY(0)';
    aSvg.getBoundingClientRect();
    aSvg.style.transition = '';
    return;
  }

  if (hero.classList.contains('on')) {
    hero.classList.remove('on');
    hero.style.transition = '';
    hero.style.clipPath = 'none';
    hImg.style.transition = '';
    hSvg.style.transition = '';
  }
  aSvg.style.transition = 'clip-path var(--dur) var(--ease), top var(--dur) var(--ease)';
  aSvg.style.transform = 'translateY(0)';
}

/* ===========================================================================
   SWITCHING TO THE MIRROR
   Everything closes behind a mask, is repositioned without motion,
   then opens again.
   =========================================================================== */

let animActiveUntil = 0;

function bumpAnim(ms) {
  const until = performance.now() + (ms == null ? ANIM_WATCH_MS : ms);
  if (until > animActiveUntil) animActiveUntil = until;
}
const onAnimRun = () => bumpAnim();
canvas.addEventListener('transitionrun', onAnimRun);
canvas.addEventListener('transitionstart', onAnimRun);

function maskItem(el, dur, clip, scale, delay) {
  const d = (delay || 0) + 's';
  const img = el.querySelector('.img');
  img.style.transition = 'clip-path ' + dur + 'ms var(--ease)';
  img.style.transitionDelay = d;
  img.style.clipPath = clip;
  if (scale != null) {
    const inner = el.querySelector('.img-inner');
    inner.style.transition = 'transform ' + dur + 'ms var(--ease)';
    inner.style.transitionDelay = d;
    inner.style.transform = scale;
  }
}

/**
 * Detaches the outgoing columns: the virtualiser stops touching them, so
 * their closing animation cannot collide with what is already being built
 * in their place.
 *
 * The cards are not moved into another element. Reparenting a node tears
 * down and rebuilds its composited layers, which was the single flickering
 * frame on transition. Instead the column itself becomes the ghost and a
 * fresh empty one goes into the pool.
 */
function ghostScrollCards() {
  let maxDelay = 0;
  let lastImg = null;   // the card that will finish closing last
  const ghosts = [];

  scrollCols.forEach((sc, k) => {
    if (sc.colIndex == null || !sc.cards.size) return;

    const ghost = sc.el;
    const cards = sc.cards;
    const order = scrollCardOrder(sc, k);

    // fresh element into the pool, the old one lives out its animation
    const fresh = document.createElement('div');
    fresh.className = 'scroll-col';
    canvas.appendChild(fresh);
    sc.el = fresh;
    sc.cards = new Map();
    sc.colIndex = null;
    sc._clipKey = null;
    ghosts.push(ghost);

    order.forEach((key, idx) => {
      const c = cards.get(key);
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const delay = scStag(idx);
      if (delay >= maxDelay) { maxDelay = delay; lastImg = img; }

      img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
      img.style.transitionDelay = delay + 's';
      img.style.clipPath = MASK_HIDDEN;

      inner.style.transition = 'transform ' + SC_CARD_MS + 'ms var(--ease)';
      inner.style.transitionDelay = delay + 's';
      inner.style.transform = ENTER_SCALE;

      capHide(c.querySelector('.cap'), { delay });
    });
  });

  if (ghosts.length) {
    const drop = () => ghosts.forEach(g => g.remove());
    if (lastImg) {
      whenDone(lastImg, {
        prop: 'clip-path',
        fallbackMs: SC_CARD_MS + maxDelay * 1000 + 400,
        slack: 60,
      }).then(drop);
    } else {
      drop();
    }
  }
  return maxDelay;
}

function coverSetCap(img, srcId, delay, step) {
  const el = img.closest('.item');
  if (!el) return;

  // No caption in this composition, so leave it alone. Without this the
  // mid-swap branch below would see a stale 'hide' class left over from
  // an earlier transition and bring a caption back onto a small card.
  if (el._capMode === 'none') return;

  if ((el._capSrcId || el.dataset.id) === srcId) return;
  el._capSrcId = srcId;

  const cap = el.querySelector('.cap');
  const variant = el._capRectVariant || 'small';
  const dirUp = step > 0;
  clearTimeout(el._capCoverT);

  if (!cap.classList.contains('show')) {
    const midSwap = cap.classList.contains('hide');
    cap.classList.remove('hide', 'dir-up', 'cover-swap');
    applyCapText(el, variant);
    if (!midSwap) {
      setCapDelay(cap, 0, false);
      return;
    }
    cap.classList.add('cover-swap');
    cap.classList.toggle('dir-up', dirUp);
    setCapDelay(cap, 0, dirUp);
    void cap.offsetWidth;
    cap.classList.add('show');
    // a guard rather than a wait: the helper classes come off with slack,
    // because removing them early would cut the caption animation short
    el._capCoverT = setTimeout(() => {
      cap.classList.remove('cover-swap', 'dir-up');
      setCapDelay(cap, 0, false);
    }, CAP_CLEAN_MS + CAP_SLACK_MS);
    return;
  }

  clearTimeout(el._capT);
  cap.classList.add('cover-swap');
  cap.classList.toggle('dir-up', dirUp);
  cap.classList.remove('show');
  cap.classList.add('hide');
  setCapDelay(cap, delay, dirUp);

  el._capCoverT = setTimeout(() => {
    applyCapText(el, variant);
    setCapDelay(cap, 0, dirUp);
    cap.classList.remove('hide');
    cap.classList.add('show');
    el._capCoverT = setTimeout(() => {
      cap.classList.remove('cover-swap', 'dir-up');
      setCapDelay(cap, 0, false);
    }, CAP_CLEAN_MS + CAP_SLACK_MS);
  }, delay * 1000 + COVER_CAP_MS + CAP_SLACK_MS);
}

function resetItemVisuals(el) {
  const img = el.querySelector('.img');
  const inner = el.querySelector('.img-inner');
  img.style.clipPath = MASK_SHOWN;
  inner.style.transform = REST_SCALE;
  el.style.clipPath = '';
}

let maskBusy = false;

function maskToggle(toN, oldN, animate, wasScroll, isScroll) {
  if (maskBusy) return;
  maskBusy = true;
  bumpAnim(6000);
  stopScrollRAF();
  clearHeroTimers();
  clearTimeout(leadTimer);
  morphToken++;
  coverClear();

  const fromRects = LAYOUTS[oldN] ? computeRects(oldN) : {};
  const toRects = computeRects(toN);
  const heroImg = hero.querySelector('.img');
  const heroOnNow = hero.classList.contains('on');
  const hadScroll = scrollActive;
  const samePair = oldN !== 0 && String(toN).replace('m', '') === String(oldN).replace('m', '');

  if (animate && oldN !== 0 && oldN !== toN) {
    if (NO_TEXT_LAYOUTS.has(toN)) hideAllText(animate);
    else syncTextTransitions(oldN, toN, 0, 0, animate, true);
  }

  // --- exit
  let maxExit = 0;

  if (oldN !== 0) {
    for (const it of ITEMS) {
      const el = els[it.id];
      if (el.classList.contains('on')) {
        const cap = el.querySelector('.cap');
        if (cap.classList.contains('show')) {
          cap.classList.remove('show');
          if (animate) cap.classList.add('hide');
        }

        const fr = fromRects[it.id];
        const delay = sStag(fr ? fr.col : 0);
        if (delay > maxExit) maxExit = delay;

        setCapDelay(cap, delay);
        maskItem(el, MASK_MS, MASK_HIDDEN, ENTER_SCALE, delay);
      }
    }

    if (heroOnNow) {
      heroImg.style.transition = 'clip-path ' + MASK_MS + 'ms var(--ease)';
      heroImg.style.transitionDelay = '0s';
      heroImg.style.clipPath = MASK_HIDDEN;
    }
    if (scrollActive) {
      ghostScrollCards();
      scrollActive = false;
    }
  }

  const handoff = (hadScroll && samePair) ? CFG.scroll.handoff : 0;
  const exitDelayMs = oldN === 0 ? 0
    : Math.max(0, (MASK_MS + maxExit * 1000 + 20) - CFG.scroll.overlap) + handoff;

  clearTimeout(maskToggle._t);
  maskToggle._t = setTimeout(() => {
    // --- reposition, no motion
    canvas.classList.add('no-anim');
    current = toN;

    const enterDelay = animate ? (oldN === 0 ? 200 : Math.max(0, 800 - exitDelayMs)) : 0;
    if (NO_TEXT_LAYOUTS.has(toN)) hideAllText(animate);
    else syncTextTransitions(oldN, toN, 0, enterDelay, animate, false);

    for (const it of ITEMS) {
      const el = els[it.id];
      const r = toRects[it.id];
      if (r) {
        el.classList.add('on');
        applyItemStyle(el, r, true);
        setRect(el, r);
        el.style.zIndex = 2;
        const img = el.querySelector('.img');
        const inner = el.querySelector('.img-inner');
        img.style.transition = 'none';
        inner.style.transition = 'none';
        img.style.clipPath = MASK_HIDDEN;
        inner.style.transform = ENTER_SCALE;
      } else {
        el.classList.remove('on', 'large');
        el.querySelector('.cap').classList.remove('show', 'hide');
        resetItemVisuals(el);
      }
    }

    if (isScroll) {
      layoutScrollCols(toN);
      scrollCols.forEach(sc => {
        if (sc.colIndex != null) sc.el.classList.add('on');
        for (const [i, c] of sc.cards) {
          const img = c.querySelector('.img');
          const cap = c.querySelector('.cap');
          img.style.transition = 'none';
          img.style.clipPath = MASK_HIDDEN;
          if (cap) cap.classList.remove('show', 'hide');
        }
      });
      scrollActive = true;
    } else if (scrollActive) {
      scrollCols.forEach(sc => {
        sc.el.classList.remove('on');
        for (const [i, c] of sc.cards) c.remove();
        sc.cards.clear();
      });
      scrollActive = false;
    }

    const aSvg = els['A'].querySelector('.top-svg');
    const hSvg = hero.querySelector('.top-svg');
    if (HERO_LAYOUTS.includes(toN)) {
      positionHero(toN);
      hero.classList.add('on');
      heroImg.style.transition = 'none';
      heroImg.style.clipPath = MASK_HIDDEN;
      aSvg.style.transition = 'none';
      aSvg.style.transform = 'translateY(-9999px)';
      hSvg.style.transition = 'none';
      hSvg.style.transform = 'translateY(0)';
    } else {
      hero.classList.remove('on');
      aSvg.style.transition = 'none';
      aSvg.style.transform = 'translateY(0)';
      hSvg.style.transition = 'none';
      hSvg.style.transform = 'translateY(9999px)';
    }

    // forced reflow: without it the browser collapses the closed and open
    // state into one frame and nothing moves
    canvas.getBoundingClientRect();
    canvas.classList.remove('no-anim');

    // --- entry
    let maxEntry = 0;
    let lastEntry = null;   // the card that will finish opening last
    for (const it of ITEMS) {
      const r = toRects[it.id];
      if (!r) continue;
      const delay = sStag(r.col);
      if (delay >= maxEntry) { maxEntry = delay; lastEntry = els[it.id].querySelector('.img'); }
      maskItem(els[it.id], MASK_MS, MASK_SHOWN, REST_SCALE, delay);
      setCapDelay(els[it.id].querySelector('.cap'), delay);
    }

    if (isScroll) {
      scrollCols.forEach((sc, k) => {
        scrollCardOrder(sc, k).forEach((key, idx) => {
          const img = sc.cards.get(key).querySelector('.img');
          const cap = sc.cards.get(key).querySelector('.cap');
          const delay = scStag(idx);
          if (delay > maxEntry) maxEntry = delay;

          img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
          img.style.transitionDelay = delay + 's';
          img.style.clipPath = MASK_SHOWN;
          if (delay >= maxEntry) { maxEntry = delay; lastEntry = img; }

          if (cap && !sc.noCaps) {
            setCapDelay(cap, delay);
            setTimeout(() => cap.classList.add('show'), CFG.time.capNudge);
          }
        });
      });
    }

    if (HERO_LAYOUTS.includes(toN)) {
      heroImg.style.transition = 'clip-path ' + MASK_MS + 'ms var(--ease)';
      heroImg.style.transitionDelay = '0s';
      heroImg.style.clipPath = MASK_SHOWN;
    }
    aSvg.style.transition = '';
    hSvg.style.transition = '';

    const entryDur = isScroll ? Math.max(MASK_MS, SC_CARD_MS) : MASK_MS;
    const release = () => { maskBusy = false; };
    if (lastEntry) {
      whenDone(lastEntry, {
        prop: 'clip-path',
        fallbackMs: entryDur + maxEntry * 1000 + 400,
        slack: 40,
      }).then(release);
    } else {
      setTimeout(release, entryDur + maxEntry * 1000 + 40);
    }
    bumpAnim(SC_CARD_MS + maxEntry * 1000 + 600);
  }, exitDelayMs);
}

/* ===========================================================================
   PHOTO SWAP ON GESTURE
   =========================================================================== */

const COVER_POOL = ITEMS.map(it => it.bg);
let coverAccum = 0;
let coverIndex = 0;
let coverLastInput = 0;
let coverGestureSpent = false;

function isCoverLayout(x) { return COVER_LAYOUTS.includes(x) }

function coverTargets() {
  const list = [];
  for (const it of ITEMS) {
    const el = els[it.id];
    if (el.classList.contains('on')) list.push(el.querySelector('.img'));
  }
  if (HERO_LAYOUTS.includes(current) && hero.classList.contains('on')) {
    list.push(hero.querySelector('.img'));
  }
  list.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return list;
}

function coverAdd(img, url, dir, delay) {
  const inner = img.querySelector('.img-inner');
  const pw = img.querySelector('.p-wrap');
  const pxo = (pw && pw._px) || 0, pyo = (pw && pw._py) || 0;

  const ov = document.createElement('div');
  ov.className = 'cover-ov';

  const ovInner = document.createElement('div');
  ovInner.className = 'cover-ov-inner';
  ovInner.style.backgroundImage = url;
  ovInner.style.backgroundSize = (inner && inner.style.backgroundSize) || 'cover';
  ovInner.style.backgroundPosition = (inner && inner.style.backgroundPosition) || 'center';
  ovInner.style.backgroundRepeat = 'no-repeat';
  ovInner.style.width = '100%';
  ovInner.style.height = '100%';
  ovInner.style.transition = 'none';
  ovInner.style.transform = 'scale(1.1)';

  ov.style.clipPath = ({
    down: 'inset(100% 100% 0 0)', up: 'inset(0 0 100% 100%)',
    right: 'inset(100% 100% 0 0)', left: 'inset(0 0 100% 100%)',
  })[dir] || 'inset(0 0 100% 100%)';
  ov.style.transform = `translate(${pxo}px, ${pyo}px) scale(var(--parallax-scale))`;
  ov.style.transition = 'none';

  ov.appendChild(ovInner);
  img.appendChild(ov);
  if (!img._covStack) img._covStack = [];
  img._covStack.push(ov);

  ov.getBoundingClientRect();

  ov.style.transition = 'clip-path var(--dur) var(--ease)';
  ov.style.transitionDelay = delay + 's';
  ov.style.clipPath = MASK_SHOWN;

  ovInner.style.transition = 'transform var(--dur) var(--ease)';
  ovInner.style.transitionDelay = delay + 's';
  ovInner.style.transform = 'scale(1)';

  const done = (e) => {
    if (e.propertyName !== 'clip-path') return;
    ov.removeEventListener('transitionend', done);
    const stack = img._covStack || [];
    const i = stack.indexOf(ov);
    if (i === -1) { ov.remove(); return; }

    const doomed = stack.slice(0, i);
    img._covStack = stack.slice(i);
    ov.style.transition = 'none';
    ovInner.style.transition = 'none';
    // animation done, this element no longer needs its own layer
    ov.style.willChange = 'auto';
    if (doomed.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => doomed.forEach(o => o.remove())));
    }
  };
  ov.addEventListener('transitionend', done);
}

function coverStep(step, dir) {
  bumpAnim();
  coverIndex = ((coverIndex + step) % COVER_CYCLE + COVER_CYCLE) % COVER_CYCLE;
  const targets = coverTargets();

  targets.forEach((img, idx) => {
    const stack = img._covStack || [];

    // Over the cap, so drop the oldest overlays.
    //
    // The base layer is deliberately left alone. Writing background-image
    // to it used to cause a flicker: the layer is composited, swapping its
    // background needs a repaint, and if the new one wasn't ready in the
    // same frame you saw one frame of the old image. Every overlay ends
    // fully open, so keeping the last few means the base is never visible.
    if (stack.length >= COVER_MAX) {
      const drop = stack.length - COVER_MAX + 1;
      const doomed = stack.slice(0, drop);
      img._covStack = stack.slice(drop);
      requestAnimationFrame(() => requestAnimationFrame(() => doomed.forEach(o => o.remove())));
    }

    const poolIdx = (coverIndex + idx) % COVER_POOL.length;
    const delay = Math.min(idx * COVER_STAGGER_S, COVER_STAGGER_CAP);
    coverAdd(img, COVER_POOL[poolIdx], dir, delay);
    coverSetCap(img, ITEMS[poolIdx].id, delay, step);
  });

  updateCoverIndex(step);
}

function updateCoverIndex(step) {
  const newVal = coverIndex + 1;
  document.querySelectorAll('.text-wrapper .idx-mask').forEach(mask => {
    const el = mask.querySelector('.index');
    if (el.textContent === String(newVal)) return;

    if (!step) { el.textContent = newVal; return; }

    const outY = step > 0 ? '-105%' : '105%';
    const inY = step > 0 ? '105%' : '-105%';

    el.style.transition = 'transform 0.4s var(--ease)';
    el.style.transform = `translateY(${outY})`;

    const onOut = (e) => {
      if (e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', onOut);
      el.style.transition = 'none';
      el.textContent = newVal;
      el.style.transform = `translateY(${inY})`;
      el.getBoundingClientRect();
      el.style.transition = 'transform 0.4s var(--ease)';
      el.style.transform = 'translateY(0%)';
    };
    el.addEventListener('transitionend', onOut);
  });
}

function coverManualStep(step) {
  if (busy) return;
  if (!isCoverLayout(current)) return;
  coverStep(step, step > 0 ? 'right' : 'left');
}

/** One step per gesture, until there is a pause. */
function coverScroll(delta, axis) {
  if (busy) return;
  const now = performance.now();

  if (now - coverLastInput > COVER_GESTURE_GAP) {
    coverGestureSpent = false;
    coverAccum = 0;
  }
  coverLastInput = now;

  if (coverGestureSpent) return;
  coverAccum += delta;

  if (Math.abs(coverAccum) >= COVER_STEP_PX) {
    const fwd = coverAccum >= 0;
    coverGestureSpent = true;
    coverAccum = 0;
    const dir = (axis === 'x') ? (fwd ? 'right' : 'left') : (fwd ? 'down' : 'up');
    coverStep(fwd ? 1 : -1, dir);
  }
}

function coverClear() {
  const commit = (img) => {
    if (!img) return;
    const stack = img._covStack || [];
    const inner = img.querySelector('.img-inner');
    if (stack.length) {
      const top = stack[stack.length - 1];
      const topInner = top.querySelector('.cover-ov-inner') || top;
      if (inner && topInner.style.backgroundImage) {
        inner.style.backgroundImage = topInner.style.backgroundImage;
        inner.style.backgroundPosition = topInner.style.backgroundPosition || 'center';
        inner.style.backgroundSize = topInner.style.backgroundSize || 'cover';
        inner.dataset.covered = '1';
      }
    }

    if (inner) {
      inner.style.transition = 'none';
      inner.style.transform = REST_SCALE;
      inner.getBoundingClientRect();
      inner.style.transition = '';
    }

    img._covStack = [];
    if (stack.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => stack.forEach(o => o.remove())));
    }
  };

  for (const it of ITEMS) {
    const el = els[it.id];
    clearTimeout(el._capCoverT);
    el.querySelector('.cap').classList.remove('cover-swap');
    commit(el.querySelector('.img'));
  }
  commit(hero.querySelector('.img'));
  coverAccum = 0;
}

/* ===========================================================================
   COMPOSITION TEXT
   =========================================================================== */

function textShown(tText) {
  const cs = getComputedStyle(tText).transform;
  if (cs === 'none') return false;
  let ty;
  try { ty = new DOMMatrixReadOnly(cs).m42; } catch (e) { return false; }
  return ty < (tText.offsetHeight || 1) * 0.5;
}

function hideAllText(animate, delayMs = 0) {
  document.querySelectorAll('.text-wrapper .visibility').forEach(el => {
    el.querySelectorAll('.t-text').forEach((tText, i) => {
      clearTimeout(tText._tEnter);
      clearTimeout(tText._tExit);
      clearTimeout(tText._tHidden);

      const isShown = textShown(tText);
      const lineDelay = delayMs + (i * LINE_STAGGER_MS);

      if (!animate || !isShown) {
        tText.style.animation = 'none';
        tText.style.transition = 'none';
        tText.style.transform = 'translateY(120%)';
        tText.classList.remove('is-active');
        tText._textState = 'hidden';
        return;
      }

      tText._tExit = setTimeout(() => {
        tText.style.animation = 'none'; void tText.offsetWidth;
        tText.style.animation = 'textExit var(--dur) var(--ease) both';
        tText.classList.remove('is-active');
        tText._textState = 'exiting';
        tText._tHidden = setTimeout(() => {
          if (tText._textState === 'exiting') tText._textState = 'hidden';
        }, CFG.time.textGuard);
      }, lineDelay);
    });
  });
}

function syncTextTransitions(oldN, newN, exitDelayMs, enterDelayMs, animate, doExitPhaseOnly = null) {
  if (NO_TEXT_LAYOUTS.has(newN)) {
    if (doExitPhaseOnly === null || doExitPhaseOnly === true) hideAllText(animate, exitDelayMs);
    return;
  }

  const newClass = 'is--' + newN;

  document.querySelectorAll('.text-wrapper .visibility').forEach(el => {
    const isInNew = el.classList.contains(newClass);

    el.querySelectorAll('.t-text').forEach((tText, i) => {
      const staggerExit = exitDelayMs + (i * LINE_STAGGER_MS);
      const staggerEnter = enterDelayMs + (i * LINE_STAGGER_MS);

      if (!animate) {
        clearTimeout(tText._tExit);
        clearTimeout(tText._tEnter);
        tText.style.animation = 'none';
        tText.style.transform = isInNew ? 'translateY(0%)' : 'translateY(120%)';
        tText.classList.toggle('is-active', isInNew);
        tText._textState = isInNew ? 'visible' : 'hidden';
        return;
      }

      if (doExitPhaseOnly === null || doExitPhaseOnly === true) {
        if (!isInNew && textShown(tText)) {
          clearTimeout(tText._tExit);
          tText._tExit = setTimeout(() => {
            tText.style.animation = 'none'; void tText.offsetWidth;
            tText.style.animation = 'textExit var(--dur) var(--ease) both';
            tText.classList.remove('is-active');
            tText._textState = 'hidden';
          }, staggerExit);
        }
      }

      if (doExitPhaseOnly === null || doExitPhaseOnly === false) {
        if (isInNew) {
          if (textShown(tText)) {
            tText.classList.add('is-active');
            tText._textState = 'visible';
          } else {
            clearTimeout(tText._tEnter);
            tText._tEnter = setTimeout(() => {
              tText.style.animation = 'none'; void tText.offsetWidth;
              tText.style.animation = 'textEnter var(--dur) var(--ease) both';
              tText.classList.add('is-active');
              tText._textState = 'visible';
            }, staggerEnter);
          }
        }
      }
    });
  });
}

/* ===========================================================================
   MORPHING A COMPOSITION
   Shared cards travel, new ones fly in from the edge, leftovers fly out.
   =========================================================================== */

/** Returns how long the transition will take — the nav lock waits on it. */
function applyLayout(n, animate = true) {
  if (!LAYOUTS[n]) return 0;
  coverClear();
  const oldN = current;

  const wasScroll = isScrollLayout(oldN);
  const isScroll = isScrollLayout(n);

  // two scroll compositions with different large cards cannot be morphed:
  // the column set differs, so that transition goes through the mask
  if (animate && n !== oldN && wasScroll && isScroll && LAYOUTS[n].large !== LAYOUTS[oldN].large) {
    maskToggle(n, oldN, animate, wasScroll, isScroll);
    return MASK_LOCK_MS;
  }

  const rects = computeRects(n);

  const wasHero = HERO_LAYOUTS.includes(oldN);
  const isHero = HERO_LAYOUTS.includes(n);
  const pairSet = new Set([oldN, n]);
  const isDirect = (pairSet.has('1') && pairSet.has('2')) || (pairSet.has('1m') && pairSet.has('2m'));

  let kind = 'none';
  if (isHero && !wasHero) kind = isDirect ? 'slideIn' : 'clipIn';
  else if (!isHero && wasHero) kind = isDirect ? 'slideOut' : 'clipOut';

  const isSameLargeScroll = wasScroll && isScroll && LAYOUTS[n].large === LAYOUTS[oldN].large;
  if (wasScroll && (!isScroll || isSameLargeScroll)) scrollHide(animate);

  // captions that won't exist in the new composition leave first
  let needLead = false;
  if (animate) {
    for (const it of ITEMS) {
      const el = els[it.id];
      const cap = el.querySelector('.cap');
      if (el.classList.contains('on') && cap.classList.contains('show')) {
        const dest = rects[it.id];
        if (!(dest && dest.cap && dest.cap !== 'none')) {
          clearTimeout(el._capT);
          capHide(cap);
          needLead = true;
        }
      }
    }
  }

  const scrollExitLead = (animate && wasScroll && (!isScroll || isSameLargeScroll)) ? SCROLL_EXIT_LEAD_MS : 0;
  const lead = Math.max(needLead ? CAP_FADE_MS : 0, scrollExitLead);

  current = n;
  clearTimeout(leadTimer);
  const token = ++morphToken;

  if (animate) syncTextTransitions(oldN, n, 0, 0, animate, true);

  const run = () => {
    if (token !== morphToken) return;

    const enterDelay = animate ? Math.max(0, 600 - lead) : 0;
    syncTextTransitions(oldN, n, 0, enterDelay, animate, false);

    runLayoutMorph(n, rects, kind, animate, oldN);

    if (isScroll) {
      if (!wasScroll || isSameLargeScroll) {
        scrollShow(n, animate);
      } else {
        layoutScrollCols(n);
        scrollCols.forEach(sc => { if (sc.colIndex != null) sc.el.classList.add('on'); });
        scrollActive = true;
      }
    }
  };

  if (lead) leadTimer = setTimeout(run, lead);
  else run();

  // columns leaving, then the move itself, plus the furthest column's delay
  const maxRank = Math.max(0, ...Object.values(rects).map(r => r.colRank || 0));
  const tail = animate ? colDelay(maxRank, animate) * 1000 : 0;
  return animate ? lead + DUR_MS + tail + CFG.lock.tail : 0;
}

function runLayoutMorph(n, rects, kind, animate, fromN) {
  const fromRects = LAYOUTS[fromN] ? computeRects(fromN) : {};
  const oldLargeId = LAYOUTS[fromN] ? LAYOUTS[fromN].large : null;
  const newLargeId = LAYOUTS[n].large;

  const largeSwapClears = !!(animate && (n === '1' || n === '1m')
    && oldLargeId && oldLargeId !== newLargeId
    && rects[oldLargeId] && !rects[oldLargeId].large);

  for (const it of ITEMS) {
    const el = els[it.id];
    const r = rects[it.id];
    const was = el.classList.contains('on');
    const wasLarge = fromRects[it.id] && fromRects[it.id].large;

    // the large card leaves with its own downward motion
    if (it.id === 'A' && kind === 'clipOut' && was && !r && animate) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      const capEl = el.querySelector('.cap');
      const capPad = capEl.offsetHeight + vw(3.5);
      el.style.transitionDelay = '0s';
      el.style.transition = 'none';
      el.style.clipPath = `inset(0px -2px ${-capPad}px -2px)`;
      img.style.transition = 'none';
      inner.style.transition = 'none';
      el.getBoundingClientRect();
      el.style.transition = 'clip-path var(--dur) var(--ease)';
      el.style.clipPath = 'inset(0px -2px 100% -2px)';
      const done = (e) => {
        if (e.target !== el || e.propertyName !== 'clip-path') return;
        el.removeEventListener('transitionend', done);
        if (!computeRects(current)[it.id]) {
          el.classList.remove('on', 'large');
          el.style.transition = '';
          img.style.transition = '';
          inner.style.transition = '';
          el.querySelector('.cap').classList.remove('show', 'hide');
        }
      };
      el.addEventListener('transitionend', done);
      continue;
    }

    if (it.id === 'A' && kind === 'clipIn' && !was && r && animate) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      const cap = el.querySelector('.cap');
      el.classList.add('on');
      el.style.transition = 'none';
      img.style.transition = 'none';
      inner.style.transition = 'none';
      resetItemVisuals(el);
      applyItemStyle(el, r, animate);
      clearTimeout(el._capT);
      cap.classList.remove('show', 'hide');
      applyCapText(el, r.capVariant);
      setCapDelay(cap, 0);
      setRect(el, r);
      el.style.zIndex = 1;
      el.style.clipPath = MASK_HIDDEN;
      el.getBoundingClientRect();
      el.style.transition = 'clip-path var(--dur) var(--ease)';
      el.style.transitionDelay = '0s';
      el.style.clipPath = MASK_SHOWN;
      whenDone(el, { prop: 'clip-path', fallbackMs: DUR_MS + 400 }).then(() => {
        if (current !== n) return;
        el.style.clipPath = '';
        el.style.transition = '';
        img.style.transition = '';
        inner.style.transition = '';
        cap.classList.add('show');
      });
      continue;
    }

    // present in both compositions, so it travels
    if (r && was) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      img.style.transition = '';
      inner.style.transition = '';
      el.style.transition = '';
      el.style.clipPath = '';

      const survRank = fromRects[it.id] ? fromRects[it.id].colRank : r.colRank;
      const dSec = largeSwapClears
        ? (it.id === oldLargeId ? 0 : colDelay(r.colRank, animate, SWAP_COL_STAGGER_S))
        : colDelay(survRank, animate);
      const d = dSec + 's';
      el.style.transitionDelay = d;
      img.style.transitionDelay = d;
      inner.style.transitionDelay = d;

      const cap = el.querySelector('.cap');
      const fr = fromRects[it.id];
      const capWasShown = cap.classList.contains('show');
      const fromBottom = fr && fr.cap === 'bottom';
      const toBottom = r.cap === 'bottom';
      const modeChanged = animate && capWasShown && fr && fr.cap !== 'none' && r.cap !== 'none' && (fromBottom !== toBottom);
      const largeRefresh = animate && capWasShown && wasLarge && r.large;
      const variantChanged = animate && capWasShown && fr && fr.capVariant !== r.capVariant;
      const manageCap = modeChanged || largeRefresh || variantChanged;

      setRect(el, r);
      applyItemStyle(el, r, animate, manageCap);

      if (manageCap) {
        cap.classList.remove('show');
        cap.classList.add('hide');
        setCapDelay(cap, dSec);
        clearTimeout(el._capT);
        el._capT = setTimeout(() => {
          if (current !== n) return;
          applyCapText(el, r.capVariant);
          if (toBottom) {
            cap.style.position = 'absolute';
            cap.style.left = '0'; cap.style.right = '0'; cap.style.bottom = '0';
          } else {
            cap.style.position = 'static';
            cap.style.left = cap.style.right = cap.style.bottom = '';
          }
          setCapDelay(cap, 0);
          cap.classList.remove('hide');
          cap.classList.add('show');
        }, DUR_MS * CFG.time.capSwapAt);
      } else if (!cap.classList.contains('show')) {
        setCapDelay(cap, dSec);
      }

      el.style.zIndex = 2;
    }

    // new card, flies in from the nearest edge
    else if (r && !was) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      el.classList.add('on');
      el.style.transition = 'none';
      img.style.transition = 'none';
      inner.style.transition = 'none';
      resetItemVisuals(el);
      applyItemStyle(el, r, animate);
      setRect(el, { ...r, top: animate ? offscreenTop(r) : r.top });
      el.style.zIndex = 1;
      el.getBoundingClientRect();
      el.style.transition = '';
      img.style.transition = '';
      inner.style.transition = '';

      const extra = (largeSwapClears && it.id === newLargeId) ? (LARGE_ENTRY_DELAY_MS / 1000) : 0;
      const delaySec = colDelay(r.colRank, animate) + extra;
      const delayStr = delaySec + 's';
      el.style.transitionDelay = delayStr;
      img.style.transitionDelay = delayStr;
      inner.style.transitionDelay = delayStr;
      el.style.top = r.top + 'px';

      setCapDelay(el.querySelector('.cap'), delaySec);
    }

    // gone in the new composition, flies out the same way
    else if (!r && was) {
      const cur = { top: el.offsetTop, left: el.offsetLeft, height: el.offsetHeight };
      el.style.zIndex = 1;
      el.classList.remove('large');

      const cap = el.querySelector('.cap');
      clearTimeout(el._capT);
      if (cap.classList.contains('show')) {
        cap.classList.remove('show');
        cap.classList.add('hide');
      }

      if (!animate) { el.classList.remove('on'); continue; }

      const exitRank = fromRects[it.id] ? fromRects[it.id].colRank : 0;
      const exitSec = colDelay(exitRank, animate);
      el.style.transitionDelay = exitSec + 's';
      setCapDelay(cap, exitSec);
      el.style.top = offscreenTop(cur) + 'px';

      // retire the card once the move has actually finished
      whenDone(el, {
        prop: 'top',
        fallbackMs: DUR_MS + exitSec * 1000 + 400,
      }).then(() => {
        if (computeRects(current)[it.id]) return;
        el.classList.remove('on', 'large');
        cap.classList.remove('show', 'hide');
        resetItemVisuals(el);
      });
    }
  }

  updateHero(n, animate, kind);
}

/* ===========================================================================
   NAVIGATION
   =========================================================================== */

let curPair = 0, curSide = 'main';
let wantPair = 0, wantSide = 'main';
let busy = false, busyTimer = null;

function requestNav(pair, side) {
  if (busy) return;
  wantPair = pair;
  wantSide = side;
  pump();
}

function pump() {
  if (wantPair === curPair && wantSide === curSide) return;
  const n = PAIRS[wantPair][wantSide];
  if (n === current) {
    curPair = wantPair; curSide = wantSide;
    canvas.dataset.pair = wantPair + 1;
    return;
  }

  const sideFlip = (wantPair === curPair && wantSide !== curSide);

  if (maskBusy) { wantPair = curPair; wantSide = curSide; return; }

  curPair = wantPair; curSide = wantSide;
  canvas.dataset.pair = wantPair + 1;
  canvas.dataset.layout = n;

  busy = true;
  bumpAnim();

  let lockMs;
  if (sideFlip) {
    maskToggle(n, current, true, isScrollLayout(current), isScrollLayout(n));
    lockMs = MASK_LOCK_MS;
  } else {
    // applyLayout decides between morph and mask itself, and reports the
    // real duration of whichever it picked
    lockMs = applyLayout(n);
  }
  lockMs = Math.max(CFG.lock.min, lockMs);

  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => { busy = false; }, lockMs);
}

window.addEventListener('keydown', (e) => {
  const nums = Object.keys(BASE_LAYOUTS);
  const keys = [...nums, 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
  if (!keys.includes(e.key)) return;
  e.preventDefault();

  const numIdx = nums.indexOf(e.key);
  if (numIdx !== -1) { requestNav(numIdx, wantSide); return; }

  const side = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'mirror' : 'main';
  requestNav(wantPair, side);
});

document.getElementById('nav-left').addEventListener('click', () => requestNav(wantPair, 'main'));
document.getElementById('nav-right').addEventListener('click', () => requestNav(wantPair, 'mirror'));

document.querySelectorAll('.nav-num-wrapper').forEach(el => {
  el.addEventListener('click', () => requestNav(parseInt(el.dataset.idx, 10), wantSide));
});

document.querySelectorAll('.svg-arrow-wrapper.is--next').forEach(el => {
  el.addEventListener('click', (e) => { e.stopPropagation(); coverManualStep(1); });
});
document.querySelectorAll('.svg-arrow-wrapper.is--prev').forEach(el => {
  el.addEventListener('click', (e) => { e.stopPropagation(); coverManualStep(-1); });
});

updateCoverIndex();

/* --- Resize -------------------------------------------------------------- */

let rT;
let lastWinW = window.innerWidth;

window.addEventListener('resize', () => {
  if (window.innerWidth === lastWinW) return;
  lastWinW = window.innerWidth;

  VW_PX = getVwPx();
  VH_PX = getVhPx();
  winW = window.innerWidth;
  winH = window.innerHeight;
  maxDist = Math.hypot(winW, winH);
  bumpAnim(600);
  canvas.classList.add('no-anim');
  applyLayout(current, false);
  clearTimeout(rT);
  rT = setTimeout(() => canvas.classList.remove('no-anim'), CFG.time.resizeSettle);
});

/* ===========================================================================
   START
   =========================================================================== */

function urlToPath(u) {
  const m = /url\((['"]?)(.*?)\1\)/.exec(u || '');
  return m ? m[2] : (u || '');
}

const _preloadedImages = [];

/** Decode everything up front, otherwise the first card reveal flickers. */
function preloadAllImages() {
  const urls = new Set();
  for (const it of ITEMS) urls.add(it.bg);
  urls.add(S2);

  let pending = urls.size;
  return new Promise(resolve => {
    if (!pending) return resolve();
    urls.forEach(u => {
      const im = new Image();
      im.src = urlToPath(u);
      _preloadedImages.push(im);
      im.decode().catch(() => {}).finally(() => { if (--pending === 0) resolve(); });
    });
  });
}

let introStarted = false;

function startIntro() {
  if (introStarted) return;
  introStarted = true;

  requestAnimationFrame(() => {
    canvas.classList.remove('no-anim');
    canvas.dataset.pair = 1;
    maskToggle('1', 0, true, false, false);
    bumpAnim();

    setTimeout(() => {
      topbarEls.forEach((el, index) => {
        el.style.transition = 'transform var(--dur) var(--ease)';
        el.style.transitionDelay = (index * 0.08) + 's';
        el.style.transform = 'translateY(0%)';
      });
    }, 100);

    setTimeout(() => { busy = false; }, INTRO_LOCK_MS);
  });
}

/* ===========================================================================
   PARALLAX
   Only the large image of a composition reacts to the cursor.
   =========================================================================== */

let curMouseX = window.innerWidth / 2;
let curMouseY = window.innerHeight / 2;
let targetMouseX = curMouseX;
let targetMouseY = curMouseY;

window.addEventListener('mousemove', (e) => {
  targetMouseX = e.clientX;
  targetMouseY = e.clientY;
});

let winW = window.innerWidth;
let winH = window.innerHeight;
let maxDist = Math.hypot(winW, winH);

const PARALLAX = [];
for (const it of ITEMS) {
  const w = els[it.id].querySelector('.p-wrap');
  if (w) PARALLAX.push({ wrap: w, host: els[it.id], img: w.closest('.img'), item: true, tx: 0, ty: 0 });
}
{
  const w = hero.querySelector('.p-wrap');
  if (w) PARALLAX.push({ wrap: w, host: hero, img: w.closest('.img'), item: false, tx: 0, ty: 0 });
}

const PX_EPS = CFG.parallax.eps;
let parallaxSettled = false;

function rafParallax() {
  const dxm = targetMouseX - curMouseX, dym = targetMouseY - curMouseY;
  const mouseMoving = Math.abs(dxm) > 0.1 || Math.abs(dym) > 0.1;

  // the loop sleeps while the mouse is still and nothing is animating
  if (!mouseMoving && parallaxSettled && performance.now() > animActiveUntil) {
    requestAnimationFrame(rafParallax);
    return;
  }

  if (mouseMoving) {
    curMouseX += dxm * CFG.parallax.follow;
    curMouseY += dym * CFG.parallax.follow;
  } else {
    curMouseX = targetMouseX;
    curMouseY = targetMouseY;
  }

  for (const p of PARALLAX) {
    // eligibility: on AND large. Small cards never move.
    const eligible = p.item
      ? (p.host.classList.contains('on') && p.host.classList.contains('large'))
      : p.host.classList.contains('on');
    if (eligible && !p.wrap._wasEligible) { p.wrap._px = 0; p.wrap._py = 0; p._force = true; }
    p.wrap._wasEligible = eligible;

    let tx = 0, ty = 0;
    if (eligible) {
      const rect = p.wrap.getBoundingClientRect();
      if (rect.width && rect.height) {
        const cX = rect.left + rect.width / 2;
        const cY = rect.top + rect.height / 2;
        const dist = Math.hypot(curMouseX - cX, curMouseY - cY);
        // the closer the cursor is to the centre, the more it moves
        const intensity = Math.max(0, 1 - (dist / (maxDist * CFG.parallax.falloff)));
        const factor = CFG.parallax.floor + intensity * (1 - CFG.parallax.floor);
        tx = ((curMouseX / winW) - 0.5) * 2 * rect.width * CFG.parallax.amount * factor;
        ty = ((curMouseY / winH) - 0.5) * 2 * rect.height * CFG.parallax.amount * factor;
      }
    }
    p.tx = tx; p.ty = ty;
  }

  let allSettled = true;
  for (const p of PARALLAX) {
    const wrap = p.wrap;
    const cx = wrap._px || 0, cy = wrap._py || 0;
    let nx = cx + (p.tx - cx) * CFG.parallax.ease;
    let ny = cy + (p.ty - cy) * CFG.parallax.ease;
    if (Math.abs(p.tx - nx) < PX_EPS && Math.abs(p.ty - ny) < PX_EPS) { nx = p.tx; ny = p.ty; }
    else allSettled = false;
    if (!p._force && nx === cx && ny === cy) continue;
    p._force = false;

    wrap._px = nx; wrap._py = ny;
    const t = `translate(${nx}px, ${ny}px)`;
    wrap.style.transform = t;

    // photo-swap overlays travel with the base layer
    if (p.img && p.img.childElementCount > 1) {
      p.img.querySelectorAll('.cover-ov').forEach(o => {
        o.style.transform = t + ' scale(var(--parallax-scale))';
      });
    }
  }
  parallaxSettled = allSettled && !mouseMoving;

  requestAnimationFrame(rafParallax);
}

requestAnimationFrame(rafParallax);

/* --- Boot ---------------------------------------------------------------- */

canvas.classList.add('no-anim');
current = 0;

const topbarEls = document.querySelectorAll('.topbar .t-topbar-text');
topbarEls.forEach(el => {
  el.style.transition = 'none';
  el.style.transform = 'translateY(-120%)';
});

busy = true;

// The intro waits for the landing gate (defined at the top of this file) to be opened. Images keep
// preloading behind it; after the click we wait for them at most introFallback.
const imagesReady = preloadAllImages();
(window.GATE_READY || Promise.resolve())
  .then(() => Promise.race([imagesReady, new Promise(r => setTimeout(r, CFG.time.introFallback))]))
  .then(startIntro);

/* ===========================================================================
   SHADER LAYER
   Adds nothing on top of the page — it redraws the same images itself.
   That is why it can be switched off at any time without breaking anything.
   =========================================================================== */

(function () {
  'use strict';

  const S = CFG.shader;
  const DPR = Math.min(window.devicePixelRatio || 1, S.dprCap);
  const HOVER_RADIUS = S.hoverRadius * DPR;
  const CENTER_FADE = S.centerFade * DPR;
  const BEAST_MS = CFG.time.beast;

  let active = false;
  let raf = null;
  let glCanvas = null, gl = null;
  let prog = null, U = {}, quadBuf = null;

  let mX = -99999, mY = -99999;
  let sX = -99999, sY = -99999;
  let presence = 0.0;
  let over = false;

  let startT = 0;
  let lastFrame = 0;
  let beastBusy = false;

  const TEX = new Map();

  /** Read the background from CSS so the colour lives in one place. */
  function pageColor() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#FFFDF3';
    const hex = raw.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const n = parseInt(full, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  let BG = pageColor();

  window.addEventListener('keydown', (e) => {
    if (!e.key || e.key.toLowerCase() !== S.key) return;
    e.preventDefault();
    if (beastBusy) return;
    active ? deactivate() : activate();
  });

  function extractPath(bg) {
    if (!bg) return '';
    const m = /url\((['"]?)(.*?)\1\)/.exec(bg);
    return m ? m[2] : '';
  }

  function px(tok, ref) {
    tok = (tok || '').trim();
    if (tok.endsWith('%')) return parseFloat(tok) / 100 * ref;
    if (tok.endsWith('vw')) return parseFloat(tok) / 100 * window.innerWidth;
    if (tok.endsWith('vh')) return parseFloat(tok) / 100 * window.innerHeight;
    const n = parseFloat(tok);
    return isNaN(n) ? 0 : n;
  }

  function parseInset(clip, w, h) {
    if (!clip) return null;
    clip = clip.trim();
    if (clip === 'none' || clip.indexOf('inset') < 0) return null;
    const m = clip.match(/inset\(([^)]*)\)/);
    if (!m) return null;
    const p = m[1].split('round')[0].trim().split(/\s+/).filter(Boolean);
    const V = (t, ref) => t.endsWith('%') ? parseFloat(t) / 100 * ref : parseFloat(t);
    let t, r, b, l;
    if (p.length === 1) { t = V(p[0], h); r = V(p[0], w); b = V(p[0], h); l = V(p[0], w); }
    else if (p.length === 2) { t = V(p[0], h); b = V(p[0], h); r = V(p[1], w); l = V(p[1], w); }
    else if (p.length === 3) { t = V(p[0], h); r = V(p[1], w); l = V(p[1], w); b = V(p[2], h); }
    else { t = V(p[0], h); r = V(p[1], w); b = V(p[2], h); l = V(p[3], w); }
    return { t, r, b, l };
  }

  /** The visible part of an element, accounting for its current mask. */
  function visibleRect(el) {
    const rc = el.getBoundingClientRect();
    const out = { left: rc.left, top: rc.top, width: rc.width, height: rc.height };
    const computed = getComputedStyle(el).clipPath;
    const clipStr = (computed && computed !== 'none') ? computed : el.style.clipPath;
    const ins = parseInset(clipStr, rc.width, rc.height);
    if (ins) {
      out.left = rc.left + ins.l;
      out.top = rc.top + ins.t;
      out.width = Math.max(0, rc.width - ins.l - ins.r);
      out.height = Math.max(0, rc.height - ins.t - ins.b);
    }
    return out;
  }

  function intersect(a, b) {
    const l = Math.max(a.left, b.left);
    const t = Math.max(a.top, b.top);
    const r = Math.min(a.left + a.width, b.left + b.width);
    const bt = Math.min(a.top + a.height, b.top + b.height);
    return { left: l, top: t, width: Math.max(0, r - l), height: Math.max(0, bt - t) };
  }

  /** Pulls the bow amount out of a column's path(). */
  function columnBow(el) {
    const cs = el.style.clipPath || getComputedStyle(el).clipPath;
    if (!cs || cs.indexOf('path') < 0) return null;
    const nums = cs.match(/-?\d+\.?\d*/g);
    if (!nums || nums.length < 5) return null;
    const W = parseFloat(nums[2]);
    const cx = parseFloat(nums[4]);
    const pinch = Math.max(0, W - cx);
    if (pinch < 0.5) return null;
    const rc = el.getBoundingClientRect();
    return { pinch: pinch * DPR, x: rc.left * DPR, y: rc.top * DPR, w: rc.width * DPR, h: rc.height * DPR };
  }

  function parseBgSize(str, Bw, Bh, R) {
    str = (str || 'cover').trim();
    if (str === 'cover') return (Bw / Bh > R) ? { dw: Bw, dh: Bw / R } : { dw: Bh * R, dh: Bh };
    if (str === 'contain') return (Bw / Bh > R) ? { dw: Bh * R, dh: Bh } : { dw: Bw, dh: Bw / R };
    if (str === 'auto') return { dw: Bh * R, dh: Bh };
    const parts = str.split(/\s+/);
    if (parts.length === 1) {
      if (parts[0] === 'auto') return { dw: Bh * R, dh: Bh };
      const w = px(parts[0], Bw);
      return { dw: w, dh: w / R };
    }
    let w = parts[0] === 'auto' ? null : px(parts[0], Bw);
    let h = parts[1] === 'auto' ? null : px(parts[1], Bh);
    if (w == null && h != null) w = h * R;
    if (h == null && w != null) h = w / R;
    if (w == null && h == null) { w = Bw; h = Bw / R; }
    return { dw: w, dh: h };
  }

  function parseBgPos(str, Bw, Bh, dw, dh) {
    str = (str || 'center').trim();
    let parts = str.split(/\s+/);
    const kX = { left: '0%', right: '100%', center: '50%' };
    const kY = { top: '0%', bottom: '100%', center: '50%' };
    if (parts.length === 1) parts = [parts[0], '50%'];
    const xa = kX[parts[0]] || parts[0];
    const ya = kY[parts[1]] || parts[1];
    const ox = xa.endsWith('%') ? (Bw - dw) * (parseFloat(xa) / 100) : px(xa, Bw);
    const oy = ya.endsWith('%') ? (Bh - dh) * (parseFloat(ya) / 100) : px(ya, Bh);
    return { ox, oy };
  }

  const VS = `
    precision mediump float;
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform vec2 u_resolution, u_quadPos, u_quadSize;
    varying vec2 v_texCoord;
    void main() {
      vec2 pos = (a_position * u_quadSize + u_quadPos) / u_resolution;
      vec2 clip = pos * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
      v_texCoord = a_texCoord;
    }`;

  const FS = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_uvScale, u_uvOffset;
    uniform vec2 u_quadPos, u_quadSize, u_mouse;
    uniform float u_time, u_hoverRadius;
    uniform float u_useBow, u_bow;
    uniform vec4 u_bowRect;

    uniform float u_centerFade;
    uniform float u_pullStrength;
    uniform float u_pullInvert;
    uniform float u_threadScale;
    uniform float u_warpAmount;
    uniform float u_iridescent;
    uniform float u_smearOpacity;
    uniform float u_lumaMin;
    uniform float u_lumaMax;
    uniform float u_dither;
    uniform float u_presence;

    varying vec2 v_texCoord;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }
    // five noise octaves: each one rotates and doubles in scale
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 frag = u_quadPos + v_texCoord * u_quadSize;

      // column bow: one parabola instead of separate geometry
      if (u_useBow > 0.5) {
        float vy = clamp((frag.y - u_bowRect.y) / u_bowRect.w, 0.0, 1.0);
        float bowAmt = 3.0 * u_bow * vy * (1.0 - vy);
        float fx = frag.x - u_bowRect.x;
        if (fx < bowAmt || fx > u_bowRect.z - bowAmt) discard;
      }

      vec2 uv = clamp(v_texCoord * u_uvScale + u_uvOffset, 0.0, 1.0);
      vec4 originalColor = texture2D(u_image, uv);

      vec2 center = u_quadPos + u_quadSize * 0.5;
      vec2 delta = u_mouse - center;
      float distToCenter = length(delta);
      vec2 dir = distToCenter > 0.1 ? normalize(delta) : vec2(0.0, 1.0);
      if (u_pullInvert > 0.5) dir = -dir;

      // the effect lives in a ring: it fades far away and under the cursor
      float activation = smoothstep(u_hoverRadius, u_quadSize.x * 0.2, distToCenter);
      activation *= smoothstep(0.0, u_centerFade, distToCenter);
      activation *= u_presence;

      vec3 acc = vec3(0.0);
      float totalWeight = 0.0;

      // the heavy part is gated: no samples are taken where there is no effect
      if (activation > 0.0 && u_mouse.x > -1000.0) {
        float jitter = hash(gl_FragCoord.xy) * u_dither;
        for (int i = 0; i < ${S.samples}; i++) {
          float f = (float(i) + jitter) / ${S.samples}.0;

          float n = fbm(uv * u_threadScale + u_time * 0.4);
          vec2 warpedDir = normalize(dir + vec2(n - 0.5) * u_warpAmount);

          vec2 suv = uv - warpedDir * (f * u_pullStrength * activation);
          suv = clamp(suv, 0.0, 1.0);

          vec4 sTex = texture2D(u_image, suv);

          float luma = dot(sTex.rgb, vec3(0.299, 0.587, 0.114));
          float mask = 1.0 - smoothstep(u_lumaMin, u_lumaMax, luma);
          float threadMask = smoothstep(0.3, 0.7, fbm(suv * u_threadScale * 1.5));
          float weight = (1.0 - f) * mask * threadMask;

          vec3 a = vec3(0.5);
          vec3 b = vec3(0.5);
          vec3 c = vec3(1.0);
          vec3 d = vec3(0.0, 0.33, 0.67);
          vec3 irid = a + b * cos(6.28318 * (c * (f * 1.5 - u_time * 0.8) + d));

          vec3 color = mix(sTex.rgb, irid, u_iridescent * f);

          acc += color * weight;
          totalWeight += weight;
        }
      }

      vec3 finalColor = originalColor.rgb;
      if (totalWeight > 0.0) {
        vec3 smearColor = acc / totalWeight;
        finalColor = mix(originalColor.rgb, smearColor, clamp(totalWeight * u_smearOpacity, 0.0, 1.0));
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function initGL() {
    gl = glCanvas.getContext('webgl', { premultipliedAlpha: false });
    if (!gl) { console.error('WebGL is not supported'); return false; }

    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('link:', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    const texLoc = gl.getAttribLocation(prog, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    U = {
      res: gl.getUniformLocation(prog, 'u_resolution'),
      pos: gl.getUniformLocation(prog, 'u_quadPos'),
      size: gl.getUniformLocation(prog, 'u_quadSize'),
      uvScale: gl.getUniformLocation(prog, 'u_uvScale'),
      uvOffset: gl.getUniformLocation(prog, 'u_uvOffset'),
      mouse: gl.getUniformLocation(prog, 'u_mouse'),
      time: gl.getUniformLocation(prog, 'u_time'),
      hoverRadius: gl.getUniformLocation(prog, 'u_hoverRadius'),
      image: gl.getUniformLocation(prog, 'u_image'),
      useBow: gl.getUniformLocation(prog, 'u_useBow'),
      bow: gl.getUniformLocation(prog, 'u_bow'),
      bowRect: gl.getUniformLocation(prog, 'u_bowRect'),
      centerFade: gl.getUniformLocation(prog, 'u_centerFade'),
      pullStrength: gl.getUniformLocation(prog, 'u_pullStrength'),
      pullInvert: gl.getUniformLocation(prog, 'u_pullInvert'),
      threadScale: gl.getUniformLocation(prog, 'u_threadScale'),
      warpAmount: gl.getUniformLocation(prog, 'u_warpAmount'),
      iridescent: gl.getUniformLocation(prog, 'u_iridescent'),
      smearOpacity: gl.getUniformLocation(prog, 'u_smearOpacity'),
      lumaMin: gl.getUniformLocation(prog, 'u_lumaMin'),
      lumaMax: gl.getUniformLocation(prog, 'u_lumaMax'),
      dither: gl.getUniformLocation(prog, 'u_dither'),
      presence: gl.getUniformLocation(prog, 'u_presence'),
    };
    gl.uniform1i(U.image, 0);
    return true;
  }

  function loadTextures() {
    const paths = new Set();
    for (const it of ITEMS) paths.add(extractPath(it.bg));
    paths.add(extractPath(S2));

    paths.forEach((path) => {
      if (!path || TEX.has(path)) return;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      const rec = { tex, ratio: FALLBACK_RATIO, loaded: false };
      TEX.set(path, rec);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!gl) return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (img.naturalWidth && img.naturalHeight) rec.ratio = img.naturalWidth / img.naturalHeight;
        rec.loaded = true;
      };
      img.src = path;
    });
  }

  /** Draws one layer, scissored to its visible rectangle. */
  function drawSurface(surfEl, clipRect, bow) {
    const rc = surfEl.getBoundingClientRect();
    if (rc.width <= 0 || rc.height <= 0) return;

    const path = extractPath(surfEl.style.backgroundImage || getComputedStyle(surfEl).backgroundImage);
    const rec = TEX.get(path);
    if (!rec || !rec.loaded) return;

    const Bw = rc.width, Bh = rc.height, R = rec.ratio;
    const sizeStr = surfEl.style.backgroundSize || getComputedStyle(surfEl).backgroundSize;
    const posStr = surfEl.style.backgroundPosition || getComputedStyle(surfEl).backgroundPosition;
    const { dw, dh } = parseBgSize(sizeStr, Bw, Bh, R);
    const { ox, oy } = parseBgPos(posStr, Bw, Bh, dw, dh);

    const clip = intersect(clipRect, { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    const sw = Math.round(clip.width * DPR);
    const sh = Math.round(clip.height * DPR);
    if (sw <= 0 || sh <= 0) return;
    const sx = Math.round(clip.left * DPR);
    const sy = Math.round(glCanvas.height - (clip.top + clip.height) * DPR);

    gl.scissor(sx, sy, sw, sh);
    gl.uniform2f(U.pos, rc.left * DPR, rc.top * DPR);
    gl.uniform2f(U.size, Bw * DPR, Bh * DPR);
    gl.uniform2f(U.uvScale, Bw / dw, Bh / dh);
    gl.uniform2f(U.uvOffset, -ox / dw, -oy / dh);

    if (bow) {
      gl.uniform1f(U.useBow, 1.0);
      gl.uniform1f(U.bow, bow.pinch);
      gl.uniform4f(U.bowRect, bow.x, bow.y, bow.w, bow.h);
    } else {
      gl.uniform1f(U.useBow, 0.0);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rec.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function renderImages(t) {
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(BG[0], BG[1], BG[2], BG[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);

    gl.uniform2f(U.res, glCanvas.width, glCanvas.height);
    gl.uniform2f(U.mouse, sX * DPR, sY * DPR);
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.hoverRadius, HOVER_RADIUS);

    gl.uniform1f(U.centerFade, CENTER_FADE);
    gl.uniform1f(U.pullStrength, S.pullStrength);
    gl.uniform1f(U.pullInvert, S.pullInvert ? 1.0 : 0.0);
    gl.uniform1f(U.threadScale, S.threadScale);
    gl.uniform1f(U.warpAmount, S.warpAmount);
    gl.uniform1f(U.iridescent, S.iridescent);
    gl.uniform1f(U.smearOpacity, S.opacity);
    gl.uniform1f(U.lumaMin, S.lumaMin);
    gl.uniform1f(U.lumaMax, S.lumaMax);
    gl.uniform1f(U.dither, S.dither);
    gl.uniform1f(U.presence, presence);

    const withOverlays = (imgEl, inner) => {
      const vis = visibleRect(imgEl);
      drawSurface(inner, vis, null);
      imgEl.querySelectorAll('.cover-ov').forEach((ov) => {
        drawSurface(ov.querySelector('.cover-ov-inner') || ov, intersect(vis, visibleRect(ov)), null);
      });
    };

    for (const it of ITEMS) {
      const el = els[it.id];
      if (!el || !el.classList.contains('on')) continue;
      const imgEl = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      if (imgEl && inner) withOverlays(imgEl, inner);
    }

    scrollCols.forEach((sc) => {
      if (sc.colIndex == null || !sc.el.classList.contains('on')) return;
      const colRect = sc.el.getBoundingClientRect();
      const bow = columnBow(sc.el);
      sc.cards.forEach((card) => {
        const imgEl = card.querySelector('.img');
        const inner = card.querySelector('.sc-inner');
        if (imgEl && inner) drawSurface(inner, intersect(colRect, visibleRect(imgEl)), bow);
      });
    });

    if (hero.classList.contains('on')) {
      const imgEl = hero.querySelector('.img');
      const inner = hero.querySelector('.img-inner');
      if (imgEl && inner) withOverlays(imgEl, inner);
    }
  }

  function frame(now) {
    if (!active) return;

    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    // exponential smoothing off the real frame time, so behaviour is the
    // same at any refresh rate
    const posK = 1.0 - Math.exp(-dt / Math.max(S.followLag, 0.001));
    sX += (mX - sX) * posK;
    sY += (mY - sY) * posK;

    const presK = 1.0 - Math.exp(-dt / Math.max(S.fadeLag, 0.001));
    presence += ((over ? 1.0 : 0.0) - presence) * presK;

    renderImages((now - startT) / 1000);
    raf = requestAnimationFrame(frame);
  }

  function sizeCanvas() {
    glCanvas.width = Math.round(window.innerWidth * DPR);
    glCanvas.height = Math.round(window.innerHeight * DPR);
    glCanvas.style.width = window.innerWidth + 'px';
    glCanvas.style.height = window.innerHeight + 'px';
  }

  const onResize = () => { if (active) sizeCanvas(); };
  const onMove = (e) => {
    if (presence < 0.1) { sX = e.clientX; sY = e.clientY; }
    mX = e.clientX; mY = e.clientY;
    over = true;
  };
  const onLeavePage = () => { over = false; };
  const onEnterPage = () => { over = true; };

  function activate() {
    active = true;
    beastBusy = true;
    BG = pageColor();

    glCanvas = document.createElement('canvas');
    glCanvas.className = 'beast-canvas';
    document.body.insertBefore(glCanvas, document.body.firstChild);
    sizeCanvas();
    if (!initGL()) { beastBusy = false; deactivate(); return; }
    loadTextures();

    presence = 0.0;
    over = false;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('resize', onResize);
    document.documentElement.addEventListener('mouseleave', onLeavePage);
    document.documentElement.addEventListener('mouseenter', onEnterPage);

    startT = performance.now();
    lastFrame = startT;
    raf = requestAnimationFrame(frame);

    requestAnimationFrame(() => glCanvas.classList.add('show'));
    setTimeout(() => {
      if (active) document.body.classList.add('beast-on');
      beastBusy = false;
    }, BEAST_MS);
  }

  function deactivate() {
    active = false;
    beastBusy = true;

    document.body.classList.remove('beast-on');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('resize', onResize);
    document.documentElement.removeEventListener('mouseleave', onLeavePage);
    document.documentElement.removeEventListener('mouseenter', onEnterPage);

    const dying = glCanvas;
    glCanvas = null;
    if (dying) dying.classList.remove('show');

    setTimeout(() => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (dying) dying.remove();
      if (!active) {
        for (const rec of TEX.values()) if (gl) gl.deleteTexture(rec.tex);
        TEX.clear();
        gl = null;
        prog = null;
      }
      beastBusy = false;
    }, BEAST_MS);
  }
})();ch((lineHtml, i) => {
      const mask = document.createElement('div');
      mask.className = 't-mask';
      const text = document.createElement('div');
      text.className = 't-text';
      text.innerHTML = lineHtml;
      mask.appendChild(text);
      frag.appendChild(mask);
      if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
    });

    originalMask.replaceWith(frag);
  });
}

fillArrows();
buildMirror();
initTextSplitting();

/* --- Cards --------------------------------------------------------------- */

for (const it of ITEMS) {
  const el = document.createElement('div');
  el.className = 'item';
  el.dataset.id = it.id;

  el._capSrcId = it.id;
  el._capRectVariant = 'small';
  el._capKey = 'small|' + it.id;

  el.innerHTML = `<div class="img"><div class="p-wrap"><div class="img-inner" style="background-image:${it.bg}"></div></div></div>`;
  el.appendChild(cutoutTpl.content.cloneNode(true));
  el.insertAdjacentHTML('beforeend', `<div class="cap">${capHTML(capData(it.id, 'small'))}</div>`);

  canvas.appendChild(el);
  els[it.id] = el;
}

const hero = document.createElement('div');
hero.className = 'hero2';
hero.innerHTML = `<div class="img"><div class="p-wrap"><div class="img-inner" style="background-image:${S2}; background-size: 68vw; background-position: 80% 57%"></div></div></div>`;
hero.appendChild(cutoutTpl.content.cloneNode(true));
canvas.appendChild(hero);

/* ===========================================================================
   COLUMN SCROLL
   =========================================================================== */

let scrollY = 0;
let scrollRAF = null;
let scrollActive = false;
let currentVelocity = 0;
let smoothVelocity = 0;

const scrollCols = [];
for (let k = 0; k < 2; k++) {
  const c = document.createElement('div');
  c.className = 'scroll-col';
  canvas.appendChild(c);
  scrollCols.push({ el: c, cards: new Map(), colIndex: null, x: 0, w: 0, cardH: 0, period: 0, offset: 0, fieldH: 0, step: 2, base: 0, noCaps: false });
}

function isScrollLayout(x) { return !!(LAYOUTS[x] && LAYOUTS[x].scroll) }

function scrollItemObj(sc, i) {
  const n = ITEMS.length;
  const step = (sc && sc.step != null) ? sc.step : 2;
  const base = (sc && sc.base != null) ? sc.base : 0;
  const idx = (((i * step + base) % n) + n) % n;
  return ITEMS[idx];
}

function layoutColMetrics(n) {
  const L = LAYOUTS[n];
  const CW = canvas.clientWidth;
  const H = canvas.clientHeight;
  const g = vw(GAP_VW);
  const imgHpx = L.ratioImgH ? vw(L.ratioImgH) : 0;

  const colWpx = new Array(L.cols.length);
  const ratioColW = Math.round(imgHpx * FALLBACK_RATIO);
  let usedFixed = 0, flexCount = 0;
  L.cols.forEach((c, i) => {
    if (c.w === 'auto' || c.w === 'eq') { flexCount++; colWpx[i] = null; }
    else if (c.w === 'ratio') { colWpx[i] = ratioColW; usedFixed += ratioColW; }
    else { const w = vw(c.w); colWpx[i] = w; usedFixed += w; }
  });
  const leftover = Math.max(0, CW - usedFixed - g * (L.cols.length - 1));
  const flexW = flexCount ? Math.floor(leftover / flexCount) : 0;
  for (let i = 0; i < colWpx.length; i++) if (colWpx[i] === null) colWpx[i] = flexW;

  const colX = new Array(L.cols.length);
  let x = 0;
  L.cols.forEach((c, i) => { colX[i] = x; x += colWpx[i] + g; });
  return { H, colX, colWpx };
}

function layoutScrollCols(n) {
  const L = LAYOUTS[n];
  if (!L.scroll) return;
  const m = layoutColMetrics(n);
  const cardW = m.colWpx[L.scrollCols[0]];
  const cardH = Math.max(1, Math.round(cardW * SMALL_RATIO_H / SMALL_RATIO_W));
  const gap = vw(GAP_VW);
  const single = (L.scrollGap === true);

  const scNoCaps = !!L.scrollNoCaps;
  const capSpace = scNoCaps ? 0 : vw(CAP_ALLOW_VW);
  const period = single ? (cardH + gap + capSpace) : (cardH * 2);

  const vpTop = canvas.getBoundingClientRect().top;
  const fieldH = window.innerHeight;

  L.scrollCols.forEach((ci, k) => {
    const sc = scrollCols[k];
    sc.colIndex = ci;
    sc.x = m.colX[ci];
    sc.w = m.colWpx[ci];
    sc.cardH = cardH;
    sc.period = period;
    sc.offset = single ? 0 : (k * cardH);
    sc.step = single ? 1 : 2;
    sc.base = single ? 0 : (k * 5);
    sc.noCaps = scNoCaps;
    sc.fieldH = fieldH;
    sc.el.style.left = sc.x + 'px';
    sc.el.style.width = sc.w + 'px';
    sc.el.style.top = (-vpTop) + 'px';
    sc.el.style.height = fieldH + 'px';
  });

  for (let k = L.scrollCols.length; k < scrollCols.length; k++) {
    const sc = scrollCols[k];
    sc.colIndex = null;
    sc.el.classList.remove('on');
    for (const [i, c] of sc.cards) c.remove();
    sc.cards.clear();
  }
  renderScroll(true);
}

function renderScroll(resize) {
  const v = Math.min(Math.abs(smoothVelocity), CFG.scroll.bowMax);
  const sy = Math.round((1 + v * CFG.scroll.stretch) * 1000) / 1000;
  const pinch = Math.round(v * CFG.scroll.bow) / 100;

  scrollCols.forEach((sc, k) => {
    if (sc.colIndex == null) return;
    const H = sc.fieldH || canvas.clientHeight;
    const { period, offset, cardH } = sc;
    const W = sc.w;

    const colDir = (k === 1) ? -1 : 1;
    const colScrollY = scrollY * colDir;

    const first = Math.floor((colScrollY - offset - cardH) / period) - 1;
    const last = Math.ceil((colScrollY - offset + H) / period) + 1;
    const need = new Set();

    // inertia bows the column edges along a cubic curve
    const clipKey = pinch + '|' + W + '|' + H;
    if (sc._clipKey !== clipKey) {
      sc._clipKey = clipKey;
      sc.el.style.clipPath = pinch === 0
        ? 'none'
        : `path('M 0 0 L ${W} 0 C ${W - pinch} ${H * 0.15}, ${W - pinch} ${H * 0.85}, ${W} ${H} L 0 ${H} C ${pinch} ${H * 0.85}, ${pinch} ${H * 0.15}, 0 0 Z')`;
    }

    for (let i = first; i <= last; i++) {
      need.add(i);
      let c = sc.cards.get(i);
      if (!c) {
        const it = scrollItemObj(sc, i);
        c = document.createElement('div');
        c.className = 'scroll-card';
        c.innerHTML =
          `<div class="img"><div class="p-wrap"><div class="sc-inner" style="background-image:${it.bg}"></div></div></div>`
          + `<div class="cap">${capHTML(capData(it.id, 'scroll'))}</div>`;
        c.style.height = cardH + 'px';
        sc.el.appendChild(c);
        sc.cards.set(i, c);
        if (!sc.noCaps) capShow(c.querySelector('.cap'));
      } else if (resize) {
        c.style.height = cardH + 'px';
      }

      c.style.top = (i * period + offset - colScrollY) + 'px';

      const wrap = c._wrap || (c._wrap = c.querySelector('.p-wrap'));
      if (wrap._sy !== sy) {
        wrap._sy = sy;
        wrap.style.transform = sy === 1 ? 'none' : `scaleY(${sy})`;
      }
    }
    for (const [i, c] of sc.cards) { if (!need.has(i)) { c.remove(); sc.cards.delete(i); } }
  });
}

/** A column moving up opens from the other end. */
function scrollCardOrder(sc, k) {
  const keys = [...sc.cards.keys()].sort((a, b) => a - b);
  return (k === 1) ? keys.reverse() : keys;
}

function scrollShow(n, animate) {
  stopScrollRAF();
  layoutScrollCols(n);
  scrollCols.forEach(sc => { if (sc.colIndex != null) sc.el.classList.add('on'); });
  scrollActive = true;

  scrollCols.forEach(sc => {
    for (const [i, c] of sc.cards) {
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const cap = c.querySelector('.cap');
      img.style.transition = 'none';
      img.style.clipPath = MASK_HIDDEN;
      inner.style.transition = 'none';
      inner.style.transform = 'scale(1.1)';
      capReset(cap);
      cap.classList.remove('show', 'hide');
    }
  });
  canvas.getBoundingClientRect();

  scrollCols.forEach((sc, k) => {
    scrollCardOrder(sc, k).forEach((key, idx) => {
      const c = sc.cards.get(key);
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const cap = c.querySelector('.cap');
      const baseDelay = animate ? (DUR_MS / 5000) : 0;
      const delay = baseDelay + (animate ? scStag(idx) : 0);

      img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
      img.style.transitionDelay = delay + 's';
      img.style.clipPath = MASK_SHOWN;

      inner.style.transition = 'transform ' + SC_CARD_MS + 'ms var(--ease)';
      inner.style.transitionDelay = delay + 's';
      inner.style.transform = 'scale(1)';

      if (sc.noCaps) { capReset(cap); return; }
      setTimeout(() => capShow(cap, { delay: animate ? delay : 0 }), CFG.time.capNudge);
    });
  });
}

function scrollHide(animate) {
  stopScrollRAF();
  let maxDelay = 0;
  let lastImg = null;   // the card that will finish closing last
  scrollCols.forEach((sc, k) => {
    scrollCardOrder(sc, k).forEach((key, idx) => {
      const c = sc.cards.get(key);
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const cap = c.querySelector('.cap');
      const delay = animate ? scStag(idx) : 0;
      if (delay >= maxDelay) { maxDelay = delay; lastImg = img; }

      img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
      img.style.transitionDelay = delay + 's';
      img.style.clipPath = MASK_HIDDEN;

      inner.style.transition = 'transform ' + SC_CARD_MS + 'ms var(--ease)';
      inner.style.transitionDelay = delay + 's';
      inner.style.transform = 'scale(1.1)';

      capHide(cap, { delay });
    });
  });

  const finish = () => {
    scrollCols.forEach(sc => {
      sc.el.classList.remove('on');
      for (const [i, c] of sc.cards) c.remove();
      sc.cards.clear();
    });
    scrollActive = false;
  };
  if (!animate || !lastImg) { finish(); return; }
  whenDone(lastImg, {
    prop: 'clip-path',
    fallbackMs: SC_CARD_MS + maxDelay * 1000 + 400,
  }).then(finish);
}

function startScrollRAF() {
  if (scrollRAF) return;
  const step = () => {
    currentVelocity *= SCROLL_FRICTION;
    if (Math.abs(currentVelocity) < CFG.scroll.minVel) currentVelocity = 0;
    scrollY += currentVelocity;

    smoothVelocity += (currentVelocity - smoothVelocity) * CFG.scroll.smooth;
    if (Math.abs(smoothVelocity) < 0.05) smoothVelocity = 0;

    renderScroll(false);

    if (currentVelocity === 0 && smoothVelocity === 0) { scrollRAF = null; return; }
    scrollRAF = requestAnimationFrame(step);
  };
  scrollRAF = requestAnimationFrame(step);
}

function stopScrollRAF() {
  if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
  if (currentVelocity || smoothVelocity) {
    currentVelocity = 0;
    smoothVelocity = 0;
    renderScroll(false);
  }
}

/* --- Gestures ------------------------------------------------------------ */

window.addEventListener('wheel', (e) => {
  if (busy || maskBusy) { if (isScrollLayout(current) || isCoverLayout(current)) e.preventDefault(); return; }
  if (isCoverLayout(current)) {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) coverScroll(e.deltaX, 'x');
    else coverScroll(e.deltaY, 'y');
    return;
  }
  if (!isScrollLayout(current)) return;
  e.preventDefault();
  currentVelocity += e.deltaY * CFG.scroll.wheel;
  startScrollRAF();
}, { passive: false });

let _touchY = null;
let _touchX = null;

window.addEventListener('touchstart', (e) => {
  if (!isScrollLayout(current) && !isCoverLayout(current)) return;
  _touchY = e.touches[0].clientY;
  _touchX = e.touches[0].clientX;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (busy || maskBusy) { if (isScrollLayout(current) || isCoverLayout(current)) e.preventDefault(); return; }
  if (_touchY == null) return;
  if (isCoverLayout(current)) {
    e.preventDefault();
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = _touchX - x;
    const dy = _touchY - y;
    if (Math.abs(dx) > Math.abs(dy)) coverScroll(dx, 'x');
    else coverScroll(dy, 'y');
    _touchX = x;
    _touchY = y;
    return;
  }
  if (!isScrollLayout(current)) return;
  e.preventDefault();
  const y = e.touches[0].clientY;
  currentVelocity += (_touchY - y) * CFG.scroll.touch;
  _touchY = y;
  startScrollRAF();
}, { passive: false });

window.addEventListener('touchend', () => {
  _touchY = null;
  _touchX = null;
  coverGestureSpent = false;
  coverAccum = 0;
});

/* ===========================================================================
   GEOMETRY
   The one place where a column description becomes pixel rectangles.
   =========================================================================== */

function computeRects(n) {
  const L = LAYOUTS[n];
  const CW = canvas.clientWidth;
  const H = canvas.clientHeight;
  const g = vw(GAP_VW);
  const canvasTop = canvas.getBoundingClientRect().top;
  const imgHpx = L.ratioImgH ? vw(L.ratioImgH) : 0;

  const colWpx = new Array(L.cols.length);
  const isRatio = new Array(L.cols.length);
  const ratioColW = Math.round(imgHpx * FALLBACK_RATIO);

  let usedFixed = 0, flexCount = 0;
  L.cols.forEach((c, i) => {
    isRatio[i] = (c.w === 'ratio');
    if (c.w === 'auto' || c.w === 'eq') { flexCount++; colWpx[i] = null; }
    else if (c.w === 'ratio') { colWpx[i] = ratioColW; usedFixed += ratioColW; }
    else { const w = vw(c.w); colWpx[i] = w; usedFixed += w; }
  });
  const leftover = Math.max(0, CW - usedFixed - g * (L.cols.length - 1));
  const flexW = flexCount ? Math.floor(leftover / flexCount) : 0;
  for (let i = 0; i < colWpx.length; i++) if (colWpx[i] === null) colWpx[i] = flexW;

  let largeColW = 0;
  L.cols.forEach((c, i) => { if (c.items.some(it => it.id === L.large)) largeColW = colWpx[i]; });
  const svgH = largeColW * 160 / 604;
  const baseH = H - svgH;

  const out = {};
  let x = 0;
  L.cols.forEach((c, i) => {
    const colW = colWpx[i];
    const ratioCol = isRatio[i];

    for (const it of c.items) {
      const isLarge = it.id === L.large;

      let computedCap = it.cap || (L.caps ? 'below' : 'none');
      if (isLarge && it.cap !== 'none') computedCap = 'bottom';
      const capBelow = computedCap === 'below';

      const smallImgH = isLarge ? 0
        : (ratioCol ? imgHpx : Math.round(colW * SMALL_RATIO_H / SMALL_RATIO_W));
      const smallBoxH = smallImgH + (capBelow ? vw(CAP_ALLOW_VW) : 0);
      const itemW = colW;
      const fitStackItem = L.fitStack && (it.y === 'bStackTop' || it.y === 'bStackBottom');

      let boxH;
      if (it.y === 'full') boxH = H;
      else if (it.y === 'fullTall') boxH = canvasTop + H;
      else if (it.y === 'baseTop') boxH = baseH;
      else if (fitStackItem) boxH = Math.round((baseH - g) / 2);
      else boxH = smallBoxH;

      let top;
      switch (it.y) {
        case 'full': top = 0; break;
        case 'fullTall': top = -canvasTop; break;
        case 'baseTop': top = svgH; break;
        case 'top': top = 0; break;
        case 'bottom': top = H - boxH; break;
        case 'fillTop': top = 0; break;
        case 'fillBottom': top = boxH + g; break;
        case 'bStackTop': top = H - 2 * boxH - g; break;
        case 'bStackBottom': top = H - boxH; break;
        default: top = 0;
      }

      let calcImgH = 'fill';
      if (it.imgH && it.imgH !== 'fill') {
        if (typeof it.imgH === 'object') {
          const targetH = isLarge ? H : baseH;
          calcImgH = Math.round(targetH * it.imgH.pct / 100);
        } else {
          calcImgH = vw(it.imgH);
        }
      }

      const rect = {
        left: x, top, width: itemW, height: boxH,
        imgH: calcImgH,
        size: it.size || null,
        pos: it.pos || null,
        cap: computedCap,
        capVariant: capVariant(n, isLarge),
        bg: L.bg || 'center',
        large: isLarge,
        svgOffset: it.y === 'fullTall' ? canvasTop : 0,
      };

      if (!isLarge) {
        rect.imgPxH = (calcImgH !== 'fill') ? calcImgH : (fitStackItem ? boxH : smallImgH);
        rect.imgW = itemW;
      } else if (it.ratio) {
        const availW = colW, availH = boxH;
        let fitW = availW, fitH = availW / it.ratio;
        if (fitH > availH) { fitH = availH; fitW = availH * it.ratio; }
        rect.left = x + (availW - fitW) / 2;
        rect.top = top + (availH - fitH) / 2;
        rect.width = fitW;
        rect.height = fitH;
        rect.autoRatio = true;
      }

      rect.col = i;
      out[it.id] = rect;
    }
    x += colW + g;
  });

  // colRank is a column's distance from the large card. Every animation
  // delay is derived from it — that is where the wave comes from.
  const populated = [...new Set(Object.keys(out).map(id => out[id].col))].sort((a, b) => a - b);
  const largeColIdx = out[L.large] ? out[L.large].col : populated[0];
  const largeRank = populated.indexOf(largeColIdx);
  for (const id in out) out[id].colRank = Math.abs(populated.indexOf(out[id].col) - largeRank);

  return out;
}

function setRect(el, r) {
  el.style.left = r.left + 'px';
  el.style.top = r.top + 'px';
  el.style.width = r.width + 'px';
  el.style.height = r.height + 'px';
}

function applyItemStyle(el, r, animate, deferCap) {
  const img = el.querySelector('.img');
  const inner = el.querySelector('.img-inner');
  const cap = el.querySelector('.cap');
  const svg = el.querySelector('.top-svg');
  el._capRectVariant = r.capVariant;
  // caption mode in the current composition: 'bottom', 'below' or 'none'.
  // Photo swapping reads it so it never revives a caption that isn't there.
  el._capMode = r.cap;

  inner.style.backgroundSize = 'cover';
  if (!inner.dataset.covered) inner.style.backgroundPosition = r.pos || r.bg || 'center';

  if (svg) svg.style.top = r.svgOffset ? ('calc(' + r.svgOffset + 'px - 1px)') : '';

  img.style.width = '';
  img.style.flex = '0 0 auto';
  cap.style.width = '';
  img.style.height = (r.large ? (r.imgH === 'fill' ? r.height : r.imgH) : r.imgPxH) + 'px';

  if (!deferCap) {
    if (r.cap === 'none') {
      clearTimeout(el._capT);
      if (cap.classList.contains('show')) {
        cap.classList.remove('show');
        if (animate) cap.classList.add('hide');
      } else if (!animate) {
        cap.classList.remove('show', 'hide');
      }
    } else {
      cap.style.display = 'flex';
      if (r.cap === 'bottom') {
        cap.style.position = 'absolute';
        cap.style.left = '0';
        cap.style.right = '0';
        cap.style.bottom = '0';
      } else {
        cap.style.position = 'static';
        cap.style.left = cap.style.right = cap.style.bottom = '';
      }

      if (!cap.classList.contains('show')) {
        cap.classList.remove('show', 'hide');
        applyCapText(el, r.capVariant);
        if (animate) {
          clearTimeout(el._capT);
          el._capT = setTimeout(() => cap.classList.add('show'), CFG.time.capEnter);
        } else {
          cap.classList.add('show');
        }
      }
    }
  }
  el.style.justifyContent = 'flex-start';
  el.classList.toggle('large', !!r.large);
}

function nearestEdge(r) {
  const center = r.top + r.height / 2;
  return center < canvas.clientHeight / 2 ? 'up' : 'down';
}

function offscreenTop(r) {
  const canvasTop = canvas.getBoundingClientRect().top;
  return nearestEdge(r) === 'up'
    ? -(canvasTop + r.height + EXIT_PAD)
    : canvas.clientHeight + EXIT_PAD;
}

function colDelay(colRank, animate, perCol) {
  if (!animate) return 0;
  const s = (perCol != null) ? perCol : COL_STAGGER_S;
  return (colRank || 0) * s;
}

/**
 * Resolves once a transition of the given property finishes on el.
 *
 * The CSS transitions themselves are untouched — this only changes how
 * the code learns that one ended, instead of adding up duration, delay
 * and slack and guessing.
 *
 * fallbackMs is the safety net: if the transition never started, was
 * interrupted, or the element left the tree, no event arrives and the
 * promise resolves on the old calculation instead.
 */
function whenDone(el, { prop, type = 'transitionend', fallbackMs = 2000, slack = 0 } = {}) {
  return new Promise(resolve => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener(type, onEvent);
      clearTimeout(timer);
      if (slack) setTimeout(resolve, slack);
      else resolve();
    };

    const onEvent = (e) => {
      // ignore events bubbling up from children or other properties
      if (e.target !== el) return;
      if (prop && e.propertyName && e.propertyName !== prop) return;
      finish();
    };

    el.addEventListener(type, onEvent);
    const timer = setTimeout(finish, fallbackMs);
  });
}

/* ===========================================================================
   STAND-IN FOR THE LARGE SLIDE
   =========================================================================== */

let leadTimer = null;
let morphToken = 0;
let heroTimers = [];

function clearHeroTimers() { heroTimers.forEach(clearTimeout); heroTimers = []; }
function afterHero(fn, ms) { const t = setTimeout(fn, ms); heroTimers.push(t); return t; }

function positionHero(n) {
  const rA = computeRects(n)['A'];
  hero.style.left = rA.left + 'px';
  hero.style.top = rA.top + 'px';
  hero.style.width = rA.width + 'px';
  hero.style.height = rA.height + 'px';
}

function updateHero(newN, animate, kind) {
  clearHeroTimers();
  const hImg = hero.querySelector('.img');
  const hSvg = hero.querySelector('.top-svg');
  const aSvg = els['A'].querySelector('.top-svg');
  const canvasTop = canvas.getBoundingClientRect().top;
  const H = canvas.clientHeight;
  const downY = H;
  const upY = -(canvasTop + (aSvg.offsetHeight || H * 0.2) + 40);

  if (kind === 'slideIn') {
    positionHero(newN);
    hero.style.transition = 'none';
    hImg.style.transition = 'none';
    hSvg.style.transition = 'none';
    hero.style.clipPath = 'none';
    hImg.style.clipPath = 'inset(100% 0 0 0)';
    hSvg.style.transform = 'translateY(' + downY + 'px)';
    hero.classList.add('on');
    hero.getBoundingClientRect();
    hero.style.transition = '';
    hImg.style.transition = '';
    hSvg.style.transition = '';
    aSvg.style.transition = '';
    hImg.style.clipPath = MASK_SHOWN;
    hSvg.style.transform = 'translateY(0)';
    aSvg.style.transform = 'translateY(' + upY + 'px)';
    return;
  }

  if (kind === 'slideOut') {
    if (hero.classList.contains('on')) {
      hero.style.transition = '';
      hero.style.clipPath = 'none';
      hImg.style.transition = '';
      hSvg.style.transition = '';
      hImg.style.clipPath = 'inset(100% 0 0 0)';
      hSvg.style.transform = 'translateY(' + downY + 'px)';
    }
    aSvg.style.transition = '';
    aSvg.style.transform = 'translateY(0)';
    if (animate) {
      afterHero(() => { hSvg.style.transition = 'none'; hSvg.style.transform = 'translateY(' + (downY + EXIT_PAD) + 'px)'; }, DUR_MS);
      afterHero(() => { if (!HERO_LAYOUTS.includes(current)) { hero.classList.remove('on'); hSvg.style.transition = ''; } }, DUR_MS + 550);
    } else {
      hero.classList.remove('on');
    }
    return;
  }

  if (kind === 'clipIn') {
    positionHero(newN);
    aSvg.style.transition = 'none';
    aSvg.style.transform = 'translateY(' + upY + 'px)';
    hImg.style.transition = 'none';
    hSvg.style.transition = 'none';
    hero.style.transition = 'none';
    hImg.style.clipPath = MASK_SHOWN;
    hSvg.style.transform = 'translateY(0)';
    hero.style.clipPath = MASK_HIDDEN;
    hero.classList.add('on');
    hero.getBoundingClientRect();
    hero.style.transition = 'clip-path var(--dur) var(--ease)';
    hero.style.clipPath = MASK_SHOWN;
    whenDone(hero, { prop: 'clip-path', fallbackMs: DUR_MS + 400 }).then(() => {
      if (!HERO_LAYOUTS.includes(current)) return;
      hero.style.transition = '';
      hero.style.clipPath = 'none';
    });
    return;
  }

  if (kind === 'clipOut') {
    if (hero.classList.contains('on')) {
      hImg.style.transition = 'none';
      hSvg.style.transition = 'none';
      hero.style.transition = 'none';
      hero.style.clipPath = MASK_SHOWN;
      hero.getBoundingClientRect();
      hero.style.transition = 'clip-path var(--dur) var(--ease)';
      hero.style.clipPath = MASK_HIDDEN;
      whenDone(hero, { prop: 'clip-path', fallbackMs: DUR_MS + 400 }).then(() => {
        if (HERO_LAYOUTS.includes(current)) return;
        hero.classList.remove('on');
        hero.style.transition = '';
        hero.style.clipPath = 'none';
        hImg.style.transition = '';
        hSvg.style.transition = '';
      });
    }
    aSvg.style.transition = 'none';
    aSvg.style.transform = 'translateY(0)';
    aSvg.getBoundingClientRect();
    aSvg.style.transition = '';
    return;
  }

  if (hero.classList.contains('on')) {
    hero.classList.remove('on');
    hero.style.transition = '';
    hero.style.clipPath = 'none';
    hImg.style.transition = '';
    hSvg.style.transition = '';
  }
  aSvg.style.transition = 'clip-path var(--dur) var(--ease), top var(--dur) var(--ease)';
  aSvg.style.transform = 'translateY(0)';
}

/* ===========================================================================
   SWITCHING TO THE MIRROR
   Everything closes behind a mask, is repositioned without motion,
   then opens again.
   =========================================================================== */

let animActiveUntil = 0;

function bumpAnim(ms) {
  const until = performance.now() + (ms == null ? ANIM_WATCH_MS : ms);
  if (until > animActiveUntil) animActiveUntil = until;
}
const onAnimRun = () => bumpAnim();
canvas.addEventListener('transitionrun', onAnimRun);
canvas.addEventListener('transitionstart', onAnimRun);

function maskItem(el, dur, clip, scale, delay) {
  const d = (delay || 0) + 's';
  const img = el.querySelector('.img');
  img.style.transition = 'clip-path ' + dur + 'ms var(--ease)';
  img.style.transitionDelay = d;
  img.style.clipPath = clip;
  if (scale != null) {
    const inner = el.querySelector('.img-inner');
    inner.style.transition = 'transform ' + dur + 'ms var(--ease)';
    inner.style.transitionDelay = d;
    inner.style.transform = scale;
  }
}

/**
 * Detaches the outgoing columns: the virtualiser stops touching them, so
 * their closing animation cannot collide with what is already being built
 * in their place.
 *
 * The cards are not moved into another element. Reparenting a node tears
 * down and rebuilds its composited layers, which was the single flickering
 * frame on transition. Instead the column itself becomes the ghost and a
 * fresh empty one goes into the pool.
 */
function ghostScrollCards() {
  let maxDelay = 0;
  let lastImg = null;   // the card that will finish closing last
  const ghosts = [];

  scrollCols.forEach((sc, k) => {
    if (sc.colIndex == null || !sc.cards.size) return;

    const ghost = sc.el;
    const cards = sc.cards;
    const order = scrollCardOrder(sc, k);

    // fresh element into the pool, the old one lives out its animation
    const fresh = document.createElement('div');
    fresh.className = 'scroll-col';
    canvas.appendChild(fresh);
    sc.el = fresh;
    sc.cards = new Map();
    sc.colIndex = null;
    sc._clipKey = null;
    ghosts.push(ghost);

    order.forEach((key, idx) => {
      const c = cards.get(key);
      const img = c.querySelector('.img');
      const inner = c.querySelector('.sc-inner');
      const delay = scStag(idx);
      if (delay >= maxDelay) { maxDelay = delay; lastImg = img; }

      img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
      img.style.transitionDelay = delay + 's';
      img.style.clipPath = MASK_HIDDEN;

      inner.style.transition = 'transform ' + SC_CARD_MS + 'ms var(--ease)';
      inner.style.transitionDelay = delay + 's';
      inner.style.transform = ENTER_SCALE;

      capHide(c.querySelector('.cap'), { delay });
    });
  });

  if (ghosts.length) {
    const drop = () => ghosts.forEach(g => g.remove());
    if (lastImg) {
      whenDone(lastImg, {
        prop: 'clip-path',
        fallbackMs: SC_CARD_MS + maxDelay * 1000 + 400,
        slack: 60,
      }).then(drop);
    } else {
      drop();
    }
  }
  return maxDelay;
}

function coverSetCap(img, srcId, delay, step) {
  const el = img.closest('.item');
  if (!el) return;

  // No caption in this composition, so leave it alone. Without this the
  // mid-swap branch below would see a stale 'hide' class left over from
  // an earlier transition and bring a caption back onto a small card.
  if (el._capMode === 'none') return;

  if ((el._capSrcId || el.dataset.id) === srcId) return;
  el._capSrcId = srcId;

  const cap = el.querySelector('.cap');
  const variant = el._capRectVariant || 'small';
  const dirUp = step > 0;
  clearTimeout(el._capCoverT);

  if (!cap.classList.contains('show')) {
    const midSwap = cap.classList.contains('hide');
    cap.classList.remove('hide', 'dir-up', 'cover-swap');
    applyCapText(el, variant);
    if (!midSwap) {
      setCapDelay(cap, 0, false);
      return;
    }
    cap.classList.add('cover-swap');
    cap.classList.toggle('dir-up', dirUp);
    setCapDelay(cap, 0, dirUp);
    void cap.offsetWidth;
    cap.classList.add('show');
    // a guard rather than a wait: the helper classes come off with slack,
    // because removing them early would cut the caption animation short
    el._capCoverT = setTimeout(() => {
      cap.classList.remove('cover-swap', 'dir-up');
      setCapDelay(cap, 0, false);
    }, CAP_CLEAN_MS + CAP_SLACK_MS);
    return;
  }

  clearTimeout(el._capT);
  cap.classList.add('cover-swap');
  cap.classList.toggle('dir-up', dirUp);
  cap.classList.remove('show');
  cap.classList.add('hide');
  setCapDelay(cap, delay, dirUp);

  el._capCoverT = setTimeout(() => {
    applyCapText(el, variant);
    setCapDelay(cap, 0, dirUp);
    cap.classList.remove('hide');
    cap.classList.add('show');
    el._capCoverT = setTimeout(() => {
      cap.classList.remove('cover-swap', 'dir-up');
      setCapDelay(cap, 0, false);
    }, CAP_CLEAN_MS + CAP_SLACK_MS);
  }, delay * 1000 + COVER_CAP_MS + CAP_SLACK_MS);
}

function resetItemVisuals(el) {
  const img = el.querySelector('.img');
  const inner = el.querySelector('.img-inner');
  img.style.clipPath = MASK_SHOWN;
  inner.style.transform = REST_SCALE;
  el.style.clipPath = '';
}

let maskBusy = false;

function maskToggle(toN, oldN, animate, wasScroll, isScroll) {
  if (maskBusy) return;
  maskBusy = true;
  bumpAnim(6000);
  stopScrollRAF();
  clearHeroTimers();
  clearTimeout(leadTimer);
  morphToken++;
  coverClear();

  const fromRects = LAYOUTS[oldN] ? computeRects(oldN) : {};
  const toRects = computeRects(toN);
  const heroImg = hero.querySelector('.img');
  const heroOnNow = hero.classList.contains('on');
  const hadScroll = scrollActive;
  const samePair = oldN !== 0 && String(toN).replace('m', '') === String(oldN).replace('m', '');

  if (animate && oldN !== 0 && oldN !== toN) {
    if (NO_TEXT_LAYOUTS.has(toN)) hideAllText(animate);
    else syncTextTransitions(oldN, toN, 0, 0, animate, true);
  }

  // --- exit
  let maxExit = 0;

  if (oldN !== 0) {
    for (const it of ITEMS) {
      const el = els[it.id];
      if (el.classList.contains('on')) {
        const cap = el.querySelector('.cap');
        if (cap.classList.contains('show')) {
          cap.classList.remove('show');
          if (animate) cap.classList.add('hide');
        }

        const fr = fromRects[it.id];
        const delay = sStag(fr ? fr.col : 0);
        if (delay > maxExit) maxExit = delay;

        setCapDelay(cap, delay);
        maskItem(el, MASK_MS, MASK_HIDDEN, ENTER_SCALE, delay);
      }
    }

    if (heroOnNow) {
      heroImg.style.transition = 'clip-path ' + MASK_MS + 'ms var(--ease)';
      heroImg.style.transitionDelay = '0s';
      heroImg.style.clipPath = MASK_HIDDEN;
    }
    if (scrollActive) {
      ghostScrollCards();
      scrollActive = false;
    }
  }

  const handoff = (hadScroll && samePair) ? CFG.scroll.handoff : 0;
  const exitDelayMs = oldN === 0 ? 0
    : Math.max(0, (MASK_MS + maxExit * 1000 + 20) - CFG.scroll.overlap) + handoff;

  clearTimeout(maskToggle._t);
  maskToggle._t = setTimeout(() => {
    // --- reposition, no motion
    canvas.classList.add('no-anim');
    current = toN;

    const enterDelay = animate ? (oldN === 0 ? 200 : Math.max(0, 800 - exitDelayMs)) : 0;
    if (NO_TEXT_LAYOUTS.has(toN)) hideAllText(animate);
    else syncTextTransitions(oldN, toN, 0, enterDelay, animate, false);

    for (const it of ITEMS) {
      const el = els[it.id];
      const r = toRects[it.id];
      if (r) {
        el.classList.add('on');
        applyItemStyle(el, r, true);
        setRect(el, r);
        el.style.zIndex = 2;
        const img = el.querySelector('.img');
        const inner = el.querySelector('.img-inner');
        img.style.transition = 'none';
        inner.style.transition = 'none';
        img.style.clipPath = MASK_HIDDEN;
        inner.style.transform = ENTER_SCALE;
      } else {
        el.classList.remove('on', 'large');
        el.querySelector('.cap').classList.remove('show', 'hide');
        resetItemVisuals(el);
      }
    }

    if (isScroll) {
      layoutScrollCols(toN);
      scrollCols.forEach(sc => {
        if (sc.colIndex != null) sc.el.classList.add('on');
        for (const [i, c] of sc.cards) {
          const img = c.querySelector('.img');
          const cap = c.querySelector('.cap');
          img.style.transition = 'none';
          img.style.clipPath = MASK_HIDDEN;
          if (cap) cap.classList.remove('show', 'hide');
        }
      });
      scrollActive = true;
    } else if (scrollActive) {
      scrollCols.forEach(sc => {
        sc.el.classList.remove('on');
        for (const [i, c] of sc.cards) c.remove();
        sc.cards.clear();
      });
      scrollActive = false;
    }

    const aSvg = els['A'].querySelector('.top-svg');
    const hSvg = hero.querySelector('.top-svg');
    if (HERO_LAYOUTS.includes(toN)) {
      positionHero(toN);
      hero.classList.add('on');
      heroImg.style.transition = 'none';
      heroImg.style.clipPath = MASK_HIDDEN;
      aSvg.style.transition = 'none';
      aSvg.style.transform = 'translateY(-9999px)';
      hSvg.style.transition = 'none';
      hSvg.style.transform = 'translateY(0)';
    } else {
      hero.classList.remove('on');
      aSvg.style.transition = 'none';
      aSvg.style.transform = 'translateY(0)';
      hSvg.style.transition = 'none';
      hSvg.style.transform = 'translateY(9999px)';
    }

    // forced reflow: without it the browser collapses the closed and open
    // state into one frame and nothing moves
    canvas.getBoundingClientRect();
    canvas.classList.remove('no-anim');

    // --- entry
    let maxEntry = 0;
    let lastEntry = null;   // the card that will finish opening last
    for (const it of ITEMS) {
      const r = toRects[it.id];
      if (!r) continue;
      const delay = sStag(r.col);
      if (delay >= maxEntry) { maxEntry = delay; lastEntry = els[it.id].querySelector('.img'); }
      maskItem(els[it.id], MASK_MS, MASK_SHOWN, REST_SCALE, delay);
      setCapDelay(els[it.id].querySelector('.cap'), delay);
    }

    if (isScroll) {
      scrollCols.forEach((sc, k) => {
        scrollCardOrder(sc, k).forEach((key, idx) => {
          const img = sc.cards.get(key).querySelector('.img');
          const cap = sc.cards.get(key).querySelector('.cap');
          const delay = scStag(idx);
          if (delay > maxEntry) maxEntry = delay;

          img.style.transition = 'clip-path ' + SC_CARD_MS + 'ms var(--ease)';
          img.style.transitionDelay = delay + 's';
          img.style.clipPath = MASK_SHOWN;
          if (delay >= maxEntry) { maxEntry = delay; lastEntry = img; }

          if (cap && !sc.noCaps) {
            setCapDelay(cap, delay);
            setTimeout(() => cap.classList.add('show'), CFG.time.capNudge);
          }
        });
      });
    }

    if (HERO_LAYOUTS.includes(toN)) {
      heroImg.style.transition = 'clip-path ' + MASK_MS + 'ms var(--ease)';
      heroImg.style.transitionDelay = '0s';
      heroImg.style.clipPath = MASK_SHOWN;
    }
    aSvg.style.transition = '';
    hSvg.style.transition = '';

    const entryDur = isScroll ? Math.max(MASK_MS, SC_CARD_MS) : MASK_MS;
    const release = () => { maskBusy = false; };
    if (lastEntry) {
      whenDone(lastEntry, {
        prop: 'clip-path',
        fallbackMs: entryDur + maxEntry * 1000 + 400,
        slack: 40,
      }).then(release);
    } else {
      setTimeout(release, entryDur + maxEntry * 1000 + 40);
    }
    bumpAnim(SC_CARD_MS + maxEntry * 1000 + 600);
  }, exitDelayMs);
}

/* ===========================================================================
   PHOTO SWAP ON GESTURE
   =========================================================================== */

const COVER_POOL = ITEMS.map(it => it.bg);
let coverAccum = 0;
let coverIndex = 0;
let coverLastInput = 0;
let coverGestureSpent = false;

function isCoverLayout(x) { return COVER_LAYOUTS.includes(x) }

function coverTargets() {
  const list = [];
  for (const it of ITEMS) {
    const el = els[it.id];
    if (el.classList.contains('on')) list.push(el.querySelector('.img'));
  }
  if (HERO_LAYOUTS.includes(current) && hero.classList.contains('on')) {
    list.push(hero.querySelector('.img'));
  }
  list.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return list;
}

function coverAdd(img, url, dir, delay) {
  const inner = img.querySelector('.img-inner');
  const pw = img.querySelector('.p-wrap');
  const pxo = (pw && pw._px) || 0, pyo = (pw && pw._py) || 0;

  const ov = document.createElement('div');
  ov.className = 'cover-ov';

  const ovInner = document.createElement('div');
  ovInner.className = 'cover-ov-inner';
  ovInner.style.backgroundImage = url;
  ovInner.style.backgroundSize = (inner && inner.style.backgroundSize) || 'cover';
  ovInner.style.backgroundPosition = (inner && inner.style.backgroundPosition) || 'center';
  ovInner.style.backgroundRepeat = 'no-repeat';
  ovInner.style.width = '100%';
  ovInner.style.height = '100%';
  ovInner.style.transition = 'none';
  ovInner.style.transform = 'scale(1.1)';

  ov.style.clipPath = ({
    down: 'inset(100% 100% 0 0)', up: 'inset(0 0 100% 100%)',
    right: 'inset(100% 100% 0 0)', left: 'inset(0 0 100% 100%)',
  })[dir] || 'inset(0 0 100% 100%)';
  ov.style.transform = `translate(${pxo}px, ${pyo}px) scale(var(--parallax-scale))`;
  ov.style.transition = 'none';

  ov.appendChild(ovInner);
  img.appendChild(ov);
  if (!img._covStack) img._covStack = [];
  img._covStack.push(ov);

  ov.getBoundingClientRect();

  ov.style.transition = 'clip-path var(--dur) var(--ease)';
  ov.style.transitionDelay = delay + 's';
  ov.style.clipPath = MASK_SHOWN;

  ovInner.style.transition = 'transform var(--dur) var(--ease)';
  ovInner.style.transitionDelay = delay + 's';
  ovInner.style.transform = 'scale(1)';

  const done = (e) => {
    if (e.propertyName !== 'clip-path') return;
    ov.removeEventListener('transitionend', done);
    const stack = img._covStack || [];
    const i = stack.indexOf(ov);
    if (i === -1) { ov.remove(); return; }

    const doomed = stack.slice(0, i);
    img._covStack = stack.slice(i);
    ov.style.transition = 'none';
    ovInner.style.transition = 'none';
    // animation done, this element no longer needs its own layer
    ov.style.willChange = 'auto';
    if (doomed.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => doomed.forEach(o => o.remove())));
    }
  };
  ov.addEventListener('transitionend', done);
}

function coverStep(step, dir) {
  bumpAnim();
  coverIndex = ((coverIndex + step) % COVER_CYCLE + COVER_CYCLE) % COVER_CYCLE;
  const targets = coverTargets();

  targets.forEach((img, idx) => {
    const stack = img._covStack || [];

    // Over the cap, so drop the oldest overlays.
    //
    // The base layer is deliberately left alone. Writing background-image
    // to it used to cause a flicker: the layer is composited, swapping its
    // background needs a repaint, and if the new one wasn't ready in the
    // same frame you saw one frame of the old image. Every overlay ends
    // fully open, so keeping the last few means the base is never visible.
    if (stack.length >= COVER_MAX) {
      const drop = stack.length - COVER_MAX + 1;
      const doomed = stack.slice(0, drop);
      img._covStack = stack.slice(drop);
      requestAnimationFrame(() => requestAnimationFrame(() => doomed.forEach(o => o.remove())));
    }

    const poolIdx = (coverIndex + idx) % COVER_POOL.length;
    const delay = Math.min(idx * COVER_STAGGER_S, COVER_STAGGER_CAP);
    coverAdd(img, COVER_POOL[poolIdx], dir, delay);
    coverSetCap(img, ITEMS[poolIdx].id, delay, step);
  });

  updateCoverIndex(step);
}

function updateCoverIndex(step) {
  const newVal = coverIndex + 1;
  document.querySelectorAll('.text-wrapper .idx-mask').forEach(mask => {
    const el = mask.querySelector('.index');
    if (el.textContent === String(newVal)) return;

    if (!step) { el.textContent = newVal; return; }

    const outY = step > 0 ? '-105%' : '105%';
    const inY = step > 0 ? '105%' : '-105%';

    el.style.transition = 'transform 0.4s var(--ease)';
    el.style.transform = `translateY(${outY})`;

    const onOut = (e) => {
      if (e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', onOut);
      el.style.transition = 'none';
      el.textContent = newVal;
      el.style.transform = `translateY(${inY})`;
      el.getBoundingClientRect();
      el.style.transition = 'transform 0.4s var(--ease)';
      el.style.transform = 'translateY(0%)';
    };
    el.addEventListener('transitionend', onOut);
  });
}

function coverManualStep(step) {
  if (busy) return;
  if (!isCoverLayout(current)) return;
  coverStep(step, step > 0 ? 'right' : 'left');
}

/** One step per gesture, until there is a pause. */
function coverScroll(delta, axis) {
  if (busy) return;
  const now = performance.now();

  if (now - coverLastInput > COVER_GESTURE_GAP) {
    coverGestureSpent = false;
    coverAccum = 0;
  }
  coverLastInput = now;

  if (coverGestureSpent) return;
  coverAccum += delta;

  if (Math.abs(coverAccum) >= COVER_STEP_PX) {
    const fwd = coverAccum >= 0;
    coverGestureSpent = true;
    coverAccum = 0;
    const dir = (axis === 'x') ? (fwd ? 'right' : 'left') : (fwd ? 'down' : 'up');
    coverStep(fwd ? 1 : -1, dir);
  }
}

function coverClear() {
  const commit = (img) => {
    if (!img) return;
    const stack = img._covStack || [];
    const inner = img.querySelector('.img-inner');
    if (stack.length) {
      const top = stack[stack.length - 1];
      const topInner = top.querySelector('.cover-ov-inner') || top;
      if (inner && topInner.style.backgroundImage) {
        inner.style.backgroundImage = topInner.style.backgroundImage;
        inner.style.backgroundPosition = topInner.style.backgroundPosition || 'center';
        inner.style.backgroundSize = topInner.style.backgroundSize || 'cover';
        inner.dataset.covered = '1';
      }
    }

    if (inner) {
      inner.style.transition = 'none';
      inner.style.transform = REST_SCALE;
      inner.getBoundingClientRect();
      inner.style.transition = '';
    }

    img._covStack = [];
    if (stack.length) {
      requestAnimationFrame(() => requestAnimationFrame(() => stack.forEach(o => o.remove())));
    }
  };

  for (const it of ITEMS) {
    const el = els[it.id];
    clearTimeout(el._capCoverT);
    el.querySelector('.cap').classList.remove('cover-swap');
    commit(el.querySelector('.img'));
  }
  commit(hero.querySelector('.img'));
  coverAccum = 0;
}

/* ===========================================================================
   COMPOSITION TEXT
   =========================================================================== */

function textShown(tText) {
  const cs = getComputedStyle(tText).transform;
  if (cs === 'none') return false;
  let ty;
  try { ty = new DOMMatrixReadOnly(cs).m42; } catch (e) { return false; }
  return ty < (tText.offsetHeight || 1) * 0.5;
}

function hideAllText(animate, delayMs = 0) {
  document.querySelectorAll('.text-wrapper .visibility').forEach(el => {
    el.querySelectorAll('.t-text').forEach((tText, i) => {
      clearTimeout(tText._tEnter);
      clearTimeout(tText._tExit);
      clearTimeout(tText._tHidden);

      const isShown = textShown(tText);
      const lineDelay = delayMs + (i * LINE_STAGGER_MS);

      if (!animate || !isShown) {
        tText.style.animation = 'none';
        tText.style.transition = 'none';
        tText.style.transform = 'translateY(120%)';
        tText.classList.remove('is-active');
        tText._textState = 'hidden';
        return;
      }

      tText._tExit = setTimeout(() => {
        tText.style.animation = 'none'; void tText.offsetWidth;
        tText.style.animation = 'textExit var(--dur) var(--ease) both';
        tText.classList.remove('is-active');
        tText._textState = 'exiting';
        tText._tHidden = setTimeout(() => {
          if (tText._textState === 'exiting') tText._textState = 'hidden';
        }, CFG.time.textGuard);
      }, lineDelay);
    });
  });
}

function syncTextTransitions(oldN, newN, exitDelayMs, enterDelayMs, animate, doExitPhaseOnly = null) {
  if (NO_TEXT_LAYOUTS.has(newN)) {
    if (doExitPhaseOnly === null || doExitPhaseOnly === true) hideAllText(animate, exitDelayMs);
    return;
  }

  const newClass = 'is--' + newN;

  document.querySelectorAll('.text-wrapper .visibility').forEach(el => {
    const isInNew = el.classList.contains(newClass);

    el.querySelectorAll('.t-text').forEach((tText, i) => {
      const staggerExit = exitDelayMs + (i * LINE_STAGGER_MS);
      const staggerEnter = enterDelayMs + (i * LINE_STAGGER_MS);

      if (!animate) {
        clearTimeout(tText._tExit);
        clearTimeout(tText._tEnter);
        tText.style.animation = 'none';
        tText.style.transform = isInNew ? 'translateY(0%)' : 'translateY(120%)';
        tText.classList.toggle('is-active', isInNew);
        tText._textState = isInNew ? 'visible' : 'hidden';
        return;
      }

      if (doExitPhaseOnly === null || doExitPhaseOnly === true) {
        if (!isInNew && textShown(tText)) {
          clearTimeout(tText._tExit);
          tText._tExit = setTimeout(() => {
            tText.style.animation = 'none'; void tText.offsetWidth;
            tText.style.animation = 'textExit var(--dur) var(--ease) both';
            tText.classList.remove('is-active');
            tText._textState = 'hidden';
          }, staggerExit);
        }
      }

      if (doExitPhaseOnly === null || doExitPhaseOnly === false) {
        if (isInNew) {
          if (textShown(tText)) {
            tText.classList.add('is-active');
            tText._textState = 'visible';
          } else {
            clearTimeout(tText._tEnter);
            tText._tEnter = setTimeout(() => {
              tText.style.animation = 'none'; void tText.offsetWidth;
              tText.style.animation = 'textEnter var(--dur) var(--ease) both';
              tText.classList.add('is-active');
              tText._textState = 'visible';
            }, staggerEnter);
          }
        }
      }
    });
  });
}

/* ===========================================================================
   MORPHING A COMPOSITION
   Shared cards travel, new ones fly in from the edge, leftovers fly out.
   =========================================================================== */

/** Returns how long the transition will take — the nav lock waits on it. */
function applyLayout(n, animate = true) {
  if (!LAYOUTS[n]) return 0;
  coverClear();
  const oldN = current;

  const wasScroll = isScrollLayout(oldN);
  const isScroll = isScrollLayout(n);

  // two scroll compositions with different large cards cannot be morphed:
  // the column set differs, so that transition goes through the mask
  if (animate && n !== oldN && wasScroll && isScroll && LAYOUTS[n].large !== LAYOUTS[oldN].large) {
    maskToggle(n, oldN, animate, wasScroll, isScroll);
    return MASK_LOCK_MS;
  }

  const rects = computeRects(n);

  const wasHero = HERO_LAYOUTS.includes(oldN);
  const isHero = HERO_LAYOUTS.includes(n);
  const pairSet = new Set([oldN, n]);
  const isDirect = (pairSet.has('1') && pairSet.has('2')) || (pairSet.has('1m') && pairSet.has('2m'));

  let kind = 'none';
  if (isHero && !wasHero) kind = isDirect ? 'slideIn' : 'clipIn';
  else if (!isHero && wasHero) kind = isDirect ? 'slideOut' : 'clipOut';

  const isSameLargeScroll = wasScroll && isScroll && LAYOUTS[n].large === LAYOUTS[oldN].large;
  if (wasScroll && (!isScroll || isSameLargeScroll)) scrollHide(animate);

  // captions that won't exist in the new composition leave first
  let needLead = false;
  if (animate) {
    for (const it of ITEMS) {
      const el = els[it.id];
      const cap = el.querySelector('.cap');
      if (el.classList.contains('on') && cap.classList.contains('show')) {
        const dest = rects[it.id];
        if (!(dest && dest.cap && dest.cap !== 'none')) {
          clearTimeout(el._capT);
          capHide(cap);
          needLead = true;
        }
      }
    }
  }

  const scrollExitLead = (animate && wasScroll && (!isScroll || isSameLargeScroll)) ? SCROLL_EXIT_LEAD_MS : 0;
  const lead = Math.max(needLead ? CAP_FADE_MS : 0, scrollExitLead);

  current = n;
  clearTimeout(leadTimer);
  const token = ++morphToken;

  if (animate) syncTextTransitions(oldN, n, 0, 0, animate, true);

  const run = () => {
    if (token !== morphToken) return;

    const enterDelay = animate ? Math.max(0, 600 - lead) : 0;
    syncTextTransitions(oldN, n, 0, enterDelay, animate, false);

    runLayoutMorph(n, rects, kind, animate, oldN);

    if (isScroll) {
      if (!wasScroll || isSameLargeScroll) {
        scrollShow(n, animate);
      } else {
        layoutScrollCols(n);
        scrollCols.forEach(sc => { if (sc.colIndex != null) sc.el.classList.add('on'); });
        scrollActive = true;
      }
    }
  };

  if (lead) leadTimer = setTimeout(run, lead);
  else run();

  // columns leaving, then the move itself, plus the furthest column's delay
  const maxRank = Math.max(0, ...Object.values(rects).map(r => r.colRank || 0));
  const tail = animate ? colDelay(maxRank, animate) * 1000 : 0;
  return animate ? lead + DUR_MS + tail + CFG.lock.tail : 0;
}

function runLayoutMorph(n, rects, kind, animate, fromN) {
  const fromRects = LAYOUTS[fromN] ? computeRects(fromN) : {};
  const oldLargeId = LAYOUTS[fromN] ? LAYOUTS[fromN].large : null;
  const newLargeId = LAYOUTS[n].large;

  const largeSwapClears = !!(animate && (n === '1' || n === '1m')
    && oldLargeId && oldLargeId !== newLargeId
    && rects[oldLargeId] && !rects[oldLargeId].large);

  for (const it of ITEMS) {
    const el = els[it.id];
    const r = rects[it.id];
    const was = el.classList.contains('on');
    const wasLarge = fromRects[it.id] && fromRects[it.id].large;

    // the large card leaves with its own downward motion
    if (it.id === 'A' && kind === 'clipOut' && was && !r && animate) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      const capEl = el.querySelector('.cap');
      const capPad = capEl.offsetHeight + vw(3.5);
      el.style.transitionDelay = '0s';
      el.style.transition = 'none';
      el.style.clipPath = `inset(0px -2px ${-capPad}px -2px)`;
      img.style.transition = 'none';
      inner.style.transition = 'none';
      el.getBoundingClientRect();
      el.style.transition = 'clip-path var(--dur) var(--ease)';
      el.style.clipPath = 'inset(0px -2px 100% -2px)';
      const done = (e) => {
        if (e.target !== el || e.propertyName !== 'clip-path') return;
        el.removeEventListener('transitionend', done);
        if (!computeRects(current)[it.id]) {
          el.classList.remove('on', 'large');
          el.style.transition = '';
          img.style.transition = '';
          inner.style.transition = '';
          el.querySelector('.cap').classList.remove('show', 'hide');
        }
      };
      el.addEventListener('transitionend', done);
      continue;
    }

    if (it.id === 'A' && kind === 'clipIn' && !was && r && animate) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      const cap = el.querySelector('.cap');
      el.classList.add('on');
      el.style.transition = 'none';
      img.style.transition = 'none';
      inner.style.transition = 'none';
      resetItemVisuals(el);
      applyItemStyle(el, r, animate);
      clearTimeout(el._capT);
      cap.classList.remove('show', 'hide');
      applyCapText(el, r.capVariant);
      setCapDelay(cap, 0);
      setRect(el, r);
      el.style.zIndex = 1;
      el.style.clipPath = MASK_HIDDEN;
      el.getBoundingClientRect();
      el.style.transition = 'clip-path var(--dur) var(--ease)';
      el.style.transitionDelay = '0s';
      el.style.clipPath = MASK_SHOWN;
      whenDone(el, { prop: 'clip-path', fallbackMs: DUR_MS + 400 }).then(() => {
        if (current !== n) return;
        el.style.clipPath = '';
        el.style.transition = '';
        img.style.transition = '';
        inner.style.transition = '';
        cap.classList.add('show');
      });
      continue;
    }

    // present in both compositions, so it travels
    if (r && was) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      img.style.transition = '';
      inner.style.transition = '';
      el.style.transition = '';
      el.style.clipPath = '';

      const survRank = fromRects[it.id] ? fromRects[it.id].colRank : r.colRank;
      const dSec = largeSwapClears
        ? (it.id === oldLargeId ? 0 : colDelay(r.colRank, animate, SWAP_COL_STAGGER_S))
        : colDelay(survRank, animate);
      const d = dSec + 's';
      el.style.transitionDelay = d;
      img.style.transitionDelay = d;
      inner.style.transitionDelay = d;

      const cap = el.querySelector('.cap');
      const fr = fromRects[it.id];
      const capWasShown = cap.classList.contains('show');
      const fromBottom = fr && fr.cap === 'bottom';
      const toBottom = r.cap === 'bottom';
      const modeChanged = animate && capWasShown && fr && fr.cap !== 'none' && r.cap !== 'none' && (fromBottom !== toBottom);
      const largeRefresh = animate && capWasShown && wasLarge && r.large;
      const variantChanged = animate && capWasShown && fr && fr.capVariant !== r.capVariant;
      const manageCap = modeChanged || largeRefresh || variantChanged;

      setRect(el, r);
      applyItemStyle(el, r, animate, manageCap);

      if (manageCap) {
        cap.classList.remove('show');
        cap.classList.add('hide');
        setCapDelay(cap, dSec);
        clearTimeout(el._capT);
        el._capT = setTimeout(() => {
          if (current !== n) return;
          applyCapText(el, r.capVariant);
          if (toBottom) {
            cap.style.position = 'absolute';
            cap.style.left = '0'; cap.style.right = '0'; cap.style.bottom = '0';
          } else {
            cap.style.position = 'static';
            cap.style.left = cap.style.right = cap.style.bottom = '';
          }
          setCapDelay(cap, 0);
          cap.classList.remove('hide');
          cap.classList.add('show');
        }, DUR_MS * CFG.time.capSwapAt);
      } else if (!cap.classList.contains('show')) {
        setCapDelay(cap, dSec);
      }

      el.style.zIndex = 2;
    }

    // new card, flies in from the nearest edge
    else if (r && !was) {
      const img = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      el.classList.add('on');
      el.style.transition = 'none';
      img.style.transition = 'none';
      inner.style.transition = 'none';
      resetItemVisuals(el);
      applyItemStyle(el, r, animate);
      setRect(el, { ...r, top: animate ? offscreenTop(r) : r.top });
      el.style.zIndex = 1;
      el.getBoundingClientRect();
      el.style.transition = '';
      img.style.transition = '';
      inner.style.transition = '';

      const extra = (largeSwapClears && it.id === newLargeId) ? (LARGE_ENTRY_DELAY_MS / 1000) : 0;
      const delaySec = colDelay(r.colRank, animate) + extra;
      const delayStr = delaySec + 's';
      el.style.transitionDelay = delayStr;
      img.style.transitionDelay = delayStr;
      inner.style.transitionDelay = delayStr;
      el.style.top = r.top + 'px';

      setCapDelay(el.querySelector('.cap'), delaySec);
    }

    // gone in the new composition, flies out the same way
    else if (!r && was) {
      const cur = { top: el.offsetTop, left: el.offsetLeft, height: el.offsetHeight };
      el.style.zIndex = 1;
      el.classList.remove('large');

      const cap = el.querySelector('.cap');
      clearTimeout(el._capT);
      if (cap.classList.contains('show')) {
        cap.classList.remove('show');
        cap.classList.add('hide');
      }

      if (!animate) { el.classList.remove('on'); continue; }

      const exitRank = fromRects[it.id] ? fromRects[it.id].colRank : 0;
      const exitSec = colDelay(exitRank, animate);
      el.style.transitionDelay = exitSec + 's';
      setCapDelay(cap, exitSec);
      el.style.top = offscreenTop(cur) + 'px';

      // retire the card once the move has actually finished
      whenDone(el, {
        prop: 'top',
        fallbackMs: DUR_MS + exitSec * 1000 + 400,
      }).then(() => {
        if (computeRects(current)[it.id]) return;
        el.classList.remove('on', 'large');
        cap.classList.remove('show', 'hide');
        resetItemVisuals(el);
      });
    }
  }

  updateHero(n, animate, kind);
}

/* ===========================================================================
   NAVIGATION
   =========================================================================== */

let curPair = 0, curSide = 'main';
let wantPair = 0, wantSide = 'main';
let busy = false, busyTimer = null;

function requestNav(pair, side) {
  if (busy) return;
  wantPair = pair;
  wantSide = side;
  pump();
}

function pump() {
  if (wantPair === curPair && wantSide === curSide) return;
  const n = PAIRS[wantPair][wantSide];
  if (n === current) {
    curPair = wantPair; curSide = wantSide;
    canvas.dataset.pair = wantPair + 1;
    return;
  }

  const sideFlip = (wantPair === curPair && wantSide !== curSide);

  if (maskBusy) { wantPair = curPair; wantSide = curSide; return; }

  curPair = wantPair; curSide = wantSide;
  canvas.dataset.pair = wantPair + 1;
  canvas.dataset.layout = n;

  busy = true;
  bumpAnim();

  let lockMs;
  if (sideFlip) {
    maskToggle(n, current, true, isScrollLayout(current), isScrollLayout(n));
    lockMs = MASK_LOCK_MS;
  } else {
    // applyLayout decides between morph and mask itself, and reports the
    // real duration of whichever it picked
    lockMs = applyLayout(n);
  }
  lockMs = Math.max(CFG.lock.min, lockMs);

  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => { busy = false; }, lockMs);
}

window.addEventListener('keydown', (e) => {
  const nums = Object.keys(BASE_LAYOUTS);
  const keys = [...nums, 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
  if (!keys.includes(e.key)) return;
  e.preventDefault();

  const numIdx = nums.indexOf(e.key);
  if (numIdx !== -1) { requestNav(numIdx, wantSide); return; }

  const side = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 'mirror' : 'main';
  requestNav(wantPair, side);
});

document.getElementById('nav-left').addEventListener('click', () => requestNav(wantPair, 'main'));
document.getElementById('nav-right').addEventListener('click', () => requestNav(wantPair, 'mirror'));

document.querySelectorAll('.nav-num-wrapper').forEach(el => {
  el.addEventListener('click', () => requestNav(parseInt(el.dataset.idx, 10), wantSide));
});

document.querySelectorAll('.svg-arrow-wrapper.is--next').forEach(el => {
  el.addEventListener('click', (e) => { e.stopPropagation(); coverManualStep(1); });
});
document.querySelectorAll('.svg-arrow-wrapper.is--prev').forEach(el => {
  el.addEventListener('click', (e) => { e.stopPropagation(); coverManualStep(-1); });
});

updateCoverIndex();

/* --- Resize -------------------------------------------------------------- */

let rT;
let lastWinW = window.innerWidth;

window.addEventListener('resize', () => {
  if (window.innerWidth === lastWinW) return;
  lastWinW = window.innerWidth;

  VW_PX = getVwPx();
  VH_PX = getVhPx();
  winW = window.innerWidth;
  winH = window.innerHeight;
  maxDist = Math.hypot(winW, winH);
  bumpAnim(600);
  canvas.classList.add('no-anim');
  applyLayout(current, false);
  clearTimeout(rT);
  rT = setTimeout(() => canvas.classList.remove('no-anim'), CFG.time.resizeSettle);
});

/* ===========================================================================
   START
   =========================================================================== */

function urlToPath(u) {
  const m = /url\((['"]?)(.*?)\1\)/.exec(u || '');
  return m ? m[2] : (u || '');
}

const _preloadedImages = [];

/** Decode everything up front, otherwise the first card reveal flickers. */
function preloadAllImages() {
  const urls = new Set();
  for (const it of ITEMS) urls.add(it.bg);
  urls.add(S2);

  let pending = urls.size;
  return new Promise(resolve => {
    if (!pending) return resolve();
    urls.forEach(u => {
      const im = new Image();
      im.src = urlToPath(u);
      _preloadedImages.push(im);
      im.decode().catch(() => {}).finally(() => { if (--pending === 0) resolve(); });
    });
  });
}

let introStarted = false;

function startIntro() {
  if (introStarted) return;
  introStarted = true;

  requestAnimationFrame(() => {
    canvas.classList.remove('no-anim');
    canvas.dataset.pair = 1;
    maskToggle('1', 0, true, false, false);
    bumpAnim();

    setTimeout(() => {
      topbarEls.forEach((el, index) => {
        el.style.transition = 'transform var(--dur) var(--ease)';
        el.style.transitionDelay = (index * 0.08) + 's';
        el.style.transform = 'translateY(0%)';
      });
    }, 100);

    setTimeout(() => { busy = false; }, INTRO_LOCK_MS);
  });
}

/* ===========================================================================
   PARALLAX
   Only the large image of a composition reacts to the cursor.
   =========================================================================== */

let curMouseX = window.innerWidth / 2;
let curMouseY = window.innerHeight / 2;
let targetMouseX = curMouseX;
let targetMouseY = curMouseY;

window.addEventListener('mousemove', (e) => {
  targetMouseX = e.clientX;
  targetMouseY = e.clientY;
});

let winW = window.innerWidth;
let winH = window.innerHeight;
let maxDist = Math.hypot(winW, winH);

const PARALLAX = [];
for (const it of ITEMS) {
  const w = els[it.id].querySelector('.p-wrap');
  if (w) PARALLAX.push({ wrap: w, host: els[it.id], img: w.closest('.img'), item: true, tx: 0, ty: 0 });
}
{
  const w = hero.querySelector('.p-wrap');
  if (w) PARALLAX.push({ wrap: w, host: hero, img: w.closest('.img'), item: false, tx: 0, ty: 0 });
}

const PX_EPS = CFG.parallax.eps;
let parallaxSettled = false;

function rafParallax() {
  const dxm = targetMouseX - curMouseX, dym = targetMouseY - curMouseY;
  const mouseMoving = Math.abs(dxm) > 0.1 || Math.abs(dym) > 0.1;

  // the loop sleeps while the mouse is still and nothing is animating
  if (!mouseMoving && parallaxSettled && performance.now() > animActiveUntil) {
    requestAnimationFrame(rafParallax);
    return;
  }

  if (mouseMoving) {
    curMouseX += dxm * CFG.parallax.follow;
    curMouseY += dym * CFG.parallax.follow;
  } else {
    curMouseX = targetMouseX;
    curMouseY = targetMouseY;
  }

  for (const p of PARALLAX) {
    // eligibility: on AND large. Small cards never move.
    const eligible = p.item
      ? (p.host.classList.contains('on') && p.host.classList.contains('large'))
      : p.host.classList.contains('on');
    if (eligible && !p.wrap._wasEligible) { p.wrap._px = 0; p.wrap._py = 0; p._force = true; }
    p.wrap._wasEligible = eligible;

    let tx = 0, ty = 0;
    if (eligible) {
      const rect = p.wrap.getBoundingClientRect();
      if (rect.width && rect.height) {
        const cX = rect.left + rect.width / 2;
        const cY = rect.top + rect.height / 2;
        const dist = Math.hypot(curMouseX - cX, curMouseY - cY);
        // the closer the cursor is to the centre, the more it moves
        const intensity = Math.max(0, 1 - (dist / (maxDist * CFG.parallax.falloff)));
        const factor = CFG.parallax.floor + intensity * (1 - CFG.parallax.floor);
        tx = ((curMouseX / winW) - 0.5) * 2 * rect.width * CFG.parallax.amount * factor;
        ty = ((curMouseY / winH) - 0.5) * 2 * rect.height * CFG.parallax.amount * factor;
      }
    }
    p.tx = tx; p.ty = ty;
  }

  let allSettled = true;
  for (const p of PARALLAX) {
    const wrap = p.wrap;
    const cx = wrap._px || 0, cy = wrap._py || 0;
    let nx = cx + (p.tx - cx) * CFG.parallax.ease;
    let ny = cy + (p.ty - cy) * CFG.parallax.ease;
    if (Math.abs(p.tx - nx) < PX_EPS && Math.abs(p.ty - ny) < PX_EPS) { nx = p.tx; ny = p.ty; }
    else allSettled = false;
    if (!p._force && nx === cx && ny === cy) continue;
    p._force = false;

    wrap._px = nx; wrap._py = ny;
    const t = `translate(${nx}px, ${ny}px)`;
    wrap.style.transform = t;

    // photo-swap overlays travel with the base layer
    if (p.img && p.img.childElementCount > 1) {
      p.img.querySelectorAll('.cover-ov').forEach(o => {
        o.style.transform = t + ' scale(var(--parallax-scale))';
      });
    }
  }
  parallaxSettled = allSettled && !mouseMoving;

  requestAnimationFrame(rafParallax);
}

requestAnimationFrame(rafParallax);

/* --- Boot ---------------------------------------------------------------- */

canvas.classList.add('no-anim');
current = 0;

const topbarEls = document.querySelectorAll('.topbar .t-topbar-text');
topbarEls.forEach(el => {
  el.style.transition = 'none';
  el.style.transform = 'translateY(-120%)';
});

busy = true;

// The intro waits for the landing gate (gate.js) to be opened. Images keep
// preloading behind it; after the click we wait for them at most introFallback.
const imagesReady = preloadAllImages();
(window.GATE_READY || Promise.resolve())
  .then(() => Promise.race([imagesReady, new Promise(r => setTimeout(r, CFG.time.introFallback))]))
  .then(startIntro);

/* ===========================================================================
   SHADER LAYER
   Adds nothing on top of the page — it redraws the same images itself.
   That is why it can be switched off at any time without breaking anything.
   =========================================================================== */

(function () {
  'use strict';

  const S = CFG.shader;
  const DPR = Math.min(window.devicePixelRatio || 1, S.dprCap);
  const HOVER_RADIUS = S.hoverRadius * DPR;
  const CENTER_FADE = S.centerFade * DPR;
  const BEAST_MS = CFG.time.beast;

  let active = false;
  let raf = null;
  let glCanvas = null, gl = null;
  let prog = null, U = {}, quadBuf = null;

  let mX = -99999, mY = -99999;
  let sX = -99999, sY = -99999;
  let presence = 0.0;
  let over = false;

  let startT = 0;
  let lastFrame = 0;
  let beastBusy = false;

  const TEX = new Map();

  /** Read the background from CSS so the colour lives in one place. */
  function pageColor() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#FFFDF3';
    const hex = raw.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const n = parseInt(full, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  let BG = pageColor();

  window.addEventListener('keydown', (e) => {
    if (!e.key || e.key.toLowerCase() !== S.key) return;
    e.preventDefault();
    if (beastBusy) return;
    active ? deactivate() : activate();
  });

  function extractPath(bg) {
    if (!bg) return '';
    const m = /url\((['"]?)(.*?)\1\)/.exec(bg);
    return m ? m[2] : '';
  }

  function px(tok, ref) {
    tok = (tok || '').trim();
    if (tok.endsWith('%')) return parseFloat(tok) / 100 * ref;
    if (tok.endsWith('vw')) return parseFloat(tok) / 100 * window.innerWidth;
    if (tok.endsWith('vh')) return parseFloat(tok) / 100 * window.innerHeight;
    const n = parseFloat(tok);
    return isNaN(n) ? 0 : n;
  }

  function parseInset(clip, w, h) {
    if (!clip) return null;
    clip = clip.trim();
    if (clip === 'none' || clip.indexOf('inset') < 0) return null;
    const m = clip.match(/inset\(([^)]*)\)/);
    if (!m) return null;
    const p = m[1].split('round')[0].trim().split(/\s+/).filter(Boolean);
    const V = (t, ref) => t.endsWith('%') ? parseFloat(t) / 100 * ref : parseFloat(t);
    let t, r, b, l;
    if (p.length === 1) { t = V(p[0], h); r = V(p[0], w); b = V(p[0], h); l = V(p[0], w); }
    else if (p.length === 2) { t = V(p[0], h); b = V(p[0], h); r = V(p[1], w); l = V(p[1], w); }
    else if (p.length === 3) { t = V(p[0], h); r = V(p[1], w); l = V(p[1], w); b = V(p[2], h); }
    else { t = V(p[0], h); r = V(p[1], w); b = V(p[2], h); l = V(p[3], w); }
    return { t, r, b, l };
  }

  /** The visible part of an element, accounting for its current mask. */
  function visibleRect(el) {
    const rc = el.getBoundingClientRect();
    const out = { left: rc.left, top: rc.top, width: rc.width, height: rc.height };
    const computed = getComputedStyle(el).clipPath;
    const clipStr = (computed && computed !== 'none') ? computed : el.style.clipPath;
    const ins = parseInset(clipStr, rc.width, rc.height);
    if (ins) {
      out.left = rc.left + ins.l;
      out.top = rc.top + ins.t;
      out.width = Math.max(0, rc.width - ins.l - ins.r);
      out.height = Math.max(0, rc.height - ins.t - ins.b);
    }
    return out;
  }

  function intersect(a, b) {
    const l = Math.max(a.left, b.left);
    const t = Math.max(a.top, b.top);
    const r = Math.min(a.left + a.width, b.left + b.width);
    const bt = Math.min(a.top + a.height, b.top + b.height);
    return { left: l, top: t, width: Math.max(0, r - l), height: Math.max(0, bt - t) };
  }

  /** Pulls the bow amount out of a column's path(). */
  function columnBow(el) {
    const cs = el.style.clipPath || getComputedStyle(el).clipPath;
    if (!cs || cs.indexOf('path') < 0) return null;
    const nums = cs.match(/-?\d+\.?\d*/g);
    if (!nums || nums.length < 5) return null;
    const W = parseFloat(nums[2]);
    const cx = parseFloat(nums[4]);
    const pinch = Math.max(0, W - cx);
    if (pinch < 0.5) return null;
    const rc = el.getBoundingClientRect();
    return { pinch: pinch * DPR, x: rc.left * DPR, y: rc.top * DPR, w: rc.width * DPR, h: rc.height * DPR };
  }

  function parseBgSize(str, Bw, Bh, R) {
    str = (str || 'cover').trim();
    if (str === 'cover') return (Bw / Bh > R) ? { dw: Bw, dh: Bw / R } : { dw: Bh * R, dh: Bh };
    if (str === 'contain') return (Bw / Bh > R) ? { dw: Bh * R, dh: Bh } : { dw: Bw, dh: Bw / R };
    if (str === 'auto') return { dw: Bh * R, dh: Bh };
    const parts = str.split(/\s+/);
    if (parts.length === 1) {
      if (parts[0] === 'auto') return { dw: Bh * R, dh: Bh };
      const w = px(parts[0], Bw);
      return { dw: w, dh: w / R };
    }
    let w = parts[0] === 'auto' ? null : px(parts[0], Bw);
    let h = parts[1] === 'auto' ? null : px(parts[1], Bh);
    if (w == null && h != null) w = h * R;
    if (h == null && w != null) h = w / R;
    if (w == null && h == null) { w = Bw; h = Bw / R; }
    return { dw: w, dh: h };
  }

  function parseBgPos(str, Bw, Bh, dw, dh) {
    str = (str || 'center').trim();
    let parts = str.split(/\s+/);
    const kX = { left: '0%', right: '100%', center: '50%' };
    const kY = { top: '0%', bottom: '100%', center: '50%' };
    if (parts.length === 1) parts = [parts[0], '50%'];
    const xa = kX[parts[0]] || parts[0];
    const ya = kY[parts[1]] || parts[1];
    const ox = xa.endsWith('%') ? (Bw - dw) * (parseFloat(xa) / 100) : px(xa, Bw);
    const oy = ya.endsWith('%') ? (Bh - dh) * (parseFloat(ya) / 100) : px(ya, Bh);
    return { ox, oy };
  }

  const VS = `
    precision mediump float;
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform vec2 u_resolution, u_quadPos, u_quadSize;
    varying vec2 v_texCoord;
    void main() {
      vec2 pos = (a_position * u_quadSize + u_quadPos) / u_resolution;
      vec2 clip = pos * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
      v_texCoord = a_texCoord;
    }`;

  const FS = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_uvScale, u_uvOffset;
    uniform vec2 u_quadPos, u_quadSize, u_mouse;
    uniform float u_time, u_hoverRadius;
    uniform float u_useBow, u_bow;
    uniform vec4 u_bowRect;

    uniform float u_centerFade;
    uniform float u_pullStrength;
    uniform float u_pullInvert;
    uniform float u_threadScale;
    uniform float u_warpAmount;
    uniform float u_iridescent;
    uniform float u_smearOpacity;
    uniform float u_lumaMin;
    uniform float u_lumaMax;
    uniform float u_dither;
    uniform float u_presence;

    varying vec2 v_texCoord;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }
    // five noise octaves: each one rotates and doubles in scale
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 frag = u_quadPos + v_texCoord * u_quadSize;

      // column bow: one parabola instead of separate geometry
      if (u_useBow > 0.5) {
        float vy = clamp((frag.y - u_bowRect.y) / u_bowRect.w, 0.0, 1.0);
        float bowAmt = 3.0 * u_bow * vy * (1.0 - vy);
        float fx = frag.x - u_bowRect.x;
        if (fx < bowAmt || fx > u_bowRect.z - bowAmt) discard;
      }

      vec2 uv = clamp(v_texCoord * u_uvScale + u_uvOffset, 0.0, 1.0);
      vec4 originalColor = texture2D(u_image, uv);

      vec2 center = u_quadPos + u_quadSize * 0.5;
      vec2 delta = u_mouse - center;
      float distToCenter = length(delta);
      vec2 dir = distToCenter > 0.1 ? normalize(delta) : vec2(0.0, 1.0);
      if (u_pullInvert > 0.5) dir = -dir;

      // the effect lives in a ring: it fades far away and under the cursor
      float activation = smoothstep(u_hoverRadius, u_quadSize.x * 0.2, distToCenter);
      activation *= smoothstep(0.0, u_centerFade, distToCenter);
      activation *= u_presence;

      vec3 acc = vec3(0.0);
      float totalWeight = 0.0;

      // the heavy part is gated: no samples are taken where there is no effect
      if (activation > 0.0 && u_mouse.x > -1000.0) {
        float jitter = hash(gl_FragCoord.xy) * u_dither;
        for (int i = 0; i < ${S.samples}; i++) {
          float f = (float(i) + jitter) / ${S.samples}.0;

          float n = fbm(uv * u_threadScale + u_time * 0.4);
          vec2 warpedDir = normalize(dir + vec2(n - 0.5) * u_warpAmount);

          vec2 suv = uv - warpedDir * (f * u_pullStrength * activation);
          suv = clamp(suv, 0.0, 1.0);

          vec4 sTex = texture2D(u_image, suv);

          float luma = dot(sTex.rgb, vec3(0.299, 0.587, 0.114));
          float mask = 1.0 - smoothstep(u_lumaMin, u_lumaMax, luma);
          float threadMask = smoothstep(0.3, 0.7, fbm(suv * u_threadScale * 1.5));
          float weight = (1.0 - f) * mask * threadMask;

          vec3 a = vec3(0.5);
          vec3 b = vec3(0.5);
          vec3 c = vec3(1.0);
          vec3 d = vec3(0.0, 0.33, 0.67);
          vec3 irid = a + b * cos(6.28318 * (c * (f * 1.5 - u_time * 0.8) + d));

          vec3 color = mix(sTex.rgb, irid, u_iridescent * f);

          acc += color * weight;
          totalWeight += weight;
        }
      }

      vec3 finalColor = originalColor.rgb;
      if (totalWeight > 0.0) {
        vec3 smearColor = acc / totalWeight;
        finalColor = mix(originalColor.rgb, smearColor, clamp(totalWeight * u_smearOpacity, 0.0, 1.0));
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function initGL() {
    gl = glCanvas.getContext('webgl', { premultipliedAlpha: false });
    if (!gl) { console.error('WebGL is not supported'); return false; }

    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('link:', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    const texLoc = gl.getAttribLocation(prog, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    U = {
      res: gl.getUniformLocation(prog, 'u_resolution'),
      pos: gl.getUniformLocation(prog, 'u_quadPos'),
      size: gl.getUniformLocation(prog, 'u_quadSize'),
      uvScale: gl.getUniformLocation(prog, 'u_uvScale'),
      uvOffset: gl.getUniformLocation(prog, 'u_uvOffset'),
      mouse: gl.getUniformLocation(prog, 'u_mouse'),
      time: gl.getUniformLocation(prog, 'u_time'),
      hoverRadius: gl.getUniformLocation(prog, 'u_hoverRadius'),
      image: gl.getUniformLocation(prog, 'u_image'),
      useBow: gl.getUniformLocation(prog, 'u_useBow'),
      bow: gl.getUniformLocation(prog, 'u_bow'),
      bowRect: gl.getUniformLocation(prog, 'u_bowRect'),
      centerFade: gl.getUniformLocation(prog, 'u_centerFade'),
      pullStrength: gl.getUniformLocation(prog, 'u_pullStrength'),
      pullInvert: gl.getUniformLocation(prog, 'u_pullInvert'),
      threadScale: gl.getUniformLocation(prog, 'u_threadScale'),
      warpAmount: gl.getUniformLocation(prog, 'u_warpAmount'),
      iridescent: gl.getUniformLocation(prog, 'u_iridescent'),
      smearOpacity: gl.getUniformLocation(prog, 'u_smearOpacity'),
      lumaMin: gl.getUniformLocation(prog, 'u_lumaMin'),
      lumaMax: gl.getUniformLocation(prog, 'u_lumaMax'),
      dither: gl.getUniformLocation(prog, 'u_dither'),
      presence: gl.getUniformLocation(prog, 'u_presence'),
    };
    gl.uniform1i(U.image, 0);
    return true;
  }

  function loadTextures() {
    const paths = new Set();
    for (const it of ITEMS) paths.add(extractPath(it.bg));
    paths.add(extractPath(S2));

    paths.forEach((path) => {
      if (!path || TEX.has(path)) return;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      const rec = { tex, ratio: FALLBACK_RATIO, loaded: false };
      TEX.set(path, rec);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!gl) return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (img.naturalWidth && img.naturalHeight) rec.ratio = img.naturalWidth / img.naturalHeight;
        rec.loaded = true;
      };
      img.src = path;
    });
  }

  /** Draws one layer, scissored to its visible rectangle. */
  function drawSurface(surfEl, clipRect, bow) {
    const rc = surfEl.getBoundingClientRect();
    if (rc.width <= 0 || rc.height <= 0) return;

    const path = extractPath(surfEl.style.backgroundImage || getComputedStyle(surfEl).backgroundImage);
    const rec = TEX.get(path);
    if (!rec || !rec.loaded) return;

    const Bw = rc.width, Bh = rc.height, R = rec.ratio;
    const sizeStr = surfEl.style.backgroundSize || getComputedStyle(surfEl).backgroundSize;
    const posStr = surfEl.style.backgroundPosition || getComputedStyle(surfEl).backgroundPosition;
    const { dw, dh } = parseBgSize(sizeStr, Bw, Bh, R);
    const { ox, oy } = parseBgPos(posStr, Bw, Bh, dw, dh);

    const clip = intersect(clipRect, { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    const sw = Math.round(clip.width * DPR);
    const sh = Math.round(clip.height * DPR);
    if (sw <= 0 || sh <= 0) return;
    const sx = Math.round(clip.left * DPR);
    const sy = Math.round(glCanvas.height - (clip.top + clip.height) * DPR);

    gl.scissor(sx, sy, sw, sh);
    gl.uniform2f(U.pos, rc.left * DPR, rc.top * DPR);
    gl.uniform2f(U.size, Bw * DPR, Bh * DPR);
    gl.uniform2f(U.uvScale, Bw / dw, Bh / dh);
    gl.uniform2f(U.uvOffset, -ox / dw, -oy / dh);

    if (bow) {
      gl.uniform1f(U.useBow, 1.0);
      gl.uniform1f(U.bow, bow.pinch);
      gl.uniform4f(U.bowRect, bow.x, bow.y, bow.w, bow.h);
    } else {
      gl.uniform1f(U.useBow, 0.0);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rec.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function renderImages(t) {
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(BG[0], BG[1], BG[2], BG[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);

    gl.uniform2f(U.res, glCanvas.width, glCanvas.height);
    gl.uniform2f(U.mouse, sX * DPR, sY * DPR);
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.hoverRadius, HOVER_RADIUS);

    gl.uniform1f(U.centerFade, CENTER_FADE);
    gl.uniform1f(U.pullStrength, S.pullStrength);
    gl.uniform1f(U.pullInvert, S.pullInvert ? 1.0 : 0.0);
    gl.uniform1f(U.threadScale, S.threadScale);
    gl.uniform1f(U.warpAmount, S.warpAmount);
    gl.uniform1f(U.iridescent, S.iridescent);
    gl.uniform1f(U.smearOpacity, S.opacity);
    gl.uniform1f(U.lumaMin, S.lumaMin);
    gl.uniform1f(U.lumaMax, S.lumaMax);
    gl.uniform1f(U.dither, S.dither);
    gl.uniform1f(U.presence, presence);

    const withOverlays = (imgEl, inner) => {
      const vis = visibleRect(imgEl);
      drawSurface(inner, vis, null);
      imgEl.querySelectorAll('.cover-ov').forEach((ov) => {
        drawSurface(ov.querySelector('.cover-ov-inner') || ov, intersect(vis, visibleRect(ov)), null);
      });
    };

    for (const it of ITEMS) {
      const el = els[it.id];
      if (!el || !el.classList.contains('on')) continue;
      const imgEl = el.querySelector('.img');
      const inner = el.querySelector('.img-inner');
      if (imgEl && inner) withOverlays(imgEl, inner);
    }

    scrollCols.forEach((sc) => {
      if (sc.colIndex == null || !sc.el.classList.contains('on')) return;
      const colRect = sc.el.getBoundingClientRect();
      const bow = columnBow(sc.el);
      sc.cards.forEach((card) => {
        const imgEl = card.querySelector('.img');
        const inner = card.querySelector('.sc-inner');
        if (imgEl && inner) drawSurface(inner, intersect(colRect, visibleRect(imgEl)), bow);
      });
    });

    if (hero.classList.contains('on')) {
      const imgEl = hero.querySelector('.img');
      const inner = hero.querySelector('.img-inner');
      if (imgEl && inner) withOverlays(imgEl, inner);
    }
  }

  function frame(now) {
    if (!active) return;

    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    // exponential smoothing off the real frame time, so behaviour is the
    // same at any refresh rate
    const posK = 1.0 - Math.exp(-dt / Math.max(S.followLag, 0.001));
    sX += (mX - sX) * posK;
    sY += (mY - sY) * posK;

    const presK = 1.0 - Math.exp(-dt / Math.max(S.fadeLag, 0.001));
    presence += ((over ? 1.0 : 0.0) - presence) * presK;

    renderImages((now - startT) / 1000);
    raf = requestAnimationFrame(frame);
  }

  function sizeCanvas() {
    glCanvas.width = Math.round(window.innerWidth * DPR);
    glCanvas.height = Math.round(window.innerHeight * DPR);
    glCanvas.style.width = window.innerWidth + 'px';
    glCanvas.style.height = window.innerHeight + 'px';
  }

  const onResize = () => { if (active) sizeCanvas(); };
  const onMove = (e) => {
    if (presence < 0.1) { sX = e.clientX; sY = e.clientY; }
    mX = e.clientX; mY = e.clientY;
    over = true;
  };
  const onLeavePage = () => { over = false; };
  const onEnterPage = () => { over = true; };

  function activate() {
    active = true;
    beastBusy = true;
    BG = pageColor();

    glCanvas = document.createElement('canvas');
    glCanvas.className = 'beast-canvas';
    document.body.insertBefore(glCanvas, document.body.firstChild);
    sizeCanvas();
    if (!initGL()) { beastBusy = false; deactivate(); return; }
    loadTextures();

    presence = 0.0;
    over = false;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('resize', onResize);
    document.documentElement.addEventListener('mouseleave', onLeavePage);
    document.documentElement.addEventListener('mouseenter', onEnterPage);

    startT = performance.now();
    lastFrame = startT;
    raf = requestAnimationFrame(frame);

    requestAnimationFrame(() => glCanvas.classList.add('show'));
    setTimeout(() => {
      if (active) document.body.classList.add('beast-on');
      beastBusy = false;
    }, BEAST_MS);
  }

  function deactivate() {
    active = false;
    beastBusy = true;

    document.body.classList.remove('beast-on');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('resize', onResize);
    document.documentElement.removeEventListener('mouseleave', onLeavePage);
    document.documentElement.removeEventListener('mouseenter', onEnterPage);

    const dying = glCanvas;
    glCanvas = null;
    if (dying) dying.classList.remove('show');

    setTimeout(() => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (dying) dying.remove();
      if (!active) {
        for (const rec of TEX.values()) if (gl) gl.deleteTexture(rec.tex);
        TEX.clear();
        gl = null;
        prog = null;
      }
      beastBusy = false;
    }, BEAST_MS);
  }
})();
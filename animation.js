/* ══════════════════════════════════════════════════════════
   Cach Creative — Animation Layer
   GSAP 3.12.5 + ScrollTrigger
══════════════════════════════════════════════════════════ */

/* ── js-ready FIRST — before any GSAP calls that could throw.
   This ensures the CSS opacity-0 guards activate even if GSAP
   fails, and content stays readable. ── */
document.documentElement.classList.add('js-ready');

/* ── Disable browser scroll-restoration so the page always starts at
   the top. On GitHub Pages (and some browsers) scroll position from a
   previous visit is restored, which causes the background cross-fade
   to calculate the wrong active layer on first load. ── */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
try { window.scrollTo(0, 0); } catch(e) {}

/* ── GSAP setup — wrapped so a CDN failure doesn't kill the page ── */
if (typeof gsap === 'undefined') {
  /* GSAP CDN failed — show all content at full opacity immediately */
  document.querySelectorAll(
    '.about-content,.offerings-content,.contact-content,.hero-inner'
  ).forEach(el => { el.style.opacity = '1'; el.style.filter = 'none'; el.style.transform = 'none'; });
  throw new Error('[CachCreative] GSAP not loaded — animations skipped, content shown');
}

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ── Selectors ── */
const sections   = [...document.querySelectorAll('.section')];
const dotButtons = [...document.querySelectorAll('.nav-dot')];
const navDotsEl  = document.getElementById('nav-dots');

/* ── Background layers ── */
const bgLayerEls = [
  document.getElementById('bg-hero-layer'),
  document.getElementById('bg-about-layer'),
  document.getElementById('bg-offerings-layer'),
  document.getElementById('bg-contact-layer'),
];

let currentSection = 0;
let navJumpIndex   = null;   // set while a nav-dot/hero-nav jump is in progress

/* ══════════════════════════════════════════════════════════
   NAV DOTS
══════════════════════════════════════════════════════════ */
const lightSections = new Set([1, 2, 3]);

function updateNavDots(idx) {
  dotButtons.forEach(b => b.classList.toggle('active', +b.dataset.index === idx));
  navDotsEl.classList.toggle('dark', lightSections.has(idx));
}

/* Play a section's entrance animation directly (used for nav jumps, where
   the scroll happens too fast/instantly for the scroll triggers to drive it). */
function playSectionEntrance(idx) {
  if (idx === 1) {
    zIn(document.querySelector('.about-content'));
    animateAboutContent();
  } else if (idx === 2) {
    setupCardDeck();
    zIn(document.querySelector('.offerings-content'), animateCardDeck);
  } else if (idx === 3) {
    zIn(document.querySelector('.contact-content'));
    gsap.delayedCall(0.75, dotJumpToForm);
  } else {
    zIn(document.querySelector('.hero-inner'));
  }
}

/* Jump to a section and pre-trigger its animation. Scroll triggers are
   suppressed while navJumpIndex is set, so plain scrolling is unaffected. */
function navigateTo(idx) {
  const sec = sections.find(s => +s.dataset.index === idx);
  if (!sec) return;
  navJumpIndex = idx;
  sec.scrollIntoView({ behavior: 'smooth' });
  gsap.delayedCall(0.55, () => {        // let the snap settle, then play
    playSectionEntrance(idx);
    gsap.delayedCall(0.8, () => { if (navJumpIndex === idx) navJumpIndex = null; });
  });
}

dotButtons.forEach(btn => {
  btn.addEventListener('click', () => navigateTo(+btn.dataset.index));
});

/* Hero top-right nav links (About / Work / Contact) */
const heroNavMap = { '#about': 1, '#offerings': 2, '#contact': 3 };
document.querySelectorAll('.hero-nav a').forEach(a => {
  a.addEventListener('click', e => {
    const idx = heroNavMap[a.getAttribute('href')];
    if (idx === undefined) return;
    e.preventDefault();
    navigateTo(idx);
  });
});

/* ══════════════════════════════════════════════════════════
   BACKGROUND SCROLL CROSS-FADE
   Each page keeps its own solid colour. During scroll the
   current layer stays fully opaque underneath while the next
   layer fades in on top — a clean wipe, no white bleed-through.
══════════════════════════════════════════════════════════ */
function setupBgBlend() {
  const first = sections[0];

  function update() {
    const vh = window.innerHeight ||
               document.documentElement.clientHeight ||
               (first ? first.offsetHeight : 0) || 800;

    /* getBoundingClientRect is viewport-relative — works regardless of
       which element is the actual scroll container. */
    const rawPos = first ? (-first.getBoundingClientRect().top / vh) : 0;
    const pos    = isNaN(rawPos) || !isFinite(rawPos) ? 0 : rawPos;
    const base   = Math.max(0, Math.min(bgLayerEls.length - 1, Math.floor(pos + 1e-4)));
    const frac   = Math.min(1, Math.max(0, pos - base));

    bgLayerEls.forEach((el, i) => {
      if (!el) return;
      let opacity = 0;
      if (i === base) {
        opacity = 1;                  // current page — solid underneath
      } else if (i === base + 1) {
        let f = frac;
        /* Offerings (orange) holds back to sync with card animation. */
        if (i === 2) {
          f = Math.min(1, Math.max(0, (frac - 0.5) / 0.5));
          f = f * f * (3 - 2 * f);    // smoothstep
        }
        opacity = f;
      }
      /* Set inline style for the smooth numeric cross-fade, AND manage
         .active class as a CSS-level fallback for the settled position. */
      el.style.opacity = opacity;
      el.classList.toggle('active', opacity > 0.5);
    });
  }

  /* Attach to every candidate scroll target — scroll events don't bubble
     and the actual container varies by browser/platform. */
  [window, document, document.documentElement, document.body].forEach(t => {
    try { t.addEventListener('scroll', update, { passive: true }); } catch(e) {}
  });
  window.addEventListener('resize', update);
  update();
}

/* ══════════════════════════════════════════════════════════
   SECTION OBSERVER — sectionChange event + nav + bg switch
══════════════════════════════════════════════════════════ */
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const idx = parseInt(entry.target.dataset.index, 10);
    if (idx === currentSection) return;
    currentSection = idx;
    updateNavDots(idx);
    document.dispatchEvent(new CustomEvent('sectionChange', {
      detail: { index: idx, id: entry.target.id }
    }));
  });
}, { threshold: 0.5 });

sections.forEach(s => sectionObserver.observe(s));

/* ══════════════════════════════════════════════════════════
   wrapChars — handles .heading-line spans
══════════════════════════════════════════════════════════ */
function wrapChars(headingEl) {
  headingEl.querySelectorAll('.heading-line').forEach(line => {
    const text = line.textContent;
    line.innerHTML = '';
    [...text].forEach(ch => {
      const s = document.createElement('span');
      s.className = 'char';
      if (ch === ' ') { s.innerHTML = '&nbsp;'; } else { s.textContent = ch; }
      line.appendChild(s);
    });
  });
}

/* ══════════════════════════════════════════════════════════
   HERO — one-time entrance on fonts ready
══════════════════════════════════════════════════════════ */
function animateHero() {
  const logo      = document.getElementById('logo-hero');
  const tagline   = document.querySelector('.hero-tagline');
  const scrollCue = document.querySelector('.scroll-cue');

  gsap.set(logo, {
    scale: 0.9,
    opacity: 0.5,
    filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.65)) drop-shadow(0 0 38px rgba(255,255,255,0.3)) blur(5px)'
  });
  gsap.to(logo, {
    scale: 1, opacity: 1,
    filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.65)) drop-shadow(0 0 38px rgba(255,255,255,0.3)) blur(0px)',
    duration: 1, ease: 'power3.out'
  });
  gsap.to(tagline,   { opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.7  });
  gsap.to(scrollCue, { opacity: 1, duration: 0.6, ease: 'power2.out', delay: 1.5  });
}

/* ══════════════════════════════════════════════════════════
   ABOUT — char reveal then body then annotations
══════════════════════════════════════════════════════════ */
function animateAboutContent() {
  const heading     = document.getElementById('about-heading');
  const body        = document.getElementById('about-body');
  const annotations = [...document.querySelectorAll('.thought-annotation')];

  wrapChars(heading);
  const chars = [...heading.querySelectorAll('.char')];

  gsap.set(chars,       { opacity: 0, y: 10 });
  gsap.set(body,        { opacity: 0 });
  gsap.set(annotations, { opacity: 0 });

  const stagger      = 0.04;
  const charDur      = 0.4;
  const headingTotal = chars.length * stagger + charDur;

  gsap.to(chars, { opacity: 1, y: 0, duration: charDur, stagger, ease: 'power2.out' });
  gsap.to(body,        { opacity: 1, duration: 0.55, ease: 'power2.out', delay: headingTotal * 0.5 });
  gsap.to(annotations, { opacity: 1, duration: 0.55, stagger: 0.18, ease: 'power2.out', delay: headingTotal * 0.75 });
}

/* ══════════════════════════════════════════════════════════
   CARD DECK — visible stacked pile → deal out into grid
   Cards begin piled at grid centre like a hand-held stack
   (slight rotation + offset, layered z-index), then deal out
   one-by-one to their grid slots with a 3D lift + overshoot.
══════════════════════════════════════════════════════════ */
function setupCardDeck() {
  const frames = [...document.querySelectorAll('.card-frame')];
  const grid   = document.querySelector('.cards-grid');

  gsap.set(frames, {
    x: 0, y: 0, scale: 1, opacity: 1,
    rotateX: 0, rotateY: 0, rotation: 0,
    transformPerspective: 1000, zIndex: 'auto'
  });

  const gRect  = grid.getBoundingClientRect();
  const cxGrid = gRect.width  / 2;
  const cyGrid = gRect.height / 2;

  frames.forEach((frame, i) => {
    const r  = frame.getBoundingClientRect();
    const dx = cxGrid - ((r.left - gRect.left) + r.width  / 2);
    const dy = cyGrid - ((r.top  - gRect.top)  + r.height / 2);
    const depth = i;  // 0 = top card, larger index = further back

    /* A neat, tidy stack: each card behind the top one is stepped by a
       small uniform offset and scaled back slightly, so the deck edges
       line up cleanly instead of scattering. */
    gsap.set(frame, {
      x: dx + depth * 5,
      y: dy + depth * 6,
      rotation: 0,
      rotateX: 0,
      scale: 1 - depth * 0.035,
      opacity: 1,
      transformOrigin: '50% 50%',
      zIndex: frames.length - i    // first card sits on top, deals first
    });
  });
}

function animateCardDeck() {
  const frames = [...document.querySelectorAll('.card-frame')];
  const header = document.querySelector('.offerings-header');

  gsap.to(header, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });

  /* Deal each card out in grid order with a lift, a settle, and an
     overshoot so the layout feels physical and dynamic. */
  const tl = gsap.timeline();
  frames.forEach((frame, i) => {
    tl.to(frame, {
      x: 0, y: 0, rotation: 0, rotateX: 0,
      duration: 0.62,
      ease: 'back.out(1.5)'
    }, i * 0.13)
    /* brief lift mid-flight for depth (owns scale to avoid conflict) */
    .to(frame, {
      keyframes: { scale: [1, 1.06, 1] },
      duration: 0.42, ease: 'sine.inOut'
    }, i * 0.13);
  });
}

/* ══════════════════════════════════════════════════════════
   FIX 2 — Z-AXIS CONTENT TRANSITIONS via ScrollTrigger
   Enter: scale 0.96 → 1, blur 4px → 0, opacity 0 → 1, 0.65s
   Leave: scale 1 → 0.92, blur 0 → 4px, opacity 1 → 0, 0.48s
   cubic-bezier(0.25, 1, 0.5, 1) ≈ power3.out in GSAP
══════════════════════════════════════════════════════════ */
const EASE_IN  = 'power2.in';
const EASE_OUT = 'power3.out';
const DUR_IN   = 0.65;
const DUR_OUT  = 0.48;

function zIn(el, onDone) {
  if (!el) return;
  gsap.fromTo(el,
    { scale: 0.96, filter: 'blur(4px)', opacity: 0 },
    { scale: 1,    filter: 'blur(0px)', opacity: 1,
      duration: DUR_IN, ease: EASE_OUT, overwrite: 'auto',
      onComplete: onDone ?? null }
  );
}
function zOut(el) {
  if (!el) return;
  gsap.to(el, {
    scale: 0.92, filter: 'blur(4px)', opacity: 0,
    duration: DUR_OUT, ease: EASE_IN, overwrite: 'auto'
  });
}

function setupScrollTransitions() {
  const heroInner        = document.querySelector('.hero-inner');
  const aboutContent     = document.querySelector('.about-content');
  const offeringsContent = document.querySelector('.offerings-content');
  const contactContent   = document.querySelector('.contact-content');

  /* Initial hidden state for non-hero sections */
  gsap.set([aboutContent, offeringsContent, contactContent], { opacity: 0 });

  /* ── Hero exit only (enters via animateHero on load) ── */
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    onLeave:     () => zOut(heroInner),
    onEnterBack: () => zIn(heroInner)
  });

  /* ── About ── */
  ScrollTrigger.create({
    trigger: '#about', start: 'top 40%',
    onEnter:     () => { if (navJumpIndex !== null) return; zIn(aboutContent); animateAboutContent(); },
    onLeave:     () => zOut(aboutContent),
    onEnterBack: () => { if (navJumpIndex !== null) return; zIn(aboutContent); animateAboutContent(); },
    onLeaveBack: () => zOut(aboutContent)
  });

  /* ── Offerings — setup deck while parent is still invisible,
       then Z-in reveals the stacked deck, then peel starts ── */
  ScrollTrigger.create({
    trigger: '#offerings', start: 'top 52%',
    onEnter: () => {
      if (navJumpIndex !== null) return;
      setupCardDeck();
      zIn(offeringsContent, animateCardDeck);
    },
    onLeave:     () => zOut(offeringsContent),
    onEnterBack: () => {
      if (navJumpIndex !== null) return;
      setupCardDeck();
      zIn(offeringsContent, animateCardDeck);
    },
    onLeaveBack: () => zOut(offeringsContent)
  });

  /* ── Contact — Z-axis IS the animation (gentle settle) ── */
  ScrollTrigger.create({
    trigger: '#contact', start: 'top 52%',
    onEnter:     () => { if (navJumpIndex !== null) return; zIn(contactContent); gsap.delayedCall(0.75, dotJumpToForm); },
    onLeave:     () => zOut(contactContent),
    onEnterBack: () => { if (navJumpIndex !== null) return; zIn(contactContent); gsap.delayedCall(0.75, dotJumpToForm); },
    onLeaveBack: () => zOut(contactContent)
  });
}

/* ══════════════════════════════════════════════════════════
   WORDMARK DOT — measures SVG text to place the pink tittle
   circle precisely over the i in cachcreative.
   getSubStringLength counts chars across tspan boundaries.
══════════════════════════════════════════════════════════ */
function positionWordmarkDot() {
  const text = document.getElementById('wordmark-text');
  const dot  = document.getElementById('wordmark-dot');
  if (!text || !dot) return;
  try {
    const xStart = text.getSubStringLength(0, 9);
    const iWidth = text.getSubStringLength(9, 1);
    dot.setAttribute('cx', String(xStart + iWidth / 2));
  } catch (e) {}
}

/* ══════════════════════════════════════════════════════════
   CONTACT — the pink tittle dot of "cachcreative" leaps in a
   bouncing arc across to the form, landing on the NAME label,
   which then glows pink.
══════════════════════════════════════════════════════════ */
let contactDotAnimating = false;

function dotJumpToForm() {
  if (contactDotAnimating) return;          // avoid overlapping plays
  const container = document.querySelector('.contact-content');
  const srcDot    = document.getElementById('wordmark-dot');
  const nameLabel = document.querySelector('.form-group label'); // first = NAME
  if (!container || !srcDot || !nameLabel) return;

  contactDotAnimating = true;

  /* Reset any previous run so it re-triggers cleanly each time. */
  container.querySelectorAll('.jump-dot').forEach(d => d.remove());
  nameLabel.classList.remove('label-glow');
  gsap.set(srcDot, { opacity: 1 });
  positionWordmarkDot();                    // make sure dot is over the i

  /* Measure start (logo dot) and target (NAME label) RELATIVE to the
     contact-content box. Because the floating dot lives inside that same
     box, the path stays correct no matter where the section has scrolled. */
  const cRect = container.getBoundingClientRect();
  const s = srcDot.getBoundingClientRect();
  const t = nameLabel.getBoundingClientRect();
  const startX  = s.left - cRect.left + s.width  / 2;
  const startY  = s.top  - cRect.top  + s.height / 2;
  const targetX = t.left - cRect.left + 8;            // start of the "NAME" word
  const targetY = t.top  - cRect.top  + t.height / 2;

  const size = Math.max(11, s.width);
  const dot  = document.createElement('div');
  dot.className = 'jump-dot';
  dot.style.width = dot.style.height = size + 'px';
  dot.style.left  = (startX - size / 2) + 'px';
  dot.style.top   = (startY - size / 2) + 'px';
  container.appendChild(dot);

  gsap.set(srcDot, { opacity: 0 });          // detach the original tittle

  const dx     = targetX - startX;
  const dy     = targetY - startY;
  const hops   = 4;
  const hopDur = 0.36;

  const tl = gsap.timeline({
    delay: 0.15,
    onComplete: () => {
      nameLabel.classList.add('label-glow');
      gsap.to(dot, { scale: 0.85, duration: 0.12, yoyo: true, repeat: 1 });
      gsap.to(dot, { opacity: 0, duration: 0.45, delay: 0.5,
                     onComplete: () => { dot.remove(); contactDotAnimating = false; } });
    }
  });

  let cursor = 0;
  for (let i = 0; i < hops; i++) {
    const toX        = dx * (i + 1) / hops;
    const fromGround = dy * i / hops;
    const toGround   = dy * (i + 1) / hops;
    const jump       = 72 - i * 13;            // hops get lower as it nears
    const apex       = Math.min(fromGround, toGround) - jump;

    tl.to(dot, { x: toX,      duration: hopDur,     ease: 'none'       }, cursor);
    tl.to(dot, { y: apex,     duration: hopDur / 2, ease: 'power2.out' }, cursor);
    tl.to(dot, { y: toGround, duration: hopDur / 2, ease: 'power2.in'  }, cursor + hopDur / 2);
    cursor += hopDur;
  }
}

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
/* Run init once — guarded so the timeout fallback can't double-fire. */
let inited = false;
function init() {
  if (inited) return;
  inited = true;
  try { setupBgBlend(); } catch(e) { console.warn('BgBlend failed', e); }
  try {
    setupScrollTransitions();
  } catch(e) {
    /* ScrollTrigger failed — make all content visible immediately */
    console.warn('ScrollTransitions failed', e);
    document.querySelectorAll('.about-content,.offerings-content,.contact-content')
      .forEach(el => { el.style.opacity='1'; el.style.filter='none'; el.style.transform='none'; });
  }
  try { animateHero(); } catch(e) {
    /* Hero animation failed — show hero content */
    const logo = document.getElementById('logo-hero');
    const tagline = document.querySelector('.hero-tagline');
    const cue = document.querySelector('.scroll-cue');
    if (logo) logo.style.opacity = '1';
    if (tagline) tagline.style.opacity = '1';
    if (cue) cue.style.opacity = '1';
  }
  try { updateNavDots(0); } catch(e) {}
  try { positionWordmarkDot(); } catch(e) {}
}

/* Primary: wait for fonts (needed for SVG text measurement). */
document.fonts.ready.then(init).catch(() => init());

/* Fallback: if fonts.ready stalls (woff2 404, network error, etc.),
   init after 1.5s so the page is never permanently blank. */
setTimeout(init, 1500);

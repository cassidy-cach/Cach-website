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
const pnavPoints = [...document.querySelectorAll('.pnav-point')];
const pnavMarker = document.querySelector('.pnav-marker');
const pnavFill   = document.querySelector('.pnav-fill');

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
   PROGRESS RAIL — active tick + glowing marker position
══════════════════════════════════════════════════════════ */
function updateNavDots(idx) {
  pnavPoints.forEach(p => p.classList.toggle('active', +p.dataset.index === idx));
}

/* Move the glowing marker + fill to reflect overall scroll progress.
   Rect-based so it's scroller-agnostic (works whether the viewport, <html>
   or <body> is the actual scroll container — and on both desktop & mobile). */
function updateProgressRail() {
  if (!pnavMarker || !sections.length) return;
  const firstR = sections[0].getBoundingClientRect();
  const lastR  = sections[sections.length - 1].getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;

  const scrolled = -firstR.top;                       // distance scrolled from the top
  const total    = (lastR.bottom - firstR.top) - vh;  // total scrollable distance
  let progress = total > 0 ? scrolled / total : 0;
  progress = Math.min(1, Math.max(0, isNaN(progress) || !isFinite(progress) ? 0 : progress));

  const pct = (progress * 100) + '%';
  pnavMarker.style.top = pct;
  if (pnavFill) pnavFill.style.height = pct;
}

/* Play a section's entrance animation directly (used for nav jumps, where
   the scroll happens too fast/instantly for the scroll triggers to drive it). */
function playSectionEntrance(idx) {
  if (idx === 1) {
    zIn(document.querySelector('.about-content'));
    animateAboutContent();
  } else if (idx === 2) {
    setupOfferings();
    zIn(document.querySelector('.offerings-content'), animateOfferings);
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

pnavPoints.forEach(btn => {
  btn.addEventListener('click', () => navigateTo(+btn.dataset.index));
});

/* Hero top-right nav links (Home / About / Services / Contact) */
const heroNavMap = { '#hero': 0, '#about': 1, '#offerings': 2, '#contact': 3 };
document.querySelectorAll('.hero-nav a').forEach(a => {
  a.addEventListener('click', e => {
    const idx = heroNavMap[a.getAttribute('href')];
    if (idx === undefined) return;
    e.preventDefault();
    navigateTo(idx);
  });
});

/* In-page CTA buttons with data-goto (e.g. "See what we do" → offerings).
   navigateTo pre-triggers the target section's animation on arrival. */
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(+btn.dataset.goto));
});

/* True on phones/small screens — where sections flow instead of snapping
   one-viewport-per-section, so the scroll-driven cross-fade math doesn't
   apply and we switch backgrounds discretely via the section observer. */
const isSmallScreen = () => window.matchMedia('(max-width: 860px)').matches;

/* Discrete background switch (used on mobile). Clears inline opacity so the
   CSS `.bg-layer.active { opacity: 1 }` + transition drive the fade. */
function activateBgLayer(idx) {
  bgLayerEls.forEach((el, i) => {
    if (!el) return;
    el.style.opacity = '';
    el.classList.toggle('active', i === idx);
  });
}

/* ══════════════════════════════════════════════════════════
   BACKGROUND SCROLL CROSS-FADE (desktop)
   Each page keeps its own solid colour. During scroll the
   current layer stays fully opaque underneath while the next
   layer fades in on top — a clean wipe, no white bleed-through.
══════════════════════════════════════════════════════════ */
function setupBgBlend() {
  const first = sections[0];

  function update() {
    updateProgressRail();             // marker runs on all screen sizes
    if (isSmallScreen()) return;      // mobile uses discrete bg (observer)
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
  if (isSmallScreen()) activateBgLayer(0);   // mobile: start on hero bg
  else update();
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
    if (isSmallScreen()) activateBgLayer(idx);   // mobile: switch bg per section
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
  const cta         = document.querySelector('.about-cta');
  const blob        = document.querySelector('.about-right');

  wrapChars(heading);
  const chars = [...heading.querySelectorAll('.char')];

  gsap.set(chars,       { opacity: 0, y: 10 });
  gsap.set(body,        { opacity: 0 });
  gsap.set(annotations, { opacity: 0 });
  gsap.set(cta,         { opacity: 0, y: 10 });

  const stagger      = 0.04;
  const charDur      = 0.4;
  const headingTotal = chars.length * stagger + charDur;

  /* Heading (left) reveals as before. */
  gsap.to(chars, { opacity: 1, y: 0, duration: charDur, stagger, ease: 'power2.out' });

  /* ── Blob (right): emerges from the LEFT edge of the screen, travels
     across (behind the heading), settles into the right column, then
     turns white + glows as the copy fades in. ── */
  const PINK_SHADOW  = '0 0 0px rgba(255,255,255,0), 0 0 0px rgba(255,255,255,0), 0 18px 40px rgba(252,47,120,0.40), 0 34px 70px rgba(252,47,120,0.28)';
  const WHITE_SHADOW = '0 0 34px rgba(255,255,255,0.75), 0 0 80px rgba(255,255,255,0.5), 0 12px 30px rgba(40,0,25,0.16), 0 34px 70px rgba(40,0,25,0.20)';

  /* Measure the blob's resting position to compute how far left it must
     start so it emerges from off the left edge of the screen. */
  gsap.set(blob, { clearProps: 'transform' });
  const rect   = blob.getBoundingClientRect();
  const startX = -(rect.left + rect.width * 0.4);   // ~40% off the left edge

  /* Apply the pink/off-screen state SYNCHRONOUSLY (same frame) so the
     white resting blob never flashes on screen before the travel starts. */
  gsap.set(blob, {
    x: startX,
    scale: 0.9,
    backgroundColor: '#FC2F78',
    boxShadow: PINK_SHADOW
  });
  gsap.set([body, annotations], { opacity: 0 });

  const tl = gsap.timeline({ delay: headingTotal * 0.15 });

  /* travel across the screen to its resting place on the right */
  tl.to(blob, { x: 0, scale: 1, duration: 1.25, ease: 'power2.inOut' });

  /* turn white + glow as it settles */
  tl.to(blob, { backgroundColor: '#ffffff', boxShadow: WHITE_SHADOW, duration: 0.5, ease: 'power2.out' }, '-=0.4');

  /* copy appears inside the (now white) blob */
  tl.to(body,        { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.15');
  tl.to(annotations, { opacity: 1, duration: 0.5, stagger: 0.16, ease: 'power2.out' }, '-=0.25');
  tl.to(cta,         { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, '-=0.15');
}

/* ══════════════════════════════════════════════════════════
   OFFERINGS — a pink dot bounces in and, on each bounce, "opens"
   one of the five offering circles (the same dot idea as the
   contact tittle). Circles pop open one-by-one with their tagline.
══════════════════════════════════════════════════════════ */
function setupOfferings() {
  const circles  = [...document.querySelectorAll('.offer-circle')];
  const taglines = [...document.querySelectorAll('.offer-tagline')];

  /* hide circles + taglines; layout space is preserved (transform only) */
  gsap.set(circles,  { scale: 0, opacity: 0, transformOrigin: '50% 50%' });
  gsap.set(taglines, { opacity: 0, y: 12 });

  /* reset hover-ready state so the CSS transition doesn't fight re-animation */
  document.querySelectorAll('.offer-item').forEach(it => it.classList.remove('ready'));

  /* clear any leftover dot from a previous run */
  document.querySelectorAll('.bounce-dot').forEach(d => d.remove());
}

function animateOfferings() {
  const row      = document.querySelector('.circles-row');
  const header   = document.querySelector('.offerings-header');
  const circles  = [...document.querySelectorAll('.offer-circle')];
  const taglines = [...document.querySelectorAll('.offer-tagline')];
  if (!row || !circles.length) return;

  const sub = document.querySelector('.offerings-sub');
  gsap.to(header, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
  gsap.to(sub,    { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.12 });

  const items = [...document.querySelectorAll('.offer-item')];

  /* Reveal circle i with a pop + its tagline. Once the pop finishes, clear
     the inline transform and flag .ready so CSS hover effects can take over. */
  function openCircle(i) {
    gsap.to(circles[i], {
      scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.8)',
      onComplete: () => {
        gsap.set(circles[i], { clearProps: 'transform' });
        if (items[i]) items[i].classList.add('ready');
      }
    });
    gsap.to(taglines[i], { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.12,
      onComplete: () => gsap.set(taglines[i], { clearProps: 'opacity' }) });
  }

  /* On small screens the circles wrap onto multiple rows, so the bouncing
     dot path doesn't apply — just pop the circles in with a stagger. The
     deliverables list is already visible by default (CSS). */
  if (isSmallScreen()) {
    circles.forEach((_, i) => gsap.delayedCall(i * 0.12, () => openCircle(i)));
    return;
  }

  /* Measure each circle's centre relative to the row. */
  const rowRect = row.getBoundingClientRect();
  const pts = circles.map(c => {
    const r = c.getBoundingClientRect();
    return { x: r.left - rowRect.left + r.width / 2,
             y: r.top  - rowRect.top  + r.height / 2 };
  });

  const dotSize = 22;
  const dot = document.createElement('div');
  dot.className = 'bounce-dot';
  dot.style.width = dot.style.height = dotSize + 'px';
  row.appendChild(dot);

  const px = i => pts[i].x - dotSize / 2;   // dot left for circle i
  const py = i => pts[i].y - dotSize / 2;   // dot top  for circle i

  gsap.set(dot, { x: px(0), y: -150, opacity: 1, scale: 1 });

  const tl = gsap.timeline({ delay: 0.15 });
  const hopDur = 0.5;
  let cursor = 0;

  pts.forEach((p, i) => {
    if (i === 0) {
      /* drop in from above onto the first circle */
      tl.to(dot, { y: py(0), duration: 0.5, ease: 'power2.in' }, cursor);
      cursor += 0.5;
    } else {
      /* arc: travel x straight, y up-then-down, landing on circle i */
      const apex = Math.min(py(i), py(i - 1)) - (150 - i * 16);
      tl.to(dot, { x: px(i),  duration: hopDur,     ease: 'none'       }, cursor);
      tl.to(dot, { y: apex,   duration: hopDur / 2, ease: 'power2.out' }, cursor);
      tl.to(dot, { y: py(i),  duration: hopDur / 2, ease: 'power2.in'  }, cursor + hopDur / 2);
      cursor += hopDur;
    }
    /* squash on impact + open the circle */
    tl.to(dot, { scaleX: 1.5, scaleY: 0.6, duration: 0.09, yoyo: true, repeat: 1,
                 transformOrigin: '50% 100%' }, cursor);
    tl.call(openCircle, [i], cursor);
    cursor += 0.02;
  });

  /* dot vanishes into the last circle */
  tl.to(dot, { scale: 0, opacity: 0, duration: 0.35, ease: 'power2.in' }, cursor + 0.2);
  tl.call(() => dot.remove(), [], cursor + 0.6);
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
      setupOfferings();
      zIn(offeringsContent, animateOfferings);
    },
    onLeave:     () => zOut(offeringsContent),
    onEnterBack: () => {
      if (navJumpIndex !== null) return;
      setupOfferings();
      zIn(offeringsContent, animateOfferings);
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

import { BEATS, TOTAL_VH } from './beats.js';

// Chrome behaviour: navigation, the chapter index, and the sound bed.
//
// The bed is the flute track, but routed through a lowpass whose cutoff falls
// with depth — so it is bright and open at the rim and muffled, as if heard
// through stone and water, by the bottom. Same gesture the light and the
// palette already make. Kept deliberately quiet: it should register as
// atmosphere, not as a song someone put on.

const BASE_VOLUME = 0.085;   // subtle on purpose

export function initUI({ onSeek }) {
  const soundBtn = document.getElementById('sound-btn');
  const indexBtn = document.getElementById('index-btn');
  const panel = document.getElementById('index-panel');
  const list = document.getElementById('index-list');

  // --- chapter index -------------------------------------------------------
  BEATS.filter((b) => b.title).forEach((b) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="ix-name">${b.title}</span>`;
    btn.addEventListener('click', () => {
      onSeek(((b.from + b.to) / 2) / TOTAL_VH);
      close();
    });
    li.appendChild(btn);
    list.appendChild(li);
  });

  function open() {
    panel.hidden = false;
    indexBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.classList.add('show'));
  }
  function close() {
    panel.classList.remove('show');
    indexBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { panel.hidden = true; }, 320);
  }
  indexBtn.addEventListener('click', () => (panel.hidden ? open() : close()));
  document.getElementById('index-close').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });

  // --- sound ---------------------------------------------------------------
  let ctx = null, lp = null, gain = null, el = null, on = false;

  function build() {
    el = new Audio('assets/ambient.mp3');
    el.loop = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';

    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(el);

    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000;
    lp.Q.value = 0.4;

    gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(lp).connect(gain).connect(ctx.destination);
  }

  soundBtn.addEventListener('click', async () => {
    if (!ctx) build();
    if (ctx.state === 'suspended') await ctx.resume();

    on = !on;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.classList.toggle('on', on);

    if (on) {
      try { await el.play(); } catch (e) { /* blocked until gesture; this IS the gesture */ }
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(BASE_VOLUME, ctx.currentTime + 2.2);
    } else {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      setTimeout(() => { if (!on) el.pause(); }, 900);
    }
  });

  // Autoplay is blocked without a gesture, so the bed is ARMED on load and
  // starts on whatever the visitor does first — a scroll counts. The toggle
  // shows the intended state immediately rather than lying about it.
  function arm() {
    on = true;
    soundBtn.setAttribute('aria-pressed', 'true');
    soundBtn.classList.add('on');

    const start = async () => {
      if (!on) return;
      if (!ctx) build();
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        await el.play();
      } catch (e) {
        // Still blocked. Do NOT unbind — the whole point is to keep waiting for
        // a real gesture. The previous version called off() unconditionally, so
        // the one speculative attempt at load consumed every listener and the
        // bed could never start.
        return;
      }
      if (el.paused) return;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(BASE_VOLUME, ctx.currentTime + 2.6);
      off();
    };
    const off = () => {
      ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((ev) =>
        removeEventListener(ev, start));
    };
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((ev) =>
      addEventListener(ev, start, { passive: true }));

    // some engines allow it outright
    start();
  }

  return {
    arm,
    update(p) {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      // 16k at the rim down to ~700Hz at the water: open air to stone
      lp.frequency.setTargetAtTime(16000 - p * 15300, t, 0.5);
      gain.gain.setTargetAtTime(BASE_VOLUME * (1 - p * 0.25), t, 0.5);
    },
  };
}

// The wordmark reveal. Per-letter masks with a stagger — the one piece of
// motion that has to land before a judge decides whether to keep scrolling.
export function revealWordmark() {
  const h1 = document.querySelector('#hero h1');
  if (!h1) return;
  const text = h1.textContent.trim();
  h1.textContent = '';
  h1.setAttribute('aria-label', text);

  [...text].forEach((ch, i) => {
    const mask = document.createElement('span');
    mask.className = 'ltr';
    const inner = document.createElement('span');
    inner.textContent = ch;
    inner.setAttribute('aria-hidden', 'true');
    mask.appendChild(inner);
    h1.appendChild(mask);

    inner.animate(
      [
        { transform: 'translateY(112%) rotate(2.5deg)', opacity: 0 },
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      ],
      {
        duration: 1150,
        delay: 220 + i * 85,
        easing: 'cubic-bezier(.16,.84,.28,1)',
        fill: 'both',
      }
    );
  });

  document.querySelectorAll('#meta > *').forEach((n, i) => {
    n.animate(
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 900, delay: 900 + i * 110, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' }
    );
  });

  document.querySelectorAll('#topbar, #scroll-cue').forEach((n, i) => {
    n.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 900, delay: 1500 + i * 160, easing: 'ease', fill: 'both' });
  });
}

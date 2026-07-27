import { BEATS, TOTAL_VH } from './beats.js';

// The dialogue layer.
//
// The governing rule: copy appears only while its beat is on screen, and each
// beat owns exactly one block. Text never rides along with a moving camera —
// that is the difference between a film and a brochure being scrolled past.

let els = {};
let depthTotal = 20;
let shownBeat = null;
let shownTitle = null;
const last = {};

function setStyle(el, prop, val) {
  if (last[el.id + prop] === val) return;
  last[el.id + prop] = val;
  el.style[prop] = val;
}

export function initOverlay(wellDepth) {
  depthTotal = wellDepth;
  els = {
    depth: document.getElementById('depth'),
    stage: document.getElementById('stage'),
    meta: document.getElementById('meta'),
    cue: document.getElementById('scroll-cue'),
    altimeter: document.getElementById('altimeter'),
    chapter: document.getElementById('chapter'),
    chapterBlock: document.getElementById('chapter-block'),
    note: document.getElementById('chapter-note'),
    fill: document.getElementById('rail-fill'),
    hero: document.getElementById('hero'),
    heroInner: document.getElementById('hero-inner'),
    scrim: document.getElementById('landing-scrim'),
    copy: document.getElementById('copy'),
    eyebrow: document.querySelector('#copy .eyebrow'),
    statement: document.querySelector('#copy .statement'),
    body: document.querySelector('#copy .body'),
  };
}

// Reveal by line, not as a block. A block fade reads as a web page; a staggered
// per-line mask reads as a title card.
function revealLines(el, text, delay = 0) {
  el.innerHTML = '';
  if (!text) { el.hidden = true; return; }
  el.hidden = false;

  text.split(/(?<=\.)\s+/).forEach((line, i) => {
    const wrap = document.createElement('span');
    wrap.className = 'line';
    const inner = document.createElement('span');
    inner.textContent = line;
    wrap.appendChild(inner);
    el.appendChild(wrap);
    inner.animate(
      [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }],
      { duration: 760, delay: delay + i * 90, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' }
    );
  });
}

function showCopy(beat) {
  const c = beat.copy;
  els.copy.className = `copy show ${c.side || 'centre'}`;
  revealLines(els.eyebrow, c.eyebrow, 0);
  revealLines(els.statement, c.statement, c.eyebrow ? 110 : 0);
  revealLines(els.body, c.body, 240);
}

function hideCopy() {
  // Only drop `show`. Clearing the whole className strips the side class too,
  // which teleports the block to its default position and then fades it out
  // there — that is the flash on the right.
  els.copy.classList.remove('show');
}

export function updateOverlay(p, state) {
  if (!els.depth) return;

  const beat = state.beat;

  // --- chrome ---------------------------------------------------------------
  const metres = Math.max(0, -state.cameraY);
  els.depth.textContent = `${metres < 0.05 ? '' : '−'}${metres.toFixed(1)} m`;
  // was "0000 / 1200 steps" — an invented figure. The stage name is true.
  els.stage.textContent = beat.title || '—';
  setStyle(els.fill, 'transform', `scaleY(${p.toFixed(4)})`);

  // The depth rail is dead weight at 0.0 m on the landing, and the scroll cue
  // is noise once you are already descending. They trade places.
  const started = Math.min(1, Math.max(0, (p * TOTAL_VH - 60) / 260));
  setStyle(els.altimeter, 'opacity', started.toFixed(3));
  setStyle(els.cue, 'opacity', (1 - started).toFixed(3));
  els.cue.classList.toggle('idle', started > 0.98);
  // the record hands the corner over to the chapter title — BOTH sides of the
  // handover have to be driven or they simply overlap
  setStyle(els.meta, 'opacity', (1 - started).toFixed(3));
  setStyle(els.chapterBlock, 'opacity', started.toFixed(3));

  if (beat.title !== shownTitle) {
    shownTitle = beat.title;
    els.chapter.textContent = beat.title || '';
    els.note.textContent = '';
    if (beat.title) {
      els.chapter.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, easing: 'cubic-bezier(.22,.61,.36,1)' }
      );
    }
  }

  // --- dialogue -------------------------------------------------------------
  const key = state.copyOn ? beat.id : null;
  if (key !== shownBeat) {
    shownBeat = key;
    if (key) showCopy(beat); else hideCopy();
  }

  // --- hero -----------------------------------------------------------------
  // holds through the whole cold open, then is swallowed as the ground opens
  const heroOut = Math.min(1, Math.max(0, (p * TOTAL_VH - 300) / 280));
  setStyle(els.hero, 'opacity', (1 - heroOut).toFixed(3));
  setStyle(els.heroInner, 'transform', `translateY(${(heroOut * -46).toFixed(1)}px)`);
  // the scrim exists to give the wordmark a ground; once the wordmark is gone
  // it would only be flattening the render, so it lifts with it
  setStyle(els.scrim, 'opacity', (1 - heroOut * 0.82).toFixed(3));
}

export { BEATS };

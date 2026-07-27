// The cross-section: drag the water line and watch the flights go under.
//
// This is the only part of the piece that teaches something a photograph
// cannot. A stepwell's whole design premise is that the water level MOVES —
// monsoon fills it, summer draws it down — and the stairs exist so the water
// is reachable at every one of those levels. Static images cannot show that.

const RIM_HALF = 16.9;      // half-width at the rim, in model units
const POOL_HALF = 7.8;      // half-width at the waterline
const DEPTH = 19.75;
const STOREYS = 8;

const W = 900;
const H = 460;
const GROUND = 54;
const FLOOR = H - 46;

function xAt(depth01, side) {
  const half = RIM_HALF + (POOL_HALF - RIM_HALF) * depth01;
  const frac = half / RIM_HALF;               // 1 at the rim, ~0.46 at the floor
  const mid = W / 2;
  const reach = (W / 2 - 40) * frac;
  return side < 0 ? mid - reach : mid + reach;
}

function yAt(depth01) {
  return GROUND + (FLOOR - GROUND) * depth01;
}

// a stepped profile down each side, rather than a smooth wedge
function sidePath(side) {
  const pts = [];
  for (let i = 0; i <= STOREYS; i++) {
    const d0 = i / STOREYS;
    const d1 = Math.min(1, (i + 0.5) / STOREYS);
    pts.push([xAt(d0, side), yAt(d0)]);
    pts.push([xAt(d0, side), yAt(d1)]);   // riser
    pts.push([xAt(d1, side), yAt(d1)]);   // tread
  }
  pts.push([xAt(1, side), yAt(1)]);
  return pts;
}

export function initSection() {
  const host = document.getElementById('section-figure');
  if (!host) return;

  const left = sidePath(-1);
  const right = sidePath(1);
  const outline = [...left, ...right.slice().reverse()];
  const d = outline.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cross-section of the stepwell with an adjustable water level">
      <defs>
        <clipPath id="wellclip"><path d="${d} Z"/></clipPath>
      </defs>
      <line class="sx-ground" x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}"/>
      <path class="sx-stone" d="${d} Z"/>
      <g clip-path="url(#wellclip)">
        <rect id="sx-water" class="sx-water" x="0" y="${FLOOR}" width="${W}" height="0"/>
      </g>
      <line id="sx-line" class="sx-line" x1="0" y1="${FLOOR}" x2="${W}" y2="${FLOOR}"/>
      <text class="sx-tag" x="14" y="${GROUND - 12}">GROUND</text>
    </svg>
  `;

  const slider = document.getElementById('section-slider');
  const water = document.getElementById('sx-water');
  const line = document.getElementById('sx-line');
  const readDepth = document.getElementById('sx-depth');
  const readState = document.getElementById('sx-state');

  function apply(v) {
    const depth01 = 1 - v;                    // v = 1 is a full well
    const y = yAt(depth01);
    water.setAttribute('y', y.toFixed(1));
    water.setAttribute('height', (FLOOR - y).toFixed(1));
    line.setAttribute('y1', y.toFixed(1));
    line.setAttribute('y2', y.toFixed(1));

    const metres = depth01 * DEPTH;
    readDepth.textContent = `−${metres.toFixed(1)} m`;

    const under = Math.round((1 - depth01) * STOREYS);
    readState.textContent = v > 0.92 ? 'Monsoon. The lowest flights are unusable.'
      : v < 0.18 ? 'High summer. The full descent is walkable — and necessary.'
      : `${under} of ${STOREYS} storeys under water.`;
  }

  slider.addEventListener('input', () => apply(Number(slider.value) / 100));
  apply(Number(slider.value) / 100);
}

// Sections arrive rather than simply being there.
export function initReveals() {
  const targets = document.querySelectorAll('.sec .kicker, .sec h2, .sec .cols > *, .sec .foot, .sec .figure-wrap');
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = [...e.target.parentElement.children].indexOf(e.target);
      e.target.animate(
        [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }],
        { duration: 900, delay: Math.min(3, i) * 90, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' }
      );
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  targets.forEach((t) => {
    t.style.opacity = '0';
    io.observe(t);
  });
}

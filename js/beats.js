// The film, as a table of beats.
//
// A single Catmull-Rom spline cannot hold, cannot change lens, and cannot cut —
// it can only glide. Twelve discrete beats can do all three: a hold is a beat
// whose start and end camera are (almost) identical, a cut is the discontinuity
// between one beat's end and the next one's start, and the lens is just another
// interpolated channel.
//
// All positions are RELATIVE to the shrine anchor; main.js adds it back, so the
// whole film re-centres itself if the pool measurement moves.
//
// Placements come from the measured open cross-section of the pit, which
// narrows sharply on the way down and is NOT centred on the model:
//
//     y = -2 :  33.8 x 31.1     y = -8   : 21.0 x 19.5
//     y = -4 :  29.8 x 26.7     y = -10  : 18.3 x 18.1
//     y = -6 :  25.0 x 23.1     y = -12.6: 15.6 x 16.6
//
// world centre ~ (-3.5, 7.5) at every level, i.e. rel (0, 4.1) from the anchor.

export const TOTAL_VH = 7200;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const linear = (t) => t;

export const EASES = { easeInOut, easeOut, easeIn, linear };

export const BEATS = [
  {
    id: 'surface',
    title: 'THE SURFACE',
    from: 0, to: 400, ease: 'easeInOut',
    fov: [46, 46],
    // THE LANDING FRAME. An earlier draft opened on empty sand and withheld the
    // well entirely — defensible for a film, wrong for a page a judge gives
    // three seconds. This is the god's-eye: concentric flights descending to
    // green water with the shrine dead centre, raking light throwing the whole
    // stepped geometry into relief. Full bleed, so no model edge is in frame.
    pos: [[-0.01, 30, 7.6], [-0.01, 29.2, 7.5]],
    look: [[-0.01, -9, 4.08], [-0.01, -9, 4.08]],
    hero: true,
  },
  {
    id: 'reveal',
    title: 'INTO IT',
    from: 400, to: 900, ease: 'easeInOut',
    fov: [46, 58],
    // the well is already revealed, so this beat is the first move toward it
    pos: [[-0.01, 29.2, 7.5], [0.5, 17, 12]],
    look: [[-0.01, -9, 4.08], [0, -9, 4]],
    copy: {
      at: 0.32,
      statement: 'In 1740 they cut a hole in the desert.',
    },
  },
  {
    id: 'lip',
    title: 'THE LIP',
    from: 900, to: 1500, ease: 'easeInOut',
    fov: [58, 48],
    pos: [[0.5, 17, 12], [2.0, 12.5, 15]],
    look: [[0, -9, 4], [0, -9.5, 3]],
    copy: {
      at: 0.18, side: 'right',
      eyebrow: 'c.1740 · Jodhpur · Rajasthan',
      statement: 'Toorji Ka Jhalra.',
      body: 'Built in the 1740s by the queen consort of Maharaja Abhay Singh — one of the last great stepwells cut in Rajasthan. Not a well you draw from. A well you walk into.',
    },
  },
  {
    id: 'plunge',
    title: 'OVER THE EDGE',
    from: 1500, to: 1900, ease: 'easeOut',
    fov: [58, 56],
    // THE CUT. Discontinuous with the beat above on purpose — the only one.
    cut: true,
    // Depth must only ever increase. This beat used to land at -4.9 and the
    // NEXT one started at -3.4, so the descent visibly climbed back up.
    // It now lands shallower than the flights that follow it.
    //
    // It also has to stay ABOVE the shrine's roofline (world y -5.05): parked
    // under it, the lens fills with the shrine's unlit underside, which is
    // what read as a black rectangle.
    // Looking UP does not work here: shallow enough to clear the shrine's roof
    // and the mouth is too wide to frame anything but sky; deep enough to see
    // walls and the shrine's unlit underside fills the lens. So the cut looks
    // steeply DOWN the wall instead — flights raking away, shrine in the water.
    pos: [[7.49, -2.0, 12.58], [7.0, -3.0, 12.2]],
    look: [[-4.51, -11.0, 0.58], [-4.3, -11.2, 0.6]],
    copy: { at: 0.30, statement: 'Sixty feet of stairs, and no handrail anywhere.' },
  },
  {
    id: 'flights',
    title: 'THE FLIGHTS',
    from: 1900, to: 2900, ease: 'easeInOut',
    // The earlier move, restored: tracks laterally across the open centre and
    // aims OUT at the far wall on a long lens, so the frame is nothing but
    // flights raking past. Shrine stays behind and below the lens.
    fov: [30, 30],
    pos: [[3.5, -3.4, 3.0], [-2.5, -4.8, 4.0]],
    look: [[-16, -9.5, -2.0], [-14, -11.0, -7.0]],
    copy: {
      at: 0.16, side: 'left',
      statement: 'Flights on every side.',
      body: 'Cut so the water could be reached at any level, in any season — as the monsoon filled it and the summer drew it down.',
    },
  },
  {
    id: 'math',
    title: 'THE MATH',
    from: 2900, to: 3500, ease: 'easeInOut',
    // long lens straight into the lattice: compression turns architecture
    // into pattern
    fov: [42, 30],
    pos: [[-4.51, -6.0, 2.58], [-4.0, -6.6, 3.2]],
    look: [[11.49, -10.0, 2.58], [11.49, -10.8, 2.9]],
    copy: {
      at: 0.18, side: 'right',
      eyebrow: 'Why it is shaped like this',
      statement: 'Every surface is a way down.',
      body: 'The zigzag is not ornament. It is how you reach the water from any side and at any level, however far it has dropped by the end of summer.',
    },
  },
  {
    id: 'pavilion',
    title: 'THE PAVILION',
    from: 3500, to: 4300, ease: 'easeInOut',
    // turns to the -Z wall: jharokhas, rosettes, chhatris, the palace face
    // Off-axis on purpose. Straight down the middle the shrine sits between
    // the lens and the wall — this angle clears it and puts the jharokha,
    // the rosette and the bracketed cornice in frame instead.
    fov: [30, 46],
    pos: [[-9.51, -6.8, 6.58], [-8.51, -8.0, 4.58]],
    look: [[-0.51, -8.2, -15.42], [-0.2, -9.0, -15.0]],
    copy: {
      at: 0.16, side: 'left',
      statement: 'It was never only for water.',
      body: 'Balconies, screens, a colonnade — stepwells were rooms as much as reservoirs. Shaded, cool, and public, in a city that hits forty-five degrees.',
    },
  },
  {
    id: 'descent',
    title: 'THE DESCENT',
    from: 4300, to: 5000, ease: 'easeInOut',
    fov: [50, 46],
    roll: [0, 0.03],
    // stays out at z > 7.4 so the shrine's mass never blocks the lens
    pos: [[-8.51, -8.0, 4.58], [0.4, -10.4, 9.2]],
    look: [[-0.2, -9.0, -15.0], [0, -11.6, -2.0]],
    copy: {
      at: 0.2, side: 'left',
      statement: 'A building that runs backwards.',
      body: 'Sunk instead of raised. The deeper you go the cooler and stiller the air, and the less the water is lost to the sun. The architecture is the machinery.',
    },
  },
  {
    id: 'water',
    title: 'THE WATER',
    from: 5000, to: 5700, ease: 'easeOut',
    fov: [44, 45],
    roll: [0.03, 0],
    pos: [[0.4, -10.4, 9.2], [0, -11.0, 10.4]],
    look: [[0, -11.6, -2.0], [0, -10.6, 0]],
    copy: {
      at: 0.26,
      statement: 'And it holds the sky.',
    },
  },
  {
    id: 'shrine',
    title: 'THE SHRINE',
    from: 5700, to: 6400, ease: 'easeInOut',
    fov: [45, 43],
    pos: [[0, -11.0, 10.4], [5.2, -10.6, 9.0]],
    look: [[0, -10.6, 0], [0, -10.2, 0]],
    copy: {
      at: 0.16, side: 'right',
      statement: 'Water, treated as something owed reverence.',
      body: 'That is what a baoli was. Not plumbing — a place you descended to, and came back up from carrying something.',
    },
  },
  {
    id: 'admission',
    title: '',
    from: 6400, to: 6900, ease: 'easeInOut',
    fov: [43, 42],
    // everything the piece has been doing to seduce you switches off here
    grade: [0, 1],
    pos: [[5.2, -10.6, 9.0], [5.0, -10.5, 8.9]],
    look: [[0, -10.2, 0], [0, -10.2, 0]],
    copy: {
      at: 0.18,
      statement: 'There is no shrine at the bottom of Toorji Ka Jhalra.',
      body: 'We put one there.',
    },
  },
  {
    id: 'reason',
    title: '',
    from: 6900, to: 7200, ease: 'easeOut',
    fov: [42, 44],
    grade: [1, 0],
    pos: [[5.0, -10.5, 8.9], [4.6, -9.9, 9.3]],
    look: [[0, -10.2, 0], [0, -9.8, 0]],
    copy: {
      at: 0.2,
      statement: 'A baoli is a place where water was treated as sacred.',
      body: 'We only made it literal.',
    },
  },
];

function lerp3(a, b, t, out) {
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.z = a[2] + (b[2] - a[2]) * t;
  return out;
}

// Evaluate the film at scroll progress p (0..1).
export function sample(p, outPos, outLook) {
  const vh = p * TOTAL_VH;

  let b = BEATS[0];
  for (let i = 0; i < BEATS.length; i++) {
    if (vh >= BEATS[i].from) b = BEATS[i];
  }

  const span = Math.max(1, b.to - b.from);
  const raw = Math.min(1, Math.max(0, (vh - b.from) / span));
  const t = EASES[b.ease || 'easeInOut'](raw);

  lerp3(b.pos[0], b.pos[1], t, outPos);
  lerp3(b.look[0], b.look[1], t, outLook);

  return {
    beat: b,
    t: raw,
    fov: b.fov[0] + (b.fov[1] - b.fov[0]) * t,
    roll: b.roll ? b.roll[0] + (b.roll[1] - b.roll[0]) * t : 0,
    grade: b.grade ? b.grade[0] + (b.grade[1] - b.grade[0]) * t : 0,
    // copy is bound to its beat and only lives while that beat is on screen
    copyOn: !!b.copy && raw >= b.copy.at,
  };
}

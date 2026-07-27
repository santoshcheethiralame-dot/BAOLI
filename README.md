# BAOLI — बावड़ी

**A machine built to pull the sky underground.**

A real-time 3D descent into **Toorji Ka Jhalra**, an eighteenth-century stepwell
in Jodhpur, Rajasthan. You start on a god's-eye view of the whole excavation and
scroll down through it — over the lip, past the criss-cross flights, along the
pavilion wall, to a shrine standing in the water at the bottom.

Everything runs in the browser at 60fps. No video, no pre-rendered frames.

---

## What is real, and what is not

This is an interpretation, not a document.

- **The well is real.** It is a scan of Toorji Ka Jhalra, built in the 1740s by
  the queen consort of Maharaja Abhay Singh. The flights, the pavilion wall, the
  jharokhas and the chhatris are all really there.
- **The shrine is ours.** There is no shrine at the bottom of Toorji Ka Jhalra.
  It is a separate temple model that we placed in the water.
- **The lingam is ours**, set on the sanctum floor.
- **The water level is chosen** — held at roughly two-thirds depth because that
  leaves the flights readable.
- **The stone is painted.** The scan arrives with no textures at all, so every
  colour is a shader: bleached at the rim, grimier with depth, algal at the
  waterline.
- **The desert and the dusk are ours.**

The piece says this out loud in its closing beat rather than burying it here.

---

## Running it

No build step. Any static server:

```bash
python -m http.server 8790
```

Then open `http://127.0.0.1:8790/`.

---

## How it is made

| | |
|---|---|
| **Rendering** | Three.js (WebGL2) |
| **Shaders** | Custom GLSL — gradient sky dome, water surface, per-course stone staining |
| **Scroll** | Lenis, driving a twelve-beat camera table |
| **Motion** | Web Animations API |
| **Audio** | Web Audio — flute bed through a depth-driven lowpass |
| **Type** | Bodoni Moda · Archivo · Space Mono |
| **Compression** | Draco via `@gltf-transform/cli` — assets 94 MB → 20 MB |
| **Build** | None. ES modules, no bundler |

### The camera is a beat table, not a spline

`js/beats.js` holds twelve beats. Each carries a start and end camera, a lens,
and optionally roll or a colour grade. A **hold** is a beat whose start and end
are nearly identical; a **cut** is the discontinuity between one beat's end and
the next one's start. A single spline can do neither — it can only glide.

Lens changes carry real weight here: 46° for the god's-eye landing, 58° over the
lip, **30° telephoto** on the flights so compression flattens the criss-cross
into pattern, 43° at the shrine.

### Everything is measured, not guessed

The scan is irregular. Its pit is 33.8 × 31.1 at the rim but only 15.6 × 16.6 at
the waterline, and its centre sits ~3.5 units off the model's bounding-box
centre. So the code measures rather than assumes:

- The **open cross-section** at any height, by gridding the model from above and
  keeping cells with no stone above that level. Camera placements come from this
  — guessed coordinates repeatedly ended up inside walls.
- The **pool centroid**, area-weighted, for seating the water and the shrine.
- The **sanctum floor** (−12.09) by raycasting down the shrine's axis, so the
  lingam sits on the floor instead of floating at the ceiling.

### Verification

`scripts/verify.js` (puppeteer-core + system Chrome) screenshots any scroll
position and runs a jank test on per-frame rAF deltas. Every frame in this build
was captured and measured, not eyeballed. The page implements a dev contract for
it: `?jump=<scrollY>` lands pre-scrolled and settled, and `window.__ready` fires
only once the scene is genuinely ready.

Debug flags: `?cam=x,y,z,lx,ly,lz,fov` · `?nowater` · `?nochrome` · `?flatsky`

---

## Credits

| Asset | Source |
|---|---|
| Toorji Ka Jhalra stepwell scan | Sketchfab |
| Indian temples pack (shrine) | Sketchfab |
| Lingam Essence | Sketchfab |
| Origami water lilies | Sketchfab |
| Krishna flute bed | Krasnoshchok |

Built for the 3D Websites Hackathon.

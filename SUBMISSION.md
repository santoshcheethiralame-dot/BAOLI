# BAOLI — बावड़ी

**A machine built to pull the sky underground.**

Live: https://baoli-peach.vercel.app
Source: https://github.com/santoshcheethiralame-dot/BAOLI

---

## Inspiration

A stepwell is the strangest building type most people have never heard of: a structure built by digging *down*, where the architecture is a staircase to water and the whole design exists because the water line itself moves with the seasons. Photographs of places like Chand Baori circulate constantly as "wow" images, but none of them explain *why* the geometry looks like that, or let you feel the descent.

We wanted a website that opens with the same jolt those photographs give — the god's-eye view straight down into the criss-crossing flights — and then actually earns it by taking you into the building instead of just showing you a picture of one.

## What it does

BAOLI is a real-time, one-take scroll descent into **Toorji Ka Jhalra**, an 18th-century stepwell in Jodhpur. You land on a symmetrical aerial view of the whole excavation, then scroll down through it: over the lip, through a hard cut into the shaft, along the criss-cross flights (shot on a long lens so the architecture reads as pure graphic pattern), across the pavilion wall, and down to a shrine standing in the water at the bottom — lit from within by a lingam in its sanctum, with lotuses floating on the surface. A cool-toned reveal at the very end tells you which parts of what you just saw are real and which parts we invented.

Below the film is an actual website: an interactive cross-section where you drag the water level and watch the flights go under (the single idea that explains what a photograph can't), a plain-language ledger of every liberty we took, and a colophon that doubles as the tech credits.

Everything renders live in WebGL — no pre-rendered video, no build step.

## How we built it

**Real scan, invented world.** The stepwell itself is a Sketchfab photogrammetry scan; everything standing in the water — the shrine, the lingam, the lotuses — is a separate asset we composited in. The scan ships with zero textures, so every surface colour is a shader driven by world height: bleached sandstone at the rim, grimier stone with depth, algae right at the waterline.

**The camera is a table, not a spline.** A single Catmull-Rom curve can glide, but it can't hold, can't change lens, and can't cut. We built a 12-beat table instead — each beat has its own start/end camera and its own focal length, so the film can open at 46°, widen to 58° cresting the rim, snap to a hard **30° telephoto** on the flights (compression is what turns stone stairs into a graphic pattern), and land at 43° in the sanctum. There's exactly one hard cut in the whole piece, placed at the plunge into the shaft — it reads as violent specifically because nothing else in the film cuts.

**Nothing is placed by eye if it can be measured.** The scan's pit is wildly irregular — 33.8×31.1m at the rim, only 15.6×16.6m at the waterline, and its true centre sits ~3.5 units off the model's own bounding-box centre. Early on we kept guessing camera coordinates and ending up embedded in walls. The fix was to grid the model from above at runtime, find which cells have open air above a given height, and derive camera placements, the water-plane centroid, and the shrine's seat position from that — not from assumption. When the lingam still looked subtly off-centre, we didn't nudge it by eye a third time: we rendered a straight-on shot, measured the pixel offset against the doorway, and moved it exactly that amount (+0.15 units) — the earlier eyeball guess turned out to be centering the model's *bounding box*, when what actually needed centering was its shaft, which sits off-axis inside the box because of the yoni's spout.

**Depth drives everything, not just the camera.** As you descend, the sky desaturates, a lowpass filter closes over the ambient flute recording (bright and open at the rim, muffled by the time you reach the water), fog thickens, and the fill light ramps up specifically so the shaft interior doesn't go pitch black — a problem we didn't discover until we screenshotted the descent and found solid black rectangles where the "corrected for the landing shot" lighting had left the tunnel completely unlit.

**Every frame was screenshotted, not eyeballed.** We built a small puppeteer harness with a `?jump=<scrollY>` dev contract and a `window.__ready` flag, so any point in the descent could be captured and jank-tested (per-frame rAF deltas, judged on p95/max — never average fps) without relying on "looks fine to me."

## Challenges we ran into

- **Compression that quietly deformed the geometry.** To get the 94MB of scans under a reasonable load size, we ran them through a standard glTF optimize pipeline with Draco compression. It worked — 94MB → 20MB — but the default pipeline also runs mesh *simplification*, which decimated hard architectural edges. It took a direct bug report ("the mandapam stairs are corrupted, facing up") to catch it: the causeway steps had lost more than half their vertices and the simplifier had warped the sharp riser/tread edges into a garbled surface. The fix was re-running compression with Draco geometry encoding only, skipping simplification entirely — full vertex counts preserved, file size still cut roughly 6–8×.
- **A sanctum that leaked light onto the water.** Our first attempt at lighting the lingam used two lamps reaching 11–16 units with slow falloff, which poured light straight out of the doorway and lit the pool outside. It looked wrong in a way that was hard to name until we realized the light source itself was the bug — one small, tightly-decayed lamp behind the lingam fixed it in one change.
- **An audio arm bug that silently disabled itself.** Autoplay is blocked without a user gesture, so we "arm" the sound bed on load and start it on the first scroll/click/keypress. The first version called an unbind function unconditionally after the *first* attempt, whether or not that attempt actually succeeded — so one blocked autoplay attempt permanently disarmed every future gesture, and the toggle looked "on" while producing nothing.
- **Getting the opening frame right at all.** Our first instinct was to withhold the well entirely and open on empty desert, which is a legitimate documentary-film choice and a bad landing-page choice — a judge gives you three seconds, not thirty. We rebuilt the cold open around the god's-eye shot instead.

## Accomplishments that we're proud of

- A fully real-time WebGL descent that still reads as directed cinema — lens changes, one deliberate cut, holds vs. moves — running with no video and no bundler.
- The honesty framing at the end. Instead of quietly passing off an invented shrine as documentary, the piece states plainly what's real (the scanned stepwell) and what's ours (the shrine, the lingam, the water level, the entire palette), and treats that admission as the emotional turn of the piece rather than a legal footnote.
- A debugging discipline that held up under real pressure: measuring pixel offsets instead of re-guessing coordinates, raycasting to find the actual sanctum floor instead of eyeballing a fraction of the shrine's height, and catching a silent geometry-corrupting compression bug from a two-line bug report.
- An interactive cross-section below the film that teaches something no screenshot of a stepwell can: that the whole point of the architecture is a waterline that moves.

## What we learned

That "optimize" and "compress" are not synonyms — an optimization pipeline that also simplifies mesh geometry can silently destroy the thing you were trying to preserve, and the only way to catch it is to check vertex counts before and after, not just file size. That measured values beat guessed ones every single time a model's actual geometry disagrees with its bounding box — which, for anything asymmetric, is most of the time. And that a piece built around a factual monument earns more trust by naming its own fictions out loud than by hiding them in a colophon nobody reads.

## What's next for BAOLI

- A horizontal-scroll section comparing Toorji Ka Jhalra against its sibling stepwells (Chand Baori, Rani ki Vav, Adalaj) by depth, date, and storeys.
- A proper performance pass — the descent currently spikes past our jank budget on a handful of frames, and we want a real profiler trace rather than another guess.
- Verified mobile support; the build has only been tested at desktop widths so far.
- Wiring the ripple shader (already written, not yet triggered) to a click on the water.

import * as THREE from 'three';
import Lenis from 'lenis';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WELL_DEPTH, WELL_WIDTH, WATER_Y } from './stepwell.js';
import { loadTemple, loadStepwell, loadProp, loadClusterFlat, manager } from './models.js';
import { createWater, mirrorBelow } from './water.js';
import { createDust, createShafts } from './atmosphere.js';
import { initOverlay, updateOverlay } from './overlay.js';
import { sample, TOTAL_VH } from './beats.js';
import { createSky } from './sky.js';
import { initUI, revealWordmark } from './ui.js';
import { initSection, initReveals } from './section.js';

// The journey no longer ends underground, so the sky must not collapse to
// black. It travels from hot white noon to dusk over the water.
const SKY_TOP = new THREE.Color('#e9dcc0');
const SKY_DEEP = new THREE.Color('#b98f95');
// beat 11 drains the colour out of the whole piece before the admission lands
const GREY = new THREE.Color('#9b9894');
// the dome's upper wash — cool against the warm horizon is what makes a desert
// sky read as deep rather than as a painted backdrop
const HIGH_TOP = new THREE.Color('#7e97ad');
const HIGH_DEEP = new THREE.Color('#6d5f74');

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
// scene.background stays null — the gradient dome IS the sky
scene.fog = new THREE.FogExp2(SKY_TOP.clone(), 0.0011);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 600);

// The tank, arcade and every flight of steps are now the Toorji Ka Jhalra scan.
// Nothing procedural remains of the well — the plaid stairs went with it.

// That scan is a SECTIONAL model: it ends in a solid slab, so without a plate
// of desert around it the whole thing reads as a tabletop diorama floating in
// the sky. This continues its top surface out to the horizon.
// It must be a RING, not a sheet — a solid plane at ground level lies straight
// over the mouth of the well and hides the entire excavation.
const desertShape = new THREE.Shape();
desertShape.moveTo(-450, -450);
desertShape.lineTo(450, -450);
desertShape.lineTo(450, 450);
desertShape.lineTo(-450, 450);
desertShape.closePath();

const mouth = new THREE.Path();
const hx = WELL_WIDTH * 0.455;   // tucks just under the scan's own top plate
const hz = WELL_WIDTH * 0.485;
mouth.moveTo(-hx, -hz);
mouth.lineTo(-hx, hz);
mouth.lineTo(hx, hz);
mouth.lineTo(hx, -hz);
mouth.closePath();
desertShape.holes.push(mouth);

const desertGeo = new THREE.ShapeGeometry(desertShape);
desertGeo.rotateX(-Math.PI / 2);
const desert = new THREE.Mesh(
  desertGeo,
  new THREE.MeshStandardMaterial({ color: '#c9a97c', roughness: 1.0 })
);
desert.position.y = -0.04;   // ground level is y = 0 in the scan, so sit just under it
desert.receiveShadow = false;
scene.add(desert);

// --- light -----------------------------------------------------------------
// One hard sun. The well darkens with depth because the geometry occludes it,
// not because anything is faded by hand.
const sun = new THREE.DirectionalLight('#ffdca6', 5.4);
// raking, not overhead — half the well has to fall into hard shadow or the
// chevrons flatten into a diagram
sun.position.set(62, 26, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 190;
const s = 46;
Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
// without this the frustum stays at its ±5 default and everything outside it
// clamps to full shadow — a hard black rectangle across the whole well
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun);

const sky = new THREE.HemisphereLight('#a8b6c2', '#2a1d12', 0.5);
scene.add(sky);

// shadowed stone still has to read as stone, not as a hole in the page
// low enough that carved relief still casts into its own shadow — a high
// ambient flattens every moulding it touches
const fill = new THREE.AmbientLight('#6d5f4c', 0.5);
scene.add(fill);

const bounce = new THREE.PointLight('#ffd9a0', 0, 60);
scene.add(bounce);

// travels with the camera — without it the middle storeys crush to pure black
// once the sun stops reaching them
const lamp = new THREE.PointLight('#ffcf9a', 0, 52, 0.9);
scene.add(lamp);

// --- water + air -----------------------------------------------------------
const water = createWater();
scene.add(water.mesh);

const dust = createDust();
scene.add(dust.points);

const shafts = createShafts();
scene.add(shafts.group);

const skyDome = createSky(sun.position);
scene.add(skyDome.mesh);
if (new URLSearchParams(location.search).has('nosky')) skyDome.mesh.visible = false;
if (new URLSearchParams(location.search).has('flatsky')) {
  scene.background = new THREE.Color('#c9b9a0');
  skyDome.mesh.visible = false;
}

// --- post ------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.7, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- camera path -----------------------------------------------------------
// One continuous descent. It never reverses; it drifts wall to wall so the
// chevrons rush past close to lens instead of reading as a distant diagram.
// One continuous approach. The shrine stays dead centre the whole way down —
// the scroll is a walk toward it, and the last beat is symmetrical so the
// reflection reads.
// Re-fitted to the scan: the well is now 22.7 deep instead of 6.9, so the whole
// descent is three times longer. Approach over the desert, tip over the rim,
// then fall the length of the shaft to the shrine standing in the water.
// Camera, lens, roll and grade all come from the beat table in beats.js.

// --- scroll ----------------------------------------------------------------
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NO_WATER = new URLSearchParams(location.search).has('nowater');
if (new URLSearchParams(location.search).has('nochrome')) {
  document.querySelectorAll('#topbar,#hero,#meta,#chapter-block,#scroll-cue,#altimeter,#copy,#grain,#vignette,#landing-scrim')
    .forEach((n) => { n.style.display = 'none'; });
}
// ?cam=x,y,z,lx,ly,lz,fov — world-space override for scouting angles
const CAM = (new URLSearchParams(location.search).get('cam') || '')
  .split(',').map(Number).filter((n) => !Number.isNaN(n));

const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.9 });
lenis.on('scroll', () => { target = scrollProgress(); });

let target = 0;
let current = 0;

// The film ends where #scroll-track ends. Everything past that is the content
// below, and must not keep driving the camera.
function scrollProgress() {
  const track = document.getElementById('scroll-track');
  const filmEnd = Math.max(1, track.offsetHeight - innerHeight);
  return Math.min(1, Math.max(0, scrollY / filmEnd));
}

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function applyProgress(p) {
  const st = sample(p, tmpPos, tmpLook);
  // The shaft is offset from the model's bounding-box centre, so the whole
  // choreography is shifted onto it — otherwise the descent runs down beside
  // the well rather than into it.
  tmpPos.x += shrineAnchor.x; tmpPos.z += shrineAnchor.z;
  tmpLook.x += shrineAnchor.x; tmpLook.z += shrineAnchor.z;
  if (CAM.length >= 6) {
    camera.position.set(CAM[0], CAM[1], CAM[2]);
    camera.lookAt(CAM[3], CAM[4], CAM[5]);
    if (CAM[6]) { camera.fov = CAM[6]; camera.updateProjectionMatrix(); }
  } else {
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);
  if (st.roll) camera.rotateZ(st.roll);
  if (Math.abs(camera.fov - st.fov) > 0.01) {
    camera.fov = st.fov;
    camera.updateProjectionMatrix();
  }
  }

  // sky and fog collapse into the dark as the walls close over you
  const k = Math.pow(p, 1.15);
  const g = st.grade || 0;
  const horizon = SKY_TOP.clone().lerp(SKY_DEEP, k);
  const high = HIGH_TOP.clone().lerp(HIGH_DEEP, k);
  if (g > 0) { horizon.lerp(GREY, g * 0.85); high.lerp(GREY, g * 0.85); }
  skyDome.setMood(horizon, high, 0.85 - k * 0.35);
  skyDome.follow(camera);
  scene.fog.color.copy(horizon);
  scene.fog.density = 0.0011 + k * 0.0016;

  sun.intensity = 5.4 * (1 - k * 0.30);

  // The landing wants a low ambient so the raking sun carves the flights into
  // relief. The shaft wants the opposite — with ambient at 0.5 the interior is
  // literally unlit, which is what rendered as black rectangles against the
  // sky. So the fill RAMPS with depth: crisp up top, readable underground.
  const depthMix = Math.min(1, Math.max(0, p / 0.32));
  fill.intensity = 0.5 + depthMix * 0.95;
  sun.color.setHSL(0.09 - k * 0.03, (0.45 + k * 0.25) * (1 - g * 0.92), 0.72 - k * 0.06 + g * 0.06);
  sky.intensity = 0.5 * (1 - k * 0.2) + depthMix * 0.55;

  // the reflector renders the whole scene a second time — only pay for it once
  // the pool is actually in shot
  water.mesh.visible = !NO_WATER;

  lamp.position.copy(camera.position);
  lamp.intensity = Math.min(1, Math.max(0, (p - 0.09) / 0.22)) * 24;

  // a cold glow off the water, only near the bottom
  // the glow off the pool has to start climbing the walls well before you
  // reach it, or the lower storeys are an unlit void
  const nearWater = Math.max(0, (p - 0.22) / 0.78);
  bounce.intensity = nearWater * 9;
  bounce.position.set(0, WATER_Y + 2.4, 0);
  bounce.color.set('#2f6f68');

  renderer.toneMappingExposure = 1.08 - k * 0.16;

  // air: dust builds as the shaft closes in, shafts burn brightest in the
  // upper storeys where the sun still reaches and die before the water
  dust.update(clock, 0.05 + Math.sin(Math.min(1, p * 1.35) * Math.PI) * 0.20);
  shafts.update(camera, Math.sin(Math.min(1, p * 1.15) * Math.PI) * 0.13);
  water.update(clock, camera.position);

  bloom.strength = (0.20 + p * 0.16) * (1 - (st.grade || 0) * 0.8);

  updateOverlay(p, { ...st, cameraY: camera.position.y });
  ui.update(p);
}

// --- dev contract ----------------------------------------------------------
// ?jump=<scrollY> lands pre-scrolled and settled; __ready fires only once a
// real frame has been drawn at that position.
const jump = new URLSearchParams(location.search).get('jump');
let settled = false;

function firstFrameSettle() {
  if (settled) return;
  settled = true;
  if (jump !== null) {
    const y = Number(jump) || 0;
    lenis.scrollTo(y, { immediate: true });
    scrollTo(0, y);
  }
  target = scrollProgress();
  current = target;
  applyProgress(current);
  composer.render();
  // the sun never moves, so the shadow map only ever needs drawing once
  renderer.shadowMap.autoUpdate = false;
  loaderFill.style.transform = 'scaleX(1)';
  loaderNum.textContent = '100';
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 900);
  revealWordmark();
  ui.arm();
  initSection();
  initReveals();
  const again = document.getElementById('again');
  if (again) again.addEventListener('click', () => lenis.scrollTo(0, { duration: 2.2 }));
  requestAnimationFrame(() => { window.__ready = true; });
}

let clock = 0;

function frame(time) {
  lenis.raf(time);
  clock = time * 0.001;
  current += (target - current) * (reduced ? 1 : 0.14);
  applyProgress(current);
  composer.render();
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// once you are down at the water, clicking it throws a ring — the one thing
// in the whole descent that answers back
const pointer = new THREE.Vector2();
const ray = new THREE.Raycaster();
addEventListener('pointerdown', (e) => {
  if (current < 0.8) return;
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(water.mesh)[0];
  if (hit) water.ripple(hit.point.x, hit.point.z, clock);
});

window.__dbg = { THREE, scene, camera, water, shafts, dust, get p() { return current; } };

const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderNum = document.getElementById('loader-num');
manager.onProgress = (_u, done, total) => {
  const pct = Math.round((done / Math.max(1, total)) * 100);
  loaderFill.style.transform = `scaleX(${pct / 100})`;
  loaderNum.textContent = String(pct);
};

initOverlay(WELL_DEPTH);

const ui = initUI({
  onSeek(frac) {
    const track = document.getElementById('scroll-track');
    lenis.scrollTo(frac * Math.max(1, track.offsetHeight - innerHeight), { duration: 1.6 });
  },
});

// Models must be in the scene before __ready fires, or the verification
// harness photographs an empty shrine.
const shrineAnchor = new THREE.Vector3();
let templeObj = null;
let lingamObj = null;
let lotusTemplate = null;
let poolCentre = null;
let poolSize = null;

Promise.all([
  loadStepwell(WELL_WIDTH, WATER_Y).then(({ obj, box, size, floorY, basinCentre, basinSize, openAt }) => {
    scene.add(obj);
    if (new URLSearchParams(location.search).has('normals')) {
      const nm = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      obj.traverse((c) => { if (c.isMesh) c.material = nm; });
    }
    // seat the water and the shrine on the MEASURED basin, not on the origin
    water.mesh.position.set(basinCentre.x, WATER_Y, basinCentre.z);
    // fit the surface to the measured pool rather than poking through its walls
    water.mesh.scale.set(basinSize.x / water.side, basinSize.z / water.side, 1);

    // The pool's centroid sits on the NEAR side of the well, and the camera
    // descends from +z — so a shrine placed there hides behind the near rim
    // when seen from above. Push it toward the far wall, as far as the pool
    // allows once its own footprint is accounted for.
    const halfFoot = 4.2;
    const backLimit = basinCentre.z - basinSize.z / 2 + halfFoot;
    poolCentre = basinCentre.clone();
    poolSize = basinSize.clone();
    shrineAnchor.set(
      basinCentre.x,
      0,
      Math.max(backLimit, basinCentre.z - 4.2)
    );
    window.__open = {};
    for (const y of [-2, -4, -6, -8, -10, -12.6]) window.__open['y' + y] = openAt(y);
    window.__wellBox = {
      min: box.min.toArray().map((v) => +v.toFixed(2)),
      max: box.max.toArray().map((v) => +v.toFixed(2)),
      size: size.toArray().map((v) => +v.toFixed(2)),
      floorY: +floorY.toFixed(2),
      basin: basinCentre.toArray().map((v) => +v.toFixed(2)),
      basinSize: basinSize.toArray().map((v) => +v.toFixed(2)),
    };
  }),
  // --- the lingam, in the garbhagriha -------------------------------------
  loadProp('assets/lingam.glb', 1.15).then(({ obj, info }) => {
    lingamObj = obj;
    window.__lingamSize = info.size.toArray().map((v) => +v.toFixed(2));
  }),

  // --- lotus cluster, floating on the pool ---------------------------------
  // 0.9, not 1.7: the pool is only ~15.6 x 16.6, and the first pass sized this
  // to fill nearly a seventh of it — one clump ended up as a wall of ghost-
  // white petals right in front of the lens during THE WATER.
  loadClusterFlat('assets/lotus.glb', 0.9).then(({ obj }) => {
    lotusTemplate = obj;
  }),

  loadTemple('Temple_02', 8.4).then(({ obj, info, names }) => {
    templeObj = obj;
    window.__templeSize = info.size.toArray().map((v) => +v.toFixed(2));
    window.__templeNames = names;
  }),
])
  .then(() => {
    // Seated only once BOTH are loaded — the shrine's position depends on the
    // basin measured out of the well, so it cannot be placed at load time.
    if (!templeObj) return;
    templeObj.userData.isTemple = true;
    window.__shrineAnchor = { x: shrineAnchor.x, y: WATER_Y - 0.85, z: shrineAnchor.z };
    templeObj.position.set(shrineAnchor.x, WATER_Y - 0.85, shrineAnchor.z);
    scene.add(templeObj);
    scene.add(mirrorBelow(templeObj));

    // Measured, not guessed. Casting straight down the shrine's axis returns
    // the ceiling at -10.0 and the sanctum floor at -12.09. A fraction-of-height
    // guess put the lingam at -10.93 — floating up against the ceiling.
    const SANCTUM_FLOOR = -12.09;
    if (lingamObj && !new URLSearchParams(location.search).has('nolingam')) {
      // nudged right of the shrine's axis so it reads centred in the doorway
      // +0.15, measured — not guessed. normalise() centres a model by its
      // BOUNDING BOX, and the yoni's spout extends to one side, so the bbox
      // centre sits right of the shaft. What must be centred in the doorway is
      // the shaft, so the whole piece shifts to compensate.
      lingamObj.position.set(shrineAnchor.x + 0.15, SANCTUM_FLOOR - 0.04, shrineAnchor.z);
      // the yoni's spout has to face right from the approach; the model
      // arrives pointing away
      lingamObj.rotation.y = Math.PI / 2;
      scene.add(lingamObj);

      // ONE small lamp, low and behind the lingam. The previous pair reached
      // 11 and 16 units with decay 1.5, so the glow poured out of the doorway
      // and lit the water. Distance 2.6 with decay 2.4 keeps it inside the
      // sanctum and leaves the lingam reading as a silhouette against it.
      const deepam = new THREE.PointLight('#ffa74e', 3.2, 2.6, 2.4);
      deepam.position.set(shrineAnchor.x, SANCTUM_FLOOR + 0.55, shrineAnchor.z - 0.75);
      scene.add(deepam);
    }

    // --- lotus clusters, floating on the pool ------------------------------
    // A handful of whole, textured clusters rather than dozens of instanced
    // pads: this asset is a composed scene (flowers + pads together), so a
    // few real copies read as clumps of lotuses growing where the water is
    // calm, the way they actually do — not a scattered grid of identical tiles.
    if (lotusTemplate && poolCentre && !new URLSearchParams(location.search).has('nolotus')) {
      let seed = 20260727;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      const hx = poolSize.x / 2 - 1.4;
      const hz = poolSize.z / 2 - 1.4;

      let placed = 0, tries = 0;
      while (placed < 5 && tries < 80) {
        tries++;
        const x = poolCentre.x + (rnd() * 2 - 1) * hx;
        const z = poolCentre.z + (rnd() * 2 - 1) * hz;
        // Clear of the shrine's plinth, AND clear of the camera's own approach
        // corridor (the water/shrine beats sit at world z ~= shrineAnchor.z + 8
        // to +10.4) — the old guard only fenced off the shrine, not the lens
        // path, which is how one clump ended up filling the frame.
        if (Math.abs(x - shrineAnchor.x) < 5.5 && Math.abs(z - shrineAnchor.z) < 5.5) continue;
        if (z > shrineAnchor.z + 6.5) continue;

        const clone = lotusTemplate.clone(true);
        clone.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
        clone.position.set(x, WATER_Y + 0.02, z);
        clone.rotation.y = rnd() * Math.PI * 2;
        clone.scale.multiplyScalar(0.55 + rnd() * 0.35);
        scene.add(clone);
        placed++;
      }
    }
  })
  .catch((e) => console.error('model load failed', e))
  .finally(() => {
    requestAnimationFrame((t) => {
      frame(t);
      firstFrameSettle();
    });
  });

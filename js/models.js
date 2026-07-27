import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Real sculpted assets. Sketchfab exports arrive Z-up at arbitrary scale, so
// nothing here trusts the file's transform: every model is measured after load
// and normalised to a target height, then seated on its own base.

// progress is reported so the wait can be counted rather than guessed at
export const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

// Every model is Draco-compressed: the stepwell scan alone went 57.6MB -> 7.2MB,
// and the four together 94MB -> 10MB. Decoding costs a moment of CPU on load
// and saves the visitor most of a minute on the wire.
const draco = new DRACOLoader(manager);
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
draco.setDecoderConfig({ type: 'js' });
loader.setDRACOLoader(draco);

function load(url) {
  return new Promise((res, rej) => loader.load(url, res, undefined, rej));
}

// Measure, upright, centre on XZ, and sit the base at y = 0.
// Centring is applied to an INNER holder, never to `obj` itself. Writing it to
// obj.position means any later obj.position.set(...) silently discards the
// centring — which is exactly how a temple ended up off-screen.
function normalise(obj, targetHeight) {
  const inner = new THREE.Group();
  while (obj.children.length) inner.add(obj.children[0]);
  obj.add(inner);

  inner.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(inner);
  let size = box.getSize(new THREE.Vector3());

  // Z-up assets come in lying down: depth exceeds height. Tip them upright.
  if (size.z > size.y * 1.25) {
    inner.rotation.x = -Math.PI / 2;
    inner.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(inner);
    size = box.getSize(new THREE.Vector3());
  }

  inner.scale.multiplyScalar(targetHeight / size.y);
  inner.updateWorldMatrix(true, true);

  box = new THREE.Box3().setFromObject(inner);
  const centre = box.getCenter(new THREE.Vector3());
  inner.position.x -= centre.x;
  inner.position.z -= centre.z;
  inner.position.y -= box.min.y;

  inner.updateWorldMatrix(true, true);
  return { size: new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3()) };
}

function dressMaterials(obj, { metalness = null, roughness = null, tint = null } = {}) {
  obj.traverse((c) => {
    if (!c.isMesh) return;
    c.castShadow = true;
    c.receiveShadow = true;
    const m = c.material;
    if (!m) return;
    if (metalness !== null && 'metalness' in m) m.metalness = metalness;
    if (roughness !== null && 'roughness' in m) m.roughness = roughness;
    if (tint) m.color.multiply(new THREE.Color(tint));
    m.side = THREE.FrontSide;
  });
}


// The temples file holds three separate shrines. Pull one out by name so the
// vimana is a real carved tower rather than my stack of boxes.
export async function loadTemple(which, targetHeight) {
  const gltf = await load('assets/temples.glb');
  const root = gltf.scene;

  // Temple_03 is FOUR separate meshes. Taking only the first gave a fragment,
  // which is why the chunky temple never appeared — collect every match and
  // keep each one's own world transform so the parts stay assembled.
  root.updateWorldMatrix(true, true);
  const picked = [];
  root.traverse((c) => {
    if (c.isMesh && c.name.toLowerCase().includes(which.toLowerCase())) picked.push(c);
  });

  const obj = new THREE.Group();
  if (picked.length) {
    for (const m of picked) {
      const clone = m.clone();
      clone.matrix.copy(m.matrixWorld);
      clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
      obj.add(clone);
    }
  } else {
    obj.add(root);
  }

  const info = normalise(obj, targetHeight);
  dressMaterials(obj, { roughness: 0.9, metalness: 0.0 });
  return { obj, info, names: listMeshes(root) };
}

// A single prop, uprighted and scaled to a target height, standing on y = 0.
export async function loadProp(url, targetHeight) {
  const gltf = await load(url);
  const obj = new THREE.Group();
  obj.add(gltf.scene);
  const info = normalise(obj, targetHeight);
  dressMaterials(obj, { roughness: 0.72, metalness: 0.05 });
  return { obj, info };
}

// Load a pack of separate props (rocks, shrubs) as individual pieces, each
// uprighted, centred on XZ and standing on y = 0 so it can be dropped anywhere.
export async function loadPack(url, targetHeight) {
  const gltf = await load(url);
  gltf.scene.updateWorldMatrix(true, true);

  const pieces = [];
  gltf.scene.traverse((c) => {
    if (!c.isMesh || !c.geometry) return;
    const geo = c.geometry.clone();
    geo.applyMatrix4(c.matrixWorld);

    // upright Z-up source art
    geo.computeBoundingBox();
    let bb = geo.boundingBox;
    if (bb.max.z - bb.min.z > (bb.max.y - bb.min.y) * 1.25) {
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      bb = geo.boundingBox;
    }

    const size = bb.getSize(new THREE.Vector3());
    if (size.y < 1e-4) return;
    const k = targetHeight / size.y;
    geo.scale(k, k, k);
    geo.computeBoundingBox();
    bb = geo.boundingBox;
    const c2 = bb.getCenter(new THREE.Vector3());
    geo.translate(-c2.x, -bb.min.y, -c2.z);
    geo.computeVertexNormals();

    const mat = Array.isArray(c.material) ? c.material[0] : c.material;
    pieces.push({ geometry: geo, material: mat, name: c.name });
  });
  return pieces;
}

// Flat props — lily pads and the like. These are already Y-up and lying flat,
// so the usual "is it lying down?" upright test is exactly wrong for them: a
// pad is 240 across and 5 thick, the test calls that Z-up, and stands it on
// end. Scale by FOOTPRINT, never by height, and never rotate.
export async function loadFlat(url, targetSpan) {
  const gltf = await load(url);
  gltf.scene.updateMatrixWorld(true);

  const pieces = [];
  gltf.scene.traverse((c) => {
    if (!c.isMesh || !c.geometry || !c.geometry.attributes.position) return;

    const src = c.geometry.clone();
    src.applyMatrix4(c.matrixWorld);

    // keep only what the renderer binds
    const geo = new THREE.BufferGeometry();
    if (src.index) geo.setIndex(src.index);
    ['position', 'normal', 'uv'].forEach((k) => {
      if (src.attributes[k]) geo.setAttribute(k, src.attributes[k]);
    });

    geo.computeBoundingBox();
    let bb = geo.boundingBox;
    const size = bb.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z);
    if (span < 1e-4) return;

    const k = targetSpan / span;
    geo.scale(k, k, k);
    geo.computeBoundingBox();
    bb = geo.boundingBox;
    const mid = bb.getCenter(new THREE.Vector3());
    geo.translate(-mid.x, -bb.min.y, -mid.z);
    if (!geo.attributes.normal) geo.computeVertexNormals();

    const m = Array.isArray(c.material) ? c.material[0] : c.material;
    pieces.push({ geometry: geo, material: m, name: c.name });
  });
  return pieces;
}

// A composed cluster prop (several elements arranged together in the file,
// e.g. a lotus cluster) that should stay intact as ONE group rather than be
// split into per-mesh instances. Textures are kept — this is not bare stone
// that needs painting. Scaled by FOOTPRINT since it is meant to float.
export async function loadClusterFlat(url, targetSpan) {
  const gltf = await load(url);
  const holder = new THREE.Group();
  holder.add(gltf.scene);
  holder.updateWorldMatrix(true, true);

  let box = new THREE.Box3().setFromObject(holder);
  let size = box.getSize(new THREE.Vector3());

  // upright only if it is genuinely lying down (Z deeper than tall) — a cube
  // bounding box like this one is ambiguous, so the ratio has to be decisive
  if (size.z > size.y * 1.4) {
    holder.rotation.x = -Math.PI / 2;
    holder.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(holder);
    size = box.getSize(new THREE.Vector3());
  }

  const span = Math.max(size.x, size.z);
  holder.scale.multiplyScalar(targetSpan / span);
  holder.updateWorldMatrix(true, true);

  box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.x -= c.x;
  holder.position.z -= c.z;
  holder.position.y -= box.min.y;

  holder.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material) o.material.side = THREE.DoubleSide;
  });

  return { obj: holder };
}

// The stepwell scan: 174 meshes, no textures at all. Bare geometry is the point
// — it takes whatever stone we paint on it, so the staining is driven by world
// height (grime low, algae at the waterline) rather than baked into the file.
export async function loadStepwell(targetWidth, waterY) {
  const gltf = await load('assets/stepwell.glb');
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);

  // Flatten every mesh into world space. No extra rotation: the raw POSITION
  // data is Z-up (bounds run -18.06..3.11 in Z), but the exporter's node
  // hierarchy already applies the Z-up -> Y-up conversion. Adding our own
  // rotateX on top lays the whole shaft back down on its side.
  const holder = new THREE.Group();
  root.updateMatrixWorld(true);

  root.traverse((c) => {
    if (!c.isMesh || !c.geometry) return;
    const geo = c.geometry.clone();
    geo.applyMatrix4(c.matrixWorld);
    holder.add(new THREE.Mesh(geo, c.material));
  });

  holder.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(holder);
  let size = box.getSize(new THREE.Vector3());

  const k = targetWidth / Math.max(size.x, size.z);
  holder.scale.multiplyScalar(k);
  holder.updateWorldMatrix(true, true);

  box = new THREE.Box3().setFromObject(holder);
  const centre = box.getCenter(new THREE.Vector3());
  holder.position.x -= centre.x;
  holder.position.z -= centre.z;
  // NO vertical translation. The scan's own origin already sits at ground
  // level (the excavation runs to -18, the pavilions rise to +3). Seating it by
  // box.max.y drops the real ground ~3.4 below y=0, which is what left a band
  // of empty sky between the desert ring and the well.

  holder.updateWorldMatrix(true, true);
  const finalBox = new THREE.Box3().setFromObject(holder);

  // Find the water basin: the lowest chunk of the excavation. The shrine and
  // the water plane are placed on THIS, not on the bounding-box centre — the
  // well is not symmetrical, so its middle is not the basin's middle.
  const floorY = finalBox.min.y;
  // Measure the VOID, not the stone.
  //
  // Slicing the geometry at a height and taking its bounding box finds the
  // walls, and the walls are not symmetrical — so their centre is not the
  // pool's centre, which is why the shrine kept sitting off to one side.
  //
  // Instead: grid the footprint, record the HIGHEST point of stone in each
  // cell, and keep the cells with nothing above them. That set of cells IS the
  // open excavation, and its centre is where the water actually is.
  const G = 72;
  const minX = finalBox.min.x, minZ = finalBox.min.z;
  const stepX = (finalBox.max.x - minX) / G;
  const stepZ = (finalBox.max.z - minZ) / G;
  const top = new Float32Array(G * G).fill(-Infinity);

  const v = new THREE.Vector3();
  holder.traverse((c) => {
    if (!c.isMesh) return;
    const pos = c.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld);
      const gx = Math.min(G - 1, Math.max(0, Math.floor((v.x - minX) / stepX)));
      const gz = Math.min(G - 1, Math.max(0, Math.floor((v.z - minZ) / stepZ)));
      const k = gz * G + gx;
      if (v.y > top[k]) top[k] = v.y;
    }
  });

  // "open" = no masonry standing anywhere near ground level above this cell
  // The pool is the set of cells with no stone above the WATERLINE — i.e. the
  // open water surface itself. Measuring the pit from the rim instead gives its
  // widest extent, and the shaft narrows sharply on the way down, so a standoff
  // sized from that puts the camera straight into a wall.
  //
  // Area-weighted centroid, not the bounding-box centre: the pool is irregular,
  // so its bbox centre sits away from where the water reads as centred, which
  // is what kept pulling the shrine off to one side.
  const basin = new THREE.Box3();
  let sx = 0, sz = 0, cells = 0;
  for (let gz = 0; gz < G; gz++) {
    for (let gx = 0; gx < G; gx++) {
      const t = top[gz * G + gx];
      if (t === -Infinity || t > waterY) continue;
      const wx = minX + (gx + 0.5) * stepX;
      const wz = minZ + (gz + 0.5) * stepZ;
      basin.expandByPoint(new THREE.Vector3(wx, t, wz));
      sx += wx; sz += wz; cells++;
    }
  }
  const centroid = cells
    ? new THREE.Vector3(sx / cells, waterY, sz / cells)
    : new THREE.Vector3(0, waterY, 0);

  const basinCentre = centroid;
  const basinSize = basin.isEmpty() ? new THREE.Vector3(10, 1, 10) : basin.getSize(new THREE.Vector3());

  // Where is it safe to put a camera at height y? Any cell whose highest stone
  // is below y has nothing at that height — so the set of such cells is the
  // open cross-section at y. The pit's shape changes at every level, so hand
  // -guessing coordinates buries the lens; this lets beats be placed from data.
  function openAt(y) {
    const b = new THREE.Box3();
    let ax = 0, az = 0, n = 0;
    for (let gz = 0; gz < G; gz++) {
      for (let gx = 0; gx < G; gx++) {
        const t = top[gz * G + gx];
        // -Infinity means the cell has NO geometry at all — it is off the edge
        // of the model, not open space inside the well. Counting those made
        // every depth report the full 48x51 footprint.
        if (t === -Infinity || t >= y || t < floorY + 0.5) continue;
        const wx = minX + (gx + 0.5) * stepX;
        const wz = minZ + (gz + 0.5) * stepZ;
        b.expandByPoint(new THREE.Vector3(wx, y, wz));
        ax += wx; az += wz; n++;
      }
    }
    if (!n) return null;
    const size = b.getSize(new THREE.Vector3());
    return {
      centre: [+(ax / n).toFixed(2), +(az / n).toFixed(2)],
      size: [+size.x.toFixed(2), +size.z.toFixed(2)],
      cells: n,
    };
  }

  paintStone(holder, waterY);
  return {
    obj: holder,
    box: finalBox,
    size: finalBox.getSize(new THREE.Vector3()),
    floorY,
    basinCentre,
    basinSize,
    openAt,
  };
}

// One shared material, tinted per-fragment by world height. Injected into the
// standard shader so it still takes the scene's lights and shadows.
// Quarried stone is never one tone: courses come from different beds, get
// recut, and weather at different rates. Each of the scan's 141 meshes gets its
// own base colour baked into vertex colours, so the sections read separately
// through ONE shared shader instead of 141 material compiles.
// Colour is assigned by architectural ROLE, not at random. Each mesh is judged
// by where it sits and how big it is, because that is what actually decides the
// stone in a real building: fine upper pavilions are cut from bleached cream
// limestone, the massive terraces from ochre sandstone, and the deep submerged
// courses are permanently damp and darker. Random tones just look like noise.
// Strictly a sandstone range — yellows, ochres, browns, creams. No cool tones:
// this is Jodhpur sandstone, and a grey or blue in the mix instantly reads as
// a different material rather than a different course of the same stone.
const WARM  = ['#d6b374', '#cda660', '#c49a54', '#dcbd82', '#c9a468', '#d2ac6c'];
const CREAM = ['#ecdfbb', '#f2e9cd', '#e0d3ab'];
const BROWN = ['#b3854f', '#a67744', '#bd9058'];
const DEEP  = ['#8a6b3e', '#785c34', '#96774a'];

function pick(list, h) {
  return list[Math.floor((h % 1) * list.length) % list.length];
}

function tintMeshes(obj) {
  const c = new THREE.Color();
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  let i = 0;

  obj.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    const n = geo.attributes.position.count;

    geo.computeBoundingBox();
    box.copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld);
    box.getSize(size);
    box.getCenter(centre);

    const h = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453);
    const span = Math.max(size.x, size.z);

    if (centre.y > 0.4 && span < 7) {
      c.set(pick(CREAM, h));               // chhatris, jharokhas, parapets
    } else if (centre.y < -11.5) {
      c.set(pick(DEEP, h));                // permanently damp lower courses
    } else if ((h * 3.7) % 1 < 0.22) {
      c.set(pick(BROWN, h * 5.1));         // richer brown courses for variation
    } else {
      c.set(pick(WARM, h));                // the bulk of the fabric
    }

    c.multiplyScalar(0.9 + ((h * 7.13) % 1) * 0.2);

    const arr = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      arr[v * 3] = c.r;
      arr[v * 3 + 1] = c.g;
      arr[v * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    i++;
  });
}

function paintStone(obj, waterY) {
  tintMeshes(obj);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    metalness: 0.0,
    vertexColors: true,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWater = { value: waterY };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uWater;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float h = vWPos.y;
          // sun-bleached at the rim, grimier as it descends
          float depth = clamp(-h / 22.0, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.36, 0.27), depth * 0.62);
          // algal band riding the waterline
          float algae = smoothstep(2.6, 0.0, abs(h - uWater));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.24, 0.31, 0.18), algae * 0.6);
          // blotchy weathering so it is never one flat tone
          float n = sin(vWPos.x * 0.7) * sin(vWPos.z * 0.6 + 1.3) * sin(h * 0.9);
          diffuseColor.rgb *= 0.93 + n * 0.09;
        }`
      );
  };

  obj.traverse((c) => {
    if (!c.isMesh) return;
    c.material = mat;
    c.castShadow = true;
    c.receiveShadow = true;
  });
}

export function listMeshes(root) {
  const out = [];
  root.traverse((c) => { if (c.isMesh) out.push(c.name); });
  return out;
}

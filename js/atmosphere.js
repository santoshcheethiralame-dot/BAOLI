import * as THREE from 'three';
import { WELL_WIDTH, WELL_DEPTH, WATER_Y } from './stepwell.js';

// the old procedural WELL object is gone with the scan swap; half-width now
// comes straight off the footprint the model is scaled to
const HALF = WELL_WIDTH / 2;

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255,240,214,1)');
  grad.addColorStop(0.35, 'rgba(255,232,196,0.45)');
  grad.addColorStop(1.0, 'rgba(255,225,180,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dust is what sells "there is air in here". Without it the shaft reads as a
// vacuum and every surface looks like plastic.
export function createDust(count = 5200) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const half = HALF * 0.94;
    pos[i * 3 + 0] = (Math.random() * 2 - 1) * half;
    pos[i * 3 + 1] = 2 - Math.random() * (WELL_DEPTH + 3);
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * half;
    seed[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: softSprite() },
      uOpacity: { value: 0.0 },
      uSize: { value: 46.0 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      uniform float uSize;
      varying float vFade;
      void main() {
        vec3 p = position;
        // slow convection: motes rise in the warm shaft and drift sideways
        p.y += mod(uTime * 0.22 + aSeed * 3.0, 34.0);
        if (p.y > 3.0) p.y -= 34.0;
        p.x += sin(uTime * 0.15 + aSeed * 6.2) * 1.15;
        p.z += cos(uTime * 0.12 + aSeed * 4.7) * 1.15;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize / max(-mv.z, 1.0) * (0.5 + fract(aSeed) * 0.9);
        // motes only catch the light where light actually reaches
        vFade = smoothstep(-26.0, -2.0, p.y);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(t.rgb, t.a * uOpacity * vFade);
        if (gl_FragColor.a < 0.01) discard;
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(time, intensity) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uOpacity.value = intensity;
    },
  };
}

// Light shafts. Real volumetrics are not worth the frame budget here — these are
// additive billboards that hang from the mouth and rotate to face the camera,
// which is what a raking sun through a square opening actually looks like.
export function createShafts() {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0.0 },
      uColor: { value: new THREE.Color('#ffd9a2') },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        // bright at the mouth, gone by the bottom; feathered at both edges
        float vertical = pow(1.0 - vUv.y, 2.1);
        float edge = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
        gl_FragColor = vec4(uColor, vertical * edge * uOpacity);
      }
    `,
  });

  const H = WELL_DEPTH * 0.82;
  for (let i = 0; i < 5; i++) {
    const w = 2.6 + i * 1.1;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat);
    plane.position.set(
      Math.sin(i * 1.7) * HALF * 0.34,
      -H / 2 + 1.5,
      Math.cos(i * 1.7) * HALF * 0.34
    );
    plane.rotation.z = (Math.random() - 0.5) * 0.16;
    group.add(plane);
  }
  group.frustumCulled = false;

  return {
    group,
    update(camera, intensity) {
      mat.uniforms.uOpacity.value = intensity;
      group.children.forEach((p) => { p.rotation.y = Math.atan2(
        camera.position.x - p.position.x,
        camera.position.z - p.position.z
      ); });
    },
  };
}

export const ATMO_BOTTOM = WATER_Y;

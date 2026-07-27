import * as THREE from 'three';
import { WATER_Y, WATER_HALF } from './stepwell.js';

// A translucent surface over a mirrored copy of the shrine.
//
// three's Reflector renders the whole scene a second time through an obliquely
// clipped virtual camera. That cost us the frame budget and, from high camera
// angles, returned solid black. A mirrored clone under a tinted surface cannot
// fail that way, costs no extra pass, and gives a real reflection of the one
// thing that actually needs reflecting.

const vert = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */`
  precision highp float;
  varying vec3 vWorld;

  uniform float uTime;
  uniform vec3  uEye;
  uniform vec3  uDeep;
  uniform vec3  uSky;
  uniform vec3  uRipples[6];

  void main() {
    vec2 p = vWorld.xz;

    // slow swell — a temple tank is nearly still
    float h = 0.0;
    h += sin(p.x * 0.30 + uTime * 0.38) * 0.020;
    h += sin((p.x * 0.21 + p.y * 0.33) + uTime * 0.29) * 0.016;
    h += sin((p.y * 0.62 - p.x * 0.17) + uTime * 0.55) * 0.008;

    vec2 grad = vec2(
      cos(p.x * 0.30 + uTime * 0.38) * 0.30 * 0.020,
      cos(p.y * 0.62 - p.x * 0.17 + uTime * 0.55) * 0.62 * 0.008
    );

    for (int i = 0; i < 6; i++) {
      float t = uTime - uRipples[i].z;
      if (uRipples[i].z > -900.0 && t > 0.0 && t < 8.0) {
        vec2 d = p - uRipples[i].xy;
        float dist = length(d) + 0.0001;
        float r = t * 4.6;
        float ring = sin((dist - r) * 3.0) * exp(-abs(dist - r) * 0.6);
        grad += normalize(d) * ring * 0.05 * exp(-t * 0.36);
      }
    }

    vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
    vec3 viewDir = normalize(uEye - vWorld);
    float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);

    vec3 col = mix(uDeep, uSky, fres * 0.42);

    // Inverted on purpose. The "reflection" is a mirrored copy of the shrine
    // sitting BELOW this plane, so the surface has to open up at grazing angles
    // to reveal it — exactly where a real fresnel would turn opaque.
    float alpha = mix(0.80, 0.26, fres);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createWater() {
  const side = (WATER_HALF + 1.2) * 2;
  const uniforms = {
    uTime: { value: 0 },
    uEye: { value: new THREE.Vector3() },
    uDeep: { value: new THREE.Color('#17251a') },
    uSky: { value: new THREE.Color('#6d7a63') },
    uRipples: { value: Array.from({ length: 6 }, () => new THREE.Vector3(0, 0, -999)) },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(side, side, 1, 1),
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_Y;
  mesh.renderOrder = 4;

  let next = 0;
  return {
    mesh,
    side,
    update(time, eye) {
      uniforms.uTime.value = time;
      if (eye) uniforms.uEye.value.copy(eye);
    },
    setSky(colour) {
      uniforms.uSky.value.copy(colour);
    },
    ripple(x, z, time) {
      uniforms.uRipples.value[next % 6].set(x, z, time);
      next++;
    },
  };
}

// A mirrored copy of an object, sunk below the surface. Materials are cloned and
// darkened so it reads as a reflection rather than a twin building.
export function mirrorBelow(obj) {
  const clone = obj.clone(true);
  clone.traverse((c) => {
    if (!c.isMesh) return;
    c.material = c.material.clone();
    c.material.color.multiplyScalar(0.55);
    if ('roughness' in c.material) c.material.roughness = Math.min(1, c.material.roughness + 0.2);
    c.castShadow = false;
    c.receiveShadow = false;
  });
  clone.scale.y *= -1;
  clone.position.y = 2 * WATER_Y - obj.position.y;
  clone.renderOrder = 1;
  return clone;
}

import * as THREE from 'three';

// A real sky, not a flat clear colour.
//
// scene.background = <single Color> is the single biggest thing making the
// opening frame look unfinished: a desert sky is never one value. It runs from
// bleached, dusty and warm at the horizon to a deeper, cooler wash overhead,
// with a broad glow around the sun. All three cost one gradient shader.

const vert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    // strip translation so the dome never moves relative to the camera
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */`
  precision highp float;
  varying vec3 vDir;

  uniform vec3 uHorizon;
  uniform vec3 uHigh;
  uniform vec3 uSunColour;
  uniform vec3 uSunDir;
  uniform float uHaze;

  void main() {
    vec3 d = normalize(vDir);

    // vertical gradient, biased so most of the drama sits near the horizon
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    float t = pow(clamp((h - 0.5) * 2.0, 0.0, 1.0), 0.75);
    vec3 col = mix(uHorizon, uHigh, t);

    // dust band sitting on the horizon — desert air is never clean
    float band = exp(-abs(d.y) * 14.0);
    col = mix(col, uHorizon * 1.06, band * uHaze);

    // broad sun glow, plus a tighter core
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColour * pow(sd, 6.0) * 0.35;
    col += uSunColour * pow(sd, 220.0) * 1.6;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky(sunDir) {
  const uniforms = {
    uHorizon: { value: new THREE.Color('#e8cfa4') },
    uHigh: { value: new THREE.Color('#8fa2b4') },
    uSunColour: { value: new THREE.Color('#ffd9a0') },
    uSunDir: { value: sunDir.clone().normalize() },
    uHaze: { value: 0.85 },
  };

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
  );
  mesh.scale.setScalar(480);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  return {
    mesh,
    uniforms,
    // keep it locked to the camera so it reads as infinitely far away
    follow(camera) {
      mesh.position.copy(camera.position);
    },
    setMood(horizon, high, haze) {
      uniforms.uHorizon.value.copy(horizon);
      uniforms.uHigh.value.copy(high);
      uniforms.uHaze.value = haze;
    },
  };
}

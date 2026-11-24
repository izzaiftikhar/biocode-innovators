"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Realistic neon DNA: shaded 3D tubes with fresnel rim light, depth falloff, uneven rotation,
 * light pulses travelling along the strands, base-pair rungs (A-T / G-C tints), ghost helixes,
 * bokeh particles that react to the cursor, scroll-driven speed, and bloom.
 * Rendered on black and blended with `mix-blend-mode: screen` so the hero background shows through.
 */

const R = 1.3;
const HEIGHT = 16;
const TURNS = 5.3;
const GROOVE = 2.4;
const PAIRS = 54;
const CAM_Z = 14;
const FOV = 30;

const TUBE_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying float vT; varying float vDist;
void main(){
  vT = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const TUBE_FRAG = /* glsl */ `
uniform float uTime; uniform float uDim; uniform float uPhase; uniform vec3 uCol; uniform vec3 uEdge;
varying vec3 vN; varying vec3 vV; varying float vT; varying float vDist;
void main(){
  float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 2.0);
  float core = pow(ndv, 7.0);
  float d = clamp((vDist - 12.4) / 3.4, 0.0, 1.0);
  float depthK = mix(1.2, 0.22, d);
  float p = fract(vT - uTime * 0.07 + uPhase);
  float pulse = exp(-pow((p - 0.5) * 24.0, 2.0));
  float shimmer = 0.9 + 0.1 * sin(vT * 90.0 - uTime * 2.0);
  vec3 col = uCol * (0.35 + 0.65 * ndv) + uEdge * rim * 1.15 + vec3(0.5, 0.95, 1.0) * core * 0.6;
  col += vec3(0.4, 0.95, 1.0) * pulse * (0.35 + core * 0.8 + rim * 0.6);
  gl_FragColor = vec4(col * depthK * shimmer * uDim, 1.0);
}`;

const PART_VERT = /* glsl */ `
attribute float aSize; attribute float aPhase; attribute float aSpeed;
uniform float uTime; uniform vec2 uSpread; uniform vec2 uMouse; uniform float uPx; uniform float uScroll;
varying float vBlur; varying float vTw; varying float vA;
void main(){
  vec3 p = position;
  float y01 = fract(p.y * 0.5 + 0.5 + uTime * aSpeed * 0.018 + uScroll * aSpeed * 0.06);
  p.y = y01 * 2.0 - 1.0;
  p.x += sin(uTime * 0.25 + aPhase * 6.28) * 0.025;
  p.xy *= uSpread;
  vec2 diff = p.xy - uMouse;
  float f = exp(-dot(diff, diff) * 0.45);
  p.xy += normalize(diff + vec2(1e-4)) * f * 1.1;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vBlur = clamp(abs(dist - 14.0) / 7.5, 0.0, 1.0);
  vTw = 0.55 + 0.45 * sin(uTime * (0.7 + aSpeed) + aPhase * 6.28);
  vA = mix(1.0, 0.5, vBlur) * smoothstep(0.0, 0.1, y01) * smoothstep(1.0, 0.9, y01);
  gl_PointSize = aSize * uPx * (1.0 + vBlur * 2.4) * (14.0 / dist);
  gl_Position = projectionMatrix * mv;
}`;

const PART_FRAG = /* glsl */ `
varying float vBlur; varying float vTw; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float edge = mix(0.3, 1.0, vBlur);
  float a = smoothstep(1.0, 1.0 - edge, d) * mix(1.0, 0.22, vBlur);
  gl_FragColor = vec4(vec3(0.3, 0.9, 1.0) * (0.3 + 0.55 * vTw), a * vA);
}`;

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  off: number;
  constructor(off: number) { super(); this.off = off; }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * TURNS * Math.PI * 2 + this.off;
    return target.set(R * Math.cos(a), (t - 0.5) * HEIGHT, R * Math.sin(a));
  }
}

type Props = { className?: string; onFail?: () => void; variant?: "hero" | "card" };

export default function DnaHelix3D({ className = "", onFail, variant = "hero" }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const card = variant === "card";
    const small = window.innerWidth < 700;
    const noGuard = new URLSearchParams(window.location.search).has("nofallback");

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: "high-performance" });
    } catch {
      onFail?.();
      return;
    }
    const pr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pr);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.28);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const disposables: { dispose: () => void }[] = [renderer, composer];
    const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };

    // ---------- strands
    const geoA = track(new THREE.TubeGeometry(new HelixCurve(0), 560, 0.06, 12, false));
    const geoB = track(new THREE.TubeGeometry(new HelixCurve(GROOVE), 560, 0.06, 12, false));
    const mkTube = (dim: number, phase: number, cool = 0) =>
      track(new THREE.ShaderMaterial({
        vertexShader: TUBE_VERT,
        fragmentShader: TUBE_FRAG,
        uniforms: {
          uTime: { value: 0 }, uDim: { value: dim }, uPhase: { value: phase },
          uCol: { value: new THREE.Color(0.01, 0.17 - cool * 0.03, 0.23) },
          uEdge: { value: new THREE.Color(0.09, 0.78 - cool * 0.12, 0.95) },
        },
      }));
    const matA = mkTube(1, 0);
    const matB = mkTube(1, 0.5);

    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);
    spin.add(new THREE.Mesh(geoA, matA), new THREE.Mesh(geoB, matB));

    // ---------- base pairs
    const palette = {
      A: new THREE.Color("#43dde5"), T: new THREE.Color("#78b6ff"),
      G: new THREE.Color("#5ef2c0"), C: new THREE.Color("#c4f6ff"),
    };
    const rungGeo = track(new THREE.CylinderGeometry(0.024, 0.024, 1, 6, 1, true));
    const beadGeo = track(new THREE.SphereGeometry(0.085, 14, 12));
    const rungMat = track(new THREE.MeshBasicMaterial({ toneMapped: false }));
    const beadMat = track(new THREE.MeshBasicMaterial({ toneMapped: false }));
    const rungs = new THREE.InstancedMesh(rungGeo, rungMat, PAIRS * 2);
    const beads = new THREE.InstancedMesh(beadGeo, beadMat, PAIRS * 2);
    spin.add(rungs, beads);

    const baseCols: THREE.Color[] = [];
    const pairT: number[] = [];
    const mid: THREE.Vector3[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const place = (mesh: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3, gap = 0) => {
      const dir = b.clone().sub(a);
      const len = dir.length();
      m4.compose(a.clone().add(b).multiplyScalar(0.5), q.setFromUnitVectors(up, dir.normalize()), new THREE.Vector3(1, Math.max(0.001, len - gap), 1));
      mesh.setMatrixAt(i, m4);
    };
    for (let i = 0; i < PAIRS; i++) {
      const t = (i + 0.5) / PAIRS;
      const y = (t - 0.5) * HEIGHT;
      const a1 = t * TURNS * Math.PI * 2;
      const a2 = a1 + GROOVE;
      const p1 = new THREE.Vector3(R * Math.cos(a1), y, R * Math.sin(a1));
      const p2 = new THREE.Vector3(R * Math.cos(a2), y, R * Math.sin(a2));
      const m = p1.clone().add(p2).multiplyScalar(0.5);
      const at = (Math.sin(i * 12.9898) * 43758.5453) % 1 > 0;
      const c1 = at ? palette.A : palette.G;
      const c2 = at ? palette.T : palette.C;
      pairT.push(t); mid.push(m);
      place(rungs, i * 2, p1, m);
      place(rungs, i * 2 + 1, m, p2);
      beads.setMatrixAt(i * 2, new THREE.Matrix4().makeTranslation(p1.x, p1.y, p1.z));
      beads.setMatrixAt(i * 2 + 1, new THREE.Matrix4().makeTranslation(p2.x, p2.y, p2.z));
      baseCols.push(c1, c2);
    }
    rungs.instanceMatrix.needsUpdate = true;
    beads.instanceMatrix.needsUpdate = true;
    rungs.frustumCulled = false;
    beads.frustumCulled = false;
    const tmpC = new THREE.Color();
    const tmpV = new THREE.Vector3();
    const flash = new Float32Array(PAIRS);

    // ---------- ghost helixes (large, dim, out of focus)
    const ghostDefs = [
      { s: 2.5, x: -5.6, y: -0.5, z: -8, dim: 0.1, rotSpeed: -0.12, tz: 0.18, ph: 0.2 },
      { s: 1.8, x: 5.8, y: 1.2, z: -6, dim: 0.08, rotSpeed: 0.16, tz: -0.25, ph: 0.7 },
    ];
    const ghosts = ghostDefs.slice(0, card ? 0 : 2).map((g) => {
      const grp = new THREE.Group();
      const sp = new THREE.Group();
      const mat = mkTube(g.dim, g.ph, 1);
      sp.add(new THREE.Mesh(geoA, mat), new THREE.Mesh(geoB, mat));
      grp.add(sp);
      grp.scale.setScalar(g.s);
      grp.position.set(g.x, g.y, g.z);
      grp.rotation.z = g.tz;
      scene.add(grp);
      return { ...g, grp, sp, mat };
    });

    // ---------- particles
    const COUNT = card ? 130 : small ? 200 : 420;
    const pos = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = Math.random() * 2 - 1;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      pos[i * 3 + 2] = -9 + Math.random() * 13;
      const big = Math.random() < 0.1;
      size[i] = big ? 9 + Math.random() * 9 : 1.6 + Math.random() * 2.6;
      phase[i] = Math.random();
      speed[i] = 0.4 + Math.random() * 1.4;
    }
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    pGeo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    pGeo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    const pMat = track(new THREE.ShaderMaterial({
      vertexShader: PART_VERT, fragmentShader: PART_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSpread: { value: new THREE.Vector2(6, 4) }, uMouse: { value: new THREE.Vector2(99, 99) },
        uPx: { value: pr }, uScroll: { value: 0 },
      },
    }));
    const points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    scene.add(points);

    // ---------- sizing
    let W = 1, H = 1, halfH0 = Math.tan((FOV * Math.PI) / 360) * CAM_Z, halfW0 = halfH0;
    const resize = () => {
      const r = el.getBoundingClientRect();
      W = Math.max(2, r.width); H = Math.max(2, r.height);
      renderer.setSize(W, H, false);
      composer.setSize(W, H);
      bloom.resolution.set(W / 2, H / 2);
      camera.aspect = W / H;
      camera.zoom = card
        ? camera.aspect < 1.3 ? 1.15 : 1.5
        : camera.aspect < 1.1 ? 0.55 + 0.45 * (camera.aspect / 1.1) : 1;
      camera.updateProjectionMatrix();
      const hh = halfH0 / camera.zoom;
      halfW0 = hh * camera.aspect;
      pMat.uniforms.uSpread.value.set(halfW0 * 1.5, hh * 1.35);
      pMat.uniforms.uPx.value = pr * Math.min(1.3, Math.max(0.7, H / 600));
      if (reduce) frame(2.0, 0);
    };

    // ---------- input
    let mx = 0, tiltMouse = 0;
    const mTarget = new THREE.Vector2(99, 99);
    const mNow = new THREE.Vector2(99, 99);
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      const r = el.getBoundingClientRect();
      mTarget.set(((e.clientX - r.left) / r.width * 2 - 1) * halfW0, -((e.clientY - r.top) / r.height * 2 - 1) * (halfW0 / Math.max(0.1, camera.aspect)));
    };
    const onLeave = () => mTarget.set(99, 99);
    let scrollY = window.scrollY, boost = 0;
    const onScroll = () => {
      const y = window.scrollY;
      boost = Math.min(1.6, boost + Math.abs(y - scrollY) * 0.006);
      scrollY = y;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });

    // ---------- loop
    let rot = 0.5;
    let nextFlash = 1.5, last = 0, t = 0;
    let frames = 0, acc = 0, failed = false;

    function frame(time: number, dt: number) {
      t = time;
      const omega = 0.42 + 0.16 * Math.sin(t * 0.37) + 0.08 * Math.sin(t * 0.93 + 1.3) + boost * 1.1;
      rot += dt * omega;
      boost *= Math.exp(-dt * 2.2);
      tiltMouse += (mx * 0.07 - tiltMouse) * Math.min(1, dt * 2.5);
      mNow.lerp(mTarget, Math.min(1, dt * 6));

      spin.rotation.y = rot;
      tilt.rotation.z = -0.15 + Math.sin(t * 0.33) * 0.03 + tiltMouse;
      tilt.rotation.x = Math.sin(t * 0.27 + 0.6) * 0.045;
      tilt.position.y = card ? 0 : Math.min(scrollY, 900) * 0.0035;
      tilt.position.x = Math.sin(t * 0.21) * 0.08;

      for (const g of ghosts) g.sp.rotation.y = g.ph * 6 + t * g.rotSpeed;
      matA.uniforms.uTime.value = t; matB.uniforms.uTime.value = t;
      for (const g of ghosts) g.mat.uniforms.uTime.value = t;
      pMat.uniforms.uTime.value = t;
      pMat.uniforms.uScroll.value = scrollY * 0.001;
      pMat.uniforms.uMouse.value.copy(mNow);

      // random rung flashes
      if (t > nextFlash) { flash[(Math.random() * PAIRS) | 0] = 1; nextFlash = t + 1.2 + Math.random() * 2.6; }
      spin.updateMatrixWorld(true);
      for (let i = 0; i < PAIRS; i++) {
        flash[i] *= Math.exp(-dt * 1.5);
        const p = (pairT[i] - t * 0.07 + 1000.5) % 1;
        const pulse = Math.exp(-Math.pow((p - 0.5) * 24, 2));
        tmpV.copy(mid[i]).applyMatrix4(spin.matrixWorld);
        const dist = camera.position.z - tmpV.z;
        const k = 1.25 - 1.0 * Math.min(1, Math.max(0, (dist - 12.4) / 3.4));
        const gain = k * (0.5 + pulse * 1.3 + flash[i] * 1.8);
        for (let h = 0; h < 2; h++) {
          tmpC.copy(baseCols[i * 2 + h]).multiplyScalar(gain);
          rungs.setColorAt(i * 2 + h, tmpC);
          beads.setColorAt(i * 2 + h, tmpC.multiplyScalar(1.25));
        }
      }
      rungs.instanceColor!.needsUpdate = true;
      beads.instanceColor!.needsUpdate = true;

      bloom.strength = 0.72 + 0.14 * Math.sin(t * 0.9);
      composer.render();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0, running = false, visible = true;
    const loop = (now: number) => {
      const tt = now / 1000;
      const dt = last ? Math.min(tt - last, 0.05) : 0.016;
      last = tt;
      frame(tt, dt);
      if (!noGuard && ++frames > 40 && frames <= 160) {
        acc += dt;
        if (frames === 160 && acc / 120 > 0.06 && !failed) { failed = true; stop(); onFail?.(); return; }
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(loop); };
    function stop() { running = false; cancelAnimationFrame(raf); }
    if (reduce) frame(2.0, 0);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible && !document.hidden ? start() : stop();
    }, { threshold: 0.02 });
    io.observe(el);
    const onVis = () => (document.hidden || !visible ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      disposables.forEach((d) => { try { d.dispose(); } catch {} });
      rungs.dispose(); beads.dispose();
      renderer.domElement.remove();
    };
  }, [onFail, variant]);

  return <div ref={host} className={`hx-3d ${className}`} role="img" aria-label="Rotating glowing DNA double helix" />;
}

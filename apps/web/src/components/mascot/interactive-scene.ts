import * as THREE from "three";
import { blinkAt } from "@/components/intro/timeline";
import { addMascotLights, createMascotRig, createRenderer, REST_POSE } from "./rig";

export type InteractiveScene = {
  canvas: HTMLCanvasElement;
  /** Pointer position relative to the stage centre, -1..1 on each axis. */
  look: (x: number, y: number) => void;
  /** Horizontal drag in CSS px since the last call. */
  drag: (dx: number) => void;
  release: () => void;
  /** Tap reaction; cycles through jump + wave, spin and a little dance. */
  poke: () => void;
  resize: (width: number, height: number) => void;
  /** Starts or stops the render loop (off-screen, hidden tab). */
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

const REACTIONS = ["jump", "spin", "dance"] as const;

export function createInteractiveScene(options: { reducedMotion: boolean }): InteractiveScene | null {
  const renderer = createRenderer(2);
  if (!renderer) return null;
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  addMascotLights(scene);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const rig = createMascotRig();
  scene.add(rig.object);

  // Soft contact shadow under the feet.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,.45)");
  gradient.addColorStop(0.5, "rgba(0,0,0,.18)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.2),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  let lookX = 0,
    lookY = 0,
    targetLookX = 0,
    targetLookY = 0;
  let turn = 0.35,
    spin = 0,
    dragging = false,
    lastInput = 0;
  let reaction: (typeof REACTIONS)[number] | null = null,
    reactionStart = 0,
    nextReaction = 0;
  let running = false,
    last = 0,
    clock = 0;

  function frame(now: number) {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    clock += dt;
    const t = clock;

    // Turning: inertia while free, then a slow return to a friendly three-quarter view.
    if (!dragging) {
      turn += spin * dt;
      spin *= Math.exp(-3.2 * dt);
      if (t - lastInput > 2.2 && Math.abs(spin) < 0.3) {
        const rest = Math.round((turn - 0.35) / (Math.PI * 2)) * Math.PI * 2 + 0.35;
        turn += (rest - turn) * (1 - Math.exp(-2.2 * dt));
      }
    }
    lookX += (targetLookX - lookX) * (1 - Math.exp(-8 * dt));
    lookY += (targetLookY - lookY) * (1 - Math.exp(-8 * dt));

    const idle = options.reducedMotion ? 0 : 1;
    let jump = 0,
      stretch = 1 + 0.015 * Math.sin(t * 3.4) * idle,
      wave = 0,
      kick = 0,
      extraTurn = 0,
      swing = 0.03 * Math.sin(t * 1.3) * idle;
    if (reaction) {
      const r = t - reactionStart;
      if (reaction === "jump") {
        const air = Math.min(1, r / 0.55);
        jump = r < 0.55 ? Math.sin(air * Math.PI) * 0.9 : 0;
        stretch =
          r < 0.1
            ? 1 - r * 1.6
            : r < 0.55
              ? 1.08
              : 1 - 0.14 * Math.sin(Math.min(1, (r - 0.55) / 0.25) * Math.PI);
        wave = r > 0.45 ? Math.min(1, (r - 0.45) * 4) * (r > 1.6 ? Math.max(0, 1 - (r - 1.6) * 4) : 1) : 0;
        if (r > 1.9) reaction = null;
      } else if (reaction === "spin") {
        const p = Math.min(1, r / 0.9);
        extraTurn = (1 - (1 - p) ** 3) * Math.PI * 2;
        jump = Math.sin(p * Math.PI) * 0.35;
        if (r > 0.9) {
          turn += Math.PI * 2;
          extraTurn = 0;
          reaction = null;
        }
      } else {
        kick = Math.sin(r * 12) * 0.9;
        swing = 0.14 * Math.sin(r * 6);
        jump = Math.abs(Math.sin(r * 6)) * 0.18;
        if (r > 1.6) reaction = null;
      }
    }

    rig.pose({
      ...REST_POSE,
      wave,
      kick,
      swing,
      stretch,
      lookX: lookX * 0.6 - (turn + extraTurn - 0.35) * 0.15,
      lookY: lookY * 0.35,
      blink: blinkAt(t),
      time: t,
    });
    rig.object.rotation.y = turn + extraTurn;
    rig.object.position.y = jump;
    shadow.scale.setScalar(1 - jump * 0.35);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - jump * 0.5;
    renderer!.render(scene, camera);
  }

  function setRunning(next: boolean) {
    if (next === running) return;
    running = next;
    last = 0;
    renderer!.setAnimationLoop(next ? frame : null);
  }

  function resize(width: number, height: number) {
    renderer!.setSize(width, height, false);
    camera.aspect = width / height;
    // Fit the whole mascot (4 units tall, ~3 wide) with a little headroom for jumps.
    const fitH = 5.4 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const fitW = 3.8 / camera.aspect / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const distance = Math.max(fitH, fitW);
    camera.position.set(0, 2.3, distance);
    camera.lookAt(0, 2.1, 0);
    camera.updateProjectionMatrix();
    if (!running) frame(performance.now());
  }

  return {
    canvas,
    look(x, y) {
      targetLookX = x;
      targetLookY = y;
    },
    drag(dx) {
      dragging = true;
      lastInput = clock;
      const delta = dx * 0.012;
      turn += delta;
      spin = delta / 0.016;
    },
    release() {
      dragging = false;
      lastInput = clock;
    },
    poke() {
      if (reaction) return;
      reaction = REACTIONS[nextReaction % REACTIONS.length]!;
      nextReaction++;
      reactionStart = clock;
      lastInput = clock;
    },
    resize,
    setRunning,
    dispose() {
      setRunning(false);
      rig.dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      shadowTexture.dispose();
      renderer!.dispose();
      renderer!.forceContextLoss();
    },
  };
}

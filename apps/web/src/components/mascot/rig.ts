import * as THREE from "three";
import { createDimsumMascot, type MascotModel } from "./model";

/**
 * Animation rig over the rigid-part mascot: shoulder, hip and neck pivots plus a pose function.
 * The authored model has no skeleton; each limb group is re-parented under a pivot placed at its
 * joint, so rotating the pivot swings the limb around the shoulder or hip instead of its centre.
 */
export type MascotPose = {
  /** 0 = arms down at the sides, 1 = both hands forward on a bar in front of the belly. */
  grip: number;
  /** Raise the right arm and wave (0..1 amplitude), driven by `time`. */
  wave: number;
  /** Body sway around the hands (radians, z axis). */
  swing: number;
  /** Leg kick, -1..1 (alternating legs). */
  kick: number;
  /** Squash and stretch: 1 = rest, <1 squashed, >1 stretched. */
  stretch: number;
  /** Head turn towards a point: yaw and pitch in radians. */
  lookX: number;
  lookY: number;
  /** Eyes closed amount 0..1. */
  blink: number;
  /** Seconds, for procedural secondary motion. */
  time: number;
};

export const REST_POSE: MascotPose = {
  grip: 0,
  wave: 0,
  swing: 0,
  kick: 0,
  stretch: 1,
  lookX: 0,
  lookY: 0,
  blink: 0,
  time: 0,
};

export type MascotRig = {
  /** Add this to the scene. Its origin is between the feet; the mascot is ~4 units tall. */
  object: THREE.Group;
  /** World-space height and the local y of the hands when gripping. */
  height: number;
  gripY: number;
  /** Midpoint of the hands in the grip pose (rig units, origin between the feet). */
  gripPoint: THREE.Vector3;
  pose: (p: MascotPose) => void;
  dispose: () => void;
};

function pivotAt(target: THREE.Object3D, at: THREE.Vector3): THREE.Group {
  const parent = target.parent!;
  const pivot = new THREE.Group();
  pivot.name = `${target.name}:pivot`;
  pivot.position.copy(at);
  parent.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(target);
  return pivot;
}

export function createMascotRig(): MascotRig {
  const model: MascotModel = createDimsumMascot();
  const g = (id: string) => model.parts.find((p) => p.id === id)!.group;

  // Body: everything rotates around the feet for sway, and squashes from the ground up.
  const body = new THREE.Group();
  body.name = "mascot-body";
  body.add(model.root);
  const object = new THREE.Group();
  object.add(body);
  model.root.updateMatrixWorld(true);

  // Shoes follow their legs.
  for (const side of ["left", "right"]) g(`leg-${side}`).attach(g(`shoe-${side}`));

  const head = pivotAt(g("head"), new THREE.Vector3(0, 2.05, 0));
  const shoulders = {
    left: pivotAt(g("sleeve-left"), new THREE.Vector3(0.58, 1.78, 0)),
    right: pivotAt(g("sleeve-right"), new THREE.Vector3(-0.58, 1.78, 0)),
  };
  const hips = {
    left: pivotAt(g("leg-left"), new THREE.Vector3(0.36, 0.72, 0)),
    right: pivotAt(g("leg-right"), new THREE.Vector3(-0.36, 0.72, 0)),
  };
  const eyes = [g("eye-left"), g("eye-right"), g("catchlights")];
  const eyeScale = eyes.map((e) => e.scale.y);

  const gripY = 1.32;

  function pose(p: MascotPose) {
    const t = p.time;
    // Squash and stretch keeps the volume roughly constant.
    body.scale.set(1 / Math.sqrt(p.stretch), p.stretch, 1 / Math.sqrt(p.stretch));
    body.rotation.z = p.swing;
    body.rotation.x = p.swing * 0.15;

    // Arms: from the sides (rest) to both hands forward and together (grip).
    for (const [side, sign] of [
      ["left", 1],
      ["right", -1],
    ] as const) {
      const s = shoulders[side];
      const waving = side === "right" ? p.wave : 0;
      const grip = p.grip * (1 - waving);
      s.rotation.set(
        -0.95 * grip - 2.3 * waving,
        -sign * 1.05 * grip,
        sign * (0.08 * Math.sin(t * 2.1 + sign) * (1 - grip) + 0.25 * grip) +
          (waving ? -sign * (0.6 + 0.35 * Math.sin(t * 14)) * waving : 0),
      );
    }

    // Legs dangle and kick.
    hips.left.rotation.x = 0.55 * p.kick;
    hips.right.rotation.x = -0.55 * p.kick;
    hips.left.rotation.z = 0.08 * Math.abs(p.kick);
    hips.right.rotation.z = -0.08 * Math.abs(p.kick);

    // Head: look target plus a little breathing bob.
    head.rotation.y = THREE.MathUtils.clamp(p.lookX, -0.7, 0.7);
    head.rotation.x = THREE.MathUtils.clamp(-p.lookY, -0.35, 0.35);
    head.rotation.z = -p.swing * 0.6 + 0.03 * Math.sin(t * 1.7);
    head.position.y = 2.05 + 0.025 * Math.sin(t * 3.4);

    eyes.forEach((e, i) => (e.scale.y = eyeScale[i]! * (1 - 0.92 * p.blink)));
  }

  // Where the two hands meet when gripping: the intro puts its bar exactly there.
  pose({ ...REST_POSE, grip: 1 });
  object.updateMatrixWorld(true);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3();
  g("hand-left").getWorldPosition(a);
  g("hand-right").getWorldPosition(b);
  const gripPoint = a.add(b).multiplyScalar(0.5);
  pose(REST_POSE);
  return { object, height: 4.05, gripY, gripPoint, pose, dispose: model.dispose };
}

export { blinkAt } from "@/components/intro/timeline";

/** Studio lighting shared by the intro and the interactive mascot. */
export function addMascotLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff7ef, 0x8a7f8f, 1.8));
  for (const [pos, power, color] of [
    [[-3, 6, 6], 2.4, 0xfff3ec],
    [[4, 3, 4], 1.2, 0xf3edff],
    [[0, 5, -4], 1.6, 0xfff2de],
  ] as const) {
    const light = new THREE.DirectionalLight(color, power);
    light.position.set(pos[0], pos[1], pos[2]);
    scene.add(light);
  }
}

/** Creates a transparent renderer, or null when WebGL is unavailable. */
export function createRenderer(maxPixelRatio = 2): THREE.WebGLRenderer | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    return renderer;
  } catch {
    return null;
  }
}

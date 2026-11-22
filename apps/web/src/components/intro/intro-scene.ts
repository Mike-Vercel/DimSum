import * as THREE from "three";
import { addMascotLights, createMascotRig, createRenderer } from "@/components/mascot/rig";
import type { IntroState } from "./timeline";

export type IntroScene = {
  /** Draws a frame and returns where the hands are on screen (CSS px): the hem is held there. */
  render: (f: IntroState) => { x: number; y: number; span: number };
  resize: (width: number, height: number, mascotPx: number) => void;
  /** Compiles the shaders (in parallel where supported) and uploads the meshes. */
  prepare: () => Promise<void>;
  dispose: () => void;
};

/**
 * Full-screen transparent WebGL layer in CSS-pixel units with the mascot seen from behind (slightly
 * from above). The page (a blanket, drawn in SVG by the overlay) is held where its hands are.
 */
export function createIntroScene(canvas: HTMLCanvasElement): IntroScene | null {
  const renderer = createRenderer(window.innerWidth < 700 ? 1.75 : 2);
  if (!renderer) return null;
  // Take the place of the overlay's canvas, so it keeps the same stacking order.
  const gl = renderer.domElement;
  gl.className = canvas.className;
  gl.setAttribute("aria-hidden", "true");
  canvas.replaceWith(gl);

  const scene = new THREE.Scene();
  addMascotLights(scene);
  // Seen from behind: a warm rim from the far side outlines the silhouette against the dark curtain.
  const rim = new THREE.DirectionalLight(0xffd9c2, 1.6);
  rim.position.set(0, 4, -6);
  scene.add(rim);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
  camera.position.set(0, 0, 3000);

  const rig = createMascotRig();
  // A slight top-down view (the top of the head shows) gives depth to the walk.
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.22;
  tilt.add(rig.object);
  scene.add(tilt);

  const hands = new THREE.Vector3();
  let width = 1,
    height = 1,
    scale = 1;

  function resize(w: number, h: number, mascotPx: number) {
    width = w;
    height = h;
    scale = mascotPx / rig.height;
    renderer!.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    rig.object.scale.setScalar(scale);
  }

  function render(f: IntroState) {
    rig.pose(f.pose);
    rig.object.rotation.y = f.turn;
    tilt.position.set(0, height / 2 - f.feet, 0);
    scene.updateMatrixWorld(true);
    rig.handsWorld(hands);
    renderer!.render(scene, camera);
    // Hands are ~1 unit either side of the centre: the stretch of hem held between them.
    return { x: width / 2 + hands.x, y: height / 2 - hands.y, span: 1.05 * scale };
  }

  async function prepare() {
    try {
      await renderer!.compileAsync(scene, camera);
    } catch {
      /* compiled on the first frame instead */
    }
    renderer!.render(scene, camera);
  }

  return {
    render,
    resize,
    prepare,
    dispose() {
      rig.dispose();
      renderer!.dispose();
      renderer!.forceContextLoss();
    },
  };
}

import * as THREE from "three";
import { addMascotLights, createMascotRig, createRenderer } from "@/components/mascot/rig";
import type { IntroState } from "./timeline";

export type IntroScene = {
  /** Draws a frame and returns the screen y (CSS px) of the page hem, i.e. of the hands. */
  render: (f: IntroState) => number;
  resize: (width: number, height: number, mascotPx: number) => void;
  dispose: () => void;
};

/**
 * Full-screen transparent WebGL layer in CSS-pixel units: the mascot seen from behind (slightly
 * from above) and the red hem bar of the page, kept exactly in its hands.
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

  const barMaterial = new THREE.MeshStandardMaterial({ color: 0xd82a1e, roughness: 0.36, metalness: 0.05 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), barMaterial);
  rod.rotation.z = Math.PI / 2;
  scene.add(rod);

  const hands = new THREE.Vector3();
  let height = 1;

  function resize(w: number, h: number, mascotPx: number) {
    height = h;
    renderer!.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    rig.object.scale.setScalar(mascotPx / rig.height);
    const radius = Math.max(6, Math.min(12, mascotPx * 0.032));
    rod.scale.set(radius, w + 240, radius);
  }

  function render(f: IntroState): number {
    rig.pose(f.pose);
    rig.object.rotation.y = f.turn;
    tilt.position.set(0, height / 2 - f.feet, 0);
    scene.updateMatrixWorld(true);
    rig.handsWorld(hands);
    // The hem sits in the hands, in front of the back (towards the camera).
    rod.position.set(0, hands.y, hands.z + 6);
    renderer!.render(scene, camera);
    return height / 2 - hands.y;
  }

  return {
    render,
    resize,
    dispose() {
      rig.dispose();
      rod.geometry.dispose();
      barMaterial.dispose();
      renderer!.dispose();
      renderer!.forceContextLoss();
    },
  };
}

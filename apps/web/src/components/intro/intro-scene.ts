import * as THREE from "three";
import { addMascotLights, createMascotRig, createRenderer, type MascotPose } from "@/components/mascot/rig";

export type IntroFrame = {
  /** Screen y (CSS px) of the page hem bar, which is also the top of the still-covered area. */
  edge: number;
  /** Screen y (CSS px) of the mascot's feet. */
  feet: number;
  /** Bar depth: 0 = behind the mascot, 1 = in front, in its hands. */
  barFront: number;
  /** Mascot turn around the vertical axis (radians). */
  turn: number;
  pose: MascotPose;
};

export type IntroScene = {
  /** Distance (CSS px) from the feet to the hands in the grip pose. */
  gripOffset: number;
  render: (f: IntroFrame) => void;
  resize: (width: number, height: number, mascotPx: number) => void;
  dispose: () => void;
};

/** Full-screen transparent WebGL layer with the mascot and the hem bar, in CSS pixel units. */
export function createIntroScene(canvas: HTMLCanvasElement): IntroScene | null {
  const renderer = createRenderer(window.innerWidth < 700 ? 1.75 : 2);
  if (!renderer) return null;
  // Use the canvas the overlay already rendered, so it sits in the right stacking order.
  const gl = renderer.domElement;
  gl.className = canvas.className;
  gl.setAttribute("aria-hidden", "true");
  canvas.replaceWith(gl);

  const scene = new THREE.Scene();
  addMascotLights(scene);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  camera.position.set(0, 0, 2000);

  const rig = createMascotRig();
  scene.add(rig.object);

  const barMaterial = new THREE.MeshStandardMaterial({ color: 0xd82a1e, roughness: 0.38, metalness: 0.05 });
  const bar = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28), barMaterial);
  rod.rotation.z = Math.PI / 2;
  bar.add(rod);
  scene.add(bar);

  let height = 1,
    scale = 1;

  function resize(w: number, h: number, mascotPx: number) {
    height = h;
    scale = mascotPx / rig.height;
    renderer!.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    rig.object.scale.setScalar(scale);
    const radius = Math.max(6, Math.min(11, mascotPx * 0.03));
    rod.scale.set(radius, w + 240, radius);
    api.gripOffset = rig.gripPoint.y * scale;
  }

  function render(f: IntroFrame) {
    rig.pose(f.pose);
    rig.object.position.set(0, height / 2 - f.feet, 0);
    rig.object.rotation.y = f.turn;
    const front = rig.gripPoint.z * scale + 4;
    const back = -1.6 * scale;
    bar.position.set(0, height / 2 - f.edge, back + (front - back) * f.barFront);
    renderer!.render(scene, camera);
  }

  const api: IntroScene = {
    gripOffset: rig.gripPoint.y,
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
  return api;
}

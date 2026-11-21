"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Download, Expand, Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createDimsumMascot } from "./model";
import styles from "./viewer.module.css";

type CameraSpec = {
  azimuth?: number;
  elevation?: number;
  target?: number[];
  distance?: number;
  head?: boolean;
};
type ViewerActions = {
  view: (azimuth: number) => void;
  reset: () => void;
  zoom: (factor: number) => void;
  explode: (value: boolean) => void;
  spin: (value: boolean) => void;
  pause: (value: boolean) => void;
};
declare global {
  interface Window {
    __IMG2THREEJS_READY__?: boolean;
    __IMG2THREEJS_CAPTURE__?: {
      setCamera: (spec: CameraSpec) => void;
      capturePass: () => { ok: boolean };
      exportGeometry: () => unknown;
      captureParts: () => Record<string, string>;
      exportGlb: () => Promise<number[]>;
      manifest: () => unknown;
    };
  }
}
export function MascotViewer() {
  const mount = useRef<HTMLDivElement>(null),
    actions = useRef<ViewerActions | null>(null);
  const [error, setError] = useState(false),
    [ready, setReady] = useState(false),
    [original, setOriginal] = useState(false),
    [exploded, setExploded] = useState(false),
    [spinning, setSpinning] = useState(false),
    [selected, setSelected] = useState("");
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: process.env.NODE_ENV === "development",
      });
    } catch {
      const notify = requestAnimationFrame(() => setError(true));
      return () => cancelAnimationFrame(notify);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Mascotte DIMSUM in 3D. Trascina per ruotare; usa i pulsanti per cambiare vista e zoom.",
    );
    canvas.tabIndex = 0;
    host.appendChild(canvas);
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 100),
      model = createDimsumMascot();
    scene.add(model.root);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 2, 0);
    controls.enablePan = false;
    controls.minZoom = 0.65;
    controls.maxZoom = 2.4;
    controls.enableDamping = false;
    controls.autoRotateSpeed = 1;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI - 0.18;
    scene.add(new THREE.HemisphereLight(0xfff7ef, 0xa297a6, 1.7));
    for (const [pos, power, color] of [
      [[-3, 6, 6], 2.3, 0xfff3ec],
      [[4, 3, 4], 1.2, 0xf3edff],
      [[0, 5, -4], 1.8, 0xfff2de],
    ] as const) {
      const light = new THREE.DirectionalLight(color, power);
      light.position.set(pos[0], pos[1], pos[2]);
      if (pos[0] === -3) {
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
        Object.assign(light.shadow.camera, { left: -3, right: 3, top: 5, bottom: -2 });
        light.shadow.normalBias = 0.025;
      }
      scene.add(light);
    }
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, "rgba(54,35,28,.28)");
    gradient.addColorStop(0.45, "rgba(54,35,28,.13)");
    gradient.addColorStop(1, "rgba(54,35,28,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    shadowTexture.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.1),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.014;
    scene.add(floor);
    let separated = false;
    let active = true,
      inViewport = true,
      paused = false,
      spinRequested = false,
      lastTime = 0;
    const render = () => {
      if (active) renderer.render(scene, camera);
    };
    const updateLoop = () => {
      const run = spinRequested && inViewport && !paused && !document.hidden;
      renderer.setAnimationLoop(
        run
          ? (time) => {
              const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
              lastTime = time;
              controls.update(delta);
              render();
            }
          : null,
      );
      if (!run) lastTime = 0;
    };
    const fit = (review = false) => {
      const aspect = host.clientWidth / Math.max(1, host.clientHeight),
        height = review ? 4.12 : Math.max(4.6, 3.5 / aspect);
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.left = (-height * aspect) / 2;
      camera.right = (height * aspect) / 2;
      camera.updateProjectionMatrix();
    };
    const setCamera = (spec: CameraSpec, review = false) => {
      floor.visible = !review;
      const az = ((spec.azimuth ?? 18) * Math.PI) / 180,
        el = ((spec.elevation ?? (review ? 0 : 5)) * Math.PI) / 180,
        d = spec.distance ?? 10;
      const target = new THREE.Vector3(
        ...((spec.target ?? (spec.head ? [0, 2.96, 0] : [0, 2, 0])) as [number, number, number]),
      );
      controls.target.copy(target);
      camera.position
        .copy(target)
        .add(
          new THREE.Vector3(
            Math.sin(az) * Math.cos(el) * d,
            Math.sin(el) * d,
            Math.cos(az) * Math.cos(el) * d,
          ),
        );
      camera.zoom = spec.head ? 1.7 : separated ? 0.76 : 1;
      fit(review);
      controls.update();
      render();
    };
    const explode = (value: boolean) => {
      separated = value;
      camera.zoom = value ? 0.76 : 1;
      camera.updateProjectionMatrix();
      const center = new THREE.Vector3(0, 2, 0);
      for (const p of model.parts) {
        p.group.position.copy(p.home);
        if (p.group.parent === model.root && value)
          p.group.position.sub(center).multiplyScalar(1.36).add(center);
      }
      model.root.updateMatrixWorld(true);
      render();
    };
    actions.current = {
      view(azimuth) {
        setCamera({ azimuth, elevation: 0 });
      },
      reset() {
        explode(false);
        setCamera({});
        spinRequested = false;
        controls.autoRotate = false;
        updateLoop();
      },
      zoom(factor) {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.65, 2.4);
        camera.updateProjectionMatrix();
        render();
      },
      explode,
      spin(value) {
        spinRequested = value;
        controls.autoRotate = value;
        updateLoop();
      },
      pause(value) {
        paused = value;
        updateLoop();
      },
    };
    controls.addEventListener("change", render);
    const stopSpin = () => {
      spinRequested = false;
      controls.autoRotate = false;
      setSpinning(false);
      updateLoop();
    };
    controls.addEventListener("start", stopSpin);
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setSize(host.clientWidth, host.clientHeight);
      fit();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const intersection = new IntersectionObserver(([entry]) => {
      inViewport = entry?.isIntersecting ?? false;
      updateLoop();
    });
    intersection.observe(host);
    document.addEventListener("visibilitychange", updateLoop);
    const pointer = new THREE.Vector2(),
      ray = new THREE.Raycaster();
    let down = [0, 0];
    const onDown = (event: PointerEvent) => {
      down = [event.clientX, event.clientY];
    };
    const onUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down[0]!, event.clientY - down[1]!) > 5) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObject(model.root, true)[0];
      let node: THREE.Object3D | null = hit?.object ?? null;
      while (node && !node.userData.partId) node = node.parent;
      const p = model.parts.find((p) => p.id === node?.userData.partId);
      setSelected(p?.label ?? "");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = camera.position.clone().sub(controls.target);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === "ArrowLeft" ? -0.18 : 0.18);
        camera.position.copy(controls.target).add(direction);
        controls.update();
        render();
      } else if (event.key === "+" || event.key === "-") {
        event.preventDefault();
        actions.current?.zoom(event.key === "+" ? 1.15 : 1 / 1.15);
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("keydown", onKey);
    const onLost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setError(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    resize();
    setCamera({});
    const readyFrame = requestAnimationFrame(() => setReady(true));
    if (process.env.NODE_ENV === "development") {
      window.__IMG2THREEJS_CAPTURE__ = {
        setCamera(spec) {
          setCamera(spec, true);
        },
        capturePass() {
          render();
          return { ok: true };
        },
        async exportGlb() {
          const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
          explode(false);
          const buffer = await new GLTFExporter().parseAsync(model.root, { binary: true });
          if (!(buffer instanceof ArrayBuffer)) throw new Error("Expected binary GLB");
          return Array.from(new Uint8Array(buffer));
        },
        manifest() {
          model.root.updateMatrixWorld(true);
          return {
            model: "dimsum-mascot",
            parts: model.parts.map((p) => ({
              name: p.id,
              kind: "part",
              module: p.id,
              parent: p.group.parent?.name,
              worldPosition: p.group.getWorldPosition(new THREE.Vector3()).toArray(),
              triangles: p.group.children.reduce(
                (n, o) =>
                  n +
                  (o instanceof THREE.Mesh
                    ? (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) / 3
                    : 0),
                0,
              ),
            })),
            unnamedMeshes: 0,
            integralMeshes: model.parts.reduce(
              (n, p) => n + p.group.children.filter((o) => o instanceof THREE.Mesh).length,
              0,
            ),
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
          };
        },
        captureParts() {
          const images: Record<string, string> = {};
          render();
          images.baseline = renderer.domElement.toDataURL();
          for (const p of model.parts) {
            const meshes = p.group.children.filter((o) => o instanceof THREE.Mesh);
            meshes.forEach((o) => (o.visible = false));
            render();
            images[p.id] = renderer.domElement.toDataURL();
            meshes.forEach((o) => (o.visible = true));
          }
          render();
          return images;
        },
        exportGeometry() {
          model.root.updateMatrixWorld(true);
          const meshes: unknown[] = [];
          model.root.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const a = o.geometry.getAttribute("position"),
                v = new THREE.Vector3(),
                vertices: number[][] = [];
              for (let i = 0; i < a.count; i++) {
                v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
                vertices.push(v.toArray());
              }
              const normal = o.geometry.getAttribute("normal"),
                matrix = new THREE.Matrix3().getNormalMatrix(o.matrixWorld),
                normals: number[][] = [];
              for (let i = 0; i < normal.count; i++) {
                v.fromBufferAttribute(normal, i).applyMatrix3(matrix).normalize();
                normals.push(v.toArray());
              }
              meshes.push({
                name: o.name,
                vertices,
                normals,
                indices: o.geometry.index
                  ? Array.from(o.geometry.index.array)
                  : Array.from({ length: a.count }, (_, i) => i),
              });
            }
          });
          return { meshes };
        },
      };
      window.__IMG2THREEJS_READY__ = true;
    }
    return () => {
      active = false;
      cancelAnimationFrame(readyFrame);
      renderer.setAnimationLoop(null);
      actions.current = null;
      window.__IMG2THREEJS_READY__ = false;
      delete window.__IMG2THREEJS_CAPTURE__;
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", updateLoop);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("keydown", onKey);
      canvas.removeEventListener("webglcontextlost", onLost);
      controls.dispose();
      model.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      shadowTexture.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.DirectionalLight) o.shadow.dispose();
      });
      renderer.dispose();
      host.removeChild(canvas);
    };
  }, []);
  const reset = () => {
    actions.current?.reset();
    setExploded(false);
    setSpinning(false);
    setSelected("");
  };
  const toggleOriginal = () => {
    const value = !original;
    setOriginal(value);
    actions.current?.pause(value);
  };
  return (
    <div className={styles.viewer}>
      <div className={styles.topbar}>
        <span className={styles.badge}>{original ? "L’originale" : "Esplora in 3D"}</span>
        <button onClick={toggleOriginal} aria-pressed={original}>
          {original ? "Torna al 3D" : "Vedi l’originale"}
        </button>
      </div>
      <div className={styles.stage}>
        <div
          ref={mount}
          data-testid="mascot-canvas"
          data-ready={ready}
          className={styles.canvas}
          style={{ visibility: original || error ? "hidden" : "visible" }}
        />
        {(original || error) && (
          <div className={styles.original}>
            <Image
              src="/brand/mascot.webp"
              alt="La mascotte DIMSUM originale"
              fill
              sizes="(max-width: 760px) 85vw, 550px"
              priority
              className="object-contain p-8"
            />
          </div>
        )}
        {!ready && !error && <p className={styles.loading}>La mascotte sta arrivando…</p>}
        {error && (
          <p role="status" className={styles.error}>
            Il 3D non è disponibile su questo dispositivo. Puoi vedere l’originale o scaricare il modello.
          </p>
        )}
        {selected && !original && (
          <p aria-live="polite" className={styles.selected}>
            {selected}
          </p>
        )}
        <span className={styles.caption}>
          {original ? "Il personaggio da cui siamo partiti" : "Trascina per ruotare · Tocca un dettaglio"}
        </span>
      </div>
      <div className={styles.toolbar} aria-label="Controlli del modello">
        <button disabled={!ready || original || error} onClick={() => actions.current?.view(0)}>
          Fronte
        </button>
        <button disabled={!ready || original || error} onClick={() => actions.current?.view(180)}>
          Retro
        </button>
        <button
          disabled={!ready || original || error}
          onClick={() => actions.current?.zoom(1.15)}
          aria-label="Avvicina"
        >
          <Plus size={19} />
        </button>
        <button
          disabled={!ready || original || error}
          onClick={() => actions.current?.zoom(1 / 1.15)}
          aria-label="Allontana"
        >
          <Minus size={19} />
        </button>
        <button
          disabled={!ready || original || error}
          onClick={() => {
            const value = !spinning;
            setSpinning(value);
            actions.current?.spin(value);
          }}
          aria-pressed={spinning}
        >
          <RotateCw size={17} />
          {spinning ? "Ferma" : "Ruota"}
        </button>
        <button
          disabled={!ready || original || error}
          onClick={() => {
            const value = !exploded;
            setExploded(value);
            actions.current?.explode(value);
          }}
          aria-pressed={exploded}
        >
          <Expand size={17} />
          {exploded ? "Ricomponi" : "Separa"}
        </button>
        <button disabled={!ready || original || error} onClick={reset} aria-label="Ripristina vista">
          <RotateCcw size={18} />
        </button>
      </div>
      <a className={styles.download} href="/brand/dimsum-mascot.glb" download>
        <Download size={18} /> Scarica il modello 3D <span>.glb</span>
      </a>
    </div>
  );
}

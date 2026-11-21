import * as THREE from "three";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices, mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const MODEL_PASS = "optimization-pass";
export type MascotPart = { id: string; label: string; group: THREE.Group; home: THREE.Vector3 };
export type MascotModel = { root: THREE.Group; parts: MascotPart[]; dispose: () => void };

// World units: sole y=0, crown y=4. Front +Z, character left +X.
// Observed front silhouette; depth and back are inferred from the single illustration.
export function createDimsumMascot(): MascotModel {
  const root = new THREE.Group();
  root.name = "dimsum-mascot";
  const parts: MascotPart[] = [];
  const clay = new THREE.MeshStandardMaterial({ color: "#e6d4cb", roughness: 0.67 });
  function part(id: string, label: string, position: [number, number, number]) {
    const group = new THREE.Group();
    group.name = id;
    group.position.set(...position);
    root.add(group);
    group.userData.partId = id;
    parts.push({ id, label, group, home: group.position.clone() });
    return group;
  }
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material = clay) {
    const obj = new THREE.Mesh(geometry, material);
    obj.name = `${parent.name}-surface-${parent.children.length}`;
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function oval(
    parent: THREE.Group,
    size: [number, number, number],
    position: [number, number, number] = [0, 0, 0],
  ) {
    const obj = mesh(parent, new THREE.SphereGeometry(1, 32, 20));
    obj.scale.set(...size);
    obj.position.set(...position);
    return obj;
  }
  // A single closed radial volume, rather than detached lobes or a flat image plane.
  const positions: number[] = [],
    indices: number[] = [];
  const rings = 40,
    segments = 144;
  for (let i = 0; i <= rings; i++) {
    const phi = (Math.PI * i) / rings,
      r = Math.sin(phi),
      z = 0.49 * Math.cos(phi);
    for (let j = 0; j <= segments; j++) {
      const angle = (2 * Math.PI * j) / segments,
        upper = Math.sin(angle) >= 0;
      const lobes = upper ? 0.12 * Math.sin(9 * angle) ** 2 : 0;
      const x = (1.36 + lobes) * Math.cos(angle) * r;
      const y = (upper ? 1.22 + lobes : 0.63) * Math.sin(angle) * r;
      const fold = upper
        ? 0.16 * Math.sin(9 * angle) ** 2 * Math.max(0, (r - 0.48) / 0.52) * Math.cos(phi)
        : 0;
      positions.push(x, y, z + fold);
      if (i < rings && j < segments) {
        const a = i * (segments + 1) + j,
          b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const headGeometry = new THREE.BufferGeometry();
  headGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  headGeometry.setIndex(indices);
  headGeometry.computeVertexNormals();
  const head = part("head", "Testa a raviolo", [0, 2.66, 0]);
  mesh(head, headGeometry);
  oval(part("torso", "Giacca", [0, 1.57, 0]), [0.76, 0.65, 0.4]);
  // A rounded tailored apron, with width increasing towards the hem.
  const apronShape = new THREE.Shape();
  apronShape.moveTo(-0.72, 0.32);
  apronShape.quadraticCurveTo(-0.83, -0.12, -0.82, -0.29);
  apronShape.quadraticCurveTo(0, -0.36, 0.82, -0.29);
  apronShape.quadraticCurveTo(0.83, -0.12, 0.72, 0.32);
  apronShape.closePath();
  const apronGeo = new THREE.ExtrudeGeometry(apronShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 24,
  });
  mesh(part("apron", "Grembiule", [0, 0.88, 0.33]), apronGeo);
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ] as const) {
    const sleeve = part(`sleeve-${side}`, "Manica", [sign * 0.81, 1.55, 0]);
    oval(sleeve, [0.25, 0.39, 0.3]).rotation.z = sign * 0.55;
    oval(part(`hand-${side}`, "Mano", [sign * 0.99, 1.31, 0.02]), [0.22, 0.25, 0.25]);
    oval(part(`leg-${side}`, "Pantalone", [sign * 0.36, 0.46, 0]), [0.31, 0.34, 0.29]);
    oval(part(`shoe-${side}`, "Scarpa", [sign * 0.36, 0.16, 0.13]), [0.33, 0.17, 0.39]);
  }
  function tube(parent: THREE.Group, points: number[][], radius = 0.018) {
    const curve = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(v[0], v[1], v[2])));
    return mesh(parent, new THREE.TubeGeometry(curve, points.length === 2 ? 1 : 24, radius, 6, false));
  }
  function curvedShape(parent: THREE.Group, shape: THREE.Shape, depth = 0.025, bevel = 0.012) {
    return mesh(
      parent,
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelSegments: 4,
        curveSegments: 24,
      }),
    );
  }
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ] as const) {
    const eye = part(`eye-${side}`, "Occhio", [sign * 0.46, 2.86 - sign * 0.045, 0.454]);
    oval(eye, [0.205, 0.222, 0.075]);
    const brow = part(`brow-${side}`, "Sopracciglio", [sign * 0.46, 3.16 - sign * 0.045, 0.455]);
    tube(
      brow,
      [
        [-0.065, 0, 0],
        [0, 0.021, 0.005],
        [0.063, 0, 0],
      ],
      0.018,
    );
  }
  const mouth = part("mouth", "Sorriso", [0, 2.58, 0.47]);
  const smile = new THREE.Shape();
  smile.moveTo(-0.18, 0.18);
  smile.bezierCurveTo(-0.09, 0.105, 0.08, 0.09, 0.18, 0.15);
  smile.bezierCurveTo(0.21, -0.09, 0.12, -0.24, 0, -0.24);
  smile.bezierCurveTo(-0.13, -0.23, -0.23, -0.08, -0.18, 0.18);
  curvedShape(mouth, smile, 0.025, 0.01);
  oval(part("tongue", "Lingua", [0, 2.43, 0.515]), [0.15, 0.1, 0.018]);
  // Belt wraps the torso, including its inferred rear; knot is deliberately offset.
  const belt = part("belt", "Cintura", [0, 1.26, 0]);
  const beltGeo = new THREE.CylinderGeometry(0.78, 0.81, 0.17, 80, 1);
  beltGeo.scale(1, 1, 0.55);
  mesh(belt, beltGeo);
  const bow = part("bow", "Fiocco", [0.28, 1.2, 0.49]);
  for (const sign of [-1, 1]) {
    const loop = new THREE.Shape();
    loop.moveTo(sign * 0.07, 0.09);
    loop.bezierCurveTo(sign * 0.2, 0.23, sign * 0.39, 0.24, sign * 0.33, 0.03);
    loop.bezierCurveTo(sign * 0.3, -0.06, sign * 0.43, -0.23, sign * 0.24, -0.17);
    loop.lineTo(sign * 0.07, -0.08);
    loop.closePath();
    curvedShape(bow, loop, 0.055, 0.025);
  }
  oval(bow, [0.1, 0.13, 0.09], [0, 0, 0.045]);
  const placket = part("placket", "Alamari della giacca", [0, 1.7, 0]);
  tube(
    placket,
    [
      [-0.38, 0.39, 0.16],
      [-0.2, 0.34, 0.29],
      [-0.05, 0.25, 0.36],
      [0, 0.12, 0.39],
      [-0.03, -0.01, 0.395],
      [-0.28, -0.04, 0.375],
      [-0.32, -0.2, 0.36],
      [-0.32, -0.43, 0.3],
    ],
    0.018,
  );
  tube(
    placket,
    [
      [0.38, 0.39, 0.16],
      [0.2, 0.34, 0.29],
      [0.05, 0.25, 0.36],
      [0, 0.12, 0.39],
    ],
    0.018,
  );
  for (const [y, x, z] of [
    [0.08, 0, 0.397],
    [-0.12, -0.29, 0.385],
    [-0.2, -0.3, 0.37],
  ])
    tube(
      placket,
      [
        [x! - 0.11, y!, z!],
        [x! + 0.1, y!, z!],
      ],
      0.016,
    );
  const stitches = part("stitches", "Cuciture", [0, 0.88, 0.33]);
  for (let i = 0; i < 27; i++) {
    const x = -0.75 + i * 0.056;
    tube(
      stitches,
      [
        [x, -0.28, 0.15],
        [x + 0.031, -0.282, 0.15],
      ],
      0.006,
    );
  }
  for (const sign of [-1, 1])
    for (let i = 0; i < 9; i++) {
      const y = -0.23 + i * 0.058,
        x = sign * (0.77 - (y + 0.23) * 0.14);
      tube(
        stitches,
        [
          [x, y, 0.145],
          [x - sign * 0.004, y + 0.032, 0.145],
        ],
        0.006,
      );
    }
  const emblem = part("emblem", "Simbolo sul grembiule", [0.44, 0.77, 0.49]);
  const dumpling = new THREE.Shape();
  dumpling.moveTo(-0.22, -0.13);
  dumpling.bezierCurveTo(-0.25, -0.02, -0.21, 0.03, -0.16, 0.04);
  dumpling.bezierCurveTo(-0.2, 0.14, -0.08, 0.18, -0.05, 0.12);
  dumpling.bezierCurveTo(-0.05, 0.23, 0.06, 0.24, 0.08, 0.16);
  dumpling.bezierCurveTo(0.18, 0.23, 0.26, 0.17, 0.22, 0.08);
  dumpling.bezierCurveTo(0.13, -0.08, -0.05, -0.16, -0.22, -0.13);
  curvedShape(emblem, dumpling, 0.006, 0.003);
  const glints = part("catchlights", "Riflessi degli occhi", [0, 0, 0]);
  for (const sign of [-1, 1]) {
    oval(glints, [0.052, 0.057, 0.008], [sign * 0.46 + 0.065, 2.94 - sign * 0.045, 0.525]);
    oval(glints, [0.024, 0.027, 0.008], [sign * 0.46 - 0.04, 2.93 - sign * 0.045, 0.526]);
  }
  // Parent attached features without changing their authored world-space placement.
  for (const id of ["eye-left", "eye-right", "brow-left", "brow-right", "mouth", "tongue", "catchlights"]) {
    const item = parts.find((p) => p.id === id)!;
    head.attach(item.group);
    item.home.copy(item.group.position);
    item.group.userData.explodeWithParent = true;
  }
  for (const [id, parentId] of [
    ["placket", "torso"],
    ["stitches", "apron"],
    ["emblem", "apron"],
    ["bow", "belt"],
    ["hand-left", "sleeve-left"],
    ["hand-right", "sleeve-right"],
  ]) {
    const item = parts.find((p) => p.id === id)!,
      parent = parts.find((p) => p.id === parentId)!;
    parent.group.attach(item.group);
    item.home.copy(item.group.position);
    item.group.userData.explodeWithParent = true;
  }
  root.updateMatrixWorld(true);
  const apron = parts.find((p) => p.id === "apron")!.group;
  apron.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      if (o.parent === apron) {
        const original = o.geometry;
        o.geometry = new TessellateModifier(0.12, 6).modify(original);
        original.dispose();
      }
      const pos = o.geometry.getAttribute("position"),
        v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        o.localToWorld(v);
        v.z -= 0.13 * (v.x / 0.83) ** 2;
        o.worldToLocal(v);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      const unmerged = o.geometry;
      o.geometry = mergeVertices(unmerged);
      unmerged.dispose();
      o.geometry.computeVertexNormals();
    }
  });
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ] as const) {
    const sleeve = parts.find((p) => p.id === `sleeve-${side}`)!.group;
    const points: number[][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2,
        v = new THREE.Vector3(0.207 * Math.cos(a), -0.22, 0.248 * Math.sin(a));
      v.applyAxisAngle(new THREE.Vector3(0, 0, 1), sign * 0.55);
      points.push(v.toArray());
    }
    const cuff = tube(sleeve, points, 0.016);
    cuff.userData.materialId = "ink";
  }
  for (const sign of [-1, 1]) {
    const curl = tube(
      bow,
      [
        [sign * 0.09, 0.03, 0.105],
        [sign * 0.18, 0.065, 0.1],
        [sign * 0.23, 0.025, 0.1],
        [sign * 0.22, -0.02, 0.1],
        [sign * 0.18, -0.025, 0.1],
      ],
      0.012,
    );
    curl.userData.materialId = "ink";
  }
  const emblemLine = tube(
    emblem,
    [
      [-0.2, -0.12, 0.028],
      [-0.12, -0.015, 0.029],
      [0.02, 0.055, 0.029],
      [0.2, 0.09, 0.028],
    ],
    0.006,
  );
  emblemLine.userData.materialId = "gold";
  const hem = tube(
    apron,
    [
      [-0.79, 0.29, 0.12],
      [-0.83, -0.25, 0.12],
      [-0.72, -0.32, 0.115],
      [0, -0.34, 0.115],
      [0.72, -0.32, 0.115],
      [0.83, -0.25, 0.12],
      [0.79, 0.29, 0.12],
    ],
    0.012,
  );
  hem.userData.materialId = "stitch";
  for (const [obj, offset] of [
    [hem, 0],
    [emblemLine, 0.44],
  ] as const) {
    const positions = obj.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++)
      positions.setZ(i, positions.getZ(i) - 0.13 * ((positions.getX(i) + offset) / 0.83) ** 2);
    positions.needsUpdate = true;
    obj.geometry.computeVertexNormals();
  }
  const palette: Record<string, THREE.MeshPhysicalMaterial> = {};
  for (const [id, color, roughness] of [
    ["dough", "#ffe4df", 0.43],
    ["cloth", "#fff4ef", 0.8],
    ["gold", "#ffb92d", 0.72],
    ["red", "#ec102b", 0.4],
    ["ink", "#211821", 0.4],
    ["eyes", "#100812", 0.12],
    ["mouth", "#430718", 0.5],
    ["tongue", "#ff3a61", 0.44],
    ["stitch", "#a64616", 0.76],
    ["white", "#ffffff", 0.3],
  ] as const) {
    palette[id] = new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0,
      clearcoat: id === "eyes" ? 0.6 : 0.04,
      clearcoatRoughness: 0.14,
    });
  }
  const matId = (id: string) =>
    id === "head" || id.startsWith("hand")
      ? "dough"
      : id === "apron"
        ? "gold"
        : id === "belt" || id === "bow" || id === "emblem"
          ? "red"
          : id.startsWith("eye")
            ? "eyes"
            : id.startsWith("shoe") || id.startsWith("brow") || id === "placket"
              ? "ink"
              : id === "mouth"
                ? "mouth"
                : id === "tongue"
                  ? "tongue"
                  : id === "stitches"
                    ? "stitch"
                    : id === "catchlights"
                      ? "white"
                      : "cloth";
  for (const p of parts)
    for (const o of p.group.children) {
      if (o instanceof THREE.Mesh) o.material = palette[(o.userData.materialId as string) || matId(p.id)]!;
    }
  const headMesh = head.children.find((o) => o instanceof THREE.Mesh) as THREE.Mesh;
  const headMaterial = palette.dough!.clone();
  headMaterial.color.set("#ffffff");
  headMaterial.vertexColors = true;
  headMesh.material = headMaterial;
  const colors: number[] = [],
    headPositions = headGeometry.getAttribute("position"),
    baseColor = new THREE.Color("#ffe8e3"),
    blushColor = new THREE.Color("#ef6e92"),
    v = new THREE.Vector3();
  for (let i = 0; i < headPositions.count; i++) {
    v.fromBufferAttribute(headPositions, i);
    const blush =
      (Math.exp(-(((v.x - 0.74) / 0.21) ** 2) - ((v.y + 0.1) / 0.15) ** 2) +
        Math.exp(-(((v.x + 0.74) / 0.21) ** 2) - ((v.y + 0.1) / 0.15) ** 2)) *
      Math.max(0, Math.min(1, v.z * 6));
    const color = baseColor.clone().lerp(blushColor, blush * 0.96);
    colors.push(color.r, color.g, color.b);
  }
  headGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  clay.dispose();
  // Facial marks and embroidery represent surface graphics: no cast shadows.
  for (const p of parts)
    if (["mouth", "tongue", "emblem", "catchlights", "stitches", "brow-left", "brow-right"].includes(p.id)) {
      for (const o of p.group.children) if (o instanceof THREE.Mesh) o.castShadow = false;
    }
  // A single draw for the repeated seam, while preserving its selectable semantic part.
  const stitchMeshes = stitches.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
  const mergedStitches = mergeGeometries(stitchMeshes.map((o) => o.geometry));
  if (mergedStitches) {
    for (const o of stitchMeshes) {
      stitches.remove(o);
      o.geometry.dispose();
    }
    mesh(stitches, mergedStitches, palette.stitch!);
  }
  root.updateMatrixWorld(true);
  const colliders = parts.map((p) => {
    const bounds = new THREE.Box3().setFromObject(p.group);
    const socket = new THREE.Object3D();
    socket.name = p.id + ":origin";
    p.group.add(socket);
    return { id: p.id, type: "box", min: bounds.min.toArray(), max: bounds.max.toArray() };
  });
  root.userData.sculptRuntime = {
    version: 1,
    colliders,
    pivots: parts.map((p) => ({
      id: p.id,
      parent: p.group.parent?.name,
      position: p.home.toArray(),
      explodeWithParent: !!p.group.userData.explodeWithParent,
    })),
    rig: "rigid-parts; no skeletal animation",
    pass: MODEL_PASS,
    parts: parts.map((p) => p.id),
    coordinateFrame: { up: "+Y", forward: "+Z" },
    hiddenRegions: "Rear geometry inferred from the single front illustration.",
  };
  return {
    root,
    parts,
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

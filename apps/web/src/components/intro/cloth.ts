/**
 * The page as a blanket: its hem is pulled down in the middle by the mascot's hands while the
 * sides lag behind, so the edge sags into a soft curve, ripples with every step and gathers into
 * folds that converge on the hands. Everything is plain geometry in CSS pixels (SVG + clip-path).
 */
export type Hem = {
  /** Screen points of the hem, left to right. */
  points: [number, number][];
  /** Highest point of the hem (the sides), for knowing when the page has fully come down. */
  top: number;
};

export type HemInput = {
  width: number;
  /** Hands: horizontal centre and height of the hem where it is held. */
  cx: number;
  edge: number;
  /** Half-width of the stretch held between the hands. */
  hold: number;
  /** How far the sides lag above the hands (CSS px). */
  lag: number;
  /** Walk phase and amount, for the ripple travelling outwards from the hands. */
  phase: number;
  ripple: number;
};

const SAMPLES = 56;

export function hemAt(i: HemInput): Hem {
  const points: [number, number][] = [];
  let top = Infinity;
  for (let k = 0; k <= SAMPLES; k++) {
    const x = (i.width * k) / SAMPLES;
    const dx = Math.abs(x - i.cx);
    const reach = Math.max(1, Math.max(i.cx, i.width - i.cx) - i.hold);
    const d = Math.min(1, Math.max(0, dx - i.hold) / reach);
    // Soft U: the fabric leaves the hands gently, rises, then flattens towards the sides.
    const drape = d * d * (3 - 2 * d);
    const wave = Math.sin(d * 9 - i.phase * 1.4) * 6 * d * i.ripple;
    const y = i.edge - i.lag * drape + wave;
    top = Math.min(top, y);
    points.push([x, y]);
  }
  return { points, top };
}

/** clip-path polygon keeping only what is below the hem (the still-covered area). */
export function belowHemPolygon(hem: Hem, height: number): string {
  const pts = hem.points.map(([x, y]) => `${x.toFixed(1)}px ${Math.max(-10, y).toFixed(1)}px`);
  const w = hem.points[hem.points.length - 1]![0];
  return `polygon(${pts.join(",")},${w}px ${height + 10}px,0px ${height + 10}px)`;
}

/** SVG path of the hem line, smoothed with quadratic segments. */
export function hemPath(hem: Hem, dy = 0): string {
  const p = hem.points;
  let d = `M${p[0]![0].toFixed(1)} ${(p[0]![1] + dy).toFixed(1)}`;
  for (let k = 1; k < p.length - 1; k++) {
    const mx = (p[k]![0] + p[k + 1]![0]) / 2;
    const my = (p[k]![1] + p[k + 1]![1]) / 2 + dy;
    d += `Q${p[k]![0].toFixed(1)} ${(p[k]![1] + dy).toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = p[p.length - 1]!;
  return `${d}L${last[0].toFixed(1)} ${(last[1] + dy).toFixed(1)}`;
}

/** Closed area of the page above the hem (where folds are drawn). */
export function aboveHemPath(hem: Hem): string {
  const w = hem.points[hem.points.length - 1]![0];
  return `${hemPath(hem)}L${w} -20L0 -20Z`;
}

/**
 * Folds: long soft wedges that start at the hands and fan out upwards and sideways, alternating
 * shadow and light. Returned as two path strings (shadows, highlights).
 */
export function foldPaths(i: HemInput, hem: Hem): { shade: string; light: string } {
  const n = 7;
  let shade = "";
  let light = "";
  const len = Math.max(140, i.lag * 2.2);
  for (const side of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const start = i.cx + side * (i.hold * (0.2 + 0.8 * (k / n)));
      // Fan angle from almost vertical (inner folds) to wide (outer folds).
      const a = (0.15 + 0.95 * (k / (n - 1))) * side;
      const sway = Math.sin(i.phase * 0.7 + k) * 0.05 * i.ripple;
      const ex = start + Math.sin(a + sway) * len * 1.3;
      const ey = i.edge - Math.cos(a) * len - (k % 2) * 30;
      const half = 7 + k * 2.2;
      const sy = yOnHem(hem, start) - 2;
      const path = `M${(start - half).toFixed(1)} ${sy.toFixed(1)}Q${((start + ex) / 2).toFixed(1)} ${((sy + ey) / 2 - 10).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}Q${((start + ex) / 2 + half).toFixed(1)} ${((sy + ey) / 2).toFixed(1)} ${(start + half).toFixed(1)} ${sy.toFixed(1)}Z`;
      if (k % 2 === 0) shade += path;
      else light += path;
    }
  }
  return { shade, light };
}

function yOnHem(hem: Hem, x: number): number {
  const p = hem.points;
  const w = p[p.length - 1]![0];
  const f = Math.min(p.length - 1.001, Math.max(0, (x / w) * (p.length - 1)));
  const k = Math.floor(f);
  const t = f - k;
  return p[k]![1] * (1 - t) + p[k + 1]![1] * t;
}

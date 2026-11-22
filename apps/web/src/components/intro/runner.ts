/**
 * The opening animation, as a tiny self-contained script inlined in the HTML right after the
 * overlay markup. It starts while the page is still being parsed, before React or any bundle has
 * loaded, so there is no loading screen: the first frame the visitor sees is already moving.
 *
 * The mascot is the real 3D model, pre-rendered (same rig, lights and camera) into a sprite sheet
 * of its walk cycle seen from behind; the sheet also records where the hands are in every frame,
 * so the page (a blanket, drawn in SVG + clip-path) is held exactly in its hands.
 *
 * `run` must stay self-contained (no imports, no outer variables, no spread/classes/async): it is
 * serialised with Function.prototype.toString().
 */
import walk from "./walk-sprite.json";

export type RunnerConfig = {
  sprite: string;
  key: string;
  w: number;
  h: number;
  cols: number;
  n: number;
  feet: number;
  span: number;
  hands: number[][];
};

/* eslint-disable no-var */
function run(c: RunnerConfig) {
  var d = document.documentElement;
  var root = document.getElementById("dimsum-intro");
  if (d.dataset.intro !== "play" || !root) return;
  d.dataset.introRun = "1";
  try {
    window.scrollTo(0, 0);
  } catch {}

  var q = function (k: string) {
    return root!.querySelector('[data-k="' + k + '"]') as HTMLElement | null;
  };
  var curtain = q("curtain");
  var mascot = q("mascot");
  var skip = q("skip");
  var clip = q("clip");
  var shade = q("shade");
  var light = q("light");
  var band = q("band");
  var hemShadow = q("hem-shadow");
  var hem = q("hem");
  var shine = q("shine");
  var stitch = q("stitch");
  var svg = root.querySelector("svg");

  var DURATION = 3.1;
  var CADENCE = 2.6; // steps per second
  var MAX_DT = 1 / 30; // a slow frame slows the animation down, it never skips ahead
  var SAMPLES = 56;

  var ready = false;
  var img = new Image();
  img.onload = img.onerror = function () {
    ready = true;
  };
  img.src = c.sprite;
  if (img.complete) ready = true;

  var clamp01 = function (x: number) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  };
  var span = function (t: number, a: number, b: number) {
    return clamp01((t - a) / (b - a));
  };
  var easeOut = function (x: number) {
    return 1 - (1 - x) * (1 - x) * (1 - x);
  };
  var easeInOutSine = function (x: number) {
    return -(Math.cos(Math.PI * x) - 1) / 2;
  };
  var f1 = function (v: number) {
    return v.toFixed(1);
  };

  var stopped = false;
  var clock = 0;
  var last = 0;
  var lastW = 0;
  var lastH = 0;

  function finish() {
    if (stopped) return;
    stopped = true;
    try {
      sessionStorage.setItem(c.key, "1");
    } catch {}
    root!.style.transition = "opacity 260ms ease-out";
    root!.style.opacity = "0";
    window.setTimeout(function () {
      delete d.dataset.intro;
      delete d.dataset.introRun;
    }, 270);
  }
  root.addEventListener("pointerdown", finish);
  if (skip) skip.addEventListener("click", finish);

  function hemPath(p: number[][], dy: number) {
    var s = "M" + f1(p[0]![0]!) + " " + f1(p[0]![1]! + dy);
    for (var k = 1; k < p.length - 1; k++) {
      var mx = (p[k]![0]! + p[k + 1]![0]!) / 2;
      var my = (p[k]![1]! + p[k + 1]![1]!) / 2 + dy;
      s += "Q" + f1(p[k]![0]!) + " " + f1(p[k]![1]! + dy) + " " + f1(mx) + " " + f1(my);
    }
    var e = p[p.length - 1]!;
    return s + "L" + f1(e[0]!) + " " + f1(e[1]! + dy);
  }

  function frame(now: number) {
    if (stopped) return;
    var W = window.innerWidth;
    var H = window.innerHeight;
    if (W !== lastW || H !== lastH) {
      lastW = W;
      lastH = H;
      if (svg) svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    }
    // The clock only runs while frames are drawn; it waits for the mascot frames before the
    // mascot enters (a fraction of a second at most), so it never appears half-way through.
    if (last && (ready || clock < 0.12)) clock += Math.min((now - last) / 1000, MAX_DT);
    last = now;
    var t = clock;

    // Choreography: enters from above the top edge, then walks down to the bottom and off.
    var size = Math.round(Math.min(380, Math.max(180, Math.min(H * 0.34, W * 0.58))));
    var k = size / (c.h * 0.8627); // the frame's mascot is 440 px tall inside a 510 px frame
    var start = size * 1.02 + H * 0.04;
    var maxLag = Math.min(H * 0.15, size * 0.42);
    var lag = maxLag * easeOut(span(t, 0.1, 0.9)) * (1 - 0.25 * span(t, 2.4, DURATION));
    var end = H + Math.max(size, maxLag) + 80;
    var enter = easeOut(span(t, 0, 0.55));
    var u = span(t, 0.45, DURATION);
    var travel = 0.55 * u + 0.45 * easeInOutSine(u);
    var phase = Math.PI * CADENCE * t;
    var walkAmount = easeOut(span(t, 0.3, 0.75));
    var surge = 7 * (0.5 - 0.5 * Math.cos(2 * phase)) * walkAmount;
    var feet = -size * 0.1 + (start + size * 0.1) * enter + (end - start) * travel + surge;

    // Mascot: the walk-cycle frame for this phase, its feet on `feet`.
    var n = c.n;
    var i = Math.floor((phase / (2 * Math.PI)) * n) % n;
    var fw = c.w * k;
    var fh = c.h * k;
    var left = W / 2 - fw / 2;
    var top = feet - c.feet * k;
    if (mascot) {
      if (ready && !mascot.style.backgroundImage) {
        mascot.style.backgroundImage = "url(" + c.sprite + ")";
        mascot.style.opacity = "1";
      }
      mascot.style.width = f1(fw) + "px";
      mascot.style.height = f1(fh) + "px";
      mascot.style.backgroundSize = f1(c.cols * fw) + "px " + f1(Math.ceil(n / c.cols) * fh) + "px";
      mascot.style.backgroundPosition =
        f1(-(i % c.cols) * fw) + "px " + f1(-Math.floor(i / c.cols) * fh) + "px";
      mascot.style.transform = "translate3d(" + f1(left) + "px," + f1(top) + "px,0)";
    }
    var hand = c.hands[i] || [c.w / 2, c.feet * 0.66];
    var cx = left + hand[0]! * k;
    var edge = top + hand[1]! * k;
    var hold = c.span * k;

    // The blanket's hem: held between the hands, sides trailing behind, rippling with each step.
    var pts: number[][] = [];
    var reach = Math.max(1, Math.max(cx, W - cx) - hold);
    for (var s = 0; s <= SAMPLES; s++) {
      var x = (W * s) / SAMPLES;
      var dd = clamp01((Math.abs(x - cx) - hold) / reach);
      var drape = dd * dd * (3 - 2 * dd);
      var wave = Math.sin(dd * 9 - phase * 1.4) * 6 * dd * walkAmount;
      pts.push([x, edge - lag * drape + wave]);
    }
    var poly = "polygon(";
    for (var j = 0; j < pts.length; j++)
      poly += f1(pts[j]![0]!) + "px " + f1(Math.max(-10, pts[j]![1]!)) + "px,";
    poly += W + "px " + (H + 10) + "px,0px " + (H + 10) + "px)";
    if (curtain) curtain.style.clipPath = poly;

    var line = hemPath(pts, 0);
    if (clip) clip.setAttribute("d", line + "L" + W + " -20L0 -20Z");
    if (band) band.setAttribute("d", line);
    if (hem) hem.setAttribute("d", line);
    if (hemShadow) hemShadow.setAttribute("d", hemPath(pts, 9));
    if (shine) shine.setAttribute("d", hemPath(pts, -4));
    if (stitch) stitch.setAttribute("d", hemPath(pts, 4));

    // Folds fanning out from the hands.
    var sh = "";
    var li = "";
    var len = Math.max(140, lag * 2.2);
    for (var side = -1; side <= 1; side += 2) {
      for (var f = 0; f < 7; f++) {
        var st = cx + side * (hold * (0.2 + 0.8 * (f / 7)));
        var a = (0.15 + 0.95 * (f / 6)) * side;
        var ex = st + Math.sin(a) * len * 1.3;
        var ey = edge - Math.cos(a) * len - (f % 2) * 30;
        var half = 7 + f * 2.2;
        var sy = edge - lag * 0.02 - 2;
        var path =
          "M" +
          f1(st - half) +
          " " +
          f1(sy) +
          "Q" +
          f1((st + ex) / 2) +
          " " +
          f1((sy + ey) / 2 - 10) +
          " " +
          f1(ex) +
          " " +
          f1(ey) +
          "Q" +
          f1((st + ex) / 2 + half) +
          " " +
          f1((sy + ey) / 2) +
          " " +
          f1(st + half) +
          " " +
          f1(sy) +
          "Z";
        if (f % 2 === 0) sh += path;
        else li += path;
      }
    }
    var tension = Math.min(1, lag / 90);
    if (shade) {
      shade.setAttribute("d", sh);
      shade.setAttribute("opacity", String(0.22 * tension));
    }
    if (light) {
      light.setAttribute("d", li);
      light.setAttribute("opacity", String(0.14 * tension));
    }
    if (skip) skip.style.opacity = String(clamp01((H * 0.82 - edge) / 120));

    if (t >= DURATION) {
      finish();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/* eslint-enable no-var */

export function introRunnerScript(key: string): string {
  const config: RunnerConfig = { sprite: "/brand/intro-walk.webp", key, ...walk };
  return `(${run.toString()})(${JSON.stringify(config)});`;
}

export const INTRO_SPRITE = "/brand/intro-walk.webp";

/**
 * The opening animation, as a tiny self-contained script inlined in the HTML right after the
 * overlay markup. It starts while the page is still being parsed, before React or any bundle has
 * loaded, so there is no loading screen.
 *
 * Story: a white blanket covers the page. The DIMSUM mascot walks in from the right, stops, turns
 * to look at us, blinks and waves, turns around, walks up, jumps to grab the blanket's top edge,
 * gives it two hard tugs and then pulls it all the way down, stepping backwards, revealing the page.
 *
 * The mascot is the real 3D model pre-rendered (same rig, lights and camera) into a sprite sheet:
 * side walk, turns, front look and wave, back walk. Every frame records where the hands are, so the
 * blanket's edge stays exactly in its hands.
 *
 * `run` must stay self-contained (no imports, no outer variables, no spread/classes/async): it is
 * serialised with Function.prototype.toString().
 */
import sheet from "./walk-sprite.json";

import { INTRO_SPRITE } from "./sprite";

export { INTRO_SPRITE };

export type RunnerConfig = {
  sprite: string;
  key: string;
  w: number;
  h: number;
  cols: number;
  n: number;
  feet: number;
  span: number;
  mascot: number;
  seq: Record<string, number[]>;
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
  var print = q("print");
  var mascot = q("mascot");
  var contact = q("contact");
  var effort = q("effort");
  var skip = q("skip");
  var clip = q("clip");
  var shade = q("shade");
  var light = q("light");
  var lift = q("lift");
  var hemShadow = q("hem-shadow");
  var hem = q("hem");
  var shine = q("shine");
  var stitch = q("stitch");
  var svg = root.querySelector("svg");

  var END = 6.7;
  var PULL = 5.35; // the blanket gives way: from here it is pulled all the way down
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
  var lerp = function (a: number, b: number, x: number) {
    return a + (b - a) * x;
  };
  var easeOut = function (x: number) {
    return 1 - (1 - x) * (1 - x) * (1 - x);
  };
  var easeIn = function (x: number) {
    return x * x * x;
  };
  var easeInOut = function (x: number) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  var f1 = function (v: number) {
    return v.toFixed(1);
  };
  var seqFrame = function (name: string, i: number) {
    var s = c.seq[name]!;
    var n = s[1]!;
    return s[0]! + (((Math.floor(i) % n) + n) % n);
  };
  var seqStep = function (name: string, x: number) {
    var s = c.seq[name]!;
    return s[0]! + Math.min(s[1]! - 1, Math.floor(clamp01(x) * s[1]!));
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
    // The clock only runs while frames are drawn, and waits for the mascot frames (a moment at
    // most) before the mascot steps in, so it never appears half-way through.
    if (last && (ready || clock < 0.05)) clock += Math.min((now - last) / 1000, MAX_DT);
    last = now;
    var t = clock;

    var S = Math.round(Math.min(340, Math.max(170, Math.min(H * 0.3, W * 0.5))));
    var k = S / c.mascot;
    var ground = H * 0.7;
    var topY = Math.max(96, H * 0.19); // where the blanket's edge is grabbed
    var stride = S * 0.62; // screen distance of one full walk cycle (two steps)
    var backN = c.seq.back![1]!;
    // Hands height above the feet in a back frame, for a given scale.
    var handRise = function (fi: number, scale: number) {
      return (c.feet - c.hands[fi]![1]!) * k * scale;
    };

    var fi = seqFrame("side", 0); // sprite frame
    var cx = W / 2; // mascot centre x
    var feet = ground; // mascot feet y
    var sc = 1; // perspective scale (smaller when further up)
    var squash = 1;
    var tilt = 0;
    var edge = 0; // blanket edge at the hands (0 = still at the top of the screen)
    var held = false;
    var lag = 0;
    var phase = 0;
    var upSc = 0.94;
    var reach0 = c.seq.reach![0]!;
    var reachN = c.seq.reach![1]!;
    var strain0 = c.seq.strain![0]!;
    var strainN = c.seq.strain![1]!;
    var upN = c.seq.backUp![1]!;
    var raisedFrame = reach0 + reachN - 1;
    // Standing just under the top: raised hands at the grab height.
    var topFeet = topY + handRise(raisedFrame, upSc);
    var raised = false; // arms up (wider hold on the blanket's edge)
    var straining = 0; // 0..1: shaking, sweat and effort marks

    if (t < 1.3) {
      // 1. Walks in from the right, side view, slowing down to stop in the middle.
      var startX = W + S * 0.7;
      var u = span(t, 0, 1.3);
      cx = lerp(startX, W / 2, 1 - (1 - u) * (1 - u));
      fi = seqFrame("side", ((startX - cx) / stride) * c.seq.side![1]!);
    } else if (t < 1.5) {
      // 2. Turns to face us.
      fi = seqStep("turnFront", span(t, 1.3, 1.5));
    } else if (t < 2.55) {
      // 3. Looks at us, blinks, waves, a little hop of joy.
      var f0 = c.seq.front![0]!;
      if (t < 1.78) fi = f0;
      else if (t < 1.88) fi = f0 + 1;
      else if (t < 1.98) fi = f0;
      else if (t < 2.36) fi = f0 + 3 + (Math.floor((t - 1.98) / 0.075) % 4);
      else if (t < 2.44) {
        fi = f0 + 7;
        squash = 0.94;
      } else {
        fi = f0 + 2;
        feet = ground - Math.sin(span(t, 2.44, 2.55) * Math.PI) * S * 0.07;
      }
    } else if (t < 2.85) {
      // 4. Turns around.
      fi = seqStep("turnBack", span(t, 2.55, 2.85));
    } else if (t < 3.45) {
      // 5. Walks up towards the top edge (away from us: a little smaller).
      var w = easeInOut(span(t, 2.85, 3.45));
      feet = lerp(ground, topFeet + S * 0.1, w);
      sc = lerp(1, upSc, w);
      fi = seqFrame("back", ((ground - feet) / (stride * 0.9)) * backN);
    } else if (t < 3.7) {
      // 6. Raises its arms towards the edge.
      sc = upSc;
      feet = topFeet + S * 0.1;
      fi = seqStep("reach", span(t, 3.45, 3.7));
      raised = t > 3.6;
    } else if (t < 3.92) {
      // 7. Jumps, grabs the edge and yanks it down to its hands.
      sc = upSc;
      raised = true;
      fi = raisedFrame;
      var j = span(t, 3.7, 3.92);
      feet = topFeet + S * 0.1 - Math.sin(j * Math.PI) * S * 0.2;
      squash = j < 0.15 ? 0.9 : 1.06;
      if (j > 0.45) {
        held = true;
        edge = (feet - handRise(fi, sc)) * easeOut(span(j, 0.45, 1));
      }
    } else if (t < PULL) {
      // 8. It won't come! Pulls with all its strength: shaking, leaning back, three hard tugs that
      // bring the edge down a little at a time, sweat drops flying.
      sc = upSc;
      raised = true;
      held = true;
      straining = clamp01((t - 3.92) / 0.2) * clamp01((PULL - t) / 0.12 + 0.3);
      fi = strain0 + (Math.floor((t - 3.92) / 0.055) % strainN);
      var tugT = (t - 3.92) / ((PULL - 3.92) / 3); // 0..3
      var tn = Math.min(2, Math.floor(tugT));
      var tp = Math.min(1, tugT - tn);
      var give = tp < 0.3 ? easeOut(tp / 0.3) : 1 - 0.45 * easeInOut((tp - 0.3) / 0.7);
      feet = topFeet + S * 0.1 + S * 0.075 * (tn + give);
      squash = tp < 0.3 ? lerp(1, 0.88, tp / 0.3) : lerp(0.88, 0.97, (tp - 0.3) / 0.7);
      // Trembling with effort.
      cx += Math.sin(t * 57) * 1.8 + Math.sin(t * 31) * 0.9;
      tilt = Math.sin(t * 43) * 0.014 + (tn % 2 ? -1 : 1) * 0.03 * Math.sin(tp * Math.PI);
      lag = S * 0.05 * (tn + give);
    } else {
      // 9. It gives way: stumbles back, arms still up, and drags the blanket all the way down.
      held = true;
      raised = true;
      var v = span(t, PULL, END - 0.1);
      var startFeet = topFeet + S * 0.1 + S * 0.075 * 2.55;
      // A quick stumble first (the release), then steady steps back.
      var travel = 0.22 * easeOut(span(v, 0, 0.18)) + 0.78 * (0.3 * v + 0.7 * easeIn(v));
      feet = lerp(startFeet, H + S * 1.3 + 60, travel);
      sc = lerp(upSc, 1.06, v);
      phase = (feet - startFeet) / (stride * 0.75);
      fi = seqFrame("backUp", -phase * upN);
      squash =
        1 -
        0.035 * Math.abs(Math.sin(phase * Math.PI)) +
        (v < 0.12 ? 0.05 * Math.sin((v / 0.12) * Math.PI) : 0);
      tilt = v < 0.15 ? -0.06 * Math.sin((v / 0.15) * Math.PI) : 0;
      lag = Math.min(H * 0.16, S * 0.45) * (0.5 + 0.5 * easeOut(span(v, 0, 0.35))) * (1 - 0.3 * v);
    }
    if (held && t >= 3.92) edge = feet - handRise(fi, sc);

    // Mascot: one sprite frame, feet on `feet`, centred on `cx`.
    var kk = k * sc;
    var fw = c.w * kk;
    var fh = c.h * kk;
    var left = cx - fw / 2;
    var top = feet - c.feet * kk;
    if (mascot) {
      if (ready && !mascot.style.backgroundImage) {
        mascot.style.backgroundImage = "url(" + c.sprite + ")";
        mascot.style.opacity = "1";
      }
      mascot.style.width = f1(fw) + "px";
      mascot.style.height = f1(fh) + "px";
      mascot.style.backgroundSize = f1(c.cols * fw) + "px " + f1(Math.ceil(c.n / c.cols) * fh) + "px";
      mascot.style.backgroundPosition =
        f1(-(fi % c.cols) * fw) + "px " + f1(-Math.floor(fi / c.cols) * fh) + "px";
      mascot.style.transformOrigin = f1(fw / 2) + "px " + f1(c.feet * kk) + "px";
      mascot.style.transform =
        "translate3d(" +
        f1(left) +
        "px," +
        f1(top) +
        "px,0) rotate(" +
        tilt.toFixed(3) +
        "rad) scaleY(" +
        squash.toFixed(3) +
        ")";
    }
    if (contact) {
      // Soft contact shadow on the blanket while it stands on it.
      var grounded = held
        ? 0
        : clamp01(1 - (ground - feet) / (S * 0.25)) * (t < 2.85 ? 1 : 1 - span(t, 2.85, 3.3));
      contact.style.width = f1(S * 0.62 * sc) + "px";
      contact.style.transform =
        "translate3d(" + f1(cx - S * 0.31 * sc) + "px," + f1(feet - S * 0.05 * sc) + "px,0)";
      contact.style.opacity = String(0.9 * grounded);
    }

    // The blanket's top edge: at the top until grabbed, then held in the hands. While tugging the
    // sides stay pinned higher (it sags only where it is held); in the full pull they trail behind.
    var hold = c.span * kk * (raised ? 1.12 : 1);
    var pts: number[][] = [];
    var reach = Math.max(1, Math.max(cx, W - cx) - hold);
    for (var s = 0; s <= SAMPLES; s++) {
      var x = (W * s) / SAMPLES;
      var dd = clamp01((Math.abs(x - cx) - hold) / reach);
      var drape = dd * dd * (3 - 2 * dd);
      var y = 0;
      if (edge > 0) {
        if (t < PULL) y = edge * (1 - 0.9 * drape) + Math.sin(dd * 7) * 2 * dd;
        else y = edge - lag * drape + Math.sin(dd * 9 - phase * 4.4) * 5 * dd;
      }
      pts.push([x, y]);
    }
    var poly = "polygon(";
    for (var jj = 0; jj < pts.length; jj++)
      poly += f1(pts[jj]![0]!) + "px " + f1(Math.max(-10, pts[jj]![1]!)) + "px,";
    poly += W + "px " + (H + 10) + "px,0px " + (H + 10) + "px)";
    if (curtain) curtain.style.clipPath = poly;
    // What is printed on the blanket travels with it.
    if (print) print.style.transform = "translate3d(0," + f1(Math.max(0, edge - lag * 0.5)) + "px,0)";

    var visible = edge > 1;
    var line = hemPath(pts, 0);
    if (clip) clip.setAttribute("d", line + "L" + W + " " + (H + 20) + "L0 " + (H + 20) + "Z");
    if (hem) hem.setAttribute("d", visible ? line : "");
    if (hemShadow) hemShadow.setAttribute("d", visible ? hemPath(pts, -5) : "");
    if (lift) lift.setAttribute("d", visible ? hemPath(pts, 14) : "");
    if (shine) shine.setAttribute("d", visible ? hemPath(pts, -3) : "");
    if (stitch) stitch.setAttribute("d", visible ? hemPath(pts, 7) : "");

    // Tension folds in the blanket, fanning down and out from the hands.
    var sh = "";
    var li = "";
    if (visible) {
      var len = Math.max(150, S * 0.9);
      for (var side = -1; side <= 1; side += 2) {
        for (var f = 0; f < 6; f++) {
          var st = cx + side * hold * (0.15 + 0.85 * (f / 6));
          var a = (0.25 + 0.9 * (f / 5)) * side;
          var ex = st + Math.sin(a) * len * 1.25;
          var ey = edge + Math.cos(a) * len * (0.9 + 0.1 * (f % 2));
          var half = 6 + f * 2.4;
          var sy = edge + 6;
          var path =
            "M" +
            f1(st - half) +
            " " +
            f1(sy) +
            "Q" +
            f1((st + ex) / 2) +
            " " +
            f1((sy + ey) / 2 + 8) +
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
    }
    var tension = visible ? Math.min(1, 0.5 + lag / 60) : 0;
    if (shade) {
      shade.setAttribute("d", sh);
      shade.setAttribute("opacity", String(0.2 * tension));
    }
    if (light) {
      light.setAttribute("d", li);
      light.setAttribute("opacity", String(0.7 * tension));
    }
    if (skip) skip.style.opacity = String(t < PULL ? 1 : clamp01((H * 0.82 - edge) / 120));
    // Sweat drops and effort marks beside the head while it strains.
    if (effort) {
      effort.style.opacity = String(straining);
      effort.style.width = f1(fw) + "px";
      effort.style.height = f1(fh * 0.45) + "px";
      effort.style.transform =
        "translate3d(" +
        f1(left) +
        "px," +
        f1(top + Math.sin(t * 9) * 2) +
        "px,0) scale(" +
        (1 + 0.04 * Math.sin(t * 18)).toFixed(3) +
        ")";
    }

    if (t >= END) {
      finish();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/* eslint-enable no-var */

export function introRunnerScript(key: string): string {
  const config: RunnerConfig = { sprite: INTRO_SPRITE, key, ...sheet };
  return `(${run.toString()})(${JSON.stringify(config)});`;
}

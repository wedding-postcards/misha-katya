// Page-fold geometry adapted from the user-supplied New Zealand sketchbook by Ann Nguyen.
// Acrylic painting is intentionally excluded; each scrapbook leaf is rasterized once on demand.
window.createBookEngine=function(options){
 const {canvas,spreads:SPREADS}=options,ctx=canvas.getContext('2d');
 const PH=1.3,PAPER='#faf7f0',LAST=SPREADS.length-1;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),easeOut=t=>1-(1-t)**3,easeInOut=t=>t<.5?4*t*t*t:1-(-2*t+2)**3/2;
 const makeCanvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
 let reduceMotion=motionPreference.matches;
 motionPreference.addEventListener('change',e=>{reduceMotion=e.matches;if(reduceMotion&&mode==='anim'){cancelAnimationFrame(raf);raf=0;startAnim(flip.anim.complete);}});
 let vw=0,vh=0,dpr=1,active=true,resolution=0;
 const geo={x0:0,y0:0,W:1},pages=SPREADS.map(()=>null);
 function ensure(i){if(!active||!resolution||i<0||i>LAST||pages[i])return;pages[i]=options.drawSpread(i,resolution);}
 function drop(i){if(!pages[i])return;for(const c of Object.values(pages[i]))if(c){c.width=1;c.height=1;}pages[i]=null;}
 function clearPages(){for(let i=0;i<pages.length;i++)drop(i);}
 function warm(){if(!active||!resolution)return;for(let i=0;i<pages.length;i++)if(Math.abs(i-index)>1)drop(i);ensure(index);ensure(index-1);ensure(index+1);}
 function onChange(){warm();options.onChange?.(index);options.onBusy?.(false);}
 function layout(){
  if(!active)return;
  stopInteraction(true);
  vw=innerWidth;vh=innerHeight;dpr=Math.min(1.75,devicePixelRatio||1);
  canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);
  const side=vw<=600?14:vw<=900?28:55;
  const top=vw<=760?72:77,bottom=vw<=760?112:133;
  const availableHeight=Math.max(1,vh-top-bottom);
  geo.W=Math.max(1,Math.min((vw-side*2)/2,availableHeight/PH,620));
  geo.x0=(vw-geo.W*2)/2;
  geo.y0=top+Math.max(0,(availableHeight-geo.W*PH)/2);
  const n=Math.min(1050,Math.ceil(geo.W*dpr/50)*50);
  if(n!==resolution){resolution=n;clearPages();}
  warm();render();options.onLayout?.({...geo});options.onBusy?.(false);
 }
  let index = 0;
  let mode = 'idle';     // idle | drag | anim
  let flip = null;       // { dir, C:[x,y] corner, P:[x,y] where that corner is now, anim? }
  let drag = null;
  const queue = [];

  const canTurn = dir => (dir > 0 ? index < LAST : index > 0);
  // the covers are hard boards that swing on the spine instead of curling
  const isHard = dir => (dir > 0 ? index === 0 || index === LAST - 1 : index === 1 || index === LAST);
  // a closed book sits in the middle; it slides over as the cover opens
  const restShift = i => (i === 0 ? -1 : i === LAST ? 1 : 0) * geo.W / 2;
  const bx = () => {
    const a = restShift(index);
    if (!flip) return geo.x0 + a;
    const t = progress(), e = t * t * (3 - 2 * t);
    return geo.x0 + a + (restShift(index + flip.dir) - a) * e;
  };
  const spineX = () => bx() + geo.W;
  const toLocal = (pt, dir) => [dir * (pt[0] - spineX()) / geo.W, (pt[1] - geo.y0) / geo.W];

  // keep the spine flat: the lifted corner can't pull further than paper allows
  function constrain(P, C) {
    const S1 = [0, C[1]], S2 = [0, PH - C[1]], D = Math.hypot(1, PH);
    let [x, y] = P;
    for (let i = 0; i < 3; i++) {
      let dx = x - S1[0], dy = y - S1[1], d = Math.hypot(dx, dy);
      if (d > 1) { x = S1[0] + dx / d; y = S1[1] + dy / d; }
      dx = x - S2[0]; dy = y - S2[1]; d = Math.hypot(dx, dy);
      if (d > D) { x = S2[0] + dx / d * D; y = S2[1] + dy / d * D; }
    }
    return [x, y];
  }

  function foldOf(f) {
    const dx = f.C[0] - f.P[0], dy = f.C[1] - f.P[1], len = Math.hypot(dx, dy);
    if (len < 1e-4) return null;
    return { n: [dx / len, dy / len], M: [(f.C[0] + f.P[0]) / 2, (f.C[1] + f.P[1]) / 2], len };
  }
  function reflectPt(X, f) {
    const d = (X[0] - f.M[0]) * f.n[0] + (X[1] - f.M[1]) * f.n[1];
    return [X[0] - 2 * d * f.n[0], X[1] - 2 * d * f.n[1]];
  }

  // paper grabbed at G is now under the finger at Q: fold along their perpendicular bisector
  function foldFromGrab(G, Q, C) {
    const dx = G[0] - Q[0], dy = G[1] - Q[1], L = Math.hypot(dx, dy);
    if (L < 1e-5) return null;
    const n = [dx / L, dy / L], M = [(G[0] + Q[0]) / 2, (G[1] + Q[1]) / 2];
    const d = (C[0] - M[0]) * n[0] + (C[1] - M[1]) * n[1];
    if (d <= 0) return null;
    return { C, P: constrain([C[0] - 2 * d * n[0], C[1] - 2 * d * n[1]], C) };
  }

  function progress() {
    if (!flip) return 0;
    if (flip.hard) return flip.t / Math.PI;
    return clamp((flip.C[0] - flip.P[0]) / 2, 0, 1);
  }

  // ---------- animation ----------
  function startAnim(complete, o = {}) {
    if (reduceMotion) { const dir=flip.dir; flip=null; mode='idle'; if(complete) index+=dir; onChange(); while(queue.length&&!canTurn(queue[0]))queue.shift(); if(queue.length)tapTurn(queue.shift(),PH); else render(); return; }
    options.onBusy?.(true);
    if (flip.hard) {
      const to = complete ? Math.PI : 0, from = flip.t;
      let dur = o.dur ?? (180 + 640 * Math.abs(to - from) / Math.PI);
      if (reduceMotion) dur *= .6;
      flip.anim = { from, to, t0: performance.now(), dur, complete, ease: o.ease || easeOut };
      mode = 'anim';
      kick();
      return;
    }
    const C = flip.C;
    const to = complete ? [-C[0], C[1]] : C.slice();
    const from = flip.P.slice();
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    let dur = o.dur ?? (150 + 470 * Math.min(1, dist / 2));
    if (reduceMotion) dur *= .6;
    flip.anim = { from, to, t0: performance.now(), dur, lift: o.lift || 0, complete, ease: o.ease || easeOut };
    mode = 'anim';
    kick();
  }

  function tapTurn(dir, cornerY) {
    ensure(index + dir);
    if (!canTurn(dir)) { if (mode !== 'anim') { flip = null; mode = 'idle'; render(); } return; }
    if (isHard(dir)) {
      if (!flip || flip.dir !== dir || !flip.hard) flip = { dir, hard: true, t: 0 };
      startAnim(true, { ease: easeInOut, dur: queue.length ? 560 : 1000 });
      return;
    }
    const flat = !flip || flip.dir !== dir || Math.hypot(flip.P[0] - flip.C[0], flip.P[1] - flip.C[1]) < 1e-3;
    if (flat) flip = { dir, C: [1, cornerY], P: [1, cornerY] };
    const quick = queue.length > 0;
    startAnim(true, { lift: flip.C[1] > 0 ? -.3 : .3, ease: easeInOut, dur: quick ? (queue.length > 2 ? 340 : 440) : 820 });
  }

  function stepAnim(now) {
    const a = flip.anim;
    const t = Math.min(1, (now - a.t0) / a.dur);
    const e = a.ease(t);
    if (flip.hard) {
      flip.t = a.from + (a.to - a.from) * e;
    } else {
      const x = a.from[0] + (a.to[0] - a.from[0]) * e;
      const y = a.from[1] + (a.to[1] - a.from[1]) * e + a.lift * Math.sin(Math.PI * e);
      flip.P = constrain([x, y], flip.C);
    }
    if (t < 1) return;
    const done = a.complete, dir = flip.dir;
    flip = null; mode = 'idle';
    options.onBusy?.(false);
    if (done) { index += dir; onChange(); }
    while (queue.length && !canTurn(queue[0])) queue.shift();
    if (queue.length) tapTurn(queue.shift(), PH);
  }

  function finishAnimNow() {
    queue.length = 0;
    if (mode === 'anim' && flip && flip.anim) { flip.anim.t0 = -1e9; stepAnim(performance.now()); }
  }

  function turn(dir) {
    if (!active || options.isBlocked?.()) return;
    if (mode === 'drag') return;
    if (mode === 'anim') { if (queue.length < 4) queue.push(dir); return; }
    tapTurn(dir, PH);
  }

  function goTo(target) {
    if (!active || options.isBlocked?.() || !Number.isFinite(target)) return;
    target = clamp(Math.round(target), 0, LAST);
    if (reduceMotion) { setIndex(target); return; }
    if (mode === 'drag') return;
    let at = index;
    if (mode === 'anim' && flip && flip.anim.complete) at += flip.dir;
    queue.length = 0;
    const dir = Math.sign(target - at);
    for (let i = 0; i < Math.abs(target - at); i++) queue.push(dir);
    if (mode !== 'anim' && queue.length) tapTurn(queue.shift(), PH);
  }

  // ---------- render loop ----------
  let raf = 0;
  function kick() {
    if (active && !raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    if (mode === 'anim') stepAnim(now);
    render();
    if (active && mode === 'anim' && !raf) raf = requestAnimationFrame(tick);
  }

  // ==========================================================================
  // Drawing the book
  // ==========================================================================
  let blank = null;
  function drawPage(img, side) {
    const x = side === 'L' ? bx() : bx() + geo.W;
    if (img) { ctx.drawImage(img, x, geo.y0, geo.W, geo.W * PH); return; }
    if (img === null) return;
  }
  function pageOf(i, side) {
    const sp = pages[i];
    const def = SPREADS[i];
    const exists = side === 'L' ? def.kind !== 'cover' : def.kind !== 'back';
    if (!exists) return null;
    if (sp && sp[side]) return sp[side];
    if (!blank) { blank = makeCanvas(40, 48); const b = blank.getContext('2d'); b.fillStyle = PAPER; b.fillRect(0, 0, 40, 48); }
    return blank;
  }

  function tracePoly(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function clipPoly(pts) { ctx.beginPath(); tracePoly(pts); ctx.clip(); }

  function clipHalf(poly, M, n, sign) {
    const out = [];
    const f = q => sign * ((q[0] - M[0]) * n[0] + (q[1] - M[1]) * n[1]);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }

  const mul = (m, k) => [
    m[0] * k[0] + m[2] * k[1], m[1] * k[0] + m[3] * k[1],
    m[0] * k[2] + m[2] * k[3], m[1] * k[2] + m[3] * k[3],
    m[0] * k[4] + m[2] * k[5] + m[4], m[1] * k[4] + m[3] * k[5] + m[5],
  ];

  // a page's outline: rounded on the outer corners, square along the spine (same curve as finishPage)
  function pagePath(x, y, w, h, side) {
    const rad = w * .03, pth = new Path2D();
    const l = side === 'L' ? rad : 0, rr = side === 'R' ? rad : 0;
    pth.moveTo(x + l, y);
    pth.lineTo(x + w - rr, y);
    if (rr) pth.quadraticCurveTo(x + w, y, x + w, y + rr);
    pth.lineTo(x + w, y + h - rr);
    if (rr) pth.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    pth.lineTo(x + l, y + h);
    if (l) pth.quadraticCurveTo(x, y + h, x, y + h - l);
    pth.lineTo(x, y + l);
    if (l) pth.quadraticCurveTo(x, y, x + l, y);
    pth.closePath();
    return pth;
  }

  function halfShadow(side, a) {
    if (a < .02) return;
    const W = geo.W, H = W * PH;
    const stack = clamp(side === 'L' ? index : LAST - index, 1, 3);
    const off = stack * Math.max(1, W * .0032);
    const x = (side === 'L' ? bx() : bx() + W) + (side === 'L' ? -off : off);
    const page = pagePath(x, geo.y0 + off * .7, W, H, side);
    const outside = new Path2D();
    outside.rect(0, 0, vw, vh);
    outside.addPath(page);
    ctx.save();
    ctx.clip(outside, 'evenodd');
    ctx.fillStyle = '#000';
    ctx.shadowColor = `rgba(10,8,6,${.3 * a})`; ctx.shadowBlur = 19 * dpr; ctx.shadowOffsetX = 2 * dpr; ctx.shadowOffsetY = 7 * dpr;
    ctx.fill(page);
    ctx.shadowColor = `rgba(10,8,6,${.55 * a})`; ctx.shadowBlur = 3 * dpr; ctx.shadowOffsetX = 1 * dpr; ctx.shadowOffsetY = 2 * dpr;
    ctx.fill(page);
    ctx.restore();
  }

  function pageStack(side, n, cover) {
    const W = geo.W, H = W * PH;
    const x = side === 'L' ? bx() : bx() + W;
    for (let k = n; k >= 1; k--) {
      const off = k * Math.max(1, W * .0032);
      const sx = side === 'L' ? x - off : x + off;
      ctx.fillStyle = cover && k === n ? '#e4d8c8' : (k % 2 ? '#e9e2d4' : '#f1ebdf');
      ctx.fill(pagePath(sx, geo.y0 + off * .7, W, H, side));
    }
  }

  function render() {
    if (!active) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    const W = geo.W, H = W * PH, sx = spineX(), y0 = geo.y0;
    const pr = progress();
    const nextI = flip ? index + flip.dir : index;
    const has = (i, side) => (side === 'L' ? SPREADS[i].kind !== 'cover' : SPREADS[i].kind !== 'back');
    const presence = side => {
      const now = has(index, side), next = has(nextI, side);
      if (now && next) return 1;
      // a board swinging away carries its own shadow; a halo left behind would outline a ghost page
      if (now) return 0;
      // the halo only arrives with the page, or it outlines an empty ghost page
      if (!next) return 0;
      const t = clamp((pr - .86) / .14, 0, 1);
      return t * t * (3 - 2 * t);
    };
    const la = presence('L'), ra = presence('R');

    halfShadow('L', la);
    halfShadow('R', ra);
    // page edges only where paper stays put; a cover swinging shut has nothing beneath it
    const keeps = side => has(index, side) && has(nextI, side);
    if (keeps('L')) pageStack('L', clamp(index, 1, 3), index === LAST);
    if (keeps('R')) pageStack('R', clamp(LAST - index, 1, 3), index === 0);

    if (flip && flip.hard) { renderHard(); return; }
    const f = flip && foldOf(flip);
    if (!f) {
      drawPage(pageOf(index, 'L'), 'L');
      drawPage(pageOf(index, 'R'), 'R');
      if (has(index, 'L') && has(index, 'R')) crease();
      return;
    }

    const s = flip.dir;
    const turnSide = s > 0 ? 'R' : 'L', otherSide = s > 0 ? 'L' : 'R';
    const turning = pageOf(index, turnSide);
    const stat = pageOf(index, otherSide);
    const verso = pageOf(nextI, otherSide);
    const revealed = pageOf(nextI, turnSide);

    const rect = [[0, 0], [1, 0], [1, PH], [0, PH]];
    const flapL = clipHalf(rect, f.M, f.n, 1);
    const fixedL = clipHalf(rect, f.M, f.n, -1);
    const toS = q => [sx + s * q[0] * W, y0 + q[1] * W];
    const sm = t => t * t * (3 - 2 * t);
    const fade = sm(clamp(f.len / .45, 0, 1)) * sm(clamp((2 - f.len) / .45, 0, 1));
    const Ms = toS(f.M), ns = [s * f.n[0], f.n[1]];

    drawPage(stat, otherSide);
    drawPage(revealed, turnSide);

    // the lifted page throws a soft shadow onto the page underneath
    if (revealed && flapL.length > 2) {
      ctx.save();
      clipPoly(flapL.map(toS));
      const Ls = Math.min(.32, f.len * .5 + .04) * W;
      const gr = ctx.createLinearGradient(Ms[0], Ms[1], Ms[0] + ns[0] * Ls, Ms[1] + ns[1] * Ls);
      gr.addColorStop(0, `rgba(40,28,22,${.34 * fade})`);
      gr.addColorStop(1, 'rgba(40,28,22,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
    }

    if (fixedL.length > 2) {
      ctx.save();
      clipPoly(fixedL.map(toS));
      drawPage(turning, turnSide);
      ctx.restore();
    }
    if (stat && (revealed || fixedL.length > 2)) crease();

    if (flapL.length < 3) return;
    const flapS = flapL.map(q => toS(reflectPt(q, f)));

    // drop shadow around the flap
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vw, vh); tracePoly(flapS); ctx.clip('evenodd');
    ctx.fillStyle = '#000';
    ctx.shadowColor = `rgba(40,28,22,${.3 * fade})`; ctx.shadowBlur = 22 * dpr;
    ctx.beginPath(); tracePoly(flapS); ctx.fill();
    ctx.restore();

    // back of the turning page, mirrored across the fold
    if (verso) {
      ctx.save();
      clipPoly(flapS);
      const vx = s > 0 ? bx() : bx() + W;
      const k = W / verso.width;
      const nx = f.n[0], ny = f.n[1], md = 2 * (f.M[0] * nx + f.M[1] * ny);
      const T = mul([s * W, 0, 0, W, sx, y0],
        mul([1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, md * nx, md * ny],
          mul([-1, 0, 0, 1, 0, 0],
            mul([1 / (s * W), 0, 0, 1 / W, -sx / (s * W), -y0 / W],
              [k, 0, 0, k, vx, y0]))));
      ctx.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
      ctx.drawImage(verso, 0, 0);
      ctx.restore();

      // curl shading on the flap
      ctx.save();
      clipPoly(flapS);
      const Lf = Math.min(.5, f.len * .5 + .05) * W;
      const gr = ctx.createLinearGradient(Ms[0], Ms[1], Ms[0] - ns[0] * Lf, Ms[1] - ns[1] * Lf);
      gr.addColorStop(0, `rgba(30,20,15,${.2 * fade})`);
      gr.addColorStop(.1, `rgba(30,20,15,${.06 * fade})`);
      gr.addColorStop(.4, `rgba(255,255,255,${.05 * fade})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
    }
  }

  // a rigid board swinging on the spine, drawn in thin strips so it foreshortens with perspective
  let boardBuf = null;
  function renderHard() {
    const s = flip.dir, th = flip.t, W = geo.W, H = W * PH, sx = spineX(), cy = geo.y0 + H / 2;
    const nextI = index + s;
    const turnSide = s > 0 ? 'R' : 'L', otherSide = s > 0 ? 'L' : 'R';
    const front = pageOf(index, turnSide), back = pageOf(nextI, otherSide);
    const stat = pageOf(index, otherSide), under = pageOf(nextI, turnSide);
    const c = Math.cos(th), sn = Math.sin(th);

    drawPage(stat, otherSide);
    drawPage(under, turnSide);
    const shade = (side, a) => {
      if (a < .01) return;
      const d = side === 'R' ? 1 : -1;
      const gr = ctx.createLinearGradient(sx, 0, sx + d * W * .85, 0);
      gr.addColorStop(0, `rgba(40,28,22,${a})`);
      gr.addColorStop(1, 'rgba(40,28,22,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(d > 0 ? sx : sx - W, geo.y0, W, H);
    };
    if (under) shade(turnSide, .3 * sn * (c > 0 ? 1 : .45));
    if (stat) shade(otherSide, .3 * sn * (c < 0 ? 1 : .45));
    if (stat && under) crease();

    const img = c >= 0 ? front : back;
    const side = c >= 0 ? turnSide : otherSide;
    if (!img) return;
    const D = 8;
    const proj = u => { const f = D / (D - sn * u); return [sx + s * c * u * f * W, f]; };
    const [xo, fo] = proj(1);

    // paint the board into its own layer so shading and shadow follow its rounded corners
    const minX = Math.floor(Math.min(sx, xo)) - 2, maxX = Math.ceil(Math.max(sx, xo)) + 2;
    const minY = Math.floor(cy - H / 2 * Math.max(1, fo)) - 2, maxY = Math.ceil(cy + H / 2 * Math.max(1, fo)) + 2;
    const bw = Math.max(1, Math.ceil((maxX - minX) * dpr)), bh = Math.max(1, Math.ceil((maxY - minY) * dpr));
    if (!boardBuf) boardBuf = makeCanvas(bw, bh);
    if (boardBuf.width < bw || boardBuf.height < bh) {
      boardBuf.width = Math.max(bw, boardBuf.width);
      boardBuf.height = Math.max(bh, boardBuf.height);
    }
    const b = boardBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, bw, bh);
    b.setTransform(dpr, 0, 0, dpr, -minX * dpr, -minY * dpr);
    b.imageSmoothingEnabled = true;
    b.imageSmoothingQuality = 'high';
    const N = 80, iw = img.width, ih = img.height;
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      const x0 = proj(u0)[0], x1 = proj(u1)[0];
      const dw = Math.abs(x1 - x0);
      if (dw < .05) continue;
      const fm = D / (D - sn * (u0 + u1) / 2), hh = H * fm;
      const s0 = (side === 'R' ? u0 : 1 - u0) * iw, s1 = (side === 'R' ? u1 : 1 - u1) * iw;
      b.drawImage(img, Math.min(s0, s1), 0, Math.max(1, Math.abs(s1 - s0)), ih, Math.min(x0, x1) - .4, cy - hh / 2, dw + .8, hh);
    }
    // it darkens a little as it turns away from the light
    b.globalCompositeOperation = 'source-atop';
    b.fillStyle = `rgba(30,20,15,${.2 * sn * sn})`;
    b.fillRect(minX, minY, maxX - minX, maxY - minY);
    b.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.shadowColor = `rgba(10,8,6,${.28 + .1 * sn})`;
    ctx.shadowBlur = (18 + 18 * sn) * dpr;
    ctx.shadowOffsetX = 2 * dpr;
    ctx.shadowOffsetY = (7 + 8 * sn) * dpr;
    ctx.drawImage(boardBuf, 0, 0, bw, bh, minX, minY, bw / dpr, bh / dpr);
    ctx.restore();
  }

  function crease() {
    const x = spineX(), H = geo.W * PH;
    ctx.save();
    ctx.fillStyle = 'rgba(70,50,40,.22)';
    ctx.fillRect(x - .6, geo.y0, 1.2, H);
    ctx.restore();
  }

  // ==========================================================================
  // Input
  // ==========================================================================
  function hitTest(pt) {
    const W = geo.W, lx = (pt[0] - spineX()) / W, ly = (pt[1] - geo.y0) / W;
    if (ly < -.04 || ly > PH + .04) return null;
    if (lx >= 0 && lx < 1.06 && canTurn(1)) return { dir: 1, x: Math.min(lx, 1), y: clamp(ly, 0, PH) };
    if (lx < 0 && lx > -1.06 && canTurn(-1)) return { dir: -1, x: Math.min(-lx, 1), y: clamp(ly, 0, PH) };
    return null;
  }

  // hovering only changes the cursor; the paper stays still until it's taken
  function hover(pt) {
    if (mode !== 'idle') return;
    canvas.style.cursor = hitTest(pt) ? 'grab' : '';
  }

  function updateFromDrag(Xl) {
    if (flip.hard) {
      flip.t = Math.acos(clamp(Xl[0] / flip.grab, -1, 1));
      kick();
      return;
    }
    const Q = [Xl[0] + drag.shift, Xl[1]];
    const res = foldFromGrab(drag.G, Q, flip.C);
    if (res) { flip.C = res.C; flip.P = res.P; }
    else flip.P = flip.C.slice();
    kick();
  }

  canvas.addEventListener('pointerdown', e => {
    if (!active || options.isBlocked?.() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (drag) return;
    if (mode === 'anim') finishAnimNow();
    const pt = [e.clientX, e.clientY];
    const hit = hitTest(pt);
    if (!hit) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    const Xl = toLocal(pt, hit.dir);
    let G = [Math.min(1, Xl[0]), clamp(Xl[1], 0, PH)];
    const shift = Math.max(0, .6 - G[0]);
    G = [G[0] + shift, G[1]];
    if (isHard(hit.dir)) {
      flip = { dir: hit.dir, hard: true, t: 0, grab: Math.max(.45, G[0] - shift) };
    } else {
      const C = [1, G[1] < PH / 2 ? 0 : PH];
      flip = { dir: hit.dir, C, P: C.slice() };
    }
    const now = performance.now();
    drag = { id: e.pointerId, dir: hit.dir, G, shift, start: pt, t0: now, samples: [[now, pt[0]]], moved: false, tapY: hit.y };
    mode = 'drag';
    options.onBusy?.(true);
    canvas.style.cursor = 'grabbing';
    updateFromDrag(Xl);
  });

  canvas.addEventListener('pointermove', e => {
    if (!active || options.isBlocked?.()) { if (drag) stopInteraction(false); return; }
    const pt = [e.clientX, e.clientY];
    if (drag && e.pointerId === drag.id) {
      const now = performance.now();
      drag.samples.push([now, pt[0]]);
      while (drag.samples.length > 2 && now - drag.samples[0][0] > 110) drag.samples.shift();
      if (Math.hypot(pt[0] - drag.start[0], pt[1] - drag.start[1]) > 6) drag.moved = true;
      updateFromDrag(toLocal(pt, drag.dir));
      return;
    }
    if (e.pointerType === 'mouse') hover(pt);
  });

  function release(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    canvas.style.cursor = '';
    const pt = [e.clientX, e.clientY];
    const dt = performance.now() - d.t0;
    if (!cancelled && !d.moved && dt < 500) {
      queue.length = 0;
      mode = 'idle';
      tapTurn(d.dir, d.tapY < PH / 2 ? 0 : PH);
      return;
    }
    // screen-space velocity, flipped into this page's outward direction
    let v = 0;
    const s = d.samples;
    if (s.length > 1) {
      const span = (s[s.length - 1][0] - s[0][0]) / 1000;
      if (span > .001) v = d.dir * (s[s.length - 1][1] - s[0][1]) / span / geo.W;
    }
    const flat = flip.hard ? flip.t < 1e-3 : Math.hypot(flip.P[0] - flip.C[0], flip.P[1] - flip.C[1]) < 1e-3;
    // swiping across a page the "wrong" way still turns the book that way
    const dx = (pt[0] - d.start[0]) * d.dir;
    if (flat && !cancelled && dx > 40 && canTurn(-d.dir)) {
      flip = null; mode = 'idle';
      tapTurn(-d.dir, PH);
      return;
    }
    const past = flip.hard ? flip.t > Math.PI / 2 : flip.P[0] < .05;
    const complete = !cancelled && (v < -1.1 || (v < 1.1 && past));
    startAnim(complete);
  }
  canvas.addEventListener('pointerup', e => release(e, false));
  canvas.addEventListener('pointercancel', e => release(e, true));
  canvas.addEventListener('lostpointercapture', e => release(e,true));

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || options.isBlocked?.() || /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    if (!active) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); turn(1); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); turn(-1); }
    else if (k === 'Home') { e.preventDefault(); goTo(0); }
    else if (k === 'End') { e.preventDefault(); goTo(LAST); }
  });


 function stopInteraction(finish){if(finish)finishAnimNow();cancelAnimationFrame(raf);raf=0;const pointerId=drag?.id;drag=null;flip=null;mode='idle';queue.length=0;canvas.style.cursor='';if(pointerId!==undefined){try{canvas.releasePointerCapture(pointerId);}catch{}}options.onBusy?.(false);}
 function invalidate(){stopInteraction(false);clearPages();if(active){warm();render();}}
 function setIndex(i){if(!Number.isFinite(i))return;stopInteraction(false);index=clamp(Math.round(i),0,LAST);onChange();if(active)render();}
 return {resize:layout,invalidate,turn,goTo,setIndex,setActive(v){const next=Boolean(v);if(next===active&&(!next||resolution))return;active=next;if(active)layout();else{stopInteraction(true);clearPages();if(boardBuf){boardBuf.width=1;boardBuf.height=1;boardBuf=null;}canvas.width=1;canvas.height=1;}},getBusy:()=>mode!=='idle',getIndex:()=>index,getLayout:()=>({...geo}),getCache:()=>pages.filter(Boolean).length};
};

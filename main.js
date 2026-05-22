/* =========================================================
   Underneath - stacking puzzle
   Matter.js now handles the light rigid-body physics.
   The artwork still owns rendering, drop assistance, stack
   detection, and the door/gate sequence.
   ========================================================= */

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const timerEl = document.getElementById("timer");
const fill = document.getElementById("timerFill");
const tText = document.getElementById("timerText");
const gate = document.getElementById("gate");
const resetBtn = document.getElementById("reset");
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/* ---------- Hint system ----------
   Keep the opening poetic, then reveal the mechanic plainly.
   The only state-based hint is the real hold condition. */
const hintEl = document.getElementById("hint");

const HINTS = {
  start: "create something",
  stack: "stack them",
  order: "heaviest first",
  hold: "hold it steady",
};

const hintState = {
  timers: [],
  holding: false,
};

function setHint(text) {
  if (!hintEl || hintEl.textContent === text) return;
  hintEl.style.opacity = "0";
  window.setTimeout(() => {
    hintEl.textContent = text;
    hintEl.style.opacity = "";
  }, 300);
}

function clearHintTimers() {
  for (const timer of hintState.timers) window.clearTimeout(timer);
  hintState.timers = [];
}

function scheduleHint(text, delay) {
  const timer = window.setTimeout(() => {
    if (won) return;
    if (!hintState.holding) setHint(text);
  }, delay);
  hintState.timers.push(timer);
}

function resetHints() {
  clearHintTimers();
  hintState.holding = false;
  setHint(HINTS.start);
  scheduleHint(HINTS.stack, 4000);
  scheduleHint(HINTS.order, 10000);
}

resetHints();

if (!window.Matter) {
  document.getElementById("hint").textContent = "Physics library missing";
  throw new Error("Matter.js must be loaded before main.js");
}

const {
  Body,
  Bodies,
  Composite,
  Engine,
  Query,
  Sleeping,
} = Matter;

/* ---------- Palette cache ---------- */
const P = {};
function cachePalette() {
  const s = getComputedStyle(document.documentElement);
  P.ink = s.getPropertyValue("--ink").trim();
  P.muted = s.getPropertyValue("--muted").trim();
  P.hair = s.getPropertyValue("--hair").trim();
  P.red = s.getPropertyValue("--red").trim();
  P.blue = s.getPropertyValue("--blue").trim();
  P.green = s.getPropertyValue("--green").trim();
}

function bodyColor(b) {
  const color = b.plugin.color;
  if (color === "--green") return P.green;
  if (color === "--blue") return P.blue;
  if (color === "--red") return P.red;
  return color;
}

/* ---------- Stack detection config ---------- */
const STACK = {
  groundTol: 34,
  ciSqYTol: 50,
  ciSqXTol: 50,
  trCiYTol: 56,
  trCiXTol: 54,
  restV: 2.6,
  restW: 0.08,
};

const SNAP = {
  baseY: 120,
  bodyY: 150,
  bodyX: 120,
};

/* ---------- Viewport ---------- */
let W = 0;
let H = 0;
let DPR = 1;

function resize() {
  cachePalette();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width = W * DPR;
  cv.height = H * DPR;
  cv.style.width = W + "px";
  cv.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layoutDoor();
  rebuildBounds();
  keepBodiesInView();
}
window.addEventListener("resize", resize);

/* ---------- Door ---------- */
const door = { x: 0, y: 0, w: 120, h: 280, opening: 0, zoom: 0 };

function groundY() {
  return H - clamp(H * 0.18, 92, 130);
}

function layoutDoor() {
  door.w = clamp(W * 0.13, 68, 130);
  door.h = clamp(H * 0.42, 210, 310);
  door.x = Math.round(clamp(W * 0.66, 48, W - door.w - 24));
  door.y = groundY() - door.h;
}

/* ---------- Matter world ---------- */
const engine = Engine.create({
  enableSleeping: true,
  positionIterations: 12,
  velocityIterations: 10,
  constraintIterations: 4,
});
engine.gravity.y = 1.85;

let bodies = [];
let bounds = [];
let dragging = null;
let pointer = { x: 0, y: 0, prevX: 0, prevY: 0 };
let activePointerId = null;

function shapeScale() {
  return clamp(Math.min(W, H) / 760, 0.68, 1);
}

function physicsOptions(type, mass) {
  return {
    label: type,
    friction: 0.86,
    frictionStatic: 1.2,
    frictionAir: 0.001,
    restitution: 0,
    slop: 0.04,
    density: 0.001 * mass,
  };
}

function tagBody(body, meta) {
  body.plugin = Object.assign(body.plugin || {}, meta);
  Body.setMass(body, meta.mass);
  return body;
}

function makeTriangle(x, y, r, opts) {
  const verts = [
    { x: 0, y: -r },
    { x: r * 0.866, y: r * 0.5 },
    { x: -r * 0.866, y: r * 0.5 },
  ];
  return Bodies.fromVertices(x, y, [verts], opts, true);
}

function createBodies() {
  const gy = groundY();
  const s = shapeScale();
  const xs =
    W < 620 ? [W * 0.26, W * 0.5, W * 0.74] : [W * 0.2, W * 0.36, W * 0.5];

  const sq = tagBody(
    Bodies.rectangle(xs[0], gy - 50 * s, 100 * s, 100 * s, physicsOptions("square", 2.0)),
    {
      type: "square",
      color: "--green",
      hw: 50 * s,
      hh: 50 * s,
      mass: 2.0,
    },
  );

  const ci = tagBody(
    Bodies.circle(xs[1], gy - 44 * s, 44 * s, physicsOptions("circle", 1.4), 48),
    {
      type: "circle",
      color: "--blue",
      r: 44 * s,
      mass: 1.4,
    },
  );

  const tr = tagBody(makeTriangle(xs[2], gy - 46 * s, 54 * s, physicsOptions("triangle", 1.0)), {
    type: "triangle",
    color: "--red",
    R: 54 * s,
    mass: 1.0,
  });

  bodies = [sq, ci, tr];
  Composite.add(engine.world, bodies);
}

function rebuildBounds() {
  if (!engine.world) return;
  if (bounds.length) Composite.remove(engine.world, bounds);

  const gy = groundY();
  bounds = [
    Bodies.rectangle(W / 2, gy + 100, Math.max(W + 400, 800), 200, {
      isStatic: true,
      friction: 0.95,
      restitution: 0,
    }),
    Bodies.rectangle(-102, H / 2, 204, Math.max(H * 2, 800), { isStatic: true }),
    Bodies.rectangle(W + 102, H / 2, 204, Math.max(H * 2, 800), { isStatic: true }),
  ];
  Composite.add(engine.world, bounds);
}

function buildScene() {
  Composite.clear(engine.world, false, true);
  engine.timing.timestamp = 0;
  bodies = [];
  bounds = [];
  rebuildBounds();
  createBodies();
}

function keepBodiesInView() {
  if (!bodies.length) return;
  const gy = groundY();

  for (const b of bodies) {
    const pad = bodyPad(b);
    const x = clamp(b.position.x, pad + 8, W - pad - 8);
    const y = Math.min(b.position.y, gy - pad * 0.25);
    Body.setPosition(b, { x, y });
    Body.setVelocity(b, {
      x: clamp(b.velocity.x, -18, 18),
      y: clamp(b.velocity.y, -18, 18),
    });
  }
}

function bodyPad(b) {
  if (b.plugin.type === "circle") return b.plugin.r;
  if (b.plugin.type === "square") return Math.max(b.plugin.hw, b.plugin.hh);
  return b.plugin.R;
}

function bodyAABB(b) {
  return {
    minX: b.bounds.min.x,
    maxX: b.bounds.max.x,
    minY: b.bounds.min.y,
    maxY: b.bounds.max.y,
  };
}

/* ---------- Assisted drops ---------- */
function settle(body) {
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
  Sleeping.set(body, true);
}

function startSnap(body, target) {
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
  Sleeping.set(body, false);
  Body.setStatic(body, true);

  body.plugin.snap = {
    x0: body.position.x,
    y0: body.position.y,
    a0: body.angle,
    x1: target.x,
    y1: target.y,
    a1: target.a ?? body.angle,
    t: 0,
    dur: 0.32,
  };
}

function updateSnaps(dt) {
  for (const body of bodies) {
    const snap = body.plugin.snap;
    if (!snap) continue;

    snap.t += dt;
    const k = Math.min(1, snap.t / snap.dur);
    const ease = 1 - Math.pow(1 - k, 3);
    Body.setPosition(body, {
      x: snap.x0 + (snap.x1 - snap.x0) * ease,
      y: snap.y0 + (snap.y1 - snap.y0) * ease,
    });
    Body.setAngle(body, snap.a0 + (snap.a1 - snap.a0) * ease);

    if (k >= 1) {
      delete body.plugin.snap;
      Body.setStatic(body, false);
      Body.setPosition(body, { x: snap.x1, y: snap.y1 });
      Body.setAngle(body, snap.a1);
      settle(body);
    }
  }
}

function tryAssistDrop(body) {
  const type = body.plugin.type;
  const gy = groundY();

  if (type === "square") {
    const closeToFloor = Math.abs(body.bounds.max.y - gy) < SNAP.baseY;
    if (!closeToFloor) return false;
    startSnap(body, {
      x: clamp(body.position.x, body.plugin.hw + 12, W - body.plugin.hw - 12),
      y: gy - body.plugin.hh,
      a: 0,
    });
    return true;
  }

  const sq = bodyByType("square");
  if (!sq) return false;
  const sqA = bodyAABB(sq);

  if (type === "circle") {
    const targetX = sq.position.x;
    const targetY = sqA.minY - body.plugin.r;
    const nearSupport =
      Math.abs(body.position.x - targetX) < Math.max(SNAP.bodyX, sq.plugin.hw + body.plugin.r) &&
      Math.abs(body.position.y - targetY) < SNAP.bodyY;
    if (!nearSupport) return false;
    startSnap(body, { x: targetX, y: targetY });
    return true;
  }

  const ci = bodyByType("circle");
  if (!ci) return false;
  const circleOnSquare =
    Math.abs(ci.position.y + ci.plugin.r - sqA.minY) < STACK.ciSqYTol + 18 &&
    Math.abs(ci.position.x - sq.position.x) < sq.plugin.hw + STACK.ciSqXTol + 12;

  if (type === "triangle" && circleOnSquare) {
    const targetX = ci.position.x;
    const targetY = ci.position.y - ci.plugin.r - body.plugin.R * 0.5;
    const nearSupport =
      Math.abs(body.position.x - targetX) < Math.max(SNAP.bodyX, ci.plugin.r + body.plugin.R) &&
      Math.abs(body.position.y - targetY) < SNAP.bodyY;
    if (!nearSupport) return false;
    startSnap(body, { x: targetX, y: targetY, a: 0 });
    return true;
  }

  return false;
}

/* ---------- Drag ---------- */
function pointerPoint(e) {
  return {
    x: Number.isFinite(e?.clientX) ? e.clientX : pointer.x,
    y: Number.isFinite(e?.clientY) ? e.clientY : pointer.y,
  };
}

function hitBody(point) {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const body = bodies[i];
    if (Query.point([body], point).length) return body;
  }
  return null;
}

cv.addEventListener("pointerdown", (e) => {
  if (won) return;
  const point = pointerPoint(e);
  const body = hitBody(point);
  if (!body) return;

  e.preventDefault();
  pointer = { x: point.x, y: point.y, prevX: point.x, prevY: point.y };
  dragging = {
    body,
    ox: body.position.x - point.x,
    oy: body.position.y - point.y,
  };
  activePointerId = e.pointerId;

  for (const b of bodies) Sleeping.set(b, false);
  Body.setVelocity(body, { x: 0, y: 0 });
  Body.setAngularVelocity(body, 0);
  Body.setStatic(body, true);

  bodies = bodies.filter((b) => b !== body);
  bodies.push(body);
  cv.setPointerCapture?.(e.pointerId);
  document.body.style.cursor = "grabbing";
});

cv.addEventListener("pointermove", (e) => {
  const point = pointerPoint(e);
  pointer = { x: point.x, y: point.y, prevX: pointer.x, prevY: pointer.y };

  if (dragging) {
    if (e.buttons === 0) {
      endDrag(e);
      return;
    }
    e.preventDefault();
    Body.setPosition(dragging.body, {
      x: pointer.x + dragging.ox,
      y: pointer.y + dragging.oy,
    });
    return;
  }

  document.body.style.cursor = hitBody(point) ? "grab" : "default";
});

function endDrag(e) {
  if (!dragging) return;
  if (e) {
    const point = pointerPoint(e);
    pointer = { x: point.x, y: point.y, prevX: pointer.x, prevY: pointer.y };
  }

  const body = dragging.body;
  dragging = null;
  document.body.style.cursor = "default";
  if (activePointerId !== null && cv.hasPointerCapture?.(activePointerId)) {
    cv.releasePointerCapture(activePointerId);
  }
  activePointerId = null;
  Sleeping.set(body, false);

  if (tryAssistDrop(body)) return;

  Body.setStatic(body, false);
  Body.setVelocity(body, {
    x: (pointer.x - pointer.prevX) * 0.24,
    y: (pointer.y - pointer.prevY) * 0.24,
  });
  Body.setAngularVelocity(body, 0);
}

cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
window.addEventListener("blur", () => endDrag());

/* ---------- Unified step loop ---------- */
let lastT = performance.now();
let won = false;
let winState = null;
const DOOR_END = 1.6;
const ZOOM_START = 1.2;
const ZOOM_END = 3.4;

function step(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;

  updateSnaps(dt);
  Engine.update(engine, Math.min(16.667, dt * 1000));
  softenTinyMotion();
  detectStack(dt);

  if (winState) {
    const el = (now - winState.t0) / 1000;
    const dk = Math.min(1, el / DOOR_END);
    door.opening = 1 - Math.pow(1 - dk, 3);
    const zRaw = (el - ZOOM_START) / (ZOOM_END - ZOOM_START);
    door.zoom = Math.max(0, Math.min(1, zRaw));
    if (el >= ZOOM_END) {
      door.opening = 1;
      door.zoom = 1;
      winState = null;
      gate.classList.add("on");
    }
  }

  draw();
  requestAnimationFrame(step);
}

function softenTinyMotion() {
  for (const b of bodies) {
    if (b === dragging || b.plugin.snap || b.isSleeping) continue;
    if (b.speed < 0.15 && b.angularSpeed < 0.01) {
      Body.setVelocity(b, { x: b.velocity.x * 0.75, y: b.velocity.y * 0.75 });
      Body.setAngularVelocity(b, b.angularVelocity * 0.72);
    }
  }
}

/* ---------- Stack detection ---------- */
let holdT = 0;
const HOLD_TARGET = 3.0;

function bodyByType(type) {
  return bodies.find((b) => b.plugin.type === type);
}

function isStacked() {
  const sq = bodyByType("square");
  const ci = bodyByType("circle");
  const tr = bodyByType("triangle");
  if (!sq || !ci || !tr) return false;

  const gy = groundY();
  const sqA = bodyAABB(sq);
  const trA = bodyAABB(tr);

  if (Math.abs(sqA.maxY - gy) > STACK.groundTol) return false;
  if (Math.abs(ci.position.y + ci.plugin.r - sqA.minY) > STACK.ciSqYTol) return false;
  if (Math.abs(ci.position.x - sq.position.x) > sq.plugin.hw + STACK.ciSqXTol) return false;
  if (Math.abs(trA.maxY - (ci.position.y - ci.plugin.r)) > STACK.trCiYTol) return false;
  if (Math.abs(tr.position.x - ci.position.x) > ci.plugin.r + STACK.trCiXTol) return false;

  for (const b of [sq, ci, tr]) {
    if (b === dragging || b.plugin.snap) return false;
    if (b.speed > STACK.restV) return false;
    if (b.angularSpeed > STACK.restW) return false;
  }

  return true;
}

function detectStack(dt) {
  if (won) return;

  if (isStacked()) {
    if (!hintState.holding) {
      hintState.holding = true;
      clearHintTimers();
      setHint(HINTS.hold);
    }
    holdT += dt;
    timerEl.classList.add("on");
    fill.style.width = Math.min(1, holdT / HOLD_TARGET) * 100 + "%";
    tText.textContent = Math.max(0, HOLD_TARGET - holdT).toFixed(1);
    if (holdT >= HOLD_TARGET) win();
  } else if (holdT > 0) {
    hintState.holding = false;
    holdT = Math.max(0, holdT - dt * 3);
    fill.style.width = Math.min(1, holdT / HOLD_TARGET) * 100 + "%";
    tText.textContent = Math.max(0, HOLD_TARGET - holdT).toFixed(1);
    if (holdT <= 0.001) timerEl.classList.remove("on");
  }
}

function win() {
  won = true;
  document.body.classList.add("won");
  for (const b of bodies) settle(b);
  winState = { t0: performance.now() };
}

/* ---------- Render ---------- */
function draw() {
  ctx.clearRect(0, 0, W, H);
  const dcx = door.x + door.w / 2;
  const dcy = door.y + door.h / 2;
  let zoomed = false;

  if (door.zoom > 0) {
    const ez =
      door.zoom < 0.5
        ? 2 * door.zoom * door.zoom
        : 1 - Math.pow(-2 * door.zoom + 2, 2) / 2;
    const scale = 1 + ez * 40;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-dcx, -dcy);
    zoomed = true;
  }

  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY() + 0.5);
  ctx.lineTo(W, groundY() + 0.5);
  ctx.stroke();

  drawDoor();
  for (const b of bodies) drawBody(b);
  if (zoomed) ctx.restore();
}

function drawDoor() {
  const pulse = 0.5 + Math.sin(performance.now() / 850) * 0.5;
  const stackGlow = Math.min(1, holdT / HOLD_TARGET);
  const glow = 0.3 + pulse * 0.18 + stackGlow * 0.7 + door.opening * 0.4;

  ctx.save();
  ctx.globalAlpha = Math.min(0.9, glow * 0.55);
  ctx.fillStyle = "rgba(47, 107, 216, 0.16)";
  ctx.fillRect(door.x - 12, door.y - 12, door.w + 24, door.h + 18);
  ctx.globalAlpha = Math.min(0.95, glow);
  ctx.shadowColor = "rgba(47, 107, 216, 0.9)";
  ctx.shadowBlur = 34 + glow * 46;
  ctx.strokeStyle = "rgba(47, 107, 216, 0.92)";
  ctx.lineWidth = 4;
  ctx.strokeRect(door.x - 7, door.y - 7, door.w + 14, door.h + 12);
  ctx.restore();

  const interiorAlpha = Math.min(1, door.opening * 1.4);
  if (interiorAlpha > 0) {
    ctx.save();
    ctx.fillStyle = "#0a0a0a";
    ctx.globalAlpha = interiorAlpha;
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(door.x - 2, groundY());
  ctx.lineTo(door.x - 2, door.y - 2);
  ctx.lineTo(door.x + door.w + 2, door.y - 2);
  ctx.lineTo(door.x + door.w + 2, groundY());
  ctx.stroke();

  if (door.opening < 0.999) {
    const open = door.opening;
    const hingeX = door.x;
    const yTop = door.y;
    const yBot = door.y + door.h;
    const fw = door.w * (1 - open * 0.85);
    const skewX = open * 36;
    const skewY = open * 20;
    const xR = hingeX + fw;

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hingeX, yTop);
    ctx.lineTo(xR + skewX, yTop - skewY * 0.2);
    ctx.lineTo(xR + skewX, yBot + skewY);
    ctx.lineTo(hingeX, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(xR + skewX - 6, (yTop + yBot) / 2 + skewY * 0.4, 3, 0, Math.PI * 2);
    ctx.fillStyle = P.ink;
    ctx.fill();
    ctx.restore();
  }

  if (door.opening < 0.2) {
    ctx.fillStyle = P.muted;
    ctx.font = "10px ui-monospace,Menlo,monospace";
    ctx.textAlign = "center";
    ctx.fillText("DOOR", door.x + door.w / 2, door.y - 12);
  }
}

function drawBody(b) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = bodyColor(b);
  ctx.fillStyle = "#fff";

  if (b.plugin.type === "circle") {
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.beginPath();
    ctx.arc(0, 0, b.plugin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(b.plugin.r * 0.55, 0);
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    const v = b.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/* ---------- Reset ---------- */
function reset() {
  won = false;
  dragging = null;
  holdT = 0;
  door.opening = 0;
  door.zoom = 0;
  winState = null;
  gate.classList.remove("on");
  document.body.classList.remove("won");
  timerEl.classList.remove("on");
  fill.style.width = "0%";
  tText.textContent = HOLD_TARGET.toFixed(1);
  resetHints();
  buildScene();
}

resetBtn.addEventListener("click", reset);
resetBtn.addEventListener("pointerdown", (e) => e.stopPropagation());

document.getElementById("enter").addEventListener("click", (e) => {
  e.preventDefault();
  if (window.fadeTo) window.fadeTo("path.html");
  else window.location.href = "path.html";
});

/* ---------- Init ---------- */
resize();
cachePalette();
buildScene();
requestAnimationFrame(step);

const floor = document.querySelector(".floor");
const guide = document.getElementById("pathGuide");
const drawn = document.getElementById("pathDrawn");
const traveler = document.getElementById("traveler");
const fill = document.getElementById("pathFill");
const statusEl = document.getElementById("pathStatus");
const next = document.getElementById("pathNext");

const total = guide.getTotalLength();
const samples = Array.from({ length: 180 }, (_, i) => {
  const len = (i / 179) * total;
  const p = guide.getPointAtLength(len);
  return { x: p.x, y: p.y, len };
});

let progress = 0;
let passes = 0;
let active = false;
let complete = false;
const PASS_TARGET = 3;

drawn.style.strokeDasharray = total;
drawn.style.strokeDashoffset = total;

function preventPageGesture(e) {
  if (!complete) e.preventDefault();
}

function preventTraceScroll(e) {
  const target = e.target;
  if (active || target === floor || target?.closest?.(".floor")) {
    e.preventDefault();
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setTravelerAt(length) {
  const p = guide.getPointAtLength(length);
  traveler.setAttribute("cx", p.x);
  traveler.setAttribute("cy", p.y);
}

function render() {
  const pct = (passes + progress / total) / PASS_TARGET;
  drawn.style.strokeDashoffset = total - progress;
  fill.style.width = `${Math.round(pct * 100)}%`;
  setTravelerAt(progress);
  guide.style.opacity = passes === 0 ? "0.55" : passes === 1 ? "0.25" : "0";
}

function svgPoint(e) {
  const pt = floor.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(floor.getScreenCTM().inverse());
}

function nearestLength(point) {
  let best = samples[0];
  let bestD = Infinity;
  const start = Math.max(0, progress - total * 0.09);
  const end = Math.min(total, progress + total * 0.18);

  for (const sample of samples) {
    if (sample.len < start || sample.len > end) continue;
    const d = Math.hypot(sample.x - point.x, sample.y - point.y);
    if (d < bestD) {
      best = sample;
      bestD = d;
    }
  }

  return bestD < 38 ? best.len : progress;
}

function finish() {
  if (complete) return;
  complete = true;
  passes = PASS_TARGET - 1;
  progress = total;
  render();
  statusEl.textContent = "the building lets the path rest where your hand leaves it";
  next.classList.add("on");
}

function completePass() {
  passes++;
  if (passes >= PASS_TARGET) {
    finish();
    return;
  }

  progress = 0;
  render();
  statusEl.textContent = `pass ${passes + 1} of ${PASS_TARGET}`;
}

function move(e) {
  if (!active || complete) return;
  e.preventDefault();
  const pt = svgPoint(e);
  const target = nearestLength(pt);
  const near = guide.getPointAtLength(target);
  const drift = Math.hypot(near.x - pt.x, near.y - pt.y);

  if (drift > 30) {
    progress = clamp(progress - total * 0.012, 0, total);
    render();
    return;
  }

  if (target >= progress - total * 0.035) {
    progress = clamp(Math.max(progress, target), 0, total);
    render();
  }
  if (progress > total * 0.965) completePass();
}

function start(e) {
  if (complete) return;
  const target = nearestLength(svgPoint(e));
  if (progress < total * 0.04 || target > progress - total * 0.04) {
    e.preventDefault();
    active = true;
    floor.classList.add("dragging");
    floor.setPointerCapture?.(e.pointerId);
    move(e);
  }
}

function stop(e) {
  active = false;
  floor.classList.remove("dragging");
  if (e && Number.isFinite(e.pointerId) && floor.hasPointerCapture?.(e.pointerId)) {
    floor.releasePointerCapture(e.pointerId);
  }
}

floor.addEventListener("pointerdown", start);
floor.addEventListener("pointermove", move);
floor.addEventListener("pointerup", stop);
floor.addEventListener("pointercancel", stop);
window.addEventListener("pointerup", stop);
window.addEventListener("pointercancel", stop);
window.addEventListener("blur", stop);
floor.addEventListener("touchstart", preventPageGesture, { passive: false });
floor.addEventListener("touchmove", preventPageGesture, { passive: false });
document.addEventListener("touchmove", preventTraceScroll, { passive: false });
window.addEventListener("scroll", () => window.scrollTo(0, 0));

render();

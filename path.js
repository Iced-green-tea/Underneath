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
let active = false;
let complete = false;

drawn.style.strokeDasharray = total;
drawn.style.strokeDashoffset = total;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setTravelerAt(length) {
  const p = guide.getPointAtLength(length);
  traveler.setAttribute("cx", p.x);
  traveler.setAttribute("cy", p.y);
}

function render() {
  const pct = progress / total;
  drawn.style.strokeDashoffset = total - progress;
  fill.style.width = `${Math.round(pct * 100)}%`;
  setTravelerAt(progress);
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

  return bestD < 74 ? best.len : progress;
}

function finish() {
  if (complete) return;
  complete = true;
  progress = total;
  render();
  statusEl.textContent = "the building lets the path rest where your hand leaves it";
  next.classList.add("on");
}

function move(e) {
  if (!active || complete) return;
  e.preventDefault();
  const target = nearestLength(svgPoint(e));
  if (target >= progress - total * 0.035) {
    progress = clamp(Math.max(progress, target), 0, total);
    render();
  }
  if (progress > total * 0.965) finish();
}

function start(e) {
  if (complete) return;
  const target = nearestLength(svgPoint(e));
  if (progress < total * 0.04 || target > progress - total * 0.04) {
    active = true;
    floor.classList.add("dragging");
    floor.setPointerCapture(e.pointerId);
    move(e);
  }
}

function stop() {
  active = false;
  floor.classList.remove("dragging");
}

floor.addEventListener("pointerdown", start);
floor.addEventListener("pointermove", move);
floor.addEventListener("pointerup", stop);
floor.addEventListener("pointercancel", stop);

render();

const root = document.documentElement;
const inputs = [...document.querySelectorAll("input[type='range']")];
const statusEl = document.getElementById("lightStatus");
const next = document.getElementById("lightNext");

const targets = {
  north: 68,
  east: 42,
  west: 58,
};

const tolerance = 8;
let complete = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function score() {
  let sum = 0;
  for (const input of inputs) {
    const key = input.dataset.key;
    const value = Number(input.value);
    const distance = Math.abs(value - targets[key]);
    sum += clamp(1 - distance / 52, 0, 1);
    root.style.setProperty(`--${key}`, `${value}%`);
    input.parentElement.classList.toggle("near", distance <= tolerance);
  }
  return sum / inputs.length;
}

function finish() {
  if (complete) return;
  complete = true;
  for (const input of inputs) {
    const key = input.dataset.key;
    input.value = targets[key];
    root.style.setProperty(`--${key}`, `${targets[key]}%`);
  }
  setDoor(1);
  statusEl.textContent = "the light has found the threshold";
  next.classList.add("on");
}

function setDoor(amount) {
  const opacity = 0.22 + amount * 0.78;
  const border = 0.16 + amount * 0.76;
  const bg = amount * 0.06;
  const glow = amount * 0.24;
  root.style.setProperty("--door-opacity", opacity.toFixed(3));
  root.style.setProperty("--door-border", `rgba(255, 255, 255, ${border.toFixed(3)})`);
  root.style.setProperty("--door-bg", `rgba(255, 255, 255, ${bg.toFixed(3)})`);
  root.style.setProperty("--door-glow", `rgba(255, 255, 255, ${glow.toFixed(3)})`);
}

function update() {
  if (complete) return;
  const amount = score();
  setDoor(amount);

  const solved = inputs.every((input) => {
    const key = input.dataset.key;
    return Math.abs(Number(input.value) - targets[key]) <= tolerance;
  });

  if (solved) {
    finish();
  } else if (amount > 0.78) {
    statusEl.textContent = "almost: let the walls share the light";
  } else {
    statusEl.textContent = "let each wall hold only enough brightness";
  }
}

for (const input of inputs) {
  input.addEventListener("input", update);
  input.addEventListener("change", () => {
    if (complete) return;
    const key = input.dataset.key;
    if (Math.abs(Number(input.value) - targets[key]) <= tolerance) {
      input.value = targets[key];
    }
    update();
  });
}

update();

/* =========================================================
   The Archive — Path 03
   Each shape (key) unlocks the fragment with the matching
   color. Three unlocked → synthesis overlay reveals the
   complete recovered passage with coordinates and time.
   Drag is custom (not HTML5 native) for full control.
   ========================================================= */

const tray   = document.getElementById('tray');
const frags  = document.querySelectorAll('.frag');
const fragWrap = document.getElementById('fragments');
const synth  = document.getElementById('synthesis');
const pcount = document.getElementById('pcount');
const pips   = document.querySelectorAll('.progress .pip');
const currentTime = document.getElementById('currentTime');

let unlocked = new Set();
let drag = null; // {el, startX, startY, originRect}
const DROP_PAD = 46;

function updateCurrentTime(){
  if(!currentTime) return;
  currentTime.textContent = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
updateCurrentTime();
setInterval(updateCurrentTime, 1000);

/* ---------- Drag system ---------- */
function startDrag(keyEl, e){
  if(keyEl.classList.contains('spent')) return;
  e.preventDefault();
  const rect = keyEl.getBoundingClientRect();
  const ghost = keyEl.cloneNode(true);
  ghost.classList.add('dragging');
  ghost.style.left = rect.left + 'px';
  ghost.style.top  = rect.top  + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  document.body.appendChild(ghost);
  keyEl.style.opacity = 0.25;
  drag = {
    keyEl, ghost,
    color: keyEl.dataset.color,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    targetFrag: null
  };
  keyEl.setPointerCapture?.(e.pointerId);
  document.body.style.cursor = 'grabbing';
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);
}

function distanceToRect(x, y, r){
  const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
  const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
  return Math.hypot(dx, dy);
}

function findDropTarget(x, y, color, pad = DROP_PAD){
  let best = null;
  let bestD = Infinity;
  for(const f of frags){
    if(f.classList.contains('unlocked')) continue;
    const r = f.getBoundingClientRect();
    const d = distanceToRect(x, y, r);
    const insideExpanded =
      x >= r.left - pad && x <= r.right + pad &&
      y >= r.top - pad && y <= r.bottom + pad;
    if(insideExpanded && d < bestD){
      best = f;
      bestD = d;
    }
  }
  if(best) return best;

  const matching = [...frags].find(f => !f.classList.contains('unlocked') && f.dataset.key === color);
  if(!matching) return null;
  const r = matching.getBoundingClientRect();
  return distanceToRect(x, y, r) < pad * 1.8 ? matching : null;
}

function onMove(e){
  if(!drag) return;
  e.preventDefault();
  drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
  drag.ghost.style.top  = (e.clientY - drag.offsetY) + 'px';
  const over = findDropTarget(e.clientX, e.clientY, drag.color);
  for(const f of frags){
    f.classList.remove('drag-over','match','miss');
  }
  if(over){
    over.classList.add('drag-over');
    if(over.dataset.key === drag.color) over.classList.add('match');
    else over.classList.add('miss');
  }
  drag.targetFrag = over;
}

function endDrag(e){
  if(!drag) return;
  const { keyEl, ghost, color } = drag;
  const x = e?.clientX ?? window.innerWidth / 2;
  const y = e?.clientY ?? window.innerHeight / 2;
  const targetFrag = drag.targetFrag || findDropTarget(x, y, color, DROP_PAD * 1.3);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  window.removeEventListener('blur', endDrag);
  document.body.style.cursor = '';

  // animate ghost back, then remove
  if(targetFrag && targetFrag.dataset.key === color){
    // success — burst and remove ghost
    ghost.style.transition = 'opacity .35s ease, transform .35s ease';
    ghost.style.opacity = 0;
    ghost.style.transform = 'scale(1.6)';
    setTimeout(()=>ghost.remove(), 380);
    unlock(targetFrag);
    keyEl.classList.add('spent');
    keyEl.style.opacity = '';
  } else {
    // fail — snap back
    const back = keyEl.getBoundingClientRect();
    ghost.style.transition = 'left .35s cubic-bezier(.5,0,.2,1), top .35s cubic-bezier(.5,0,.2,1), opacity .25s';
    ghost.style.left = back.left + 'px';
    ghost.style.top  = back.top  + 'px';
    setTimeout(()=>{ ghost.remove(); keyEl.style.opacity = ''; }, 380);
    if(targetFrag){
      // small shake on miss
      targetFrag.animate(
        [{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],
        {duration:280, easing:'ease-out'}
      );
    }
  }
  for(const f of frags) f.classList.remove('drag-over','match','miss');
  drag = null;
}

document.querySelectorAll('.key').forEach(k=>{
  k.addEventListener('pointerdown', e => startDrag(k, e));
});

/* ---------- Unlock logic ---------- */
function unlock(frag){
  frag.classList.add('unlocked');
  frag.querySelector('.lockmark').textContent = 'recovered';
  // type-out animation: locked text → unlocked text
  const body = frag.querySelector('.body');
  const target = body.dataset.unlocked;
  const locked = body.dataset.locked;
  // glitch transition: 12 frames of random char swap, then resolve to target
  const glyphs = '█▓▒░╳╳/\\\\<>?#@';
  let frames = 0;
  const total = 18;
  body.style.fontFamily = '"JetBrains Mono",monospace';
  body.style.fontSize = '14px';
  body.style.letterSpacing = '.05em';
  body.style.color = '#888';
  const tick = () => {
    frames++;
    if(frames >= total){
      // resolve
      body.style.transition = 'all .8s ease';
      body.style.fontFamily = '';
      body.style.fontSize = '';
      body.style.letterSpacing = '';
      body.style.color = '';
      body.textContent = target;
      return;
    }
    let s = '';
    const reveal = Math.floor((frames/total) * target.length);
    for(let i=0;i<target.length;i++){
      if(i < reveal && target[i]!==' ') s += target[i];
      else if(target[i]===' ') s += ' ';
      else s += glyphs[Math.floor(Math.random()*glyphs.length)];
    }
    body.textContent = s;
    setTimeout(tick, 60);
  };
  tick();

  unlocked.add(frag.dataset.key);
  pcount.textContent = `${unlocked.size}/3`;
  pips.forEach((p, i) => { if(i < unlocked.size) p.classList.add('on'); });

  if(unlocked.size === 3){
    setTimeout(()=>{
      fragWrap.classList.add('assembled');
      // pull fragments slightly together
      fragWrap.style.gap = '8px';
      fragWrap.style.transform = 'scale(0.92)';
      fragWrap.style.opacity = '0.4';
      setTimeout(()=>{
        updateCurrentTime();
        synth.classList.add('on');
      }, 1200);
    }, 3400);
  }
}

document.getElementById('seal').addEventListener('click', e=>{
  e.preventDefault();
  // Final state: fade everything to pure black with a single line
  document.body.classList.add('sealed');
  document.body.style.transition = 'background 1.8s ease';
  document.body.style.background = '#000';
  synth.style.transition = 'opacity 1.8s ease, background 1.8s ease';
  synth.style.background = '#000';
  synth.innerHTML = '<div style="font-family:Fraunces,serif;font-style:normal;font-weight:300;font-size:32px;color:#888;text-align:center;text-wrap:pretty;max-width:620px;">The archive is sealed.<br>The room keeps no name.<br>The quiet remains for whoever arrives next.</div>';
});


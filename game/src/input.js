// Keyboard + mouse. Pointer lock is optional: dragging with the mouse held
// also turns the camera, so the game plays fine without it.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_TALK = 32;
export const ACTION_MUSIC = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let firing = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;

  function key(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }

  window.addEventListener('keydown', (e) => {
    const k = key(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === ' ' || k === 'Enter') actions |= ACTION_CONFIRM;
    if (k === 'p' || k === 'Escape') actions |= ACTION_PAUSE;
    if (k === 'e') actions |= ACTION_ENTER;
    if (k === 'f') actions |= ACTION_PUNCH;
    if (k === 'r') actions |= ACTION_RELOAD;
    if (k === 'q') actions |= ACTION_TALK;
    if (k === 'm') actions |= ACTION_MUSIC;
  });
  window.addEventListener('keyup', (e) => keys.delete(key(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      firing = true;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) { firing = false; dragging = false; } });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
  window.addEventListener('mousemove', (e) => {
    if (locked) { lookX += e.movementX; lookY += e.movementY; }
    else if (dragging) { lookX += e.clientX - lastX; lookY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    takeActions() { const a = actions; actions = 0; return a; },
    takeLook() { const l = { x: lookX, y: lookY }; lookX = 0; lookY = 0; return l; },
    isFiring() { return firing; },
    axis() {
      let x = 0; let z = 0;
      if (keys.has('w') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) z += 1;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    sprint() { return keys.has('Shift'); },
    jump() { return keys.has(' '); },
    weaponSlot() {
      if (keys.has('1')) return 0;
      if (keys.has('2')) return 1;
      if (keys.has('3')) return 2;
      return -1;
    },
    clear() { keys.clear(); actions = 0; firing = false; },
  };
}

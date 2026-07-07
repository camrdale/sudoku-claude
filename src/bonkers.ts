/**
 * Over-the-top juice for Bonkers mode: digits that fly off the board,
 * jelly wobbles, screen shakes, cartoon boings, and pitch-shifted screams.
 */

let audio: AudioContext | undefined;

function context(): AudioContext {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/** A cartoon spring: a quick pitch-bent sine slide. */
export function boing(): void {
  try {
    const ctx = context();
    const t = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(160 + Math.random() * 60, t);
    oscillator.frequency.exponentialRampToValueAtTime(520, t + 0.08);
    oscillator.frequency.exponentialRampToValueAtTime(230, t + 0.26);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + 0.35);
  } catch {
    // No audio, no problem.
  }
}

/**
 * Play a sound file at a (by default randomized) playback rate with pitch
 * shifting enabled, for maximum comedy.
 */
export function scream(
  url: string,
  rate = 0.7 + Math.random() * 0.9,
  volume = 0.5
): void {
  try {
    const sound = new Audio(url);
    sound.playbackRate = rate;
    sound.preservesPitch = false;
    sound.volume = volume;
    void sound.play().catch(() => {});
  } catch {
    // Audio is best-effort.
  }
}

/**
 * Launch a copy of a digit from the given rect: it pops up, tumbles under
 * gravity, and is removed once it falls past the bottom of the viewport.
 */
export function ejectDigit(text: string, from: DOMRect): void {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed',
    left: `${from.left + from.width / 2}px`,
    top: `${from.top + from.height / 2}px`,
    fontSize: `${Math.max(from.height * 0.6, 16)}px`,
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '700',
    color: 'var(--ink-user)',
    pointerEvents: 'none',
    zIndex: '99',
    willChange: 'transform',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.append(el);

  let x = 0;
  let y = 0;
  let rotation = 0;
  let vx = (Math.random() - 0.5) * 800;
  let vy = -500 - Math.random() * 400;
  const spin = (Math.random() - 0.5) * 1100;
  let last = performance.now();

  const step = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    vy += 1900 * dt;
    x += vx * dt;
    y += vy * dt;
    rotation += spin * dt;
    el.style.transform =
      `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) ` +
      `rotate(${rotation}deg)`;
    if (from.top + y < window.innerHeight + 150) {
      requestAnimationFrame(step);
    } else {
      el.remove();
    }
  };
  el.style.transform = 'translate(-50%, -50%)';
  requestAnimationFrame(step);
}

/** Squash and stretch, like poking a jelly. */
export function jelly(el: Element): void {
  el.animate(
    [
      { transform: 'scale(1, 1)' },
      { transform: 'scale(1.04, 0.94)' },
      { transform: 'scale(0.95, 1.05)' },
      { transform: 'scale(1.02, 0.99)' },
      { transform: 'scale(1, 1)' },
    ],
    { duration: 380, easing: 'ease-out' }
  );
}

/** Rattle an element, for when something has gone dramatically wrong. */
export function shake(el: Element): void {
  el.animate(
    [
      { transform: 'translate(0, 0) rotate(0deg)' },
      { transform: 'translate(-11px, 5px) rotate(-1.3deg)' },
      { transform: 'translate(10px, -6px) rotate(1.1deg)' },
      { transform: 'translate(-8px, -4px) rotate(-0.8deg)' },
      { transform: 'translate(7px, 5px) rotate(0.6deg)' },
      { transform: 'translate(-4px, 2px) rotate(-0.3deg)' },
      { transform: 'translate(0, 0) rotate(0deg)' },
    ],
    { duration: 480, easing: 'ease-out' }
  );
}

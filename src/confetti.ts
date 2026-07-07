/**
 * A small dependency-free canvas confetti effect. Fires angled bursts of
 * spinning, fluttering paper from the bottom corners and the center.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  /** Phase for the flutter wobble. */
  phase: number;
  shape: 'rect' | 'circle';
}

const COLORS = [
  '#f43f5e', // rose
  '#f97316', // orange
  '#facc15', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
];

const GRAVITY = 900; // px/s^2
const DRAG = 0.55;

function burst(particles: Particle[], x: number, y: number, angle: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const spread = angle + (Math.random() - 0.5) * 1.1;
    const speed = 550 + Math.random() * 750;
    particles.push({
      x,
      y,
      vx: Math.cos(spread) * speed,
      vy: Math.sin(spread) * speed,
      size: 5 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      phase: Math.random() * Math.PI * 2,
      shape: Math.random() < 0.7 ? 'rect' : 'circle',
    });
  }
}

/**
 * Start the celebration on the given canvas. Bursts repeat a few times,
 * then the animation ends on its own. Returns a function that stops it
 * immediately (e.g. when the overlay is dismissed).
 */
export function launchConfetti(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};

  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  context.scale(devicePixelRatio, devicePixelRatio);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const particles: Particle[] = [];
  const fire = (round: number): void => {
    burst(particles, 0, height, -Math.PI / 3, 60);
    burst(particles, width, height, Math.PI + Math.PI / 3, 60);
    if (round === 1) burst(particles, width / 2, height, -Math.PI / 2, 80);
  };

  let frame = 0;
  let last = performance.now();
  const timers = [0, 1, 2].map((round) =>
    setTimeout(() => fire(round), round * 650)
  );

  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    context.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= 1 - DRAG * dt;
      p.vy = p.vy * (1 - DRAG * dt) + GRAVITY * dt;
      p.x += (p.vx + Math.cos(p.phase += 8 * dt) * 40) * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      if (p.y > height + 30) {
        particles.splice(i, 1);
        continue;
      }
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.rotation);
      // Fold around the spin axis so rectangles glint like real paper.
      context.scale(1, 0.35 + Math.abs(Math.sin(p.phase)) * 0.65);
      context.fillStyle = p.color;
      if (p.shape === 'rect') {
        context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        context.beginPath();
        context.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    // Keep going while bursts are still scheduled or paper is in the air.
    if (particles.length > 0 || now - start < 2200) {
      frame = requestAnimationFrame(tick);
    } else {
      context.clearRect(0, 0, width, height);
    }
  };

  const start = performance.now();
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    for (const timer of timers) clearTimeout(timer);
    context.clearRect(0, 0, width, height);
  };
}

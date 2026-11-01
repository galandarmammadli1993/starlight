/** Broadcast-style Canvas renderer. Field and physics share metre coordinates. */
import { FIELD } from './rules.mjs';

const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const TEAM = [
  { shirt: '#e5fff2', trim: '#18c789', shorts: '#142f2b', sock: '#e5fff2' },
  { shirt: '#ffba53', trim: '#fff0c7', shorts: '#202538', sock: '#ffba53' },
];
const HOME_KITS = {
  mint: TEAM[0],
  blue: { shirt: '#80b9ff', trim: '#ecf5ff', shorts: '#152d56', sock: '#80b9ff' },
  rose: { shirt: '#ff8f9f', trim: '#fff0ef', shorts: '#43212e', sock: '#ff8f9f' },
};

export class PitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.background = document.createElement('canvas');
    this.time = 0;
    this.trail = [];
    this.width = 1;
    this.height = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize = this.resize.bind(this);
    this.observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.resize) : null;
    this.observer?.observe(canvas.parentElement || canvas);
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const bounds = (parent || this.canvas).getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height || this.width * .69);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    this.scale = Math.min(this.width / (FIELD.length + 14), this.height / (FIELD.width + 14));
    this.offsetX = (this.width - FIELD.length * this.scale) / 2;
    this.offsetY = (this.height - FIELD.width * this.scale) / 2;
    this.drawBackground();
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * this.width / (rect.width || 1) - this.offsetX) / this.scale,
      y: ((clientY - rect.top) * this.height / (rect.height || 1) - this.offsetY) / this.scale,
    };
  }

  worldTransform(ctx) {
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale,
      this.offsetX * this.dpr, this.offsetY * this.dpr);
  }

  drawBackground() {
    const c = this.background.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#0c181b';
    c.fillRect(0, 0, this.width, this.height);
    this.worldTransform(c);

    // Stadium, seats and advertising sit beyond the actual touchlines.
    c.fillStyle = '#14292b';
    c.fillRect(-7, -7, FIELD.length + 14, FIELD.width + 14);
    c.fillStyle = '#20393a';
    for (let row = 0; row < 3; row++) {
      for (let col = -4; col < 110; col += 1.15) {
        c.globalAlpha = .22 + ((Math.round(col * 7) + row) % 4 + 4) % 4 * .12;
        c.fillRect(col, -6.3 + row * .7, .65, .4);
        c.fillRect(col, FIELD.width + 4.5 + row * .7, .65, .4);
      }
    }
    c.globalAlpha = 1;
    c.fillStyle = '#203e3d';
    c.fillRect(-4.8, -3.8, FIELD.length + 9.6, FIELD.width + 7.6);
    c.fillStyle = '#224b3c';
    c.fillRect(-3.6, -2.3, FIELD.length + 7.2, FIELD.width + 4.6);

    // Full pitch with no visual centre-lane restriction.
    const grass = c.createLinearGradient(0, 0, FIELD.length, FIELD.width);
    grass.addColorStop(0, '#216743');
    grass.addColorStop(1, '#184f37');
    c.fillStyle = grass;
    c.fillRect(0, 0, FIELD.length, FIELD.width);
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        c.fillStyle = '#ffffff07';
        c.fillRect(i * FIELD.length / 20, 0, FIELD.length / 20, FIELD.width);
      }
    }
    // Fine, restrained mowing texture, cached rather than redrawn per frame.
    c.fillStyle = '#ffffff03';
    for (let i = 0; i < FIELD.width; i += .55) c.fillRect(0, i, FIELD.length, .035);
    const floodlight = c.createRadialGradient(FIELD.length / 2, FIELD.width / 2, 4,
      FIELD.length / 2, FIELD.width / 2, 75);
    floodlight.addColorStop(0, '#c5ffcf0a');
    floodlight.addColorStop(1, '#00000020');
    c.fillStyle = floodlight;
    c.fillRect(0, 0, FIELD.length, FIELD.width);

    c.strokeStyle = '#e7f6dca6';
    c.lineWidth = .14;
    c.strokeRect(0, 0, FIELD.length, FIELD.width);
    c.beginPath();
    c.moveTo(FIELD.length / 2, 0);
    c.lineTo(FIELD.length / 2, FIELD.width);
    c.stroke();
    c.beginPath();
    c.arc(FIELD.length / 2, FIELD.width / 2, 9.15, 0, TAU);
    c.stroke();
    this.dot(c, FIELD.length / 2, FIELD.width / 2, .19, '#e7f6dc');

    for (const side of [0, 1]) {
      const goalX = side ? FIELD.length : 0;
      const sign = side ? -1 : 1;
      c.strokeRect(side ? FIELD.length - 16.5 : 0, (FIELD.width - 40.32) / 2, 16.5, 40.32);
      c.strokeRect(side ? FIELD.length - 5.5 : 0, (FIELD.width - 18.32) / 2, 5.5, 18.32);
      this.dot(c, goalX + sign * 11, FIELD.width / 2, .18, '#e7f6dc');
      c.beginPath();
      const a = Math.acos(5.5 / 9.15);
      if (side) c.arc(FIELD.length - 11, FIELD.width / 2, 9.15, Math.PI - a, Math.PI + a);
      else c.arc(11, FIELD.width / 2, 9.15, -a, a);
      c.stroke();
      this.drawGoal(c, goalX, side ? 1 : -1);
    }
    for (const x of [0, FIELD.length]) {
      for (const y of [0, FIELD.width]) {
        c.beginPath();
        const start = y === 0 ? (x === 0 ? 0 : Math.PI / 2) : (x === 0 ? Math.PI * 1.5 : Math.PI);
        c.arc(x, y, 1, start, start + Math.PI / 2);
        c.stroke();
        c.fillStyle = '#e7f6dc';
        c.fillRect(x - .06, y - .7, .12, .7);
        c.fillStyle = '#f4cb67';
        c.fillRect(x + .06, y - .7, .45, .3);
      }
    }
    c.font = '600 1.05px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#d0ede366';
    c.fillText('F O O T B A 1 1   H E R O E S', FIELD.length / 2, -1.05);
    c.fillStyle = '#b2d6c34d';
    c.fillText('THE BEAUTIFUL GAME', FIELD.length / 2, FIELD.width + 1.6);
  }

  drawGoal(c, x, direction) {
    const top = (FIELD.width - FIELD.goalWidth) / 2;
    const depth = 2.1;
    const left = direction < 0 ? x - depth : x;
    c.fillStyle = '#d1eae21a';
    c.fillRect(left, top, depth, FIELD.goalWidth);
    c.strokeStyle = '#d1eae24d';
    c.lineWidth = .065;
    for (let y = top; y <= top + FIELD.goalWidth; y += .4) {
      c.beginPath(); c.moveTo(left, y); c.lineTo(left + depth, y); c.stroke();
    }
    for (let gx = left; gx <= left + depth; gx += .35) {
      c.beginPath(); c.moveTo(gx, top); c.lineTo(gx, top + FIELD.goalWidth); c.stroke();
    }
    c.strokeStyle = '#f2fff1';
    c.lineWidth = .23;
    c.beginPath();
    c.moveTo(x, top); c.lineTo(x + direction * depth, top);
    c.lineTo(x + direction * depth, top + FIELD.goalWidth); c.lineTo(x, top + FIELD.goalWidth);
    c.stroke();
    c.strokeStyle = '#e7f6dca6';
    c.lineWidth = .14;
  }

  dot(c, x, y, radius, color) {
    c.fillStyle = color;
    c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fill();
  }

  render(engine, delta = 0) {
    if (!engine || !this.ctx || this.width < 2) return;
    this.time += Math.min(delta || 0, .1);
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.drawImage(this.background, 0, 0);
    this.worldTransform(c);

    if (engine.debug && engine.offsideSnapshot) {
      const snap = engine.offsideSnapshot;
      const x = snap.line ?? snap.offsideLine;
      if (Number.isFinite(x)) {
        c.save();
        c.strokeStyle = '#ffba53aa'; c.lineWidth = .23;
        c.setLineDash([1, .7]);
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, FIELD.width); c.stroke();
        c.restore();
      }
    }

    const selected = engine.players.find(p => p.id === engine.selectedTarget && !p.sentOff);
    const controlled = engine.players.find(p => p.id === engine.controlled && !p.sentOff);
    if (selected && controlled && selected.id !== controlled.id) {
      c.save();
      c.strokeStyle = '#bcffe540'; c.lineWidth = .18; c.setLineDash([.7, .8]);
      c.beginPath(); c.moveTo(controlled.x, controlled.y); c.lineTo(selected.x, selected.y); c.stroke();
      c.restore();
      c.strokeStyle = '#d5ffe299'; c.lineWidth = .17;
      c.beginPath(); c.arc(selected.x, selected.y, 1.65, 0, TAU); c.stroke();
    }

    if (engine.restart && engine.state !== 'IN_PLAY') {
      const r = engine.restart;
      c.save();
      c.globalAlpha = .18 + Math.sin(this.time * 3) * .06;
      this.dot(c, r.x, r.y, 2.5, r.team === 0 ? '#98ffd2' : '#ffbd57');
      c.restore();
    }

    for (const player of [...engine.players].filter(p => !p.sentOff).sort((a, b) => a.y - b.y)) {
      this.drawPlayer(c, player, engine);
    }

    // Referee is a visual official, not an extra player in the simulation.
    const ball = engine.ball;
    this.drawReferee(c, clamp(ball.x - 11, 15, 90), clamp(ball.y + 9, 8, 60));
    this.drawBall(c, ball);
    if (engine.debug) this.drawDebug(c, engine);
  }

  drawPlayer(c, p, engine) {
    const selected = p.id === engine.controlled;
    const speed = Math.hypot(p.vx || 0, p.vy || 0);
    const angle = speed > .2 ? Math.atan2(p.vy, p.vx) : engine.directions?.[p.team] === -1 ? Math.PI : 0;
    const phase = Math.sin(this.time * (speed > 5 ? 21 : 14) + p.id * 2) * Math.min(.38, speed * .065);
    const kit = p.role === 'GK'
      ? { shirt: p.team === 0 ? '#b5a5ff' : '#8bc7ed', trim: '#e5d9ff', shorts: '#24213c', sock: '#b5a5ff' }
      : p.team === 0 ? (HOME_KITS[engine.kitColor] || TEAM[0]) : TEAM[1];
    c.save();
    c.translate(p.x, p.y);
    if (selected) {
      c.strokeStyle = '#95ffd5'; c.lineWidth = .2;
      c.beginPath(); c.ellipse(0, .08, 1.5, 1.25, 0, 0, TAU); c.stroke();
      c.fillStyle = '#a4ffde';
      c.beginPath(); c.moveTo(-.65, -2.2); c.lineTo(.65, -2.2); c.lineTo(0, -1.5); c.closePath(); c.fill();
      // Stamina bar is attached to the controlled footballer.
      c.fillStyle = '#071e1b99'; c.fillRect(-1.2, 1.8, 2.4, .22);
      const stamina = p.stamina > 1 ? p.stamina / 100 : p.stamina ?? 1;
      c.fillStyle = stamina < .25 ? '#ffb35f' : '#7ff0bf';
      c.fillRect(-1.2, 1.8, 2.4 * clamp(stamina, 0, 1), .22);
    }
    c.fillStyle = '#031c2166';
    c.beginPath(); c.ellipse(.28, .5, 1.0, .7, -.3, 0, TAU); c.fill();
    c.save();
    c.rotate(angle);
    // Boots, legs, shorts, jersey and head express movement orientation.
    c.lineWidth = .28;
    c.lineCap = 'round';
    c.strokeStyle = kit.sock;
    c.beginPath(); c.moveTo(-.35, -.34); c.lineTo(-.85 + phase, -.34); c.stroke();
    c.beginPath(); c.moveTo(-.35, .34); c.lineTo(-.85 - phase, .34); c.stroke();
    c.strokeStyle = '#182328'; c.lineWidth = .25;
    c.beginPath(); c.moveTo(-.88 + phase, -.34); c.lineTo(-.99 + phase, -.34); c.stroke();
    c.beginPath(); c.moveTo(-.88 - phase, .34); c.lineTo(-.99 - phase, .34); c.stroke();
    c.strokeStyle = ['#c8926c', '#c8926c', '#9d694b', '#e4b494', '#80583e'][p.id % 5];
    c.lineWidth = .24;
    c.beginPath(); c.moveTo(0, -.6); c.lineTo(-phase * .4, -.9); c.stroke();
    c.beginPath(); c.moveTo(0, .6); c.lineTo(phase * .4, .9); c.stroke();
    c.fillStyle = kit.shorts; c.fillRect(-.65, -.48, .52, .96);
    c.fillStyle = kit.shirt;
    c.beginPath(); c.ellipse(.02, 0, .64, .7, 0, 0, TAU); c.fill();
    c.strokeStyle = kit.trim; c.lineWidth = .1;
    c.beginPath(); c.moveTo(-.3, -.58); c.lineTo(-.3, .58); c.stroke();
    this.dot(c, .43, 0, .34, ['#c8926c', '#c8926c', '#9d694b', '#e4b494', '#80583e'][p.id % 5]);
    this.dot(c, .55, 0, .25, ['#35281f', '#181d20', '#2b201c', '#6b5030'][p.id % 4]);
    c.restore();
    c.fillStyle = '#ecfff4';
    c.font = `700 ${Math.max(1.05, 7 / this.scale)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = '#071b1b'; c.shadowBlur = 2;
    c.fillText(String(p.number), 0, -1.3);
    c.shadowBlur = 0;
    c.restore();
  }

  drawReferee(c, x, y) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#091b2299'; c.beginPath(); c.ellipse(.2, .35, .65, .5, 0, 0, TAU); c.fill();
    c.fillStyle = '#e9e67e'; c.beginPath(); c.ellipse(0, 0, .48, .6, 0, 0, TAU); c.fill();
    c.fillStyle = '#1a252b'; c.fillRect(-.3, .3, .6, .35);
    this.dot(c, 0, -.3, .26, '#b47d59');
    c.restore();
  }

  drawBall(c, ball) {
    if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y)) return;
    const z = Math.max(0, ball.z || 0);
    const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
    this.trail.push({ x: ball.x, y: ball.y - z * .55 });
    if (this.trail.length > 6) this.trail.shift();
    if (speed > 10) {
      for (let i = 1; i < this.trail.length; i++) {
        if (Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y) > 8) continue;
        c.strokeStyle = `rgba(246,255,235,${i / this.trail.length * .14})`;
        c.lineWidth = .32; c.beginPath();
        c.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        c.lineTo(this.trail[i].x, this.trail[i].y); c.stroke();
      }
    }
    c.fillStyle = '#041b2077';
    c.beginPath(); c.ellipse(ball.x + .2, ball.y + .2, .45 + z * .04, .28 + z * .02, 0, 0, TAU); c.fill();
    const y = ball.y - z * .55;
    const radius = Math.max(.29, 2.8 / this.scale) + Math.min(z * .035, .18);
    this.dot(c, ball.x, y, radius + .055, '#18392e');
    this.dot(c, ball.x, y, radius, '#fffef1');
    this.dot(c, ball.x + radius * .15, y - radius * .1, radius * .32, '#213833');
    this.dot(c, ball.x - radius * .58, y + radius * .37, radius * .16, '#213833');
    if (z > 1) {
      c.strokeStyle = '#f4ffe347'; c.lineWidth = .08;
      c.beginPath(); c.moveTo(ball.x, ball.y); c.lineTo(ball.x, y + radius); c.stroke();
    }
  }

  drawDebug(c, engine) {
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#041714dd';
    c.fillRect(12, 12, Math.min(355, this.width - 24), 118);
    c.font = '10px monospace'; c.textAlign = 'left'; c.fillStyle = '#b8ffdb';
    const b = engine.ball;
    const lines = [
      `STATE ${engine.state} · CLOCK ${engine.clock?.display || '00:00'}`,
      `BALL ${b.x.toFixed(2)} / ${b.y.toFixed(2)} / ${(b.z || 0).toFixed(2)}`,
      `VEL ${(b.vx || 0).toFixed(2)} / ${(b.vy || 0).toFixed(2)} / ${(b.vz || 0).toFixed(2)}`,
      `TOUCH ${JSON.stringify(b.lastTouch || null)}`,
      `RESTART ${engine.restart?.type || 'NONE'} @ ${engine.restart ? `${engine.restart.x.toFixed(1)}, ${engine.restart.y.toFixed(1)}` : '—'}`,
      `DECISION ${String(engine.notification || '').slice(0, 45)}`,
    ];
    lines.forEach((line, i) => c.fillText(line, 21, 29 + i * 17));
    c.restore();
  }

  destroy() {
    this.observer?.disconnect();
    this.trail.length = 0;
  }
}

// Vẽ trận đấu lên canvas 2D theo phong cách "bản đồ tác chiến".
import { WORLD, TEAMS, UNITS, RULES } from './config';

const HULL = '#dfe7ef';
const DECK = '#8d9aa8';

function hullPath(ctx, len, wid) {
  const h = len / 2;
  const w = wid / 2;
  ctx.beginPath();
  ctx.moveTo(h, 0);
  ctx.quadraticCurveTo(h * 0.55, -w, -h * 0.75, -w);
  ctx.lineTo(-h, -w * 0.6);
  ctx.lineTo(-h, w * 0.6);
  ctx.lineTo(-h * 0.75, w);
  ctx.quadraticCurveTo(h * 0.55, w, h, 0);
  ctx.closePath();
}

function turret(ctx, x, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x, -r * 0.3, r * 2.2, r * 0.6);
}

// Vẽ một đơn vị hướng mũi sang phải, tâm tại (0,0).
export function paintUnit(ctx, type, team) {
  const def = UNITS[type];
  const { color, dark } = TEAMS[team];
  const { len, wid } = def;
  ctx.lineJoin = 'round';
  switch (type) {
    case 'jet': {
      ctx.fillStyle = HULL;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(-len / 2, -wid / 2);
      ctx.lineTo(-len / 4, 0);
      ctx.lineTo(-len / 2, wid / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(len / 2 - 4, 0);
      ctx.lineTo(-len / 6, -3);
      ctx.lineTo(-len / 6, 3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'sub': {
      ctx.fillStyle = dark;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(-4, -wid / 4, 14, wid / 2);
      break;
    }
    default: {
      hullPath(ctx, len, wid);
      ctx.fillStyle = HULL;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // dải màu phe dọc thân tàu
      ctx.fillStyle = color;
      ctx.fillRect(-len * 0.42, -wid * 0.18, len * 0.7, wid * 0.36);
      if (type === 'frigate') {
        ctx.fillStyle = DECK;
        ctx.fillRect(-8, -4, 12, 8);
        turret(ctx, 12, 2.5, dark);
      } else if (type === 'cruiser') {
        ctx.fillStyle = DECK;
        ctx.fillRect(-14, -6, 20, 12);
        turret(ctx, 18, 3.5, dark);
        turret(ctx, -26, 3, dark);
      } else if (type === 'flagship') {
        ctx.fillStyle = DECK;
        ctx.fillRect(-26, -11, 40, 22);
        ctx.fillStyle = dark;
        ctx.fillRect(-14, -6, 16, 12);
        turret(ctx, 28, 6, dark);
        turret(ctx, 44, 4.5, dark);
        turret(ctx, -42, 5, dark);
        ctx.strokeStyle = '#ffd866';
        ctx.lineWidth = 2;
        hullPath(ctx, len - 6, wid - 6);
        ctx.stroke();
      }
    }
  }
}

function makeSprite(type, team) {
  const def = UNITS[type];
  const c = document.createElement('canvas');
  c.width = Math.ceil(def.len + 12);
  c.height = Math.ceil(def.wid + 12);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  if (team === 1) ctx.scale(-1, 1); // phe ĐỎ quay mũi sang trái
  paintUnit(ctx, type, team);
  return c;
}

// Biểu tượng cho thẻ quà trên HUD (đơn vị hoặc kỹ năng).
export function paintIcon(canvas, icon) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  if (UNITS[icon]) {
    const def = UNITS[icon];
    const s = Math.min((w * 0.86) / def.len, (h * 0.8) / def.wid, 2.6);
    ctx.scale(s, s);
    paintUnit(ctx, icon, 0);
  } else if (icon === 'rally') {
    ctx.fillStyle = '#ffd866';
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * w * 0.22 - w * 0.1, h * 0.28);
      ctx.lineTo(i * w * 0.22, -h * 0.3);
      ctx.lineTo(i * w * 0.22 + w * 0.1, h * 0.28);
      ctx.lineTo(i * w * 0.22, h * 0.08);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // mưa tên lửa
    ctx.strokeStyle = '#ffb347';
    ctx.fillStyle = '#ff5a4d';
    ctx.lineWidth = Math.max(2, w * 0.04);
    for (let i = -1; i <= 1; i += 1) {
      const x = i * w * 0.25;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.12, -h * 0.38);
      ctx.lineTo(x + w * 0.04, h * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w * 0.06, h * 0.22, h * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = WORLD.w;
  c.height = WORLD.h;
  const ctx = c.getContext('2d');
  const sea = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  sea.addColorStop(0, '#06131f');
  sea.addColorStop(0.45, '#0a2a3f');
  sea.addColorStop(1, '#051019');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // vùng lãnh hải mỗi phe
  TEAMS.forEach((team) => {
    const g = ctx.createRadialGradient(WORLD.baseX[team.id], WORLD.baseY, 40, WORLD.baseX[team.id], WORLD.baseY, 620);
    g.addColorStop(0, `${team.glow}0.22)`);
    g.addColorStop(1, `${team.glow}0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  });

  // lưới toạ độ
  ctx.strokeStyle = 'rgba(120,200,255,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.h);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.h; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.w, y);
    ctx.stroke();
  }

  // vòng sonar quanh tâm chiến trường
  ctx.strokeStyle = 'rgba(120,220,255,0.09)';
  ctx.lineWidth = 2;
  for (let r = 140; r <= 700; r += 140) {
    ctx.beginPath();
    ctx.arc(WORLD.w / 2, WORLD.baseY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // đường ranh giữa hai phe
  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(WORLD.w / 2, WORLD.laneTop - 40);
  ctx.lineTo(WORLD.w / 2, WORLD.laneBottom + 40);
  ctx.stroke();
  ctx.setLineDash([]);
  return c;
}

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    canvas.width = WORLD.w;
    canvas.height = WORLD.h;
    this.ctx = canvas.getContext('2d');
    this.bg = makeBackground();
    this.sprites = {};
    Object.keys(UNITS).forEach((type) => {
      this.sprites[type] = [makeSprite(type, 0), makeSprite(type, 1)];
    });
    this.avatars = new Map();
    this.t = 0;
  }

  avatar(url) {
    if (!url) return null;
    let entry = this.avatars.get(url);
    if (!entry) {
      const img = new Image();
      entry = { img, ok: false };
      img.onload = () => {
        entry.ok = true;
      };
      img.referrerPolicy = 'no-referrer';
      img.src = url;
      this.avatars.set(url, entry);
    }
    return entry.ok ? entry.img : null;
  }

  drawBase(game, base) {
    const { ctx } = this;
    const team = TEAMS[base.team];
    const alive = base.hp > 0;
    const r = RULES.baseRadius;
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.35;
    hexPath(ctx, base.x, base.y, r + 14);
    ctx.fillStyle = `${team.glow}0.18)`;
    ctx.fill();
    hexPath(ctx, base.x, base.y, r);
    ctx.fillStyle = '#1b2733';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = team.color;
    ctx.stroke();
    hexPath(ctx, base.x, base.y, r * 0.55);
    ctx.fillStyle = team.dark;
    ctx.fill();
    // tia quét radar
    if (alive) {
      const a = this.t * 1.6 * (base.team === 0 ? 1 : -1);
      ctx.strokeStyle = team.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x + Math.cos(a) * r * 0.5, base.y + Math.sin(a) * r * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(team.key, base.x, base.y - r - 44);
    ctx.restore();
  }

  drawUnit(game, u) {
    const { ctx } = this;
    const def = UNITS[u.type];
    const sprite = this.sprites[u.type][u.team];
    const team = TEAMS[u.team];
    const buffed = game.teams[u.team].buff > 0;
    const dir = u.team === 0 ? 1 : -1;

    if (def.air) {
      // bóng máy bay trên mặt biển
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(u.x + 10, u.y + 22, def.len * 0.4, def.wid * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.moving && u.type !== 'sub') {
      // vệt sóng đuôi tàu
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = Math.max(1.5, def.wid * 0.18);
      ctx.beginPath();
      ctx.moveTo(u.x - dir * def.len * 0.5, u.y);
      ctx.lineTo(u.x - dir * def.len * 1.1, u.y);
      ctx.stroke();
    }
    if (buffed) {
      ctx.fillStyle = `${team.glow}0.22)`;
      ctx.beginPath();
      ctx.ellipse(u.x, u.y, def.len * 0.7, def.wid * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.type === 'sub') ctx.globalAlpha = 0.8;
    ctx.drawImage(sprite, Math.round(u.x - sprite.width / 2), Math.round(u.y - sprite.height / 2));
    ctx.globalAlpha = 1;

    if (def.hero || (u.maxHp >= 400 && u.hp < u.maxHp)) {
      const w = def.hero ? 96 : 44;
      const y = u.y - def.wid / 2 - (def.hero ? 16 : 10);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(u.x - w / 2, y, w, def.hero ? 7 : 4);
      ctx.fillStyle = team.color;
      ctx.fillRect(u.x - w / 2, y, w * Math.max(0, u.hp / u.maxHp), def.hero ? 7 : 4);
    }
  }

  drawHeroLabel(game, u) {
    const { ctx } = this;
    const def = UNITS[u.type];
    const owner = u.owner ? game.players.get(u.owner) : null;
    if (!owner) return;
    const team = TEAMS[u.team];
    const cx = u.x - 62;
    const cy = u.y - def.wid / 2 - 14;
    const r = 15;
    const img = this.avatar(owner.avatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = team.dark;
    ctx.fill();
    if (img) {
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((owner.name || '?').slice(0, 1).toUpperCase(), cx, cy + 1);
    }
    ctx.restore();
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const name = owner.name.length > 14 ? `${owner.name.slice(0, 13)}…` : owner.name;
    ctx.strokeText(name, u.x - 44, cy - 7);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, u.x - 44, cy - 7);
  }

  draw(game, dt) {
    const { ctx } = this;
    this.t += dt;
    ctx.drawImage(this.bg, 0, 0);

    // gợn sóng lấp lánh
    ctx.strokeStyle = 'rgba(160,220,255,0.10)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 46; i += 1) {
      const x = ((i * 197 + this.t * (12 + (i % 5) * 4)) % (WORLD.w + 80)) - 40;
      const y = (i * 311) % WORLD.h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 14, y - 5, x + 28, y);
      ctx.stroke();
    }

    this.drawBase(game, game.bases[0]);
    this.drawBase(game, game.bases[1]);

    // cảnh báo điểm rơi tên lửa
    for (const s of game.strikes) {
      const k = 1 - Math.max(0, s.delay) / s.total;
      ctx.strokeStyle = `rgba(255,120,60,${0.25 + 0.5 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (1.15 - 0.15 * k), 0, Math.PI * 2);
      ctx.stroke();
      if (s.delay < 0.5) {
        // tên lửa đang lao xuống
        const f = s.delay / 0.5;
        ctx.strokeStyle = '#ffd08a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s.x - 260 * f - 30, s.y - 620 * f - 70);
        ctx.lineTo(s.x - 260 * f, s.y - 620 * f);
        ctx.stroke();
      }
    }

    const heroes = [];
    const air = [];
    for (const u of game.units) {
      if (UNITS[u.type].air) air.push(u);
      else {
        this.drawUnit(game, u);
        if (UNITS[u.type].hero) heroes.push(u);
      }
    }

    // đạn
    ctx.lineCap = 'round';
    for (const p of game.projectiles) {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const tail = p.big ? 26 : 13;
      ctx.strokeStyle = p.big ? '#ffe08a' : TEAMS[p.team].color;
      ctx.lineWidth = p.big ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (dx / d) * tail, p.y - (dy / d) * tail);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    for (const u of air) this.drawUnit(game, u);

    // vụ nổ
    for (const e of game.effects) {
      const k = e.t / e.life;
      const r = e.r * (0.35 + 0.65 * k);
      ctx.fillStyle = `rgba(255,${Math.round(210 - 120 * k)},70,${0.75 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const u of heroes) this.drawHeroLabel(game, u);
  }
}

// Lõi mô phỏng trận đấu. Không phụ thuộc React hay canvas để có thể test độc lập.
import { WORLD, RULES, UNITS, SKILLS, GIFT_TIERS, POINTS, TEAMS } from './config';

const rand = (a, b) => a + Math.random() * (b - a);

// Khoá tuần (thứ Hai đầu tuần) dùng cho bảng xếp hạng tuần.
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return `fleet-week-${d.toISOString().slice(0, 10)}`;
}

export function parseTeam(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === '1' || t === 'xanh') return 0;
  if (t === '2' || t === 'đỏ' || t === 'do') return 1;
  return null;
}

export function tierFor(diamonds) {
  return GIFT_TIERS.find((tier) => diamonds >= tier.min) || GIFT_TIERS[GIFT_TIERS.length - 1];
}

export class Game {
  constructor(storage = null) {
    this.storage = storage;
    this.key = weekKey();
    this.weekly = this.loadWeekly();
    this.players = new Map();
    this.wins = [0, 0];
    this.round = 0;
    this.nextId = 1;
    this.saveTimer = 0;
    this.resetRound();
  }

  loadWeekly() {
    try {
      return JSON.parse(this.storage?.getItem(this.key) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  saveWeekly() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.weekly));
    } catch (e) {
      // Bộ nhớ đầy hoặc bị chặn: bỏ qua, trận đấu vẫn chạy.
    }
  }

  resetRound() {
    this.round += 1;
    this.phase = 'battle';
    this.time = 0;
    this.resultLeft = 0;
    this.winner = null;
    this.units = [];
    this.byTeam = [[], []];
    this.projectiles = [];
    this.effects = [];
    this.strikes = [];
    this.feed = [];
    this.bases = TEAMS.map((team) => ({
      isBase: true,
      team: team.id,
      x: WORLD.baseX[team.id],
      y: WORLD.baseY,
      hp: RULES.baseHp,
      maxHp: RULES.baseHp,
      cd: 0,
    }));
    this.teams = TEAMS.map(() => ({ score: 0, buff: 0, queue: [], trickle: 0 }));
    for (const p of this.players.values()) {
      p.round = 0;
      p.team = null; // mỗi trận người xem chọn phe lại
      p.likes = 0;
      p.lastChatSpawn = -999;
    }
  }

  // ---------- người chơi & điểm ----------

  getPlayer(user) {
    let p = this.players.get(user.id);
    if (!p) {
      p = { id: user.id, name: user.name || user.id, avatar: user.avatar || '', team: null, round: 0, likes: 0, lastChatSpawn: -999 };
      this.players.set(user.id, p);
    } else {
      if (user.name) p.name = user.name;
      if (user.avatar) p.avatar = user.avatar;
    }
    return p;
  }

  memberCount(team) {
    let n = 0;
    for (const p of this.players.values()) if (p.team === team) n += 1;
    return n;
  }

  // Người chưa chọn phe mà đã tương tác thì vào phe đang ít người hơn.
  ensureTeam(p, wanted = null) {
    if (p.team !== null) return false;
    if (wanted !== null) p.team = wanted;
    else p.team = this.memberCount(0) <= this.memberCount(1) ? 0 : 1;
    this.addScore(p, POINTS.join);
    return true;
  }

  addScore(p, pts) {
    if (!p || p.team === null || pts <= 0) return;
    p.round += pts;
    this.teams[p.team].score += pts;
    const w = this.weekly[p.id] || (this.weekly[p.id] = { n: p.name, a: p.avatar, s: 0 });
    w.n = p.name;
    w.a = p.avatar;
    w.s += pts;
  }

  pushFeed(team, text) {
    this.feed.push({ id: this.nextId++, team, text, at: this.time });
    if (this.feed.length > 6) this.feed.shift();
  }

  // ---------- sự kiện từ TikTok ----------

  handleEvent(ev) {
    if (!ev || !ev.user || !ev.user.id || this.phase !== 'battle') return;
    const p = this.getPlayer(ev.user);
    switch (ev.type) {
      case 'chat': {
        const wanted = parseTeam(ev.text);
        if (p.team === null) {
          if (wanted === null) return;
          this.ensureTeam(p, wanted);
          this.enqueue(p.team, 'skiff', 2, p.id);
          this.pushFeed(p.team, `${p.name} gia nhập phe ${TEAMS[p.team].name}`);
        } else if (this.time - p.lastChatSpawn >= RULES.chatSpawnCooldown) {
          p.lastChatSpawn = this.time;
          this.enqueue(p.team, 'skiff', 1, p.id);
        }
        break;
      }
      case 'like': {
        this.ensureTeam(p);
        const count = Math.max(1, Math.min(200, ev.count || 1));
        p.likes += count;
        const boats = Math.min(5, Math.floor(p.likes / RULES.likesPerSkiff));
        p.likes -= boats * RULES.likesPerSkiff;
        if (boats > 0) this.enqueue(p.team, 'skiff', boats, p.id);
        this.addScore(p, count * POINTS.like);
        break;
      }
      case 'follow':
        this.ensureTeam(p);
        this.enqueue(p.team, 'frigate', 1, p.id);
        this.addScore(p, POINTS.follow);
        this.pushFeed(p.team, `${p.name} đã follow → Tàu hộ vệ`);
        break;
      case 'share':
        this.ensureTeam(p);
        this.enqueue(p.team, 'frigate', 2, p.id);
        this.addScore(p, POINTS.share);
        this.pushFeed(p.team, `${p.name} đã chia sẻ → 2 Tàu hộ vệ`);
        break;
      case 'gift': {
        this.ensureTeam(p);
        const diamonds = Math.max(1, ev.diamonds || 1);
        const count = Math.max(1, Math.min(999, ev.count || 1));
        const tier = tierFor(diamonds);
        for (const [type, n] of tier.units) this.enqueue(p.team, type, n * count, p.id);
        if (tier.skill === 'rally') this.rally(p.team, count);
        if (tier.skill === 'barrage') this.barrage(p.team, p.id, Math.min(count, 5));
        this.addScore(p, diamonds * count * POINTS.perDiamond);
        const times = count > 1 ? ` ×${count}` : '';
        this.pushFeed(p.team, `${p.name} tặng ${ev.giftName || 'quà'}${times} → ${tier.label}`);
        break;
      }
      default:
        break;
    }
  }

  enqueue(team, type, count, owner = null) {
    const q = this.teams[team].queue;
    for (let i = 0; i < count && q.length < RULES.maxQueue; i += 1) q.push({ type, owner });
  }

  rally(team, stacks = 1) {
    const t = this.teams[team];
    t.buff = Math.min(RULES.buffMaxSeconds, t.buff + RULES.buffSeconds * stacks);
  }

  barrage(team, owner, waves = 1) {
    const cfg = SKILLS.barrage;
    const enemies = this.byTeam[1 - team];
    const enemyBase = this.bases[1 - team];
    const dir = team === 0 ? -1 : 1; // hướng từ căn cứ địch ra giữa bản đồ
    for (let i = 0; i < cfg.strikes * waves; i += 1) {
      const target = enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
      this.strikes.push({
        team,
        owner,
        x: target ? target.x + rand(-30, 30) : enemyBase.x + dir * rand(60, 330),
        y: target ? target.y + rand(-30, 30) : rand(WORLD.laneTop, WORLD.laneBottom),
        delay: 0.6 + i * 0.16,
        total: 0.6 + i * 0.16,
        dmg: cfg.dmg,
        r: cfg.radius,
      });
    }
  }

  // ---------- mô phỏng ----------

  spawn(team, type, owner) {
    const def = UNITS[type];
    const dir = team === 0 ? 1 : -1;
    const laneY = rand(WORLD.laneTop + 20, WORLD.laneBottom - 20);
    const unit = {
      id: this.nextId++,
      type,
      team,
      owner,
      x: WORLD.baseX[team] + dir * rand(70, 120),
      y: WORLD.baseY + (laneY - WORLD.baseY) * 0.35,
      laneY,
      hp: def.hp,
      maxHp: def.hp,
      cd: rand(0, def.cd),
      think: rand(0, 0.3),
      target: null,
      moving: true,
    };
    this.units.push(unit);
    this.byTeam[team].push(unit);
    return unit;
  }

  findTarget(u, radius) {
    const enemies = this.byTeam[1 - u.team];
    let best = null;
    let bestD = radius * radius;
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      const dx = e.x - u.x;
      const dy = e.y - u.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  fire(from, target, dmg, owner, splash = 0) {
    const atk = this.teams[from.team].buff > 0 ? 2 : 1;
    this.projectiles.push({
      x: from.x,
      y: from.y,
      tx: target.x,
      ty: target.y,
      target,
      team: from.team,
      owner,
      dmg: dmg * atk,
      splash,
      big: dmg >= 60,
      speed: dmg >= 60 ? 420 : 620,
    });
  }

  damage(target, dmg, ownerId) {
    if (target.hp <= 0 || this.phase !== 'battle') return;
    const amount = this.teams[target.team].buff > 0 ? dmg * 0.5 : dmg;
    target.hp -= amount;
    const attacker = ownerId ? this.players.get(ownerId) : null;
    if (target.isBase) {
      this.addScore(attacker, amount * POINTS.baseDamage);
      if (target.hp <= 0) {
        target.hp = 0;
        this.effects.push({ x: target.x, y: target.y, t: 0, life: 1.6, r: 260 });
        this.finish(1 - target.team);
      }
    } else if (target.hp <= 0) {
      const def = UNITS[target.type];
      this.effects.push({ x: target.x, y: target.y, t: 0, life: 0.5 + def.len / 160, r: def.len * 0.8 });
      this.addScore(attacker, def.bounty);
    }
  }

  explode(x, y, r, dmg, team, owner) {
    const enemies = this.byTeam[1 - team];
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (Math.hypot(e.x - x, e.y - y) <= r) this.damage(e, dmg, owner);
    }
    const base = this.bases[1 - team];
    if (Math.hypot(base.x - x, base.y - y) <= r + RULES.baseRadius) this.damage(base, dmg * 0.5, owner);
  }

  stepUnit(u, dt) {
    const def = UNITS[u.type];
    u.cd -= dt;
    u.think -= dt;
    if (u.think <= 0 || (u.target && u.target.hp <= 0)) {
      u.think = 0.25 + Math.random() * 0.15;
      u.target = this.findTarget(u, def.range * 1.7);
    }
    u.moving = false;
    if (u.target) {
      const dx = u.target.x - u.x;
      const dy = u.target.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= def.range) {
        if (u.cd <= 0) {
          u.cd = def.cd;
          this.fire(u, u.target, def.dmg, u.owner, def.splash || 0);
        }
      } else {
        u.x += (dx / d) * def.speed * dt;
        u.y += (dy / d) * def.speed * dt;
        u.moving = true;
      }
      return;
    }
    const base = this.bases[1 - u.team];
    if (Math.abs(base.x - u.x) <= def.range + RULES.baseRadius) {
      if (u.cd <= 0) {
        u.cd = def.cd;
        this.fire(u, base, def.dmg * (def.baseBonus || 1), u.owner, 0);
      }
    } else {
      u.x += (u.team === 0 ? 1 : -1) * def.speed * dt;
      u.y += (u.laneY - u.y) * Math.min(1, dt * 1.2);
      u.moving = true;
    }
  }

  stepBase(base, dt) {
    base.cd -= dt;
    if (base.cd > 0) return;
    const target = this.findTarget(base, RULES.baseRange);
    if (!target) return;
    base.cd = RULES.baseCooldown;
    this.fire(base, target, RULES.baseDamage, null, 0);
  }

  stepProjectiles(dt) {
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      if (p.target.hp > 0) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d > step) {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
        continue;
      }
      if (p.splash) this.explode(p.tx, p.ty, p.splash, p.dmg, p.team, p.owner);
      else this.damage(p.target, p.dmg, p.owner);
      // Căn cứ vừa sập: finish() đã dọn sạch danh sách đạn.
      if (this.phase !== 'battle') return;
      if (p.big) this.effects.push({ x: p.tx, y: p.ty, t: 0, life: 0.35, r: 26 + p.splash * 0.5 });
      list[i] = list[list.length - 1];
      list.pop();
    }
  }

  stepStrikes(dt) {
    for (let i = this.strikes.length - 1; i >= 0; i -= 1) {
      const s = this.strikes[i];
      s.delay -= dt;
      if (s.delay > 0) continue;
      this.explode(s.x, s.y, s.r, s.dmg, s.team, s.owner);
      if (this.phase !== 'battle') return;
      this.effects.push({ x: s.x, y: s.y, t: 0, life: 0.7, r: s.r });
      this.strikes.splice(i, 1);
    }
  }

  finish(winner) {
    if (this.phase !== 'battle') return;
    this.phase = 'result';
    this.winner = winner; // null = hoà
    this.resultLeft = RULES.resultSeconds;
    if (winner !== null) this.wins[winner] += 1;
    this.projectiles.length = 0;
    this.strikes.length = 0;
    this.saveWeekly();
  }

  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const e = this.effects[i];
      e.t += dt;
      if (e.t >= e.life) this.effects.splice(i, 1);
    }

    if (this.phase === 'result') {
      this.resultLeft -= dt;
      if (this.resultLeft <= 0) this.resetRound();
      return;
    }

    this.time += dt;
    for (let t = 0; t < 2; t += 1) {
      const team = this.teams[t];
      team.buff = Math.max(0, team.buff - dt);
      team.trickle += dt;
      if (team.trickle >= RULES.trickleSeconds) {
        team.trickle = 0;
        this.enqueue(t, 'skiff', 1, null);
      }
      let budget = RULES.spawnPerTick;
      while (budget > 0 && team.queue.length && this.byTeam[t].length < RULES.maxUnitsPerTeam) {
        const next = team.queue.shift();
        this.spawn(t, next.type, next.owner);
        budget -= 1;
      }
    }

    for (let i = 0; i < this.units.length; i += 1) {
      if (this.units[i].hp > 0) this.stepUnit(this.units[i], dt);
    }
    this.stepBase(this.bases[0], dt);
    this.stepBase(this.bases[1], dt);
    this.stepProjectiles(dt);
    this.stepStrikes(dt);

    if (this.phase !== 'battle') return;
    this.units = this.units.filter((u) => u.hp > 0);
    this.byTeam[0] = this.units.filter((u) => u.team === 0);
    this.byTeam[1] = this.units.filter((u) => u.team === 1);

    if (this.time >= RULES.roundSeconds) {
      const a = this.bases[0].hp;
      const b = this.bases[1].hp;
      this.finish(a === b ? null : a > b ? 0 : 1);
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.saveWeekly();
    }
  }

  // ---------- dữ liệu cho giao diện ----------

  topPlayers(team, n = 3) {
    const list = [];
    for (const p of this.players.values()) if (p.team === team && p.round > 0) list.push(p);
    list.sort((a, b) => b.round - a.round);
    return list.slice(0, n).map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      round: Math.floor(p.round),
      weekly: Math.floor(this.weekly[p.id]?.s || 0),
    }));
  }

  snapshot() {
    return {
      round: this.round,
      phase: this.phase,
      winner: this.winner,
      resultLeft: Math.ceil(this.resultLeft),
      timeLeft: Math.max(0, Math.ceil(RULES.roundSeconds - this.time)),
      wins: this.wins.slice(),
      teams: this.teams.map((t, i) => ({
        hp: Math.max(0, Math.ceil(this.bases[i].hp)),
        maxHp: this.bases[i].maxHp,
        score: Math.floor(t.score),
        buff: Math.ceil(t.buff),
        units: this.byTeam[i].length,
        waiting: t.queue.length,
        members: this.memberCount(i),
        top: this.topPlayers(i),
      })),
      feed: this.feed.filter((f) => this.time - f.at < 6).slice(-4),
    };
  }
}

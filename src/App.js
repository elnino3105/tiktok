import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Game } from './game/engine';
import { Renderer, paintIcon } from './game/renderer';
import { connectBridge, startDemo, demoUser } from './game/eventSource';
import { TEAMS, GIFT_TIERS } from './game/config';

const params = new URLSearchParams(window.location.search);
const WS_URL = params.get('ws') || 'ws://localhost:8081';
const STEP = 1 / 30;

const fmt = (n) => Number(n).toLocaleString('vi-VN');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Icon({ name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) paintIcon(ref.current, name);
  }, [name]);
  return <canvas ref={ref} width={120} height={56} className="card-icon" />;
}

function Avatar({ player, team }) {
  const [broken, setBroken] = useState(false);
  if (player.avatar && !broken) {
    return <img className="avatar" src={player.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return (
    <span className="avatar avatar-fallback" style={{ background: TEAMS[team].dark }}>
      {player.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function TopList({ team, players }) {
  return (
    <div className={`top top-${team}`}>
      {players.map((p, i) => (
        <div className="top-row" key={p.id}>
          <span className="top-rank">{i + 1}</span>
          <Avatar player={p} team={team} />
          <span className="top-text">
            <span className="top-name">{p.name}</span>
            <span className="top-score">
              {fmt(p.round)} · tuần {fmt(p.weekly)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// Thẻ quà hiển thị từ rẻ đến đắt.
const CARDS = [...GIFT_TIERS].reverse();

export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const demoRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [status, setStatus] = useState({ bridge: false, live: false });
  const [demo, setDemo] = useState(params.get('demo') === '1');
  const [panel, setPanel] = useState(params.get('debug') === '1');

  // Vòng lặp game: mô phỏng theo nhịp cố định, vẽ theo tốc độ màn hình.
  useEffect(() => {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch (e) {
      storage = null;
    }
    const game = new Game(storage);
    gameRef.current = game;
    const renderer = new Renderer(canvasRef.current);
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const frame = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= STEP) {
        game.update(STEP);
        acc -= STEP;
      }
      renderer.draw(game, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hud = setInterval(() => setSnap(game.snapshot()), 200);
    const save = () => game.saveWeekly();
    window.addEventListener('beforeunload', save);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(hud);
      window.removeEventListener('beforeunload', save);
      save();
    };
  }, []);

  useEffect(() => connectBridge(WS_URL, (ev) => gameRef.current?.handleEvent(ev), setStatus), []);

  useEffect(() => {
    if (!demo) return undefined;
    const handle = startDemo((ev) => gameRef.current?.handleEvent(ev));
    demoRef.current = handle;
    return () => {
      handle.stop();
      demoRef.current = null;
    };
  }, [demo]);

  // Sang trận mới, người xem giả lập cũng phải chọn phe lại.
  const round = snap?.round;
  useEffect(() => {
    demoRef.current?.resetTeams();
  }, [round]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'h' || e.key === 'H') setPanel((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const send = (team, type, extra = {}) => {
    const game = gameRef.current;
    if (!game) return;
    const user = demoUser(team === 0 ? 0 : 1);
    user.id = `test-${team}`;
    user.name = team === 0 ? 'Thử nghiệm Xanh' : 'Thử nghiệm Đỏ';
    game.handleEvent({ type: 'chat', user, text: TEAMS[team].key });
    game.handleEvent({ type, user, ...extra });
  };

  return (
    <div className="page">
      <div className="stage">
        <canvas ref={canvasRef} className="battle" />

        {snap && (
          <div className="hud">
            <header className="title">
              <h1>ĐẠI CHIẾN HẠM ĐỘI</h1>
              <p>
                Gõ <b className="c0">1</b> vào phe <b className="c0">XANH</b> · gõ <b className="c1">2</b> vào phe{' '}
                <b className="c1">ĐỎ</b> · thả tim và tặng quà để gọi tàu
              </p>
            </header>

            <div className="cards">
              {CARDS.map((tier) => (
                <div className="card" key={tier.min}>
                  <Icon name={tier.icon} />
                  <span className="card-label">{tier.label}</span>
                  <span className="card-cost">{tier.min} xu</span>
                </div>
              ))}
            </div>

            <div className="bars">
              <div className="bar bar-0">
                <div className="bar-fill" style={{ width: `${(snap.teams[0].hp / snap.teams[0].maxHp) * 100}%` }} />
                <span className="bar-text">{fmt(snap.teams[0].hp)}</span>
              </div>
              <div className="timer">
                <span className="timer-clock">{clock(snap.timeLeft)}</span>
                <span className="timer-wins">
                  {snap.wins[0]} – {snap.wins[1]}
                </span>
              </div>
              <div className="bar bar-1">
                <div className="bar-fill" style={{ width: `${(snap.teams[1].hp / snap.teams[1].maxHp) * 100}%` }} />
                <span className="bar-text">{fmt(snap.teams[1].hp)}</span>
              </div>
            </div>
            <div className="stats">
              {snap.teams.map((t, i) => (
                <span key={TEAMS[i].id} className={`c${i}`}>
                  {fmt(t.score)} điểm · {t.members} người · {t.units} tàu
                  {t.waiting > 0 ? ` (+${t.waiting})` : ''}
                </span>
              ))}
            </div>

            <TopList team={0} players={snap.teams[0].top} />
            <TopList team={1} players={snap.teams[1].top} />

            {snap.teams.map((t, i) =>
              t.buff > 0 ? (
                <div key={TEAMS[i].id} className={`buff buff-${i}`}>
                  <b>TĂNG LỰC</b>
                  <span>Công ×2 · Thủ ×2</span>
                  <span className="buff-time">{t.buff}s</span>
                </div>
              ) : null
            )}

            <div className="feed">
              {snap.feed.map((f) => (
                <div key={f.id} className={`feed-row feed-${f.team}`}>
                  {f.text}
                </div>
              ))}
            </div>

            {snap.phase === 'result' && (
              <div className="result">
                <div className={`result-box ${snap.winner === null ? '' : `win-${snap.winner}`}`}>
                  <h2>{snap.winner === null ? 'HOÀ' : `PHE ${TEAMS[snap.winner].name} THẮNG`}</h2>
                  {snap.winner !== null && snap.teams[snap.winner].top.length > 0 && (
                    <>
                      <p className="result-sub">Công thần của trận</p>
                      <TopList team={snap.winner} players={snap.teams[snap.winner].top} />
                    </>
                  )}
                  <p className="result-next">Trận mới bắt đầu sau {snap.resultLeft}s</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {panel && (
        <aside className="panel">
          <h3>Bảng điều khiển (phím H để ẩn)</h3>
          <p className="panel-status">
            Cầu nối: {status.bridge ? 'đã kết nối' : 'chưa kết nối'} · TikTok:{' '}
            {status.live ? `đang nhận từ @${status.username}` : 'chưa có phòng live'}
          </p>
          <label className="panel-demo">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Tự giả lập người xem
          </label>
          {TEAMS.map((team) => (
            <div className="panel-team" key={team.id}>
              <b style={{ color: team.color }}>Phe {team.name}</b>
              <button onClick={() => send(team.id, 'like', { count: 30 })}>30 tim</button>
              <button onClick={() => send(team.id, 'follow')}>Follow</button>
              {CARDS.map((tier) => (
                <button key={tier.min} onClick={() => send(team.id, 'gift', { diamonds: tier.min, giftName: `Quà ${tier.min} xu`, count: 1 })}>
                  {tier.min} xu
                </button>
              ))}
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

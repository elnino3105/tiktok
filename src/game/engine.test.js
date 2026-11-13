import { Game, parseTeam, tierFor } from './engine';
import { RULES } from './config';

const user = (id) => ({ id, name: id, avatar: '' });
const run = (game, seconds) => {
  for (let i = 0; i < seconds * 30; i += 1) game.update(1 / 30);
};

test('đọc lệnh chọn phe từ bình luận', () => {
  expect(parseTeam(' 1 ')).toBe(0);
  expect(parseTeam('Đỏ')).toBe(1);
  expect(parseTeam('xin chào')).toBe(null);
});

test('quà rơi đúng bậc theo giá xu', () => {
  expect(tierFor(1).icon).toBe('skiff');
  expect(tierFor(7).icon).toBe('frigate');
  expect(tierFor(5000).icon).toBe('barrage');
});

test('bình luận 1/2 đưa người xem vào phe và sinh quân', () => {
  const game = new Game();
  game.handleEvent({ type: 'chat', user: user('a'), text: '1' });
  game.handleEvent({ type: 'chat', user: user('b'), text: '2' });
  game.handleEvent({ type: 'chat', user: user('c'), text: 'hello' });
  expect(game.players.get('a').team).toBe(0);
  expect(game.players.get('b').team).toBe(1);
  expect(game.players.get('c').team).toBe(null);
  run(game, 1);
  expect(game.byTeam[0].length).toBe(2);
  expect(game.byTeam[1].length).toBe(2);
});

test('người tặng quà chưa chọn phe được xếp vào phe ít người hơn', () => {
  const game = new Game();
  game.handleEvent({ type: 'chat', user: user('a'), text: '1' });
  game.handleEvent({ type: 'gift', user: user('b'), diamonds: 499, giftName: 'x', count: 1 });
  expect(game.players.get('b').team).toBe(1);
  run(game, 1);
  expect(game.byTeam[1].some((u) => u.type === 'flagship')).toBe(true);
  expect(game.snapshot().teams[1].top[0].id).toBe('b');
});

test('quà tăng lực bật buff và giới hạn thời gian cộng dồn', () => {
  const game = new Game();
  game.handleEvent({ type: 'gift', user: user('a'), diamonds: 199, giftName: 'x', count: 10 });
  expect(game.teams[game.players.get('a').team].buff).toBe(RULES.buffMaxSeconds);
});

test('phe được tặng quà lớn phá căn cứ địch, rồi trận mới tự bắt đầu', () => {
  const game = new Game();
  game.handleEvent({ type: 'chat', user: user('a'), text: '1' });
  game.handleEvent({ type: 'gift', user: user('a'), diamonds: 499, giftName: 'x', count: 8 });
  let ticks = 0;
  while (game.phase === 'battle' && ticks < (RULES.roundSeconds - 1) * 30) {
    game.update(1 / 30);
    ticks += 1;
  }
  expect(game.phase).toBe('result');
  expect(game.winner).toBe(0);
  expect(game.wins).toEqual([1, 0]);
  run(game, RULES.resultSeconds + 1);
  expect(game.phase).toBe('battle');
  expect(game.round).toBe(2);
  expect(game.bases[1].hp).toBe(RULES.baseHp);
  expect(game.players.get('a').team).toBe(null);
});

test('hết giờ thì phe còn nhiều máu căn cứ hơn thắng', () => {
  const game = new Game();
  game.bases[1].hp -= 100;
  game.time = RULES.roundSeconds - 0.1;
  run(game, 1);
  expect(game.phase).toBe('result');
  expect(game.winner).toBe(0);
});

test('điểm tuần được lưu qua bộ nhớ', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const game = new Game(storage);
  game.handleEvent({ type: 'gift', user: user('a'), diamonds: 10, giftName: 'x', count: 2 });
  game.saveWeekly();
  const again = new Game(storage);
  expect(again.weekly.a.s).toBeGreaterThanOrEqual(200);
});

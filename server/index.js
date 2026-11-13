// Cầu nối TikTok LIVE -> WebSocket.
// Chạy:  node index.js <tên_tài_khoản_đang_live>
// Game (trình duyệt) kết nối tới ws://localhost:8081 và nhận các sự kiện đã chuẩn hoá:
//   { type: 'chat' | 'like' | 'gift' | 'follow' | 'share',
//     user: { id, name, avatar }, text, count, diamonds, giftName }
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const username = (process.argv[2] || process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
const port = Number(process.env.PORT || 8081);

if (!username) {
  console.error('Thiếu tên tài khoản. Cách dùng: node index.js <tên_tài_khoản_tiktok>');
  process.exit(1);
}

const wss = new WebSocketServer({ port });
let status = { type: 'status', connected: false, username };

function broadcast(msg) {
  const text = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(text);
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify(status));
});
console.log(`[bridge] WebSocket đang nghe tại ws://localhost:${port}`);

function toUser(user) {
  if (!user) return null;
  const id = user.uniqueId || user.userId;
  if (!id) return null;
  return {
    id: String(id),
    name: user.nickname || String(id),
    avatar: user.profilePicture?.urls?.[0] || '',
  };
}

function emit(type, data, extra = {}) {
  const user = toUser(data.user);
  if (!user) return;
  broadcast({ type, user, ...extra });
}

const connection = new TikTokLiveConnection(username, {
  // Không phát lại lịch sử chat cũ khi vừa kết nối, tránh sinh quân "ma".
  processInitialData: false,
  signApiKey: process.env.EULER_API_KEY || undefined,
});

connection.on(WebcastEvent.CHAT, (data) => {
  emit('chat', data, { text: String(data.comment || '').slice(0, 80) });
});

connection.on(WebcastEvent.LIKE, (data) => {
  emit('like', data, { count: Number(data.likeCount) || 1 });
});

connection.on(WebcastEvent.GIFT, (data) => {
  const details = data.giftDetails;
  // Quà dạng combo (giftType 1) bắn nhiều sự kiện; chỉ tính khi combo kết thúc.
  if (details?.giftType === 1 && !data.repeatEnd) return;
  emit('gift', data, {
    giftName: details?.giftName || `#${data.giftId}`,
    diamonds: Number(details?.diamondCount) || 1,
    count: Number(data.repeatCount) || 1,
  });
});

connection.on(WebcastEvent.FOLLOW, (data) => emit('follow', data));
connection.on(WebcastEvent.SHARE, (data) => emit('share', data));

connection.on(ControlEvent.ERROR, ({ info }) => {
  console.error('[tiktok] lỗi:', info);
});

let retryDelay = 5000;
let retryTimer = null;

function scheduleReconnect() {
  if (retryTimer) return;
  console.log(`[tiktok] thử kết nối lại sau ${retryDelay / 1000}s`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60000);
}

async function connect() {
  try {
    const state = await connection.connect();
    retryDelay = 5000;
    status = { type: 'status', connected: true, username };
    broadcast(status);
    console.log(`[tiktok] đã kết nối phòng live của @${username} (roomId ${state.roomId})`);
  } catch (err) {
    console.error(`[tiktok] không kết nối được @${username}:`, err?.message || err);
    scheduleReconnect();
  }
}

function onLost(reason) {
  status = { type: 'status', connected: false, username };
  broadcast(status);
  console.log(`[tiktok] mất kết nối (${reason})`);
  scheduleReconnect();
}

connection.on(ControlEvent.DISCONNECTED, () => onLost('disconnected'));
connection.on(WebcastEvent.STREAM_END, () => onLost('phiên live đã kết thúc'));

connect();

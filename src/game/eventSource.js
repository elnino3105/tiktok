// Nguồn sự kiện cho game: cầu nối WebSocket thật, hoặc bộ giả lập để thử nghiệm.

// Kết nối tới server/index.js, tự kết nối lại khi rớt. Trả về hàm huỷ.
export function connectBridge(url, onEvent, onStatus) {
  let socket = null;
  let timer = null;
  let closed = false;

  const open = () => {
    if (closed) return;
    onStatus({ bridge: false, live: false });
    try {
      socket = new WebSocket(url);
    } catch (e) {
      timer = setTimeout(open, 3000);
      return;
    }
    socket.onopen = () => onStatus({ bridge: true, live: false });
    socket.onmessage = (msg) => {
      let data;
      try {
        data = JSON.parse(msg.data);
      } catch (e) {
        return;
      }
      if (data.type === 'status') onStatus({ bridge: true, live: !!data.connected, username: data.username });
      else onEvent(data);
    };
    socket.onclose = () => {
      onStatus({ bridge: false, live: false });
      if (!closed) timer = setTimeout(open, 3000);
    };
    socket.onerror = () => socket.close();
  };

  open();
  return () => {
    closed = true;
    clearTimeout(timer);
    if (socket) socket.close();
  };
}

const NAMES = [
  'Bảo Anh', 'Hải Đăng', 'Thuỷ Tiên', 'Quốc Khánh', 'Mai Chi', 'Gia Huy', 'Ngọc Lan', 'Tuấn Kiệt',
  'Phương Nhi', 'Đức Minh', 'Khánh Vy', 'Hoàng Nam', 'Thanh Trúc', 'Nhật Quang', 'Yến Nhi', 'Trọng Nghĩa',
];
const DEMO_GIFTS = [
  [1, 'Hoa hồng'], [1, 'Hoa hồng'], [1, 'Hoa hồng'], [5, 'Kem ốc quế'], [5, 'Kem ốc quế'], [10, 'Bánh ngọt'],
  [30, 'Mũ lưỡi trai'], [99, 'Vòng hoa'], [199, 'Pháo hoa'], [499, 'Vương miện'], [999, 'Du thuyền'],
];

export function demoUser(i) {
  return { id: `demo-${i}`, name: NAMES[i % NAMES.length], avatar: '' };
}

// Sinh sự kiện ngẫu nhiên như một phòng live sôi động. Trả về hàm dừng.
export function startDemo(onEvent) {
  const joined = new Set();
  const tick = () => {
    const i = Math.floor(Math.random() * NAMES.length);
    const user = demoUser(i);
    if (!joined.has(i)) {
      joined.add(i);
      onEvent({ type: 'chat', user, text: i % 2 === 0 ? '1' : '2' });
      return;
    }
    const roll = Math.random();
    if (roll < 0.4) onEvent({ type: 'like', user, count: 5 + Math.floor(Math.random() * 25) });
    else if (roll < 0.6) onEvent({ type: 'chat', user, text: 'cố lên' });
    else if (roll < 0.64) onEvent({ type: 'follow', user });
    else if (roll < 0.67) onEvent({ type: 'share', user });
    else {
      // quà rẻ xuất hiện nhiều hơn quà đắt
      const pick = DEMO_GIFTS[Math.floor(Math.random() ** 2.2 * DEMO_GIFTS.length)];
      const count = pick[0] <= 5 ? 1 + Math.floor(Math.random() * 5) : 1;
      onEvent({ type: 'gift', user, diamonds: pick[0], giftName: pick[1], count });
    }
  };
  const id = setInterval(tick, 350);
  // Trận mới thì người xem phải chọn phe lại.
  return {
    stop: () => clearInterval(id),
    resetTeams: () => joined.clear(),
  };
}

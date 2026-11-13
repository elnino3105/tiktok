// Toàn bộ số liệu cân bằng nằm ở đây — chỉnh file này để đổi luật chơi.

export const WORLD = {
  w: 1080,
  h: 1920,
  laneTop: 680, // mép trên vùng giao chiến
  laneBottom: 1250, // mép dưới vùng giao chiến
  baseX: [100, 980], // toạ độ x căn cứ phe 0 (XANH) và phe 1 (ĐỎ)
  baseY: 965,
};

export const TEAMS = [
  { id: 0, name: 'XANH', key: '1', color: '#38a6ff', dark: '#0f3d73', glow: 'rgba(56,166,255,' },
  { id: 1, name: 'ĐỎ', key: '2', color: '#ff5a4d', dark: '#7a1b14', glow: 'rgba(255,90,77,' },
];

export const RULES = {
  roundSeconds: 300,
  resultSeconds: 12,
  baseHp: 30000,
  baseRadius: 70,
  baseDamage: 26, // pháo phòng thủ của căn cứ
  baseRange: 300,
  baseCooldown: 0.5,
  maxUnitsPerTeam: 300,
  spawnPerTick: 3, // số tàu tối đa rời xưởng mỗi nhịp mô phỏng, tránh giật khi có đợt quà lớn
  maxQueue: 600,
  trickleSeconds: 3, // mỗi phe tự có 1 xuồng sau chừng này giây để màn hình không bao giờ trống
  chatSpawnCooldown: 5, // giây giữa hai lần bình luận sinh quân của cùng một người
  likesPerSkiff: 10,
  buffSeconds: 30,
  buffMaxSeconds: 90,
};

// len/wid: kích thước vẽ. bounty: điểm cho người hạ được đơn vị này.
export const UNITS = {
  skiff: { name: 'Xuồng cao tốc', hp: 45, dmg: 7, range: 95, speed: 78, cd: 0.8, len: 26, wid: 10, bounty: 1 },
  frigate: { name: 'Tàu hộ vệ', hp: 170, dmg: 15, range: 150, speed: 50, cd: 1.0, len: 46, wid: 14, bounty: 3 },
  cruiser: { name: 'Tuần dương hạm', hp: 460, dmg: 36, range: 190, speed: 38, cd: 1.2, len: 72, wid: 20, bounty: 8 },
  jet: { name: 'Tiêm kích', hp: 95, dmg: 20, range: 130, speed: 165, cd: 0.55, len: 30, wid: 24, bounty: 4, air: true },
  sub: { name: 'Tàu ngầm', hp: 280, dmg: 95, range: 230, speed: 32, cd: 2.6, len: 62, wid: 14, bounty: 10, baseBonus: 2 },
  flagship: {
    name: 'Soái hạm', hp: 2800, dmg: 85, range: 250, speed: 24, cd: 0.9, len: 124, wid: 34, bounty: 60,
    splash: 60, hero: true,
  },
};

export const SKILLS = {
  rally: { name: 'Tăng lực' },
  barrage: { name: 'Mưa tên lửa', strikes: 14, dmg: 320, radius: 115 },
};

// Phần thưởng tính theo giá trị xu của MỘT món quà (nhân với số lượng combo).
// Dùng giá xu thay vì tên quà vì danh sách quà TikTok khác nhau theo từng quốc gia.
// Sắp xếp từ đắt đến rẻ; quà rơi vào bậc đầu tiên có min <= giá xu.
export const GIFT_TIERS = [
  { min: 999, icon: 'barrage', label: 'Mưa tên lửa + Soái hạm', units: [['flagship', 1]], skill: 'barrage' },
  { min: 499, icon: 'flagship', label: 'Soái hạm', units: [['flagship', 1]] },
  { min: 199, icon: 'rally', label: 'Tăng lực ×2', units: [['cruiser', 3]], skill: 'rally' },
  { min: 99, icon: 'sub', label: '2 Tàu ngầm', units: [['sub', 2], ['cruiser', 1]] },
  { min: 30, icon: 'jet', label: '4 Tiêm kích', units: [['jet', 4]] },
  { min: 10, icon: 'cruiser', label: 'Tuần dương hạm', units: [['cruiser', 1], ['frigate', 1]] },
  { min: 5, icon: 'frigate', label: '2 Tàu hộ vệ', units: [['frigate', 2]] },
  { min: 1, icon: 'skiff', label: '3 Xuồng', units: [['skiff', 3]] },
];

export const POINTS = {
  join: 5,
  like: 1,
  follow: 20,
  share: 30,
  perDiamond: 10,
  baseDamage: 0.02, // điểm cho mỗi điểm sát thương lên căn cứ địch
};

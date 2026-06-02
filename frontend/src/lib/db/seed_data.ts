/**
 * Dev seed data. Lives next to seed.ts so we can drop the old mockData.ts
 * (which the app no longer references). All ids here are stable string keys
 * the seeder uses to wire foreign keys; real UUIDs are minted at insert time.
 */

export const MOCK_TODAY = new Date().toISOString().slice(0, 10);

export type SeedDepartment = { id: string; name: string };
export type SeedClient = { id: string; name: string; code: string };
export type SeedSite = {
  id: string;
  clientId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
};
export type SeedBusinessType = { id: string; name: string; clientId: string };
export type SeedStaff = {
  id: string;
  name: string;
  departmentId: string;
  hourlyRate: number;
  siteIds: string[];
};
export type SeedAttendance = {
  id: string;
  staffId: string;
  siteId: string;
  date: string;
  punchIn: string;
  punchOut: string | null;
  status: "出勤中" | "退勤済" | "遅刻" | "未出勤";
  lat: number;
  lng: number;
};
export type SeedReport = {
  id: string;
  staffId: string;
  siteId: string;
  clientId: string;
  businessTypeId: string;
  count: number;
  reportedAt: string;
  memo?: string;
};
export type SeedNotice = {
  id: string;
  fromStaffId: string;
  targetType: "all" | "department" | "individual";
  targetId?: string;
  clientId?: string;
  title: string;
  body: string;
  createdAt: string;
};
export type SeedBoardPost = {
  id: string;
  siteId: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
  pinned: boolean;
};

export const departments: SeedDepartment[] = [
  { id: "d1", name: "清掃部門" },
  { id: "d2", name: "警備部門" },
  { id: "d3", name: "設備管理部門" },
  { id: "d4", name: "受付部門" },
];

export const clientCompanies: SeedClient[] = [
  { id: "c1", name: "株式会社ABC不動産", code: "ABC" },
  { id: "c2", name: "東京ビルメンテナンス株式会社", code: "TBM" },
  { id: "c3", name: "グランドプロパティ株式会社", code: "GP" },
  { id: "c4", name: "日本施設管理株式会社", code: "NSK" },
];

export const sites: SeedSite[] = [
  { id: "s1", name: "新宿パークタワー", clientId: "c1", latitude: 35.6896, longitude: 139.6917, radiusM: 100 },
  { id: "s2", name: "渋谷スクランブルスクエア", clientId: "c1", latitude: 35.6580, longitude: 139.7016, radiusM: 100 },
  { id: "s3", name: "品川インターシティ", clientId: "c2", latitude: 35.6189, longitude: 139.7400, radiusM: 150 },
  { id: "s4", name: "丸の内ビルディング", clientId: "c2", latitude: 35.6812, longitude: 139.7649, radiusM: 100 },
  { id: "s5", name: "六本木ヒルズ森タワー", clientId: "c3", latitude: 35.6604, longitude: 139.7292, radiusM: 200 },
  { id: "s6", name: "横浜ランドマークタワー", clientId: "c3", latitude: 35.4544, longitude: 139.6323, radiusM: 150 },
  { id: "s7", name: "池袋サンシャイン60", clientId: "c4", latitude: 35.7295, longitude: 139.7187, radiusM: 100 },
  { id: "s8", name: "大手町プレイス", clientId: "c4", latitude: 35.6867, longitude: 139.7660, radiusM: 100 },
];

export const businessTypes: SeedBusinessType[] = [
  { id: "bt1", name: "日常清掃", clientId: "c1" },
  { id: "bt2", name: "定期清掃", clientId: "c1" },
  { id: "bt3", name: "巡回警備", clientId: "c2" },
  { id: "bt4", name: "立哨警備", clientId: "c2" },
  { id: "bt5", name: "設備点検", clientId: "c3" },
  { id: "bt6", name: "空調管理", clientId: "c3" },
  { id: "bt7", name: "受付業務", clientId: "c4" },
  { id: "bt8", name: "来客対応", clientId: "c4" },
];

export const staffs: SeedStaff[] = [
  { id: "st1", name: "田中 太郎", hourlyRate: 2000, departmentId: "d1", siteIds: ["s1", "s2"] },
  { id: "st2", name: "佐藤 花子", hourlyRate: 1200, departmentId: "d1", siteIds: ["s1"] },
  { id: "st3", name: "鈴木 一郎", hourlyRate: 1300, departmentId: "d2", siteIds: ["s3", "s4"] },
  { id: "st4", name: "高橋 美咲", hourlyRate: 1250, departmentId: "d2", siteIds: ["s3"] },
  { id: "st5", name: "渡辺 健太", hourlyRate: 1400, departmentId: "d3", siteIds: ["s5", "s6"] },
  { id: "st6", name: "伊藤 由美", hourlyRate: 1150, departmentId: "d4", siteIds: ["s7"] },
  { id: "st7", name: "山本 翔", hourlyRate: 1350, departmentId: "d1", siteIds: ["s2"] },
  { id: "st8", name: "中村 さくら", hourlyRate: 1200, departmentId: "d3", siteIds: ["s5"] },
  { id: "st9", name: "小林 大輔", hourlyRate: 1300, departmentId: "d2", siteIds: ["s4", "s7"] },
  { id: "st10", name: "加藤 明", hourlyRate: 1800, departmentId: "d1", siteIds: ["s1", "s2", "s3"] },
];

export const attendanceLogs: SeedAttendance[] = [
  { id: "a1", staffId: "st2", siteId: "s1", date: MOCK_TODAY, punchIn: "08:55", punchOut: "17:05", status: "退勤済", lat: 35.6897, lng: 139.6918 },
  { id: "a2", staffId: "st3", siteId: "s3", date: MOCK_TODAY, punchIn: "09:02", punchOut: "18:00", status: "退勤済", lat: 35.619, lng: 139.7401 },
  { id: "a3", staffId: "st4", siteId: "s3", date: MOCK_TODAY, punchIn: "09:15", punchOut: null, status: "遅刻", lat: 35.6188, lng: 139.7399 },
  { id: "a4", staffId: "st5", siteId: "s5", date: MOCK_TODAY, punchIn: "08:45", punchOut: "17:30", status: "退勤済", lat: 35.6605, lng: 139.7293 },
  { id: "a5", staffId: "st6", siteId: "s7", date: MOCK_TODAY, punchIn: "08:58", punchOut: null, status: "出勤中", lat: 35.7296, lng: 139.7188 },
  { id: "a6", staffId: "st7", siteId: "s2", date: MOCK_TODAY, punchIn: "09:00", punchOut: "17:00", status: "退勤済", lat: 35.6581, lng: 139.7017 },
  { id: "a7", staffId: "st8", siteId: "s5", date: MOCK_TODAY, punchIn: "08:50", punchOut: null, status: "出勤中", lat: 35.6603, lng: 139.7291 },
  { id: "a8", staffId: "st9", siteId: "s4", date: MOCK_TODAY, punchIn: "00:00", punchOut: null, status: "未出勤", lat: 0, lng: 0 },
];

export const businessReports: SeedReport[] = [
  { id: "r1", staffId: "st2", siteId: "s1", clientId: "c1", businessTypeId: "bt1", count: 12, reportedAt: `${MOCK_TODAY}T17:10:00`, memo: "3Fトイレ異常なし" },
  { id: "r2", staffId: "st3", siteId: "s3", clientId: "c2", businessTypeId: "bt3", count: 8, reportedAt: `${MOCK_TODAY}T18:05:00`, memo: "B1駐車場巡回完了" },
  { id: "r3", staffId: "st5", siteId: "s5", clientId: "c3", businessTypeId: "bt5", count: 5, reportedAt: `${MOCK_TODAY}T17:35:00`, memo: "空調室外機点検完了。異常なし。" },
  { id: "r4", staffId: "st6", siteId: "s7", clientId: "c4", businessTypeId: "bt7", count: 23, reportedAt: `${MOCK_TODAY}T12:00:00`, memo: "午前中来客23件対応" },
  { id: "r5", staffId: "st7", siteId: "s2", clientId: "c1", businessTypeId: "bt2", count: 4, reportedAt: `${MOCK_TODAY}T17:05:00`, memo: "定期ワックスがけ完了" },
  { id: "r6", staffId: "st2", siteId: "s1", clientId: "c1", businessTypeId: "bt1", count: 10, reportedAt: "2026-04-07T17:00:00" },
  { id: "r7", staffId: "st3", siteId: "s3", clientId: "c2", businessTypeId: "bt4", count: 6, reportedAt: "2026-04-07T18:00:00" },
  { id: "r8", staffId: "st4", siteId: "s3", clientId: "c2", businessTypeId: "bt3", count: 7, reportedAt: "2026-04-07T17:30:00" },
  { id: "r9", staffId: "st5", siteId: "s5", clientId: "c3", businessTypeId: "bt6", count: 3, reportedAt: "2026-04-06T17:00:00" },
  { id: "r10", staffId: "st6", siteId: "s7", clientId: "c4", businessTypeId: "bt8", count: 15, reportedAt: "2026-04-06T17:00:00" },
];

export const notices: SeedNotice[] = [
  { id: "n1", fromStaffId: "st1", targetType: "all", title: "【重要】4月度安全大会のお知らせ", body: "4月15日（水）14:00より本社会議室にて安全大会を開催します。全スタッフ必ず出席してください。", createdAt: "2026-04-07T10:00:00" },
  { id: "n2", fromStaffId: "st1", targetType: "department", targetId: "d1", clientId: "c1", title: "清掃部門 月次ミーティング（ABC不動産エリア）", body: "4月10日（金）10:00〜 清掃手順の見直しについて打合せを行います。", createdAt: "2026-04-06T15:00:00" },
  { id: "n3", fromStaffId: "st10", targetType: "individual", targetId: "st5", title: "設備点検報告書について", body: "先日提出いただいた報告書に不備がありました。修正をお願いします。", createdAt: "2026-04-05T09:00:00" },
  { id: "n4", fromStaffId: "st1", targetType: "all", title: "GW期間中のシフトについて", body: "GW期間中のシフト希望を4月20日までに提出してください。", createdAt: "2026-04-04T11:00:00" },
];

export const boardPosts: SeedBoardPost[] = [
  { id: "bp1", siteId: "s1", title: "清掃マニュアル更新", body: "3Fトイレの清掃手順が変更になりました。新マニュアルを確認してください。", authorId: "st1", createdAt: "2026-04-07T08:00:00", pinned: true },
  { id: "bp2", siteId: "s1", title: "備品補充のお願い", body: "ペーパータオルの在庫が少なくなっています。補充をお願いします。", authorId: "st2", createdAt: "2026-04-06T16:00:00", pinned: false },
  { id: "bp3", siteId: "s3", title: "駐車場B1 注意事項", body: "B1駐車場のゲート付近で不審者の報告がありました。巡回時は注意してください。", authorId: "st10", createdAt: `${MOCK_TODAY}T07:00:00`, pinned: true },
  { id: "bp4", siteId: "s5", title: "空調室外機 異音について", body: "5F室外機から異音の報告あり。次回点検時に確認をお願いします。", authorId: "st5", createdAt: "2026-04-07T14:00:00", pinned: false },
];

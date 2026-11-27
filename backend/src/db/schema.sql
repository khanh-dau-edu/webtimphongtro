-- ============================================================================
-- SCHEMA CƠ SỞ DỮ LIỆU QUAN HỆ - TRỌ THÔNG MINH ĐÀ NẴNG
-- Tương thích SQLite hiện tại & sẵn sàng chuyển đổi sang PostgreSQL / MySQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tenant', 'landlord', 'admin')),
  verified_ekyc INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  address TEXT NOT NULL,
  district TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  district TEXT NOT NULL,
  price INTEGER NOT NULL,
  area REAL NOT NULL,
  type TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  image TEXT NOT NULL,
  images_json TEXT NOT NULL DEFAULT '[]',
  amenities_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 1,
  landlord_id INTEGER,
  landlord_name TEXT NOT NULL,
  landlord_phone TEXT NOT NULL,
  trust_score INTEGER NOT NULL DEFAULT 90,
  elec_price INTEGER NOT NULL DEFAULT 3500,
  water_price INTEGER NOT NULL DEFAULT 15000,
  wifi_price INTEGER NOT NULL DEFAULT 0,
  trash_price INTEGER NOT NULL DEFAULT 20000,
  parking_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  featured INTEGER NOT NULL DEFAULT 0,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  checks_json TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_district ON rooms(district);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  room_id INTEGER NOT NULL,
  room_title TEXT NOT NULL,
  tenant_id INTEGER,
  tenant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Chờ xác nhận',
  reviewed INTEGER NOT NULL DEFAULT 0,
  review_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  room_id INTEGER NOT NULL,
  booking_id TEXT,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  verified_booking INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_room_id ON reviews(room_id);

CREATE TABLE IF NOT EXISTS violation_reports (
  id TEXT PRIMARY KEY,
  room_id INTEGER NOT NULL,
  room_title TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ekyc_requests (
  id TEXT PRIMARY KEY,
  landlord_id INTEGER,
  landlord_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  cccd_number TEXT NOT NULL,
  address TEXT NOT NULL,
  face_match_score INTEGER NOT NULL,
  ocr_status TEXT NOT NULL,
  property_doc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  submitted_at TEXT NOT NULL
);

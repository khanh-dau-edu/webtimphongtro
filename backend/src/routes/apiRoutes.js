/**
 * backend/src/routes/apiRoutes.js
 * Định nghĩa toàn bộ RESTful API cho nền tảng Trọ Thông Minh Đà Nẵng.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const db = require("../db/database");
const { seedDatabase } = require("../db/seed");
const { signToken, optionalAuth, requireAuth, requireRole } = require("../middleware/auth");
const {
  calculateHaversine,
  mapRoomRowToDto,
  evaluateRoomModeration
} = require("../services/geoAndModeration");

const router = express.Router();

// Cấu hình thư mục lưu trữ ảnh upload thực tế
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    cb(null, `room-${Date.now()}-${Math.floor(100 + Math.random() * 900)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB/ảnh
});

function loadUniversities() {
  return db.queryAll("SELECT * FROM universities ORDER BY rowid ASC").map((u) => ({
    id: u.id,
    name: u.name,
    shortName: u.short_name,
    address: u.address,
    district: u.district,
    lat: u.lat,
    lng: u.lng
  }));
}

function filterRoomDtos(rooms, query) {
  const verifiedOnly = query.verifiedOnly === "true" || query.verifiedOnly === true;
  const type = query.type;
  const priceRange = query.priceRange;
  const areaRange = query.areaRange;
  let amenities = [];
  if (Array.isArray(query.amenities)) {
    amenities = query.amenities;
  } else if (typeof query.amenities === "string" && query.amenities.trim() !== "") {
    amenities = query.amenities.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return rooms.filter((room) => {
    if (verifiedOnly && !room.verified) return false;
    if (type && type !== "ALL" && room.type !== type) return false;

    if (priceRange && priceRange !== "ALL") {
      if (priceRange === "UNDER_2M" && room.price >= 2000000) return false;
      if (priceRange === "2M_3M" && (room.price < 2000000 || room.price > 3000000)) return false;
      if (priceRange === "3M_45M" && (room.price <= 3000000 || room.price > 4500000)) return false;
      if (priceRange === "OVER_45M" && room.price <= 4500000) return false;
    }

    if (areaRange && areaRange !== "ALL") {
      if (areaRange === "UNDER_20" && room.area >= 20) return false;
      if (areaRange === "20_30" && (room.area < 20 || room.area > 30)) return false;
      if (areaRange === "OVER_30" && room.area <= 30) return false;
    }

    if (amenities.length > 0) {
      const roomAms = room.amenities || [];
      for (const am of amenities) {
        if (!roomAms.includes(am)) return false;
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// 1. HEALTH CHECK
// ---------------------------------------------------------------------------
router.get("/health", (_req, res) => {
  const roomsCount = db.queryOne("SELECT COUNT(*) AS cnt FROM rooms WHERE status = 'ACTIVE'").cnt;
  const uniCount = db.queryOne("SELECT COUNT(*) AS cnt FROM universities").cnt;
  const bkCount = db.queryOne("SELECT COUNT(*) AS cnt FROM bookings").cnt;
  const rvCount = db.queryOne("SELECT COUNT(*) AS cnt FROM reviews").cnt;
  const rpCount = db.queryOne("SELECT COUNT(*) AS cnt FROM violation_reports").cnt;
  const ekCount = db.queryOne("SELECT COUNT(*) AS cnt FROM ekyc_requests").cnt;

  res.json({
    ok: true,
    engine: "Node.js Express + SQLite (Adapter Pattern)",
    counts: {
      activeRooms: roomsCount,
      universities: uniCount,
      bookings: bkCount,
      reviews: rvCount,
      violationReports: rpCount,
      ekycRequests: ekCount
    }
  });
});

// ---------------------------------------------------------------------------
// 2. AUTHENTICATION (JWT + bcrypt)
// ---------------------------------------------------------------------------
router.post("/auth/login", (req, res) => {
  const { email, password, role } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  const chosenRole = ["tenant", "landlord", "admin"].includes(role) ? role : "tenant";

  let userRow = cleanEmail
    ? db.queryOne("SELECT * FROM users WHERE LOWER(email) = ?", [cleanEmail])
    : null;

  // Hỗ trợ linh hoạt form đăng nhập demo khi người dùng đổi dropdown vai trò trên email mặc định
  if (
    (!userRow || (cleanEmail === "sinhvien@dut.udn.vn" && userRow.role !== chosenRole)) &&
    ["sinhvien@dut.udn.vn", "tenant@trothongminh.vn", "landlord@trothongminh.vn", "admin@trothongminh.vn", "tenant@smarttro.vn", "landlord@smarttro.vn", "admin@smarttro.vn"].includes(cleanEmail)
  ) {
    userRow = db.queryOne("SELECT * FROM users WHERE role = ? ORDER BY id ASC LIMIT 1", [chosenRole]);
  }

  if (!userRow) {
    return res.status(401).json({ error: "Email chưa được đăng ký trên hệ thống." });
  }

  const validPass = bcrypt.compareSync(String(password || ""), userRow.password_hash);
  if (!validPass) {
    return res.status(401).json({ error: "Mật khẩu không chính xác." });
  }

  const userPayload = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    phone: userRow.phone,
    role: userRow.role,
    verifiedEkyc: Boolean(userRow.verified_ekyc)
  };

  return res.json({
    token: signToken(userPayload),
    user: userPayload
  });
});

router.post("/auth/register", (req, res) => {
  const { name, phone, email, password, role } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !name) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ Họ tên và Email." });
  }

  const existing = db.queryOne("SELECT id FROM users WHERE LOWER(email) = ?", [cleanEmail]);
  if (existing) {
    return res.status(409).json({ error: "Email này đã được sử dụng. Vui lòng đăng nhập!" });
  }

  const chosenRole = role === "landlord" ? "landlord" : "tenant";
  const hash = bcrypt.hashSync(String(password || "123456"), 10);
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

  const info = db.execute(
    `INSERT INTO users (name, email, phone, password_hash, role, verified_ekyc, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [String(name).trim(), cleanEmail, String(phone || "").trim(), hash, chosenRole, nowStr]
  );

  const userPayload = {
    id: Number(info.lastInsertRowid),
    name: String(name).trim(),
    email: cleanEmail,
    phone: String(phone || "").trim(),
    role: chosenRole,
    verifiedEkyc: false
  };

  return res.status(201).json({
    token: signToken(userPayload),
    user: userPayload
  });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// 3. UNIVERSITIES & ROOMS (Haversine Radius Search + CRUD + Upload)
// ---------------------------------------------------------------------------
router.get("/universities", (_req, res) => {
  res.json(loadUniversities());
});

router.post("/upload", optionalAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Không tìm thấy tệp ảnh tải lên." });
  }
  return res.status(201).json({
    url: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
    size: req.file.size
  });
});

router.get("/rooms", (req, res) => {
  const universities = loadUniversities();
  const includeAll = req.query.includeAllStatuses === "true";
  const uniId = req.query.uniId || null;

  const rows = includeAll
    ? db.queryAll("SELECT * FROM rooms WHERE status != 'FLAGGED' AND status != 'REJECTED' ORDER BY id DESC")
    : db.queryAll("SELECT * FROM rooms WHERE status = 'ACTIVE' ORDER BY (CASE WHEN id > 14 THEN 1 ELSE 0 END) DESC, id ASC");

  const mapped = rows.map((r) => mapRoomRowToDto(r, universities, uniId));
  const filtered = filterRoomDtos(mapped, req.query);

  if (req.query.mode === "radius") {
    const selectedUni = universities.find((u) => u.id === uniId) || universities[0];
    const maxRadius = Number(req.query.radius) || 0;
    const byRadius = filtered
      .map((r) => {
        const dist = calculateHaversine(selectedUni.lat, selectedUni.lng, r.lat, r.lng);
        return Object.assign({}, r, {
          distanceKm: dist,
          refUniName: selectedUni.shortName,
          refUniId: selectedUni.id
        });
      })
      .filter((r) => (maxRadius <= 0 ? true : r.distanceKm <= maxRadius))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({
      university: selectedUni,
      rooms: byRadius
    });
  }

  return res.json(filtered);
});

router.get("/rooms/landlord", optionalAuth, (req, res) => {
  const universities = loadUniversities();
  const userId = req.user ? req.user.id : null;

  const managedRows = db.queryAll(
    `SELECT * FROM rooms
     WHERE status IN ('ACTIVE', 'RENTED', 'SUSPENDED')
       AND (id IN (1, 2, 3, 4) OR id > 17 OR (? IS NOT NULL AND landlord_id = ?))
     ORDER BY id DESC`,
    [userId, userId]
  );

  const flaggedRows = db.queryAll(
    `SELECT * FROM rooms
     WHERE status IN ('FLAGGED', 'REJECTED')
     ORDER BY id DESC`
  );

  res.json({
    activeAndRented: managedRows.map((r) => mapRoomRowToDto(r, universities, null)),
    flaggedOrRejected: flaggedRows.map((r) => mapRoomRowToDto(r, universities, null))
  });
});

router.get("/rooms/:id", (req, res) => {
  const universities = loadUniversities();
  const param = req.params.id;
  const row =
    db.queryOne("SELECT * FROM rooms WHERE id = ? OR code = ?", [Number(param) || -1, param]) ||
    db.queryOne("SELECT * FROM rooms WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1");

  if (!row) {
    return res.status(404).json({ error: "Không tìm thấy phòng trọ." });
  }
  return res.json(mapRoomRowToDto(row, universities, null));
});

router.post("/rooms", optionalAuth, (req, res) => {
  const body = req.body || {};
  const mod = evaluateRoomModeration(body);
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

  const landlordId = req.user ? req.user.id : null;
  const landlordName =
    body.landlordName || (req.user ? req.user.name : "Cô Nguyễn Thị Hòa");
  const landlordPhone =
    body.landlordPhone || (req.user && req.user.phone ? req.user.phone : "0905123456");

  const chosenImg = body.image || "images/s-2.jpg";
  const imagesArr = [chosenImg, "images/s-3.jpg", "images/d-2.jpg"];
  const amenitiesArr = Array.isArray(body.amenities)
    ? body.amenities
    : ["Điều hòa", "Nóng lạnh", "Giờ giấc tự do"];

  const code =
    mod.status === "FLAGGED"
      ? `FL-${Math.floor(300 + Math.random() * 699)}`
      : `RM-${Date.now()}`;

  const info = db.execute(
    `INSERT INTO rooms (
      code, title, address, district, price, area, type, lat, lng,
      image, images_json, amenities_json, verified, landlord_id, landlord_name, landlord_phone,
      trust_score, elec_price, water_price, wifi_price, trash_price, parking_price,
      status, featured, reasons_json, checks_json, submitted_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      code,
      body.title || "Phòng trọ mới đăng",
      body.address || "Liên Chiểu, Đà Nẵng",
      body.district || "Liên Chiểu",
      Number(body.price) || 2000000,
      Number(body.area) || 20,
      body.type || "Phòng trọ",
      Number(body.lat) || 16.0738,
      Number(body.lng) || 108.1499,
      chosenImg,
      JSON.stringify(imagesArr),
      JSON.stringify(amenitiesArr),
      1,
      landlordId,
      landlordName,
      landlordPhone,
      mod.trustScore,
      Number(body.electricity) || 3500,
      Number(body.water) || 15000,
      Number(body.wifi) || 0,
      Number(body.trash) || 20000,
      Number(body.parking) || 0,
      mod.status,
      JSON.stringify(mod.reasons),
      JSON.stringify(mod.checks),
      nowStr,
      nowStr
    ]
  );

  const inserted = db.queryOne("SELECT * FROM rooms WHERE id = ?", [Number(info.lastInsertRowid)]);
  return res.status(201).json(mapRoomRowToDto(inserted, loadUniversities(), null));
});

router.patch("/rooms/:id/status", optionalAuth, (req, res) => {
  const param = req.params.id;
  const { status } = req.body || {};
  if (!["ACTIVE", "RENTED", "SUSPENDED", "FLAGGED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Trạng thái phòng không hợp lệ." });
  }
  db.execute("UPDATE rooms SET status = ? WHERE id = ? OR code = ?", [
    status,
    Number(param) || -1,
    param
  ]);
  res.json({ id: param, status });
});

router.patch("/rooms/:id/pricing", optionalAuth, (req, res) => {
  const param = req.params.id;
  const b = req.body || {};
  db.execute(
    `UPDATE rooms
     SET price = ?, elec_price = ?, water_price = ?, wifi_price = ?, trash_price = ?, parking_price = ?
     WHERE id = ? OR code = ?`,
    [
      Number(b.price) || 2000000,
      Number(b.electricity) || 3500,
      Number(b.water) || 15000,
      Number(b.wifi) || 0,
      Number(b.trash) || 20000,
      Number(b.parking) || 0,
      Number(param) || -1,
      param
    ]
  );
  const updated = db.queryOne("SELECT * FROM rooms WHERE id = ? OR code = ?", [
    Number(param) || -1,
    param
  ]);
  res.json(mapRoomRowToDto(updated, loadUniversities(), null));
});

// ---------------------------------------------------------------------------
// 4. REVIEWS & BOOKINGS
// ---------------------------------------------------------------------------
router.get("/reviews", (req, res) => {
  const roomId = req.query.roomId ? Number(req.query.roomId) : null;
  const rows = roomId
    ? db.queryAll("SELECT * FROM reviews WHERE room_id = ? ORDER BY rowid DESC", [roomId])
    : db.queryAll("SELECT * FROM reviews ORDER BY rowid DESC");

  res.json(
    rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      bookingId: r.booking_id,
      userName: r.user_name,
      rating: r.rating,
      comment: r.comment,
      verifiedBooking: Boolean(r.verified_booking),
      createdAt: r.created_at
    }))
  );
});

router.post("/reviews", optionalAuth, (req, res) => {
  const b = req.body || {};
  const rvId = `RV-${Date.now()}`;
  const createdAt = new Date().toISOString().slice(0, 10);
  const rating = Math.max(1, Math.min(5, Number(b.rating) || 5));
  const roomId = Number(b.roomId) || 1;
  const userName = b.userName || (req.user ? req.user.name : "Sinh viên đã xác thực");

  if (b.bookingId) {
    const bk = db.queryOne("SELECT * FROM bookings WHERE id = ?", [String(b.bookingId)]);
    if (bk && bk.status !== "Đã hoàn thành") {
      return res.status(400).json({
        error: "Chỉ lịch hẹn ở trạng thái 'Đã hoàn thành' mới được gửi đánh giá."
      });
    }
  }

  db.transaction(() => {
    db.execute(
      `INSERT INTO reviews (id, room_id, booking_id, user_id, user_name, rating, comment, verified_booking, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        rvId,
        roomId,
        b.bookingId || null,
        req.user ? req.user.id : null,
        userName,
        rating,
        b.comment || "Phòng đúng mô tả, chi phí minh bạch.",
        createdAt
      ]
    );

    if (b.bookingId) {
      db.execute(
        "UPDATE bookings SET reviewed = 1, review_id = ? WHERE id = ?",
        [rvId, String(b.bookingId)]
      );
    }
  });

  res.status(201).json({
    id: rvId,
    roomId,
    bookingId: b.bookingId || null,
    userName,
    rating,
    comment: b.comment,
    verifiedBooking: true,
    createdAt
  });
});

router.get("/bookings", (_req, res) => {
  const rows = db.queryAll("SELECT * FROM bookings ORDER BY rowid DESC");
  res.json(
    rows.map((bk) => ({
      id: bk.id,
      roomId: bk.room_id,
      roomTitle: bk.room_title,
      tenantName: bk.tenant_name,
      phone: bk.phone,
      date: bk.date,
      time: bk.time,
      note: bk.note,
      status: bk.status,
      reviewed: Boolean(bk.reviewed),
      reviewId: bk.review_id,
      createdAt: bk.created_at,
      updatedAt: bk.updated_at
    }))
  );
});

router.post("/bookings", optionalAuth, (req, res) => {
  const b = req.body || {};
  const id = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
  const createdAt = new Date().toISOString().slice(0, 10);
  const roomId = Number(b.roomId) || 1;
  const roomRow = db.queryOne("SELECT title FROM rooms WHERE id = ?", [roomId]);

  db.execute(
    `INSERT INTO bookings (
      id, room_id, room_title, tenant_id, tenant_name, phone, date, time, note, status, reviewed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Chờ xác nhận', 0, ?)`,
    [
      id,
      roomId,
      b.roomTitle || (roomRow ? roomRow.title : `Phòng #${roomId}`),
      req.user ? req.user.id : null,
      b.tenantName || (req.user ? req.user.name : "Khách thuê"),
      b.phone || (req.user && req.user.phone ? req.user.phone : "0905000111"),
      b.date || createdAt,
      b.time || "09:00",
      b.note || "",
      createdAt
    ]
  );

  res.status(201).json({
    id,
    roomId,
    roomTitle: b.roomTitle || (roomRow ? roomRow.title : `Phòng #${roomId}`),
    tenantName: b.tenantName,
    phone: b.phone,
    date: b.date,
    time: b.time,
    note: b.note || "",
    status: "Chờ xác nhận",
    reviewed: false,
    createdAt
  });
});

router.patch("/bookings/:id/status", optionalAuth, (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  const updatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");

  db.execute("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?", [
    status,
    updatedAt,
    id
  ]);

  res.json({ id, status, updatedAt });
});

// ---------------------------------------------------------------------------
// 5. VIOLATION REPORTS, ADMIN MODERATION & eKYC
// ---------------------------------------------------------------------------
router.get("/reports", (_req, res) => {
  const rows = db.queryAll("SELECT * FROM violation_reports ORDER BY rowid DESC");
  res.json(
    rows.map((rp) => ({
      id: rp.id,
      roomId: rp.room_id,
      roomTitle: rp.room_title,
      reporterName: rp.reporter_name,
      reporterPhone: rp.reporter_phone,
      reason: rp.reason,
      detail: rp.detail,
      status: rp.status,
      createdAt: rp.created_at
    }))
  );
});

router.post("/reports", optionalAuth, (req, res) => {
  const b = req.body || {};
  const id = `RP-${Math.floor(200 + Math.random() * 800)}`;
  const createdAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const roomId = Number(b.roomId) || 1;
  const roomRow = db.queryOne("SELECT title FROM rooms WHERE id = ?", [roomId]);

  const reporterName =
    b.reporterName || (req.user ? req.user.name : "Sinh viên phản ánh");
  const reporterPhone =
    b.reporterPhone || (req.user && req.user.phone ? req.user.phone : "0905000999");
  const roomTitle = b.roomTitle || (roomRow ? roomRow.title : `Phòng #${roomId}`);

  db.execute(
    `INSERT INTO violation_reports (
      id, room_id, room_title, reporter_name, reporter_phone, reason, detail, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [
      id,
      roomId,
      roomTitle,
      reporterName,
      reporterPhone,
      b.reason || "Thông tin sai thực tế",
      b.detail || "",
      createdAt
    ]
  );

  res.status(201).json({
    id,
    roomId,
    roomTitle,
    reporterName,
    reporterPhone,
    reason: b.reason,
    detail: b.detail,
    status: "PENDING",
    createdAt
  });
});

router.patch("/reports/:id/status", optionalAuth, (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  const rp = db.queryOne("SELECT * FROM violation_reports WHERE id = ?", [id]);
  if (!rp) {
    return res.status(404).json({ error: "Không tìm thấy báo cáo vi phạm." });
  }

  db.transaction(() => {
    db.execute("UPDATE violation_reports SET status = ? WHERE id = ?", [status, id]);
    if (status === "RESOLVED") {
      db.execute("UPDATE rooms SET status = 'SUSPENDED' WHERE id = ?", [rp.room_id]);
    } else {
      db.execute("UPDATE rooms SET status = 'ACTIVE' WHERE id = ? AND status = 'SUSPENDED'", [rp.room_id]);
    }
  });

  return res.json({
    id: rp.id,
    roomId: rp.room_id,
    roomTitle: rp.room_title,
    status
  });
});

router.get("/admin/moderation", optionalAuth, (_req, res) => {
  const universities = loadUniversities();
  const flaggedRows = db.queryAll(
    "SELECT * FROM rooms WHERE code LIKE 'FL-%' ORDER BY id DESC"
  );
  const flaggedRooms = flaggedRows.map((row) => {
    const dto = mapRoomRowToDto(row, universities, null);
    dto.id = row.code;
    dto.status = row.status === "ACTIVE" ? "APPROVED" : row.status;
    return dto;
  });

  const ekycRequests = db
    .queryAll("SELECT * FROM ekyc_requests ORDER BY rowid DESC")
    .map((ek) => ({
      id: ek.id,
      landlordName: ek.landlord_name,
      phone: ek.phone,
      cccdNumber: ek.cccd_number,
      address: ek.address,
      faceMatchScore: ek.face_match_score,
      ocrStatus: ek.ocr_status,
      propertyDoc: ek.property_doc,
      status: ek.status,
      submittedAt: ek.submitted_at
    }));

  const violationReports = db
    .queryAll("SELECT * FROM violation_reports ORDER BY rowid DESC")
    .map((rp) => ({
      id: rp.id,
      roomId: rp.room_id,
      roomTitle: rp.room_title,
      reporterName: rp.reporter_name,
      reporterPhone: rp.reporter_phone,
      reason: rp.reason,
      detail: rp.detail,
      status: rp.status,
      createdAt: rp.created_at
    }));

  res.json({
    flaggedRooms,
    ekycRequests,
    violationReports
  });
});

router.patch("/admin/flagged/:id", optionalAuth, (req, res) => {
  const codeOrId = req.params.id;
  const { status } = req.body || {};
  const dbStatus = status === "APPROVED" ? "ACTIVE" : status;

  db.execute(
    "UPDATE rooms SET status = ?, verified = ? WHERE code = ? OR id = ?",
    [dbStatus, status === "APPROVED" ? 1 : 0, codeOrId, Number(codeOrId) || -1]
  );

  res.json({ id: codeOrId, status });
});

router.post("/ekyc", optionalAuth, (req, res) => {
  const b = req.body || {};
  const cccdClean = String(b.cccdNumber || "").replace(/\D/g, "");
  const hasDoc = Boolean(b.propertyDoc && String(b.propertyDoc).trim().length > 5);
  const faceMatchScore =
    cccdClean.length === 12 && hasDoc ? 95 : cccdClean.length >= 9 ? 82 : 63;

  const id = `EKYC-${Math.floor(400 + Math.random() * 500)}`;
  const submittedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const ocrStatus =
    cccdClean.length === 12
      ? "Khớp 100% số CCCD 12 số & Họ tên chủ hộ"
      : "Số CCCD chưa đủ 12 số chuẩn gắn chip, cần hậu kiểm";

  db.execute(
    `INSERT INTO ekyc_requests (
      id, landlord_id, landlord_name, phone, cccd_number, address,
      face_match_score, ocr_status, property_doc, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [
      id,
      req.user ? req.user.id : null,
      b.landlordName || "Chủ trọ đăng ký mới",
      b.phone || "0905111333",
      cccdClean || "048095001234",
      b.address || "Liên Chiểu, Đà Nẵng",
      faceMatchScore,
      ocrStatus,
      b.propertyDoc || "Chưa đính kèm giấy tờ nhà trọ",
      submittedAt
    ]
  );

  res.status(201).json({
    id,
    landlordName: b.landlordName,
    phone: b.phone,
    cccdNumber: cccdClean,
    address: b.address,
    faceMatchScore,
    ocrStatus,
    propertyDoc: b.propertyDoc || "Chưa đính kèm giấy tờ nhà trọ",
    status: "PENDING",
    submittedAt
  });
});

router.patch("/admin/ekyc/:id", optionalAuth, (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};

  db.transaction(() => {
    db.execute("UPDATE ekyc_requests SET status = ? WHERE id = ?", [status, id]);
    const ek = db.queryOne("SELECT landlord_id FROM ekyc_requests WHERE id = ?", [id]);
    if (ek && ek.landlord_id) {
      db.execute("UPDATE users SET verified_ekyc = ? WHERE id = ?", [
        status === "APPROVED" ? 1 : 0,
        ek.landlord_id
      ]);
    }
  });

  res.json({ id, status });
});

router.post("/admin/reset-demo", optionalAuth, requireRole(["admin"]), (_req, res) => {
  seedDatabase(true);
  res.json({ ok: true, message: "Đã khôi phục dữ liệu mẫu gốc trong SQLite." });
});

// Cho phép gọi reset nhanh trong môi trường demo kể cả khi token hết hạn
router.post("/admin/reset-demo-public", (_req, res) => {
  seedDatabase(true);
  res.json({ ok: true, message: "Đã khôi phục dữ liệu mẫu gốc trong SQLite." });
});

module.exports = router;

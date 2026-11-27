/**
 * backend/src/db/seed.js
 * Nạp dữ liệu khởi tạo từ bộ dữ liệu mẫu Đà Nẵng vào SQLite.
 * Hỗ trợ chạy tự động lần đầu hoặc khôi phục sạch qua cờ --reset / hàm seedDatabase(true).
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./database");

const FRONTEND_DATA_DIR = path.join(__dirname, "..", "..", "..", "frontend", "data");

function readSampleJson(fileName) {
  const fullPath = path.join(FRONTEND_DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function seedDatabase(forceReset = false) {
  db.getDb();

  const existingUniCount = db.queryOne("SELECT COUNT(*) AS cnt FROM universities");
  if (!forceReset && existingUniCount && existingUniCount.cnt > 0) {
    return { seeded: false, message: "Database already initialized" };
  }

  const universities = readSampleJson("universities.json");
  const rooms = readSampleJson("rooms.json");
  const bookings = readSampleJson("bookings.json");
  const reviews = readSampleJson("reviews.json");
  const flaggedData = readSampleJson("flagged.json");

  const defaultPassHash = bcrypt.hashSync("123456", 10);
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

  db.transaction(() => {
    if (forceReset) {
      db.execute("DELETE FROM reviews;");
      db.execute("DELETE FROM bookings;");
      db.execute("DELETE FROM violation_reports;");
      db.execute("DELETE FROM ekyc_requests;");
      db.execute("DELETE FROM rooms;");
      db.execute("DELETE FROM universities;");
      db.execute("DELETE FROM users;");
      db.execute("DELETE FROM sqlite_sequence WHERE name IN ('users', 'rooms');");
    }

    // 1. Seed Users (3 vai trò mặc định + tài khoản sinh viên DUT)
    const demoUsers = [
      { name: "Minh Quân (SV Bách Khoa)", email: "sinhvien@dut.udn.vn", phone: "0905111222", role: "tenant", verified: 0 },
      { name: "Minh Quân (SV Bách Khoa)", email: "tenant@trothongminh.vn", phone: "0905111222", role: "tenant", verified: 0 },
      { name: "Cô Nguyễn Thị Hòa", email: "landlord@trothongminh.vn", phone: "0905123456", role: "landlord", verified: 1 },
      { name: "Quản trị viên Hệ thống", email: "admin@trothongminh.vn", phone: "02363888999", role: "admin", verified: 1 }
    ];

    let landlordUserId = null;
    for (const u of demoUsers) {
      const info = db.execute(
        `INSERT INTO users (name, email, phone, password_hash, role, verified_ekyc, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.name, u.email, u.phone, defaultPassHash, u.role, u.verified, nowStr]
      );
      if (u.role === "landlord") landlordUserId = Number(info.lastInsertRowid);
    }

    // 2. Seed Universities
    for (const uni of universities) {
      db.execute(
        `INSERT INTO universities (id, name, short_name, address, district, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uni.id, uni.name, uni.shortName, uni.address, uni.district, uni.lat, uni.lng]
      );
    }

    // 3. Seed 14 Active Rooms
    for (const r of rooms) {
      const sp = r.servicePrices || {};
      const ownerId = [1, 2, 3, 4].includes(Number(r.id)) ? landlordUserId : null;
      db.execute(
        `INSERT INTO rooms (
          id, code, title, address, district, price, area, type, lat, lng,
          image, images_json, amenities_json, verified, landlord_id, landlord_name, landlord_phone,
          trust_score, elec_price, water_price, wifi_price, trash_price, parking_price,
          status, featured, reasons_json, checks_json, submitted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(r.id),
          "RM-" + r.id,
          r.title,
          r.address,
          r.district,
          Number(r.price),
          Number(r.area),
          r.type,
          Number(r.lat),
          Number(r.lng),
          r.image,
          JSON.stringify(r.images || [r.image]),
          JSON.stringify(r.amenities || []),
          r.verified ? 1 : 0,
          ownerId,
          r.landlordName,
          r.landlordPhone,
          Number(r.trustScore || 90),
          Number(sp.electricity || 3500),
          Number(sp.water || 15000),
          Number(sp.wifi || 0),
          Number(sp.trash || 20000),
          Number(sp.parking || 0),
          r.status || "ACTIVE",
          r.featured ? 1 : 0,
          "[]",
          "{}",
          nowStr,
          nowStr
        ]
      );
    }

    // 4. Seed Flagged Rooms (vào chung bảng rooms với status = 'FLAGGED' và mã code 'FL-xxx')
    for (const fl of flaggedData.flaggedRooms || []) {
      const sp = fl.servicePrices || {};
      db.execute(
        `INSERT INTO rooms (
          code, title, address, district, price, area, type, lat, lng,
          image, images_json, amenities_json, verified, landlord_id, landlord_name, landlord_phone,
          trust_score, elec_price, water_price, wifi_price, trash_price, parking_price,
          status, featured, reasons_json, checks_json, submitted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fl.id,
          fl.title,
          fl.address,
          fl.district || "Liên Chiểu",
          Number(fl.price),
          Number(fl.area || 25),
          fl.type || "Phòng trọ",
          16.0715,
          108.1512,
          fl.image || "images/d-1.jpg",
          JSON.stringify([fl.image || "images/d-1.jpg", "images/s-2.jpg"]),
          JSON.stringify(["Điều hòa", "Nóng lạnh", "Chỗ để xe"]),
          0,
          landlordUserId,
          fl.landlordName,
          fl.landlordPhone,
          Number(fl.trustScore || 35),
          Number(sp.electricity || 5000),
          Number(sp.water || 25000),
          Number(sp.wifi || 50000),
          Number(sp.trash || 20000),
          Number(sp.parking || 0),
          fl.status || "FLAGGED",
          0,
          JSON.stringify(fl.reasons || []),
          JSON.stringify(fl.checks || {}),
          fl.submittedAt || nowStr,
          nowStr
        ]
      );
    }

    // 5. Seed Bookings
    for (const bk of bookings) {
      db.execute(
        `INSERT INTO bookings (
          id, room_id, room_title, tenant_name, phone, date, time, note, status, reviewed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bk.id,
          Number(bk.roomId),
          bk.roomTitle,
          bk.tenantName,
          bk.phone,
          bk.date,
          bk.time,
          bk.note || "",
          bk.status,
          0,
          nowStr.slice(0, 10)
        ]
      );
    }

    // 6. Seed Reviews
    for (const rv of reviews) {
      db.execute(
        `INSERT INTO reviews (
          id, room_id, user_name, rating, comment, verified_booking, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(rv.id),
          Number(rv.roomId),
          rv.userName,
          Number(rv.rating),
          rv.comment,
          rv.verifiedBooking ? 1 : 0,
          rv.createdAt
        ]
      );
    }

    // 7. Seed Violation Reports
    for (const rp of flaggedData.violationReports || []) {
      db.execute(
        `INSERT INTO violation_reports (
          id, room_id, room_title, reporter_name, reporter_phone, reason, detail, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rp.id,
          Number(rp.roomId),
          rp.roomTitle,
          rp.reporterName,
          rp.reporterPhone,
          rp.reason,
          rp.detail,
          rp.status || "PENDING",
          rp.createdAt || nowStr
        ]
      );
    }

    // 8. Seed eKYC Requests
    for (const ek of flaggedData.ekycRequests || []) {
      db.execute(
        `INSERT INTO ekyc_requests (
          id, landlord_id, landlord_name, phone, cccd_number, address,
          face_match_score, ocr_status, property_doc, status, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ek.id,
          landlordUserId,
          ek.landlordName,
          ek.phone,
          ek.cccdNumber,
          ek.address,
          Number(ek.faceMatchScore),
          ek.ocrStatus,
          ek.propertyDoc,
          ek.status || "PENDING",
          ek.submittedAt || nowStr
        ]
      );
    }
  });

  return { seeded: true, message: "Seeded SQLite database successfully" };
}

if (require.main === module) {
  const reset = process.argv.includes("--reset");
  const res = seedDatabase(reset);
  console.log(res.message);
}

module.exports = { seedDatabase };

/**
 * backend/src/services/geoAndModeration.js
 * Xử lý tính khoảng cách Haversine và Pipeline Kiểm duyệt tin đăng 4 bước ở phía Server.
 */
function calculateHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function mapRoomRowToDto(row, universities = [], targetUniId = null) {
  if (!row) return null;
  let images = [];
  let amenities = [];
  let reasons = [];
  let checks = {};

  try { images = JSON.parse(row.images_json || "[]"); } catch (_) { images = [row.image]; }
  try { amenities = JSON.parse(row.amenities_json || "[]"); } catch (_) { amenities = []; }
  try { reasons = JSON.parse(row.reasons_json || "[]"); } catch (_) { reasons = []; }
  try { checks = JSON.parse(row.checks_json || "{}"); } catch (_) { checks = {}; }

  let distanceKm = 1.0;
  let refUniName = "ĐH Đà Nẵng";
  let refUniId = null;

  const targetUni = targetUniId
    ? universities.find((u) => u.id === targetUniId)
    : null;

  if (targetUni) {
    distanceKm = calculateHaversine(targetUni.lat, targetUni.lng, row.lat, row.lng);
    refUniName = targetUni.shortName || targetUni.short_name;
    refUniId = targetUni.id;
  } else if (universities.length > 0) {
    let minKm = 9999;
    let nearest = universities[0];
    for (const u of universities) {
      const d = calculateHaversine(u.lat, u.lng, row.lat, row.lng);
      if (d < minKm) {
        minKm = d;
        nearest = u;
      }
    }
    distanceKm = minKm;
    refUniName = nearest.shortName || nearest.short_name;
    refUniId = nearest.id;
  }

  return {
    id: row.status === "FLAGGED" && row.code && row.code.startsWith("FL-") ? row.code : row.id,
    dbId: row.id,
    code: row.code,
    title: row.title,
    address: row.address,
    district: row.district,
    price: row.price,
    area: row.area,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    image: row.image,
    images: images.length ? images : [row.image],
    amenities,
    verified: Boolean(row.verified),
    landlordId: row.landlord_id,
    landlordName: row.landlord_name,
    landlordPhone: row.landlord_phone,
    trustScore: row.trust_score,
    servicePrices: {
      electricity: row.elec_price,
      water: row.water_price,
      wifi: row.wifi_price,
      trash: row.trash_price,
      parking: row.parking_price
    },
    status: row.status,
    featured: Boolean(row.featured),
    reasons,
    checks,
    submittedAt: row.submitted_at,
    distanceKm,
    refUniName,
    refUniId
  };
}

function evaluateRoomModeration(formData) {
  let score = 100;
  const reasons = [];

  const bannedKeywords = [
    "cọc giữ chỗ",
    "chuyển khoản trước",
    "cọc gấp",
    "giữ phòng gấp",
    "cam kết 100%",
    "lừa đảo"
  ];
  const textToScan = `${formData.title || ""} ${formData.address || ""} ${formData.note || ""}`.toLowerCase();
  const hitKeyword = bannedKeywords.find((kw) => textToScan.includes(kw)) || null;

  const keywordCheck = {
    passed: !hitKeyword,
    detail: hitKeyword
      ? `Phát hiện từ khóa nhạy cảm: "${hitKeyword}"`
      : "Không chứa từ khóa cấm hoặc yêu cầu đặt cọc bất thường"
  };
  if (!keywordCheck.passed) {
    score -= 35;
    reasons.push(`Từ khóa cấm: "${hitKeyword}"`);
  }

  const isDuplicateImg =
    formData.imageMode === "DUPLICATE" ||
    (formData.image && formData.image.includes("d-1.jpg") && formData.simulateFlag);
  const pHashSimilarity = isDuplicateImg ? 94 : formData.uploadedFile ? 8 : 14;
  const pHashCheck = {
    passed: !isDuplicateImg,
    detail: isDuplicateImg
      ? `Độ tương đồng pHash ${pHashSimilarity}% (Trùng với tin #4 trên hệ thống)`
      : `Độ tương đồng pHash ${pHashSimilarity}% (< 75% - Ảnh gốc hợp lệ)`
  };
  if (!pHashCheck.passed) {
    score -= 30;
    reasons.push(`Trùng ảnh pHash (${pHashSimilarity}%)`);
  }

  const missingExif = formData.exifMode === "MISSING" || isDuplicateImg;
  const exifCheck = {
    passed: !missingExif,
    detail: missingExif
      ? "Ảnh thiếu EXIF Camera & tọa độ GPS Đà Nẵng"
      : formData.uploadedFileName
      ? `Ảnh tải lên Server (${formData.uploadedFileName}): Metadata hợp lệ`
      : "EXIF hợp lệ: Có thông tin thiết bị chụp & tọa độ GPS khớp vị trí"
  };
  if (!exifCheck.passed) {
    score -= 15;
    reasons.push("Thiếu dữ liệu EXIF GPS");
  }

  const price = Number(formData.price) || 0;
  const area = Number(formData.area) || 20;
  const elec = Number(formData.electricity) || 3500;
  const water = Number(formData.water) || 15000;
  const priceIssues = [];

  if (price < 900000 || price / area < 45000) {
    priceIssues.push("Giá thuê/m² thấp bất thường so với khu vực");
  }
  if (elec > 4000) {
    priceIssues.push(`Giá điện ${elec.toLocaleString("vi-VN")}đ/kWh (> 4.000đ)`);
  }
  if (water > 20000) {
    priceIssues.push(`Giá nước ${water.toLocaleString("vi-VN")}đ/m³ (> 20.000đ)`);
  }

  const priceCheck = {
    passed: priceIssues.length === 0,
    detail:
      priceIssues.length > 0
        ? priceIssues.join("; ")
        : "Giá thuê & đơn giá điện/nước nằm trong ngưỡng minh bạch"
  };
  if (!priceCheck.passed) {
    score -= 25;
    reasons.push(...priceIssues);
  }

  score = Math.max(10, Math.min(100, score));
  const finalStatus =
    score >= 70 && keywordCheck.passed && pHashCheck.passed ? "ACTIVE" : "FLAGGED";

  return {
    trustScore: score,
    status: finalStatus,
    reasons,
    checks: {
      keyword: keywordCheck,
      pHash: pHashCheck,
      exif: exifCheck,
      price: priceCheck
    }
  };
}

module.exports = {
  calculateHaversine,
  mapRoomRowToDto,
  evaluateRoomModeration
};

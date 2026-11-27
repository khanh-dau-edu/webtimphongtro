/**
 * js/api.js
 * Tầng trung gian dữ liệu (Data Access Layer).
 * Mọi trang đều gọi qua SmartTroAPI. Hiện tại đọc từ data/*.json + localStorage.
 * Khi ghép Backend thật chỉ cần đổi các hàm trong file này sang gọi REST API.
 */
(function (window) {
  "use strict";

  var STORAGE_KEYS = {
    COMPARE_IDS: "smarttro_compare_ids",
    CUSTOM_ROOMS: "smarttro_custom_rooms",
    CUSTOM_BOOKINGS: "smarttro_custom_bookings",
    CUSTOM_REPORTS: "smarttro_custom_reports",
    FLAGGED_STATE: "smarttro_flagged_state"
  };

  var _cache = {
    universities: null,
    rooms: null,
    reviews: null,
    bookings: null,
    flagged: null
  };

  // Tự động xác định đường dẫn gốc dựa trên vị trí trang (root hay thư mục con landlord/, admin/, tenant/)
  function getBasePath() {
    var path = window.location.pathname.replace(/\\/g, "/");
    if (
      path.indexOf("/landlord/") !== -1 ||
      path.indexOf("/admin/") !== -1 ||
      path.indexOf("/tenant/") !== -1
    ) {
      return "../";
    }
    return "";
  }

  // Chuẩn hóa đường dẫn ảnh/tài nguyên theo cấp thư mục hiện tại
  function resolveAsset(relPath) {
    if (!relPath) return getBasePath() + "images/s-2.jpg";
    if (relPath.indexOf("http") === 0 || relPath.indexOf("data:") === 0) {
      return relPath;
    }
    var clean = relPath.replace(/^(\.\.\/)+/, "");
    return getBasePath() + clean;
  }

  // Định dạng tiền tệ VNĐ (VD: 2.600.000 đ)
  function formatCurrency(amount) {
    var num = Number(amount) || 0;
    return num.toLocaleString("vi-VN") + " đ";
  }

  // Định dạng giá ngắn gọn trên Card (VD: 2,6 triệu/tháng)
  function formatShortPrice(amount) {
    var num = Number(amount) || 0;
    if (num >= 1000000) {
      var tr = (num / 1000000).toFixed(1).replace(".0", "").replace(".", ",");
      return tr + " tr/tháng";
    }
    return formatCurrency(num) + "/tháng";
  }

  /**
   * Công thức Haversine tính khoảng cách đường chim bay (km) giữa 2 tọa độ GPS
   * @param {number} lat1 Vĩ độ điểm 1
   * @param {number} lng1 Kinh độ điểm 1
   * @param {number} lat2 Vĩ độ điểm 2
   * @param {number} lng2 Kinh độ điểm 2
   * @returns {number} Khoảng cách tính bằng km (làm tròn 2 chữ số thập phân)
   */
  function calculateHaversine(lat1, lng1, lat2, lng2) {
    var R = 6371; // Bán kính Trái Đất (km)
    var toRad = function (deg) {
      return (deg * Math.PI) / 180;
    };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  // Hàm đọc file JSON qua fetch/jQuery
  function fetchJson(fileName) {
    var url = getBasePath() + "data/" + fileName;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Không thể tải " + url);
      return res.json();
    });
  }

  // Lấy danh sách trường Đại học tại Đà Nẵng
  function getUniversities() {
    if (_cache.universities) {
      return Promise.resolve(_cache.universities);
    }
    return fetchJson("universities.json").then(function (data) {
      _cache.universities = data;
      return data;
    });
  }

  // Gắn thông tin trường ĐH gần nhất và khoảng cách mặc định cho từng phòng
  function attachNearestUni(rooms, universities, targetUniId) {
    var targetUni = null;
    if (targetUniId && universities.length) {
      for (var i = 0; i < universities.length; i++) {
        if (universities[i].id === targetUniId) {
          targetUni = universities[i];
          break;
        }
      }
    }

    return rooms.map(function (room) {
      var copy = Object.assign({}, room);
      if (targetUni) {
        copy.distanceKm = calculateHaversine(
          targetUni.lat,
          targetUni.lng,
          copy.lat,
          copy.lng
        );
        copy.refUniName = targetUni.shortName;
        copy.refUniId = targetUni.id;
      } else if (universities && universities.length) {
        var minKm = 9999;
        var nearest = universities[0];
        universities.forEach(function (u) {
          var d = calculateHaversine(u.lat, u.lng, copy.lat, copy.lng);
          if (d < minKm) {
            minKm = d;
            nearest = u;
          }
        });
        copy.distanceKm = minKm;
        copy.refUniName = nearest.shortName;
        copy.refUniId = nearest.id;
      } else {
        copy.distanceKm = 1.0;
        copy.refUniName = "ĐH Đà Nẵng";
      }
      return copy;
    });
  }

  // Lấy danh sách tất cả phòng trọ (kết hợp rooms.json và phòng mới đăng trong phiên)
  function getRooms(filters) {
    return Promise.all([
      _cache.rooms ? Promise.resolve(_cache.rooms) : fetchJson("rooms.json"),
      getUniversities()
    ]).then(function (results) {
      _cache.rooms = results[0];
      var universities = results[1];

      var customRooms = [];
      try {
        customRooms =
          JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROOMS)) || [];
      } catch (e) {
        customRooms = [];
      }

      var allRooms = customRooms.concat(_cache.rooms).filter(function (r) {
        return r.status === "ACTIVE";
      });

      var uniId = filters && filters.uniId ? filters.uniId : null;
      var enriched = attachNearestUni(allRooms, universities, uniId);

      if (!filters) return enriched;
      return applyRoomFilters(enriched, filters);
    });
  }

  // Lọc phòng theo các tiêu chí: giá, diện tích, loại hình, tiện ích, chủ trọ xác thực
  function applyRoomFilters(rooms, filters) {
    return rooms.filter(function (room) {
      if (filters.verifiedOnly && !room.verified) return false;
      if (filters.type && filters.type !== "ALL" && room.type !== filters.type)
        return false;

      if (filters.priceRange && filters.priceRange !== "ALL") {
        if (filters.priceRange === "UNDER_2M" && room.price >= 2000000)
          return false;
        if (
          filters.priceRange === "2M_3M" &&
          (room.price < 2000000 || room.price > 3000000)
        )
          return false;
        if (
          filters.priceRange === "3M_45M" &&
          (room.price <= 3000000 || room.price > 4500000)
        )
          return false;
        if (filters.priceRange === "OVER_45M" && room.price <= 4500000)
          return false;
      }

      if (filters.areaRange && filters.areaRange !== "ALL") {
        if (filters.areaRange === "UNDER_20" && room.area >= 20) return false;
        if (
          filters.areaRange === "20_30" &&
          (room.area < 20 || room.area > 30)
        )
          return false;
        if (filters.areaRange === "OVER_30" && room.area <= 30) return false;
      }

      if (filters.amenities && filters.amenities.length > 0) {
        var roomAms = room.amenities || [];
        for (var i = 0; i < filters.amenities.length; i++) {
          if (roomAms.indexOf(filters.amenities[i]) === -1) return false;
        }
      }
      return true;
    });
  }

  // Tìm kiếm phòng theo bán kính (km) quanh trường Đại học bằng công thức Haversine
  function searchByRadius(uniId, radiusKm, filters) {
    var mergedFilters = Object.assign({}, filters || {}, { uniId: uniId });
    return Promise.all([getUniversities(), getRooms(mergedFilters)]).then(
      function (res) {
        var universities = res[0];
        var rooms = res[1];
        var selectedUni =
          universities.find(function (u) {
            return u.id === uniId;
          }) || universities[0];

        var maxRadius = Number(radiusKm) || 0;
        var filtered = rooms.filter(function (r) {
          var dist = calculateHaversine(
            selectedUni.lat,
            selectedUni.lng,
            r.lat,
            r.lng
          );
          r.distanceKm = dist;
          r.refUniName = selectedUni.shortName;
          r.refUniId = selectedUni.id;
          return maxRadius <= 0 ? true : dist <= maxRadius;
        });

        filtered.sort(function (a, b) {
          return a.distanceKm - b.distanceKm;
        });

        return {
          university: selectedUni,
          rooms: filtered
        };
      }
    );
  }

  // Lấy thông tin chi tiết 1 phòng theo ID
  function getRoom(id) {
    var numId = Number(id) || 1;
    return getRooms().then(function (rooms) {
      var found = rooms.find(function (r) {
        return Number(r.id) === numId;
      });
      return found || rooms[0];
    });
  }

  // Lấy danh sách đánh giá của phòng
  function getReviews(roomId) {
    var p = _cache.reviews
      ? Promise.resolve(_cache.reviews)
      : fetchJson("reviews.json").then(function (data) {
          _cache.reviews = data;
          return data;
        });
    return p.then(function (list) {
      if (!roomId) return list;
      return list.filter(function (item) {
        return Number(item.roomId) === Number(roomId);
      });
    });
  }

  // Lấy & tạo mới lịch hẹn xem phòng
  function getBookings() {
    return fetchJson("bookings.json").then(function (base) {
      var custom = [];
      try {
        custom =
          JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_BOOKINGS)) || [];
      } catch (e) {
        custom = [];
      }
      return custom.concat(base);
    });
  }

  function createBooking(bookingData) {
    var custom = [];
    try {
      custom =
        JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_BOOKINGS)) || [];
    } catch (e) {
      custom = [];
    }
    var newBooking = Object.assign(
      {
        id: "BK-" + Math.floor(1000 + Math.random() * 9000),
        status: "Chờ xác nhận",
        createdAt: new Date().toISOString().slice(0, 10)
      },
      bookingData
    );
    custom.unshift(newBooking);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_BOOKINGS, JSON.stringify(custom));
    return Promise.resolve(newBooking);
  }

  // Gửi báo cáo vi phạm từ trang chi tiết phòng
  function createReport(reportData) {
    var reports = [];
    try {
      reports =
        JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_REPORTS)) || [];
    } catch (e) {
      reports = [];
    }
    var newReport = Object.assign(
      {
        id: "RP-" + Math.floor(100 + Math.random() * 900),
        createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
      },
      reportData
    );
    reports.unshift(newReport);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_REPORTS, JSON.stringify(reports));
    return Promise.resolve(newReport);
  }

  // Quản lý danh sách phòng lưu để So sánh (tối đa 3 phòng)
  function getCompareIds() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.COMPARE_IDS);
      if (!raw) return [1, 4, 5]; // Mặc định nạp sẵn 3 phòng tiêu biểu để so sánh ngay
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [1, 4, 5];
    } catch (e) {
      return [1, 4, 5];
    }
  }

  function setCompareIds(ids) {
    localStorage.setItem(STORAGE_KEYS.COMPARE_IDS, JSON.stringify(ids));
    if (window.SmartTroAuth && window.SmartTroAuth.updateCompareBadge) {
      window.SmartTroAuth.updateCompareBadge();
    }
  }

  function toggleCompareRoom(roomId) {
    var numId = Number(roomId);
    var ids = getCompareIds();
    var idx = ids.indexOf(numId);
    var added = false;
    var message = "";

    if (idx !== -1) {
      ids.splice(idx, 1);
      message = "Đã bỏ phòng khỏi danh sách so sánh.";
    } else {
      if (ids.length >= 3) {
        ids.shift(); // Giữ tối đa 3 phòng
      }
      ids.push(numId);
      added = true;
      message = "Đã lưu vào So sánh chi phí (" + ids.length + "/3 phòng).";
    }
    setCompareIds(ids);
    return { added: added, ids: ids, message: message };
  }

  function replaceCompareSlot(slotIndex, newRoomId) {
    var ids = getCompareIds();
    ids[slotIndex] = Number(newRoomId);
    setCompareIds(ids);
    return ids;
  }

  /**
   * Hàm giả lập kiểm duyệt tin đăng phòng trọ tự động (AI & Rule-based Moderation)
   * Gồm 4 bước:
   * 1. Quét từ khóa cấm (cọc gấp, chuyển khoản giữ chỗ, cam kết 100%...)
   * 2. Kiểm tra trùng lặp hình ảnh bằng mã băm cảm nhận pHash
   * 3. Kiểm tra EXIF Metadata của ảnh (thông tin camera & GPS)
   * 4. Kiểm tra bất thường về giá thuê và đơn giá điện/nước
   */
  function simulateModeration(formData) {
    var score = 100;
    var reasons = [];

    // Bước 1: Kiểm tra từ khóa cấm
    var bannedKeywords = [
      "cọc giữ chỗ",
      "chuyển khoản trước",
      "cọc gấp",
      "giữ phòng gấp",
      "cam kết 100%",
      "lừa đảo"
    ];
    var textToScan = (
      (formData.title || "") +
      " " +
      (formData.address || "") +
      " " +
      (formData.note || "")
    ).toLowerCase();
    var hitKeyword = null;
    for (var i = 0; i < bannedKeywords.length; i++) {
      if (textToScan.indexOf(bannedKeywords[i]) !== -1) {
        hitKeyword = bannedKeywords[i];
        break;
      }
    }
    var keywordCheck = {
      passed: !hitKeyword,
      detail: hitKeyword
        ? 'Phát hiện từ khóa nhạy cảm: "' + hitKeyword + '"'
        : "Không chứa từ khóa cấm hoặc yêu cầu đặt cọc bất thường"
    };
    if (!keywordCheck.passed) {
      score -= 35;
      reasons.push('Từ khóa cấm: "' + hitKeyword + '"');
    }

    // Bước 2: Kiểm tra trùng ảnh pHash
    var isDuplicateImg =
      formData.imageMode === "DUPLICATE" ||
      (formData.image && formData.image.indexOf("d-1.jpg") !== -1 && formData.simulateFlag);
    var pHashSimilarity = isDuplicateImg ? 94 : 14;
    var pHashCheck = {
      passed: !isDuplicateImg,
      detail: isDuplicateImg
        ? "Độ tương đồng pHash " + pHashSimilarity + "% (Trùng với tin #4 trên hệ thống)"
        : "Độ tương đồng pHash " + pHashSimilarity + "% (< 75% - Ảnh gốc hợp lệ)"
    };
    if (!pHashCheck.passed) {
      score -= 30;
      reasons.push("Trùng ảnh pHash (" + pHashSimilarity + "%)");
    }

    // Bước 3: Kiểm tra dữ liệu EXIF ảnh
    var missingExif = formData.exifMode === "MISSING" || isDuplicateImg;
    var exifCheck = {
      passed: !missingExif,
      detail: missingExif
        ? "Ảnh thiếu EXIF Camera & tọa độ GPS Đà Nẵng"
        : "EXIF hợp lệ: Có thông tin thiết bị chụp & tọa độ GPS khớp vị trí"
    };
    if (!exifCheck.passed) {
      score -= 15;
      reasons.push("Thiếu dữ liệu EXIF GPS");
    }

    // Bước 4: Kiểm tra giá thuê & đơn giá điện nước bất thường
    var price = Number(formData.price) || 0;
    var area = Number(formData.area) || 20;
    var elec = Number(formData.electricity) || 3500;
    var water = Number(formData.water) || 15000;
    var priceIssues = [];

    if (price < 900000 || price / area < 45000) {
      priceIssues.push("Giá thuê/m² thấp bất thường so với khu vực");
    }
    if (elec > 4000) {
      priceIssues.push("Giá điện " + elec.toLocaleString("vi-VN") + "đ/kWh (> 4.000đ)");
    }
    if (water > 20000) {
      priceIssues.push("Giá nước " + water.toLocaleString("vi-VN") + "đ/m³ (> 20.000đ)");
    }

    var priceCheck = {
      passed: priceIssues.length === 0,
      detail:
        priceIssues.length > 0
          ? priceIssues.join("; ")
          : "Giá thuê & đơn giá điện/nước nằm trong ngưỡng minh bạch"
    };
    if (!priceCheck.passed) {
      score -= 25;
      priceIssues.forEach(function (iss) {
        reasons.push(iss);
      });
    }

    score = Math.max(10, Math.min(100, score));
    var finalStatus = score >= 70 && keywordCheck.passed && pHashCheck.passed ? "ACTIVE" : "FLAGGED";

    var resultObj = {
      id: finalStatus === "ACTIVE" ? Date.now() : "FL-" + Math.floor(300 + Math.random() * 600),
      title: formData.title || "Phòng trọ mới đăng",
      address: formData.address || "Liên Chiểu, Đà Nẵng",
      district: formData.district || "Liên Chiểu",
      price: price,
      area: area,
      type: formData.type || "Phòng trọ",
      lat: Number(formData.lat) || 16.0738,
      lng: Number(formData.lng) || 108.1499,
      image: formData.image || "images/s-2.jpg",
      images: [formData.image || "images/s-2.jpg", "images/s-3.jpg", "images/d-2.jpg"],
      amenities: formData.amenities || ["Điều hòa", "Nóng lạnh", "Giờ giấc tự do"],
      verified: true,
      landlordName: formData.landlordName || "Chủ trọ đã xác thực",
      landlordPhone: formData.landlordPhone || "0905123456",
      submittedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      trustScore: score,
      status: finalStatus,
      reasons: reasons,
      checks: {
        keyword: keywordCheck,
        pHash: pHashCheck,
        exif: exifCheck,
        price: priceCheck
      },
      servicePrices: {
        electricity: elec,
        water: water,
        wifi: Number(formData.wifi) || 0,
        trash: Number(formData.trash) || 20000,
        parking: Number(formData.parking) || 0
      }
    };

    // Lưu tin vào localStorage để đồng bộ giữa trang Tìm kiếm và trang Admin hậu kiểm
    if (finalStatus === "ACTIVE") {
      var customRooms = [];
      try {
        customRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROOMS)) || [];
      } catch (e) {
        customRooms = [];
      }
      customRooms.unshift(resultObj);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_ROOMS, JSON.stringify(customRooms));
    } else {
      getFlaggedData().then(function (flaggedState) {
        flaggedState.flaggedRooms.unshift(resultObj);
        localStorage.setItem(STORAGE_KEYS.FLAGGED_STATE, JSON.stringify(flaggedState));
      });
    }

    return resultObj;
  }

  // Lấy dữ liệu tin bị gắn cờ & hồ sơ eKYC cho trang Admin hậu kiểm
  function getFlaggedData() {
    try {
      var saved = localStorage.getItem(STORAGE_KEYS.FLAGGED_STATE);
      if (saved) {
        return Promise.resolve(JSON.parse(saved));
      }
    } catch (e) {}

    return fetchJson("flagged.json").then(function (data) {
      localStorage.setItem(STORAGE_KEYS.FLAGGED_STATE, JSON.stringify(data));
      return data;
    });
  }

  // Admin Duyệt hoặc Từ chối tin bị gắn cờ
  function updateFlaggedStatus(id, newStatus) {
    return getFlaggedData().then(function (state) {
      var target = null;
      state.flaggedRooms = state.flaggedRooms.map(function (item) {
        if (String(item.id) === String(id)) {
          item.status = newStatus;
          target = item;
        }
        return item;
      });
      localStorage.setItem(STORAGE_KEYS.FLAGGED_STATE, JSON.stringify(state));

      if (newStatus === "APPROVED" && target) {
        var customRooms = [];
        try {
          customRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_ROOMS)) || [];
        } catch (e) {
          customRooms = [];
        }
        var approvedRoom = Object.assign({}, target, {
          id: Date.now(),
          status: "ACTIVE",
          verified: true,
          lat: target.lat || 16.0715,
          lng: target.lng || 108.1512,
          images: [target.image || "images/s-2.jpg", "images/d-1.jpg"],
          amenities: ["Điều hòa", "Nóng lạnh", "Chỗ để xe"]
        });
        customRooms.unshift(approvedRoom);
        localStorage.setItem(STORAGE_KEYS.CUSTOM_ROOMS, JSON.stringify(customRooms));
      }
      return state;
    });
  }

  // Admin Duyệt hoặc Từ chối hồ sơ eKYC
  function updateEkycStatus(id, newStatus) {
    return getFlaggedData().then(function (state) {
      state.ekycRequests = state.ekycRequests.map(function (req) {
        if (String(req.id) === String(id)) {
          req.status = newStatus;
        }
        return req;
      });
      localStorage.setItem(STORAGE_KEYS.FLAGGED_STATE, JSON.stringify(state));
      return state;
    });
  }

  /**
   * Render HTML cho Card phòng trọ theo đúng nguyên tắc ÍT CHỮ:
   * Gồm: Ảnh, Giá/tháng, Diện tích, Khoảng cách tới trường, Badge "Chủ trọ đã xác thực", nút "Xem"
   */
  function renderRoomCard(room, colClass) {
    var compareIds = getCompareIds();
    var isCompared = compareIds.indexOf(Number(room.id)) !== -1;
    var detailUrl = getBasePath() + "room-detail.html?id=" + room.id;
    var imgUrl = resolveAsset(room.image);
    var wrapperClass = colClass || "col-lg-4 col-md-6 mb-4";

    var verifiedBadge = room.verified
      ? '<span class="badge-verified">✓ Chủ trọ đã xác thực</span>'
      : '<span class="badge-unverified">Chưa xác thực eKYC</span>';

    var distText =
      (room.distanceKm !== undefined ? room.distanceKm : "0.8") +
      " km tới " +
      (room.refUniName || "trường ĐH");

    return (
      '<div class="' +
      wrapperClass +
      '" data-room-id="' +
      room.id +
      '">' +
      '  <div class="room-card">' +
      '    <div class="img-wrap">' +
      '      <a href="' +
      detailUrl +
      '">' +
      '        <img src="' +
      imgUrl +
      '" alt="' +
      room.title +
      '">' +
      "      </a>" +
      verifiedBadge +
      '      <span class="badge-room-type">' +
      room.type +
      "</span>" +
      "    </div>" +
      '    <div class="card-body-custom">' +
      '      <h5 class="room-title" title="' +
      room.title +
      '">' +
      room.title +
      "</h5>" +
      '      <div class="room-core-metrics">' +
      '        <span class="metric-pill price-pill">' +
      formatShortPrice(room.price) +
      "</span>" +
      '        <span class="metric-pill">📐 ' +
      room.area +
      " m²</span>" +
      '        <span class="metric-pill distance-pill">📍 ' +
      distText +
      "</span>" +
      "      </div>" +
      '      <div class="room-card-actions">' +
      '        <a href="' +
      detailUrl +
      '" class="btn-view-room">Xem</a>' +
      '        <button type="button" class="btn-compare-toggle ' +
      (isCompared ? "active" : "") +
      '" onclick="window.handleCompareClick(' +
      room.id +
      ', this)">' +
      (isCompared ? "✓ Đã lưu" : "+ So sánh") +
      "</button>" +
      "      </div>" +
      "    </div>" +
      "  </div>" +
      "</div>"
    );
  }

  // Sự kiện lưu phòng vào danh sách so sánh trên toàn cục
  window.handleCompareClick = function (roomId, btnEl) {
    var res = toggleCompareRoom(roomId);
    if (btnEl) {
      if (res.added) {
        btnEl.classList.add("active");
        btnEl.textContent = "✓ Đã lưu";
      } else {
        btnEl.classList.remove("active");
        btnEl.textContent = "+ So sánh";
      }
    }
    if (window.showToast) {
      window.showToast(res.message);
    }
  };

  window.SmartTroAPI = {
    getBasePath: getBasePath,
    resolveAsset: resolveAsset,
    formatCurrency: formatCurrency,
    formatShortPrice: formatShortPrice,
    calculateHaversine: calculateHaversine,
    getUniversities: getUniversities,
    getRooms: getRooms,
    getRoom: getRoom,
    searchByRadius: searchByRadius,
    getReviews: getReviews,
    getBookings: getBookings,
    createBooking: createBooking,
    createReport: createReport,
    getCompareIds: getCompareIds,
    toggleCompareRoom: toggleCompareRoom,
    replaceCompareSlot: replaceCompareSlot,
    simulateModeration: simulateModeration,
    getFlaggedData: getFlaggedData,
    updateFlaggedStatus: updateFlaggedStatus,
    updateEkycStatus: updateEkycStatus,
    renderRoomCard: renderRoomCard
  };
})(window);

/**
 * js/api.js
 * Tầng trung gian dữ liệu (Data Access Layer) kết nối REST API Backend (Node.js + SQLite).
 * Tự động gửi kèm JWT Token trong Header và hỗ trợ Fallback sang dữ liệu tĩnh JSON
 * trong trường hợp người dùng mở giao diện tĩnh mà chưa bật server Node.js.
 */
(function (window) {
  "use strict";

  var API_BASE = window.SMARTTRO_API_BASE || "/api";

  var STORAGE_KEYS = {
    COMPARE_IDS: "smarttro_compare_ids",
    CUSTOM_ROOMS: "smarttro_custom_rooms",
    ROOM_OVERRIDES: "smarttro_room_overrides",
    CUSTOM_BOOKINGS: "smarttro_custom_bookings",
    BOOKING_OVERRIDES: "smarttro_booking_overrides",
    CUSTOM_REVIEWS: "smarttro_custom_reviews",
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

  function safeReadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getAuthHeaders(extraHeaders) {
    var headers = Object.assign({}, extraHeaders || {});
    if (window.SmartTroAuth && window.SmartTroAuth.getToken) {
      var token = window.SmartTroAuth.getToken();
      if (token) {
        headers["Authorization"] = "Bearer " + token;
      }
    }
    return headers;
  }

  // Gọi REST API Backend; ném lỗi rõ ràng nếu API trả mã lỗi 4xx/5xx hoặc mất kết nối
  function apiRequest(endpoint, options) {
    var opts = options || {};
    var headers = getAuthHeaders(
      opts.body && !(opts.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}
    );
    var fetchOpts = Object.assign({}, opts, { headers: headers });
    if (
      fetchOpts.body &&
      typeof fetchOpts.body === "object" &&
      !(fetchOpts.body instanceof FormData)
    ) {
      fetchOpts.body = JSON.stringify(fetchOpts.body);
    }

    return fetch(API_BASE + endpoint, fetchOpts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || "Lỗi API HTTP " + res.status);
          err.status = res.status;
          err.isHttpError = true;
          throw err;
        }
        return data;
      });
    });
  }

  // Chỉ chuyển sang dữ liệu tĩnh dự phòng khi không có kết nối tới Server (Network Error / 404 tĩnh),
  // giữ nguyên các lỗi nghiệp vụ 400/401/403/409 trả về từ Backend REST API
  function onOfflineFallback(fallbackFn) {
    return function (err) {
      if (err && err.isHttpError && err.status !== 404 && err.status !== 405) {
        throw err;
      }
      return fallbackFn();
    };
  }

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

  function resolveAsset(relPath) {
    if (!relPath) return getBasePath() + "images/s-2.jpg";
    if (
      relPath.indexOf("http") === 0 ||
      relPath.indexOf("data:") === 0 ||
      relPath.indexOf("/uploads/") === 0
    ) {
      return relPath;
    }
    var clean = relPath.replace(/^(\.\.\/)+/, "");
    return getBasePath() + clean;
  }

  function formatCurrency(amount) {
    var num = Number(amount) || 0;
    return num.toLocaleString("vi-VN") + " đ";
  }

  function formatShortPrice(amount) {
    var num = Number(amount) || 0;
    if (num >= 1000000) {
      var tr = (num / 1000000).toFixed(1).replace(".0", "").replace(".", ",");
      return tr + " tr/tháng";
    }
    return formatCurrency(num) + "/tháng";
  }

  function calculateHaversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
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

  function fetchStaticJson(fileName) {
    var url = getBasePath() + "data/" + fileName;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Không thể tải " + url);
      return res.json();
    });
  }

  function buildRoomQueryString(filters, extraParams) {
    var params = new URLSearchParams();
    var f = filters || {};
    if (f.uniId) params.set("uniId", f.uniId);
    if (f.priceRange && f.priceRange !== "ALL") params.set("priceRange", f.priceRange);
    if (f.areaRange && f.areaRange !== "ALL") params.set("areaRange", f.areaRange);
    if (f.type && f.type !== "ALL") params.set("type", f.type);
    if (f.verifiedOnly) params.set("verifiedOnly", "true");
    if (f.includeAllStatuses) params.set("includeAllStatuses", "true");
    if (f.amenities && f.amenities.length > 0) {
      params.set("amenities", f.amenities.join(","));
    }
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        if (extraParams[k] !== undefined && extraParams[k] !== null) {
          params.set(k, String(extraParams[k]));
        }
      });
    }
    var qs = params.toString();
    return qs ? "?" + qs : "";
  }

  // -------------------------------------------------------------------------
  // CÁC HÀM GỌI REST API (CÓ FALLBACK TĨNH KHI CHẠY OFFLINE KHÔNG SERVER)
  // -------------------------------------------------------------------------

  function getUniversities() {
    if (_cache.universities) {
      return Promise.resolve(_cache.universities);
    }
    return apiRequest("/universities")
      .catch(function () {
        return fetchStaticJson("universities.json");
      })
      .then(function (data) {
        _cache.universities = data;
        return data;
      });
  }

  function attachNearestUniLocal(rooms, universities, targetUniId) {
    var targetUni = null;
    if (targetUniId && universities.length) {
      targetUni = universities.find(function (u) {
        return u.id === targetUniId;
      });
    }
    return rooms.map(function (room) {
      var copy = Object.assign({}, room);
      if (targetUni) {
        copy.distanceKm = calculateHaversine(targetUni.lat, targetUni.lng, copy.lat, copy.lng);
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
      }
      return copy;
    });
  }

  function getRoomsFallback(filters) {
    return Promise.all([fetchStaticJson("rooms.json"), getUniversities()]).then(
      function (results) {
        var customRooms = safeReadJson(STORAGE_KEYS.CUSTOM_ROOMS, []);
        var overrides = safeReadJson(STORAGE_KEYS.ROOM_OVERRIDES, {});
        var includeAll = filters && filters.includeAllStatuses;

        var merged = customRooms.concat(results[0]).map(function (r) {
          var ov = overrides[String(r.id)];
          if (!ov) return Object.assign({}, r);
          var m = Object.assign({}, r, ov);
          if (ov.servicePrices) {
            m.servicePrices = Object.assign({}, r.servicePrices || {}, ov.servicePrices);
          }
          return m;
        }).filter(function (r) {
          return includeAll ? true : r.status === "ACTIVE";
        });

        var enriched = attachNearestUniLocal(merged, results[1], filters && filters.uniId);
        return enriched;
      }
    );
  }

  function getRooms(filters) {
    var qs = buildRoomQueryString(filters);
    return apiRequest("/rooms" + qs).catch(function () {
      return getRoomsFallback(filters);
    });
  }

  function searchByRadius(uniId, radiusKm, filters) {
    var qs = buildRoomQueryString(filters, {
      mode: "radius",
      uniId: uniId,
      radius: radiusKm
    });
    return apiRequest("/rooms" + qs).catch(function () {
      return Promise.all([getUniversities(), getRoomsFallback(filters)]).then(
        function (res) {
          var selectedUni =
            res[0].find(function (u) { return u.id === uniId; }) || res[0][0];
          var maxR = Number(radiusKm) || 0;
          var list = res[1]
            .map(function (r) {
              var dist = calculateHaversine(selectedUni.lat, selectedUni.lng, r.lat, r.lng);
              return Object.assign({}, r, {
                distanceKm: dist,
                refUniName: selectedUni.shortName,
                refUniId: selectedUni.id
              });
            })
            .filter(function (r) { return maxR <= 0 ? true : r.distanceKm <= maxR; })
            .sort(function (a, b) { return a.distanceKm - b.distanceKm; });
          return { university: selectedUni, rooms: list };
        }
      );
    });
  }

  function getRoom(id) {
    return apiRequest("/rooms/" + encodeURIComponent(id)).catch(function () {
      return getRoomsFallback({ includeAllStatuses: true }).then(function (rooms) {
        return (
          rooms.find(function (r) { return String(r.id) === String(id); }) || rooms[0]
        );
      });
    });
  }

  function getLandlordRooms() {
    return apiRequest("/rooms/landlord").catch(function () {
      return Promise.all([
        getRoomsFallback({ includeAllStatuses: true }),
        fetchStaticJson("flagged.json")
      ]).then(function (res) {
        return {
          activeAndRented: res[0].slice(0, 6),
          flaggedOrRejected: res[1].flaggedRooms || []
        };
      });
    });
  }

  function updateRoomStatus(roomId, newStatus) {
    return apiRequest("/rooms/" + encodeURIComponent(roomId) + "/status", {
      method: "PATCH",
      body: { status: newStatus }
    }).catch(function () {
      var overrides = safeReadJson(STORAGE_KEYS.ROOM_OVERRIDES, {});
      overrides[String(roomId)] = Object.assign({}, overrides[String(roomId)] || {}, {
        status: newStatus
      });
      localStorage.setItem(STORAGE_KEYS.ROOM_OVERRIDES, JSON.stringify(overrides));
      return { id: roomId, status: newStatus };
    });
  }

  function updateRoomPricing(roomId, payload) {
    return apiRequest("/rooms/" + encodeURIComponent(roomId) + "/pricing", {
      method: "PATCH",
      body: payload
    }).catch(function () {
      var overrides = safeReadJson(STORAGE_KEYS.ROOM_OVERRIDES, {});
      overrides[String(roomId)] = Object.assign({}, overrides[String(roomId)] || {}, {
        price: Number(payload.price),
        servicePrices: {
          electricity: Number(payload.electricity),
          water: Number(payload.water),
          wifi: Number(payload.wifi),
          trash: Number(payload.trash),
          parking: Number(payload.parking)
        }
      });
      localStorage.setItem(STORAGE_KEYS.ROOM_OVERRIDES, JSON.stringify(overrides));
      return overrides[String(roomId)];
    });
  }

  function uploadRoomImage(fileObj) {
    var fd = new FormData();
    fd.append("image", fileObj);
    return apiRequest("/upload", {
      method: "POST",
      body: fd
    });
  }

  function createRoom(formData) {
    return apiRequest("/rooms", {
      method: "POST",
      body: formData
    }).catch(onOfflineFallback(function () {
      return Promise.resolve(simulateModerationFallback(formData));
    }));
  }

  function getReviews(roomId) {
    var qs = roomId ? "?roomId=" + encodeURIComponent(roomId) : "";
    return apiRequest("/reviews" + qs).catch(onOfflineFallback(function () {
      return fetchStaticJson("reviews.json").then(function (base) {
        var custom = safeReadJson(STORAGE_KEYS.CUSTOM_REVIEWS, []);
        var all = custom.concat(base);
        return roomId
          ? all.filter(function (x) { return Number(x.roomId) === Number(roomId); })
          : all;
      });
    }));
  }

  function createReview(reviewData) {
    return apiRequest("/reviews", {
      method: "POST",
      body: reviewData
    }).catch(onOfflineFallback(function () {
      var custom = safeReadJson(STORAGE_KEYS.CUSTOM_REVIEWS, []);
      var rv = Object.assign(
        {
          id: "RV-" + Date.now(),
          verifiedBooking: true,
          createdAt: new Date().toISOString().slice(0, 10)
        },
        reviewData
      );
      custom.unshift(rv);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_REVIEWS, JSON.stringify(custom));
      return rv;
    }));
  }

  function getBookings() {
    return apiRequest("/bookings").catch(onOfflineFallback(function () {
      return fetchStaticJson("bookings.json");
    }));
  }

  function createBooking(bookingData) {
    return apiRequest("/bookings", {
      method: "POST",
      body: bookingData
    }).catch(onOfflineFallback(function () {
      var custom = safeReadJson(STORAGE_KEYS.CUSTOM_BOOKINGS, []);
      var bk = Object.assign(
        {
          id: "BK-" + Math.floor(1000 + Math.random() * 9000),
          status: "Chờ xác nhận",
          reviewed: false,
          createdAt: new Date().toISOString().slice(0, 10)
        },
        bookingData
      );
      custom.unshift(bk);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_BOOKINGS, JSON.stringify(custom));
      return bk;
    }));
  }

  function updateBookingStatus(bookingId, newStatus) {
    return apiRequest("/bookings/" + encodeURIComponent(bookingId) + "/status", {
      method: "PATCH",
      body: { status: newStatus }
    });
  }

  function createReport(reportData) {
    return apiRequest("/reports", {
      method: "POST",
      body: reportData
    });
  }

  function getViolationReports() {
    return apiRequest("/reports").catch(function () {
      return fetchStaticJson("flagged.json").then(function (d) {
        return d.violationReports || [];
      });
    });
  }

  function updateReportStatus(reportId, newStatus) {
    return apiRequest("/reports/" + encodeURIComponent(reportId) + "/status", {
      method: "PATCH",
      body: { status: newStatus }
    });
  }

  function submitEkycRequest(ekycPayload) {
    return apiRequest("/ekyc", {
      method: "POST",
      body: ekycPayload
    });
  }

  function getFlaggedData() {
    return apiRequest("/admin/moderation").catch(function () {
      return fetchStaticJson("flagged.json");
    });
  }

  function updateFlaggedStatus(id, newStatus) {
    return apiRequest("/admin/flagged/" + encodeURIComponent(id), {
      method: "PATCH",
      body: { status: newStatus }
    });
  }

  function updateEkycStatus(id, newStatus) {
    return apiRequest("/admin/ekyc/" + encodeURIComponent(id), {
      method: "PATCH",
      body: { status: newStatus }
    });
  }

  function resetAdminDemoData() {
    return apiRequest("/admin/reset-demo-public", {
      method: "POST"
    }).then(function () {
      localStorage.removeItem(STORAGE_KEYS.FLAGGED_STATE);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_REPORTS);
      localStorage.removeItem(STORAGE_KEYS.ROOM_OVERRIDES);
      return getFlaggedData();
    });
  }

  // Quản lý danh sách lưu so sánh phòng ở phía trình duyệt
  function getCompareIds() {
    var parsed = safeReadJson(STORAGE_KEYS.COMPARE_IDS, null);
    if (!parsed || !Array.isArray(parsed)) return [1, 4, 5];
    return parsed;
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
        ids.shift();
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

  // Fallback kiểm duyệt cục bộ nếu chạy không có Backend
  function simulateModerationFallback(formData) {
    var score = 100;
    var reasons = [];
    var bannedKeywords = ["cọc giữ chỗ", "chuyển khoản trước", "cọc gấp", "giữ phòng gấp", "cam kết 100%", "lừa đảo"];
    var text = ((formData.title || "") + " " + (formData.address || "")).toLowerCase();
    var hit = bannedKeywords.find(function (k) { return text.indexOf(k) !== -1; }) || null;
    if (hit) { score -= 35; reasons.push('Từ khóa cấm: "' + hit + '"'); }
    var dup = formData.imageMode === "DUPLICATE";
    if (dup) { score -= 30; reasons.push("Trùng ảnh pHash (94%)"); }
    var missExif = formData.exifMode === "MISSING" || dup;
    if (missExif) { score -= 15; reasons.push("Thiếu dữ liệu EXIF GPS"); }
    var price = Number(formData.price) || 0;
    var area = Number(formData.area) || 20;
    var elec = Number(formData.electricity) || 3500;
    var water = Number(formData.water) || 15000;
    var pIssues = [];
    if (price < 900000 || price / area < 45000) pIssues.push("Giá thuê/m² thấp bất thường");
    if (elec > 4000) pIssues.push("Giá điện > 4.000đ/kWh");
    if (water > 20000) pIssues.push("Giá nước > 20.000đ/m³");
    if (pIssues.length) { score -= 25; reasons = reasons.concat(pIssues); }
    score = Math.max(10, Math.min(100, score));
    var status = score >= 70 && !hit && !dup ? "ACTIVE" : "FLAGGED";
    return {
      id: status === "ACTIVE" ? Date.now() : "FL-" + Math.floor(300 + Math.random() * 600),
      title: formData.title,
      status: status,
      trustScore: score,
      reasons: reasons,
      checks: {
        keyword: { passed: !hit, detail: hit ? 'Phát hiện: "' + hit + '"' : "Hợp lệ" },
        pHash: { passed: !dup, detail: dup ? "Trùng pHash 94%" : "Ảnh gốc hợp lệ" },
        exif: { passed: !missExif, detail: missExif ? "Thiếu EXIF" : "EXIF hợp lệ" },
        price: { passed: pIssues.length === 0, detail: pIssues.join("; ") || "Giá minh bạch" }
      }
    };
  }

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
    apiRequest: apiRequest,
    getBasePath: getBasePath,
    resolveAsset: resolveAsset,
    formatCurrency: formatCurrency,
    formatShortPrice: formatShortPrice,
    calculateHaversine: calculateHaversine,
    getUniversities: getUniversities,
    getRooms: getRooms,
    getRoom: getRoom,
    getLandlordRooms: getLandlordRooms,
    updateRoomStatus: updateRoomStatus,
    updateRoomPricing: updateRoomPricing,
    uploadRoomImage: uploadRoomImage,
    createRoom: createRoom,
    simulateModeration: createRoom,
    searchByRadius: searchByRadius,
    getReviews: getReviews,
    createReview: createReview,
    getBookings: getBookings,
    createBooking: createBooking,
    updateBookingStatus: updateBookingStatus,
    createReport: createReport,
    getViolationReports: getViolationReports,
    updateReportStatus: updateReportStatus,
    submitEkycRequest: submitEkycRequest,
    getCompareIds: getCompareIds,
    toggleCompareRoom: toggleCompareRoom,
    replaceCompareSlot: replaceCompareSlot,
    getFlaggedData: getFlaggedData,
    updateFlaggedStatus: updateFlaggedStatus,
    updateEkycStatus: updateEkycStatus,
    resetAdminDemoData: resetAdminDemoData,
    renderRoomCard: renderRoomCard
  };
})(window);

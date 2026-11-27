/**
 * js/cost-calc.js
 * Công cụ tính "Tổng chi phí thực tế hàng tháng" và cảnh báo đơn giá điện/nước cao bất thường.
 * Dùng cho trang Chi tiết phòng (room-detail.html) và trang So sánh phòng (compare.html).
 */
(function (window) {
  "use strict";

  // Ngưỡng đơn giá phổ biến tại Đà Nẵng để cảnh báo nếu chủ trọ thu cao bất thường
  var THRESHOLDS = {
    ELECTRICITY_MAX: 4000, // Cảnh báo nếu điện > 4.000 đ/kWh
    WATER_MAX: 20000 // Cảnh báo nếu nước > 20.000 đ/m³
  };

  /**
   * Tính tổng chi phí thực tế hàng tháng dựa trên mức sử dụng của người thuê
   * @param {Object} room Thông tin phòng (gồm price và servicePrices)
   * @param {Object} usage Mức sử dụng { kwh, waterM3, bikes, people }
   * @returns {Object} Chi tiết từng khoản phí, tổng chi phí, chi phí/người và danh sách cảnh báo
   */
  function calculateMonthlyCost(room, usage) {
    var sp = (room && room.servicePrices) || {
      electricity: 3500,
      water: 15000,
      wifi: 50000,
      trash: 20000,
      parking: 0
    };

    var kwh = Number(usage.kwh !== undefined ? usage.kwh : 100);
    var waterM3 = Number(usage.waterM3 !== undefined ? usage.waterM3 : 5);
    var bikes = Number(usage.bikes !== undefined ? usage.bikes : 1);
    var people = Math.max(1, Number(usage.people !== undefined ? usage.people : 2));

    var baseRent = Number(room.price) || 0;
    var electricityCost = kwh * (Number(sp.electricity) || 0);
    var waterCost = waterM3 * (Number(sp.water) || 0);
    var wifiCost = Number(sp.wifi) || 0;
    var trashCost = Number(sp.trash) || 0;
    var parkingCost = bikes * (Number(sp.parking) || 0);
    var otherServicesCost = wifiCost + trashCost + parkingCost;

    var totalMonthly = baseRent + electricityCost + waterCost + otherServicesCost;
    var perPerson = Math.round(totalMonthly / people);

    // Kiểm tra cảnh báo đơn giá điện / nước cao bất thường
    var warnings = [];
    if (Number(sp.electricity) > THRESHOLDS.ELECTRICITY_MAX) {
      warnings.push(
        "Giá điện " +
          Number(sp.electricity).toLocaleString("vi-VN") +
          " đ/kWh cao hơn mức phổ biến (≤ 4.000 đ/kWh)"
      );
    }
    if (Number(sp.water) > THRESHOLDS.WATER_MAX) {
      warnings.push(
        "Giá nước " +
          Number(sp.water).toLocaleString("vi-VN") +
          " đ/m³ cao hơn mức phổ biến (≤ 20.000 đ/m³)"
      );
    }

    return {
      baseRent: baseRent,
      electricityCost: electricityCost,
      waterCost: waterCost,
      wifiCost: wifiCost,
      trashCost: trashCost,
      parkingCost: parkingCost,
      otherServicesCost: otherServicesCost,
      totalMonthly: totalMonthly,
      perPerson: perPerson,
      warnings: warnings,
      hasWarning: warnings.length > 0
    };
  }

  // Khởi tạo giao diện thanh trượt tính chi phí tức thì trên trang room-detail.html
  function initRoomCalculator(containerId, room) {
    var container = document.getElementById(containerId);
    if (!container || !room) return;

    var sp = room.servicePrices || {};
    var fmt = window.SmartTroAPI.formatCurrency;

    container.innerHTML =
      '<div class="cost-calc-card">' +
      '  <div class="cost-calc-header d-flex justify-content-between align-items-center">' +
      '    <h4>⚡ Tổng Chi Phí Thực Tế Hàng Tháng</h4>' +
      '    <span class="badge badge-warning text-dark">Tính tức thì</span>' +
      "  </div>" +
      '  <div class="cost-calc-body">' +
      '    <div id="calcWarningArea"></div>' +
      '    <div class="slider-group">' +
      '      <div class="slider-label-row">' +
      '        <span>🔌 Điện tiêu thụ (<span id="lblKwh">100</span> kWh × ' +
      fmt(sp.electricity) +
      ")</span>" +
      '        <strong id="valElecCost">0 đ</strong>' +
      "      </div>" +
      '      <input type="range" id="rangeKwh" min="0" max="300" step="10" value="100">' +
      "    </div>" +
      '    <div class="slider-group">' +
      '      <div class="slider-label-row">' +
      '        <span>💧 Nước sinh hoạt (<span id="lblWater">5</span> m³ × ' +
      fmt(sp.water) +
      ")</span>" +
      '        <strong id="valWaterCost">0 đ</strong>' +
      "      </div>" +
      '      <input type="range" id="rangeWater" min="0" max="25" step="1" value="5">' +
      "    </div>" +
      '    <div class="slider-group">' +
      '      <div class="slider-label-row">' +
      '        <span>🛵 Số lượng xe (<span id="lblBikes">1</span> xe × ' +
      fmt(sp.parking) +
      ")</span>" +
      '        <strong id="valBikeCost">0 đ</strong>' +
      "      </div>" +
      '      <input type="range" id="rangeBikes" min="0" max="4" step="1" value="1">' +
      "    </div>" +
      '    <div class="slider-group">' +
      '      <div class="slider-label-row">' +
      '        <span>👥 Số người ở ghép (<span id="lblPeople">2</span> người)</span>' +
      '        <span class="text-muted small">Chia đầu người</span>' +
      "      </div>" +
      '      <input type="range" id="rangePeople" min="1" max="4" step="1" value="2">' +
      "    </div>" +
      '    <div class="small text-muted mb-3 d-flex justify-content-between border-top pt-2">' +
      '      <span>Phí cố định (Wifi: ' +
      fmt(sp.wifi) +
      " + Rác: " +
      fmt(sp.trash) +
      ")</span>" +
      '      <strong class="text-dark">' +
      fmt((Number(sp.wifi) || 0) + (Number(sp.trash) || 0)) +
      "</strong>" +
      "    </div>" +
      '    <div class="cost-total-banner">' +
      '      <div class="small text-uppercase font-weight-bold text-dark">Tổng chi phí dự kiến / tháng</div>' +
      '      <div class="total-number" id="valTotalMonthly">0 đ</div>' +
      '      <div class="small font-weight-bold text-primary mt-1">≈ <span id="valPerPerson">0 đ</span> / người / tháng</div>' +
      "    </div>" +
      "  </div>" +
      "</div>";

    var rangeKwh = document.getElementById("rangeKwh");
    var rangeWater = document.getElementById("rangeWater");
    var rangeBikes = document.getElementById("rangeBikes");
    var rangePeople = document.getElementById("rangePeople");

    function updateCalc() {
      var usage = {
        kwh: Number(rangeKwh.value),
        waterM3: Number(rangeWater.value),
        bikes: Number(rangeBikes.value),
        people: Number(rangePeople.value)
      };

      document.getElementById("lblKwh").textContent = usage.kwh;
      document.getElementById("lblWater").textContent = usage.waterM3;
      document.getElementById("lblBikes").textContent = usage.bikes;
      document.getElementById("lblPeople").textContent = usage.people;

      var result = calculateMonthlyCost(room, usage);

      document.getElementById("valElecCost").textContent = fmt(result.electricityCost);
      document.getElementById("valWaterCost").textContent = fmt(result.waterCost);
      document.getElementById("valBikeCost").textContent = fmt(result.parkingCost);
      document.getElementById("valTotalMonthly").textContent = fmt(result.totalMonthly);
      document.getElementById("valPerPerson").textContent = fmt(result.perPerson);

      var warningArea = document.getElementById("calcWarningArea");
      if (result.hasWarning) {
        warningArea.innerHTML =
          '<div class="cost-Warning-box">⚠️ <strong>Cảnh báo giá dịch vụ cao:</strong><br>' +
          result.warnings.join("<br>") +
          "</div>";
      } else {
        warningArea.innerHTML =
          '<div class="cost-safe-box">✓ Đơn giá điện, nước nằm trong mức minh bạch chuẩn Đà Nẵng.</div>';
      }
    }

    [rangeKwh, rangeWater, rangeBikes, rangePeople].forEach(function (inp) {
      inp.addEventListener("input", updateCalc);
    });

    updateCalc();
  }

  window.SmartTroCostCalc = {
    THRESHOLDS: THRESHOLDS,
    calculateMonthlyCost: calculateMonthlyCost,
    initRoomCalculator: initRoomCalculator
  };
})(window);

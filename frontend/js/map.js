/**
 * js/map.js
 * Module bản đồ Leaflet.js + OpenStreetMap và tính khoảng cách bằng công thức Haversine.
 * Thay thế hoàn toàn các iframe Google Maps trong template gốc.
 */
(function (window) {
  "use strict";

  var _searchMap = null;
  var _radiusCircle = null;
  var _uniMarker = null;
  var _roomMarkers = {};
  var _markerLayerGroup = null;

  /**
   * Công thức Haversine tính khoảng cách (km) giữa 2 tọa độ (lat1, lng1) và (lat2, lng2)
   */
  function calculateHaversine(lat1, lng1, lat2, lng2) {
    if (window.SmartTroAPI && window.SmartTroAPI.calculateHaversine) {
      return window.SmartTroAPI.calculateHaversine(lat1, lng1, lat2, lng2);
    }
    var R = 6371; // Bán kính Trái Đất (km)
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLng = ((lng2 - lng1) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  // Tạo DivIcon hiển thị nhãn giá trực quan trên bản đồ
  function createPriceBadgeIcon(text, extraClass) {
    return L.divIcon({
      className: "leaflet-custom-div-icon",
      html:
        '<div class="custom-map-marker ' +
        (extraClass || "") +
        '">' +
        text +
        "</div>",
      iconSize: [90, 28],
      iconAnchor: [45, 14]
    });
  }

  // Khởi tạo bản đồ trang Tìm kiếm (search.html)
  function initSearchMap(containerId) {
    var el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    _searchMap = L.map(containerId).setView([16.065, 108.19], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(_searchMap);

    _markerLayerGroup = L.layerGroup().addTo(_searchMap);
    return _searchMap;
  }

  // Cập nhật vòng tròn bán kính quanh trường ĐH và danh sách marker phòng trọ
  function updateSearchMap(university, radiusKm, rooms) {
    if (!_searchMap || typeof L === "undefined") return;

    _markerLayerGroup.clearLayers();
    _roomMarkers = {};

    if (_radiusCircle) {
      _searchMap.removeLayer(_radiusCircle);
      _radiusCircle = null;
    }
    if (_uniMarker) {
      _searchMap.removeLayer(_uniMarker);
      _uniMarker = null;
    }

    // Vẽ marker Trường đại học và vòng tròn bán kính
    if (university) {
      _uniMarker = L.marker([university.lat, university.lng], {
        icon: createPriceBadgeIcon("🎓 " + university.shortName, "uni-marker")
      })
        .addTo(_searchMap)
        .bindPopup(
          "<strong>" +
            university.name +
            "</strong><br><small>" +
            university.address +
            "</small>"
        );

      var numRadius = Number(radiusKm) || 0;
      if (numRadius > 0) {
        _radiusCircle = L.circle([university.lat, university.lng], {
          radius: numRadius * 1000,
          color: "#f97616",
          weight: 2,
          fillColor: "#3554d1",
          fillOpacity: 0.11
        }).addTo(_searchMap);
      }
    }

    // Vẽ các marker phòng trọ
    var basePath = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    rooms.forEach(function (room) {
      var shortPrice = (room.price / 1000000).toFixed(1).replace(".0", "") + " tr";
      var markerIcon = createPriceBadgeIcon(
        (room.verified ? "✓ " : "") + shortPrice,
        room.verified ? "verified-marker" : ""
      );

      var popupHtml =
        '<div style="min-width:205px;font-family:\'Be Vietnam Pro\',sans-serif;padding:2px;">' +
        '  <img src="' +
        window.SmartTroAPI.resolveAsset(room.image) +
        '" style="width:100%;height:105px;object-fit:cover;border-radius:10px;margin-bottom:8px;">' +
        '  <div style="font-weight:700;color:#0f172a;font-size:13.5px;margin-bottom:4px;">' +
        room.title +
        "</div>" +
        '  <div style="font-size:12.5px;color:#ea580c;font-weight:800;">' +
        window.SmartTroAPI.formatCurrency(room.price) +
        "/tháng • " +
        room.area +
        "m²</div>" +
        '  <div style="font-size:12px;color:#475569;margin:5px 0;">📍 Cách ' +
        (room.refUniName || "trường") +
        ": <strong>" +
        room.distanceKm +
        " km</strong></div>" +
        '  <a href="' +
        basePath +
        "room-detail.html?id=" +
        room.id +
        '" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;padding:6px 10px;border-radius:8px;font-size:12.5px;font-weight:700;margin-top:8px;">Xem chi tiết →</a>' +
        "</div>";

      var m = L.marker([room.lat, room.lng], { icon: markerIcon }).bindPopup(
        popupHtml
      );
      _markerLayerGroup.addLayer(m);
      _roomMarkers[room.id] = m;
    });

    // Căn chỉnh khung nhìn bản đồ
    if (_radiusCircle) {
      _searchMap.fitBounds(_radiusCircle.getBounds(), { padding: [20, 20] });
    } else if (university) {
      _searchMap.setView([university.lat, university.lng], 13);
    }
  }

  // Di chuyển tâm bản đồ và mở popup khi người dùng click/hover vào card phòng
  function focusRoomMarker(roomId) {
    if (!_searchMap || !_roomMarkers[roomId]) return;
    var marker = _roomMarkers[roomId];
    _searchMap.setView(marker.getLatLng(), 15, { animate: true });
    marker.openPopup();
  }

  // Khởi tạo bản đồ trang Chi tiết phòng (room-detail.html)
  function initDetailMap(containerId, room, nearestUni) {
    var el = document.getElementById(containerId);
    if (!el || typeof L === "undefined" || !room) return null;

    var map = L.map(containerId).setView([room.lat, room.lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    var roomIcon = createPriceBadgeIcon(
      "🏠 " + (room.price / 1000000).toFixed(1) + " tr",
      room.verified ? "verified-marker" : ""
    );
    L.marker([room.lat, room.lng], { icon: roomIcon })
      .addTo(map)
      .bindPopup("<strong>" + room.title + "</strong><br>" + room.address)
      .openPopup();

    if (nearestUni) {
      var uniIcon = createPriceBadgeIcon("🎓 " + nearestUni.shortName, "uni-marker");
      L.marker([nearestUni.lat, nearestUni.lng], { icon: uniIcon })
        .addTo(map)
        .bindPopup("<strong>" + nearestUni.name + "</strong>");

      var line = L.polyline(
        [
          [room.lat, room.lng],
          [nearestUni.lat, nearestUni.lng]
        ],
        {
          color: "#f97616",
          weight: 3,
          dashArray: "6, 6"
        }
      ).addTo(map);

      map.fitBounds(line.getBounds(), { padding: [45, 45] });
    }
    return map;
  }

  // Khởi tạo bản đồ chọn vị trí khi Chủ trọ đăng tin (landlord/post-room.html)
  function initPickerMap(containerId, initialLat, initialLng, onSelect) {
    var el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    var lat = Number(initialLat) || 16.0738;
    var lng = Number(initialLng) || 108.1499;

    var map = L.map(containerId).setView([lat, lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    var marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.bindPopup("Kéo marker hoặc click bản đồ để chọn vị trí phòng").openPopup();

    function notify(latlng) {
      var rLat = Math.round(latlng.lat * 10000) / 10000;
      var rLng = Math.round(latlng.lng * 10000) / 10000;
      if (typeof onSelect === "function") {
        onSelect(rLat, rLng);
      }
    }

    marker.on("dragend", function () {
      notify(marker.getLatLng());
    });

    map.on("click", function (e) {
      marker.setLatLng(e.latlng);
      notify(e.latlng);
    });

    return {
      map: map,
      setLocation: function (newLat, newLng) {
        var ll = L.latLng(newLat, newLng);
        marker.setLatLng(ll);
        map.setView(ll, 15);
        notify(ll);
      }
    };
  }

  // Khởi tạo bản đồ cụm trường ĐH Đà Nẵng trên trang Đăng nhập / Đăng ký (thay iframe Google Maps)
  function initAuthMap(containerId) {
    var el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    var map = L.map(containerId).setView([16.0544, 108.2022], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    if (window.SmartTroAPI) {
      window.SmartTroAPI.getUniversities().then(function (unis) {
        unis.forEach(function (u) {
          L.marker([u.lat, u.lng], {
            icon: createPriceBadgeIcon("🎓 " + u.shortName, "uni-marker")
          })
            .addTo(map)
            .bindPopup("<strong>" + u.name + "</strong><br>" + u.address);
        });
      });
    }
    return map;
  }

  window.SmartTroMap = {
    calculateHaversine: calculateHaversine,
    initSearchMap: initSearchMap,
    updateSearchMap: updateSearchMap,
    focusRoomMarker: focusRoomMarker,
    initDetailMap: initDetailMap,
    initPickerMap: initPickerMap,
    initAuthMap: initAuthMap
  };
})(window);

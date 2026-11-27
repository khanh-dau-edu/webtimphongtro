/**
 * js/auth.js
 * Quản lý đăng nhập/đăng ký giả lập bằng sessionStorage và cập nhật menu theo vai trò.
 * Các vai trò: 'tenant' (Khách thuê), 'landlord' (Chủ trọ), 'admin' (Quản trị viên).
 */
(function (window) {
  "use strict";

  var SESSION_KEY = "smarttro_user";

  var ROLE_LABELS = {
    tenant: "Khách thuê",
    landlord: "Chủ trọ",
    admin: "Admin"
  };

  // Lấy thông tin người dùng hiện tại từ sessionStorage
  function getCurrentUser() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Trả về trang đích mặc định theo vai trò (trong Đợt 1)
  function getRedirectUrlByRole(role) {
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    if (role === "landlord") return base + "landlord/post-room.html";
    if (role === "admin") return base + "admin/review.html";
    return base + "search.html";
  }

  // Đăng nhập giả lập & lưu vai trò vào sessionStorage
  function login(email, password, role, customName) {
    var chosenRole = role || "tenant";
    var defaultNames = {
      tenant: "Minh Quân (SV Bách Khoa)",
      landlord: "Cô Nguyễn Thị Hòa",
      admin: "Quản trị viên Hệ thống"
    };
    var user = {
      email: email || chosenRole + "@smarttro.vn",
      name: customName || defaultNames[chosenRole] || "Người dùng",
      role: chosenRole,
      loggedInAt: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return {
      user: user,
      redirectUrl: getRedirectUrlByRole(chosenRole)
    };
  }

  // Đăng ký tài khoản Khách thuê hoặc Chủ trọ
  function register(formData) {
    var chosenRole = formData.role === "landlord" ? "landlord" : "tenant";
    var user = {
      name: formData.name || "Thành viên mới",
      phone: formData.phone || "0905000111",
      email: formData.email || "user@smarttro.vn",
      role: chosenRole,
      loggedInAt: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return {
      user: user,
      redirectUrl: getRedirectUrlByRole(chosenRole)
    };
  }

  // Đăng xuất
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    window.location.href = base + "index.html";
  }

  // Lấy danh sách mục menu theo vai trò hiện tại
  function getMenuItems(role, basePath, compareCount) {
    var items = [
      { label: "Trang chủ", href: basePath + "index.html", key: "index.html" },
      { label: "Tìm phòng", href: basePath + "search.html", key: "search.html" },
      {
        label: "So sánh",
        href: basePath + "compare.html",
        key: "compare.html",
        badge: compareCount
      }
    ];

    if (role === "landlord") {
      items.push({
        label: "Đăng tin phòng",
        href: basePath + "landlord/post-room.html",
        key: "post-room.html"
      });
    } else if (role === "admin") {
      items.push({
        label: "Hậu kiểm & eKYC",
        href: basePath + "admin/review.html",
        key: "review.html"
      });
      items.push({
        label: "Đăng tin (Test)",
        href: basePath + "landlord/post-room.html",
        key: "post-room.html"
      });
    } else {
      // Khách hoặc Khách thuê vẫn có lối tắt nhanh để kiểm thử toàn bộ luồng Đợt 1
      items.push({
        label: "Đăng tin",
        href: basePath + "landlord/post-room.html",
        key: "post-room.html"
      });
      items.push({
        label: "Hậu kiểm",
        href: basePath + "admin/review.html",
        key: "review.html"
      });
    }
    return items;
  }

  // Cập nhật số lượng phòng đã lưu so sánh trên thanh menu
  function updateCompareBadge() {
    var count = window.SmartTroAPI ? window.SmartTroAPI.getCompareIds().length : 0;
    var badges = document.querySelectorAll(".compare-count-badge");
    badges.forEach(function (b) {
      b.textContent = count;
    });
  }

  // Đồng bộ Header, Menu ngang, Menu overlay (#myNav) theo đúng vai trò trong sessionStorage
  function syncHeaderAndMenu() {
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    var user = getCurrentUser();
    var role = user ? user.role : "guest";
    var compareCount = window.SmartTroAPI
      ? window.SmartTroAPI.getCompareIds().length
      : 3;

    var currentPath = window.location.pathname.replace(/\\/g, "/");
    var menuItems = getMenuItems(role, base, compareCount);

    // 1. Render menu ngang trên Desktop
    var navList = document.querySelector(". header_section .navbar-nav, .header_section .navbar-nav");
    if (navList) {
      var desktopLinksHtml = '<ul class="desktop-nav-links">';
      menuItems.forEach(function (item) {
        var isActive = currentPath.indexOf(item.key) !== -1 ||
          (item.key === "index.html" && (currentPath.endsWith("/") || currentPath.endsWith("/frontend")));
        var badgeHtml =
          item.badge !== undefined
            ? '<span class="compare-count-badge">' + item.badge + "</span>"
            : "";
        desktopLinksHtml +=
          '<li><a href="' +
          item.href +
          '" class="' +
          (isActive ? "active" : "") +
          '">' +
          item.label +
          badgeHtml +
          "</a></li>";
      });
      desktopLinksHtml += "</ul>";

      var userOptionHtml = "";
      if (user) {
        userOptionHtml =
          '<div class="User_option">' +
          '  <span class="user-role-pill">' +
          '    <span class="role-tag">' +
          (ROLE_LABELS[user.role] || "Thành viên") +
          "</span>" +
          '    <span class="user-name-text">' +
          user.name +
          "</span>" +
          "  </span>" +
          '  <a href="javascript:void(0)" onclick="window.SmartTroAuth.logout()" class="btn-nav-auth btn-nav-login">Đăng xuất</a>' +
          "</div>";
      } else {
        userOptionHtml =
          '<div class="User_option">' +
          '  <a class="btn-nav-auth btn-nav-login" href="' +
          base +
          'login.html">Đăng nhập</a>' +
          '  <a class="btn-nav-auth btn-nav-register" href="' +
          base +
          'register.html">Đăng ký</a>' +
          "</div>";
      }

      navList.innerHTML = desktopLinksHtml + userOptionHtml;
    }

    // 2. Render menu Overlay (#myNav) của template cho Mobile & Tablet
    var overlayContent = document.querySelector("#myNav .overlay-content");
    if (overlayContent) {
      var overlayHtml = "";
      menuItems.forEach(function (item) {
        overlayHtml +=
          '<a href="' +
          item.href +
          '">' +
          item.label +
          (item.badge !== undefined ? " (" + item.badge + ")" : "") +
          "</a>";
      });
      if (user) {
        overlayHtml +=
          '<a href="javascript:void(0)" onclick="window.SmartTroAuth.logout()" style="color:#f9bc16;">Đăng xuất (' +
          (ROLE_LABELS[user.role] || user.name) +
          ")</a>";
      } else {
        overlayHtml += '<a href="' + base + 'login.html">Đăng nhập</a>';
        overlayHtml += '<a href="' + base + 'register.html">Đăng ký</a>';
      }
      overlayContent.innerHTML = overlayHtml;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncHeaderAndMenu();
  });

  window.SmartTroAuth = {
    getCurrentUser: getCurrentUser,
    login: login,
    register: register,
    logout: logout,
    syncHeaderAndMenu: syncHeaderAndMenu,
    updateCompareBadge: updateCompareBadge
  };
})(window);

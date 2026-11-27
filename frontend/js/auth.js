/**
 * js/auth.js
 * Xác thực người dùng với Backend JWT API (/api/auth/login, /api/auth/register),
 * lưu trữ JWT Token + thông tin phiên trong sessionStorage và bảo vệ Route Guard.
 */
(function (window) {
  "use strict";

  var SESSION_KEY = "smarttro_user";
  var TOKEN_KEY = "smarttro_jwt_token";

  var ROLE_LABELS = {
    tenant: "Khách thuê",
    landlord: "Chủ trọ",
    admin: "Admin"
  };

  function getCurrentUser() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function saveAuthSession(user, token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  }

  function getRedirectUrlByRole(role, nextRelUrl) {
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    if (nextRelUrl && nextRelUrl.indexOf("http") !== 0) {
      return base + nextRelUrl.replace(/^(\.\.\/)+/, "").replace(/^\//, "");
    }
    if (role === "landlord") return base + "landlord/manage.html";
    if (role === "admin") return base + "admin/review.html";
    return base + "tenant/my-bookings.html";
  }

  // Đăng nhập qua REST API /api/auth/login (có fallback nếu chạy tĩnh không server)
  function login(email, password, role, customName, nextRelUrl) {
    var chosenRole = role || "tenant";

    if (window.SmartTroAPI && window.SmartTroAPI.apiRequest) {
      return window.SmartTroAPI.apiRequest("/auth/login", {
        method: "POST",
        body: {
          email: email,
          password: password,
          role: chosenRole
        }
      })
        .then(function (data) {
          saveAuthSession(data.user, data.token);
          return {
            user: data.user,
            token: data.token,
            redirectUrl: getRedirectUrlByRole(data.user.role, nextRelUrl)
          };
        })
        .catch(function (err) {
          // Nếu lỗi từ phía API (401 sai mật khẩu...), ném lỗi để form hiển thị
          if (err && err.isHttpError) {
            throw err;
          }
          // Nếu mở file tĩnh không chạy server Node.js -> fallback phiên cục bộ
          var fallbackUser = {
            email: email || chosenRole + "@trothongminh.vn",
            name: customName || "Thành viên (" + chosenRole + ")",
            phone: "0905123456",
            role: chosenRole
          };
          saveAuthSession(fallbackUser, null);
          return {
            user: fallbackUser,
            redirectUrl: getRedirectUrlByRole(chosenRole, nextRelUrl)
          };
        });
    }

    return Promise.resolve({
      redirectUrl: getRedirectUrlByRole(chosenRole, nextRelUrl)
    });
  }

  // Đăng ký tài khoản mới vào bảng users của SQLite qua /api/auth/register
  function register(formData, nextRelUrl) {
    var chosenRole = formData.role === "landlord" ? "landlord" : "tenant";

    if (window.SmartTroAPI && window.SmartTroAPI.apiRequest) {
      return window.SmartTroAPI.apiRequest("/auth/register", {
        method: "POST",
        body: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          password: formData.password || "123456",
          role: chosenRole
        }
      })
        .then(function (data) {
          saveAuthSession(data.user, data.token);
          return {
            user: data.user,
            token: data.token,
            redirectUrl: getRedirectUrlByRole(data.user.role, nextRelUrl)
          };
        })
        .catch(function (err) {
          if (err && err.isHttpError) {
            throw err;
          }
          var fallbackUser = {
            name: formData.name || "Thành viên mới",
            phone: formData.phone || "0905000111",
            email: formData.email || "user@trothongminh.vn",
            role: chosenRole
          };
          saveAuthSession(fallbackUser, null);
          return {
            user: fallbackUser,
            redirectUrl: getRedirectUrlByRole(chosenRole, nextRelUrl)
          };
        });
    }

    return Promise.resolve({
      redirectUrl: getRedirectUrlByRole(chosenRole, nextRelUrl)
    });
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    window.location.href = base + "index.html";
  }

  function enforceRouteGuard() {
    var path = window.location.pathname.replace(/\\/g, "/");
    var search = window.location.search || "";
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    var user = getCurrentUser();

    var requiredRole = null;
    var relTarget = "";

    if (path.indexOf("/admin/") !== -1) {
      requiredRole = "admin";
      relTarget = "admin/" + path.split("/admin/")[1] + search;
      if (!user || user.role !== "admin") {
        window.location.replace(
          base +
            "login.html?required=" +
            requiredRole +
            "&next=" +
            encodeURIComponent(relTarget)
        );
        return false;
      }
    } else if (path.indexOf("/landlord/") !== -1) {
      requiredRole = "landlord";
      relTarget = "landlord/" + path.split("/landlord/")[1] + search;
      if (!user || (user.role !== "landlord" && user.role !== "admin")) {
        window.location.replace(
          base +
            "login.html?required=" +
            requiredRole +
            "&next=" +
            encodeURIComponent(relTarget)
        );
        return false;
      }
    } else if (path.indexOf("/tenant/") !== -1) {
      requiredRole = "tenant";
      relTarget = "tenant/" + path.split("/tenant/")[1] + search;
      if (!user || (user.role !== "tenant" && user.role !== "admin")) {
        window.location.replace(
          base +
            "login.html?required=" +
            requiredRole +
            "&next=" +
            encodeURIComponent(relTarget)
        );
        return false;
      }
    }
    return true;
  }

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

    if (role === "tenant") {
      items.push({
        label: "Lịch hẹn & Đánh giá",
        href: basePath + "tenant/my-bookings.html",
        key: "my-bookings.html"
      });
    } else if (role === "landlord") {
      items.push({
        label: "Quản lý trọ",
        href: basePath + "landlord/manage.html",
        key: "manage.html"
      });
      items.push({
        label: "Đăng tin mới",
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
        label: "Quản lý trọ",
        href: basePath + "landlord/manage.html",
        key: "manage.html"
      });
      items.push({
        label: "Lịch hẹn SV",
        href: basePath + "tenant/my-bookings.html",
        key: "my-bookings.html"
      });
    } else {
      items.push({
        label: "Lịch hẹn",
        href: basePath + "tenant/my-bookings.html",
        key: "my-bookings.html"
      });
      items.push({
        label: "Cho thuê trọ",
        href: basePath + "landlord/manage.html",
        key: "manage.html"
      });
    }
    return items;
  }

  function updateCompareBadge() {
    var count = window.SmartTroAPI ? window.SmartTroAPI.getCompareIds().length : 0;
    var badges = document.querySelectorAll(".compare-count-badge");
    badges.forEach(function (b) {
      b.textContent = count;
    });
  }

  function syncHeaderAndMenu() {
    var base = window.SmartTroAPI ? window.SmartTroAPI.getBasePath() : "";
    var user = getCurrentUser();
    var role = user ? user.role : "guest";
    var compareCount = window.SmartTroAPI
      ? window.SmartTroAPI.getCompareIds().length
      : 3;

    var currentPath = window.location.pathname.replace(/\\/g, "/");
    var menuItems = getMenuItems(role, base, compareCount);

    var navList = document.querySelector(".header_section .navbar-nav");
    if (navList) {
      var desktopLinksHtml = '<ul class="desktop-nav-links">';
      menuItems.forEach(function (item) {
        var isActive =
          currentPath.indexOf(item.key) !== -1 ||
          (item.key === "index.html" &&
            (currentPath.endsWith("/") || currentPath.endsWith("/frontend")));
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

  enforceRouteGuard();

  document.addEventListener("DOMContentLoaded", function () {
    syncHeaderAndMenu();
  });

  window.SmartTroAuth = {
    ROLE_LABELS: ROLE_LABELS,
    getCurrentUser: getCurrentUser,
    getToken: getToken,
    getRedirectUrlByRole: getRedirectUrlByRole,
    login: login,
    register: register,
    logout: logout,
    enforceRouteGuard: enforceRouteGuard,
    syncHeaderAndMenu: syncHeaderAndMenu,
    updateCompareBadge: updateCompareBadge
  };
})(window);

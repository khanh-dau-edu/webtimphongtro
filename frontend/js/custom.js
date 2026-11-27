// Lấy năm hiện tại hiển thị ở Footer
function getYear() {
  var currentDate = new Date();
  var currentYear = currentDate.getFullYear();
  var el = document.querySelector("#displayYear");
  if (el) {
    el.innerHTML = currentYear;
  }
}
getYear();

// Mở / đóng menu overlay trên mobile & desktop (từ template gốc)
function openNav() {
  var nav = document.getElementById("myNav");
  var btn = document.querySelector(".custom_menu-btn");
  if (nav) nav.classList.toggle("menu_width");
  if (btn) btn.classList.toggle("menu_btn-style");
}

// Hiển thị thông báo ngắn (Toast) không gây gián đoạn
window.showToast = function (message) {
  var toast = document.getElementById("smarttroToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "smarttroToast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function () {
    toast.style.display = "none";
  }, 3200);
};

# Trọ Thông Minh Đà Nẵng (`webtimphongtro`)

Nền tảng tìm kiếm phòng trọ sinh viên minh bạch tổng chi phí thực tế tại Đà Nẵng — tích hợp bản đồ bán kính Haversine quanh các trường Đại học, công cụ ước tính tổng chi phí điện/nước hàng tháng, kiểm duyệt tin đăng 4 bước và hậu kiểm eKYC.

## Cấu trúc thư mục

- `frontend/` — Giao diện người dùng (10 trang HTML5, Bootstrap 4, Leaflet.js + OpenStreetMap, tầng truy cập dữ liệu `SmartTroAPI` + `SmartTroAuth`).
- `backend/` — Máy chủ RESTful API (Node.js v24 + Express + CSDL quan hệ SQLite qua tầng Database Adapter, xác thực JWT + `bcryptjs`, upload ảnh thực tế bằng `multer`).
- `template/` — Giao diện mẫu tham chiếu ban đầu.

## Hướng dẫn khởi chạy Fullstack (Frontend + Backend + SQLite)

Yêu cầu: **Node.js >= 22.5** (khuyến nghị **Node.js v24+** để dùng sẵn `node:sqlite`).

```bash
cd backend
npm install
npm start
```

Sau khi chạy, mở trình duyệt tại: **http://localhost:3000**

- Hệ thống sẽ tự động tạo file cơ sở dữ liệu `backend/storage/smarttro.db` và nạp dữ liệu mẫu (6 trường ĐH Đà Nẵng, 14 phòng đang hoạt động, 3 phòng bị gắn cờ, lịch hẹn, đánh giá và hồ sơ eKYC).
- Để khôi phục lại toàn bộ dữ liệu gốc về ban đầu:
  ```bash
  cd backend
  npm run seed
  ```

## Tài khoản Demo (Mật khẩu mặc định: `123456`)

| Vai trò | Email đăng nhập | Quyền hạn chính |
| :--- | :--- | :--- |
| **Khách thuê / Sinh viên** | `sinhvien@dut.udn.vn` hoặc `tenant@trothongminh.vn` | Tìm phòng bán kính, tính & so sánh chi phí, đặt lịch hẹn, báo cáo vi phạm, viết đánh giá sau khi xem phòng. |
| **Chủ trọ** | `landlord@trothongminh.vn` | Đăng tin mới (tải ảnh thật từ thiết bị), ẩn/mở phòng, sửa giá & điện/nước, duyệt lịch hẹn, nộp hồ sơ eKYC. |
| **Quản trị viên (Admin)** | `admin@trothongminh.vn` | Duyệt/gỡ tin bị gắn cờ tự động, xử lý báo cáo vi phạm & đình chỉ phòng, duyệt cấp tích xanh eKYC. |

# 📘 Hướng Dẫn Chi Tiết Cách Test RESTful CRUD API Trên Swagger UI

Tài liệu này hướng dẫn từng bước cách kiểm thử toàn bộ hệ thống **RESTful API & CRUD (Create – Read – Update – Delete)** của dự án **Trọ Thông Minh Đà Nẵng** thông qua giao diện chính thức **Swagger UI (OpenAPI 3.0.3)**.

---

## 1. Khởi Chạy Server & Mở Giao Diện Swagger UI

1. Mở Terminal / PowerShell tại thư mục gốc của dự án và chạy:
   ```bash
   cd backend
   npm install
   npm start
   ```
2. Khi màn hình hiển thị:
   ```text
   [SmartTro Server] Web App:    http://localhost:3000
   [SmartTro Server] Swagger UI: http://localhost:3000/api-docs
   ```
3. Mở trình duyệt và truy cập:  
   👉 **http://localhost:3000/api-docs** *(hoặc http://localhost:3000/swagger)*

---

## 2. Cách Đăng Nhập & Gắn Quyền JWT (`Authorize 🔒`)

Một số thao tác quản trị hoặc cá nhân hóa sử dụng **JWT Bearer Token**. Quy trình cấp quyền trên Swagger UI gồm **3 bước**:

### Bước 2.1: Lấy chuỗi `token` từ API Đăng nhập
1. Kéo xuống nhóm **`2. Auth (JWT)`** $\rightarrow$ nhấn vào khối màu xanh lá **`POST /api/auth/login`**.
2. Nhấn nút **`Try it out`** ở góc phải khung đó.
3. Chọn 1 trong 3 tài khoản mẫu dưới đây để sửa vào ô **Request body** (mật khẩu mặc định đều là `"123456"`):

| Vai trò cần test | JSON Request Body nhập vào |
| :--- | :--- |
| **Quản trị viên (Admin - Toàn quyền)** | `{"email": "admin@trothongminh.vn", "password": "123456", "role": "admin"}` |
| **Chủ trọ (Landlord)** | `{"email": "landlord@trothongminh.vn", "password": "123456", "role": "landlord"}` |
| **Sinh viên / Khách thuê (Tenant)** | `{"email": "sinhvien@dut.udn.vn", "password": "123456", "role": "tenant"}` |

4. Nhấn nút màu xanh dương **`Execute`**.
5. Kéo xuống phần **Responses (Code `200`)** $\rightarrow$ sao chép chuỗi ký tự bên trong trường `"token"` *(không copy dấu ngoặc kép `""`)*.

### Bước 2.2: Dán Token vào ổ khóa `Authorize`
1. Cuộn lên đầu trang Swagger UI $\rightarrow$ nhấn nút màu xanh lá **`Authorize 🔒`** ở góc trên bên phải.
2. Dán chuỗi token vừa copy vào ô **`Value`** của mục `bearerAuth (http, Bearer)`.
3. Nhấn **`Authorize`** $\rightarrow$ nhấn **`Close`**.  
   *(Lúc này biểu tượng ổ khóa đã đóng lại — mọi lệnh gọi API tiếp theo sẽ tự động đính kèm Header `Authorization: Bearer <token>`).*

### Bước 2.3: Kiểm tra nhanh Token vừa gắn
- Mở **`GET /api/auth/me`** $\rightarrow$ nhấn **`Try it out`** $\rightarrow$ **`Execute`**.
- Nếu trả về **Code `200`** kèm thông tin `user` của bạn nghĩa là xác thực JWT đã hoạt động chính xác!

---

## 3. Quy Trình Chuẩn Test Vòng Đời CRUD Trên Từng Bảng

Hệ thống cung cấp đầy đủ **4 thao tác CRUD** với màu sắc chuẩn của Swagger trên cả **7 bảng dữ liệu** (`Rooms`, `Bookings`, `Reviews`, `Reports`, `eKYC`, `Universities`, `Users`):

- 🟢 **`POST`** — **C**reate (Thêm bản ghi mới $\rightarrow$ trả về HTTP `201 Created`)
- 🔵 **`GET`** — **R**ead (Đọc danh sách hoặc chi tiết theo `{id}` $\rightarrow$ trả về HTTP `200 OK`)
- 🟠 **`PUT` / `PATCH`** — **U**pdate (Cập nhật toàn bộ hoặc một phần bản ghi $\rightarrow$ trả về HTTP `200 OK`)
- 🔴 **`DELETE`** — **D**elete (Xóa bản ghi khỏi SQLite $\rightarrow$ trả về HTTP `200 OK`, gọi lại `GET /{id}` sẽ ra `404 Not Found`)

### Ví dụ thực hành đầy đủ 1 vòng CRUD với nhóm `3. Rooms (CRUD Phòng trọ)`:

1. **[CREATE] Tạo phòng mới (`POST /api/rooms`)**:
   - Mở `POST /api/rooms` $\rightarrow$ bấm **`Try it out`**.
   - Swagger đã điền sẵn mẫu JSON hợp lệ (`Studio Mới Xây Hòa Khánh Bắc`). Nhấn **`Execute`**.
   - Quan sát **Response `201`**: Hệ thống chấm `trustScore: 100`, `status: "ACTIVE"` và cấp mã phòng mới (ví dụ `"id": 18`). Hãy nhớ con số `id` này!
2. **[READ] Đọc lại phòng vừa tạo (`GET /api/rooms/{id}`)**:
   - Mở `GET /api/rooms/{id}` $\rightarrow$ bấm **`Try it out`** $\rightarrow$ nhập `18` vào ô `id` $\rightarrow$ **`Execute`**.
   - Quan sát **Response `200`**: Trả về đầy đủ thông tin phòng `#18` kèm khoảng cách `distanceKm` tới trường ĐH gần nhất.
3. **[UPDATE] Sửa thông tin & giá phòng (`PUT /api/rooms/{id}`)**:
   - Mở `PUT /api/rooms/{id}` $\rightarrow$ bấm **`Try it out`** $\rightarrow$ nhập `18` vào ô `id`.
   - Sửa `"title"` thành `"Studio Hòa Khánh (Đã giảm giá)"` và `"price": 2400000` $\rightarrow$ nhấn **`Execute`**.
   - Quan sát **Response `200`**: Giá phòng và tiêu đề đã được cập nhật trong SQLite (mở trang web http://localhost:3000/search.html sẽ thấy thay đổi ngay lập tức!).
4. **[DELETE] Xóa phòng (`DELETE /api/rooms/{id}`)**:
   - Mở `DELETE /api/rooms/{id}` $\rightarrow$ bấm **`Try it out`** $\rightarrow$ nhập `18` vào ô `id` $\rightarrow$ **`Execute`**.
   - Quan sát **Response `200`**: `{"deleted": true, "id": 18, ...}`.
   - Thử gọi lại `GET /api/rooms/18` một lần nữa $\rightarrow$ Server trả về **HTTP `404`** (`"Không tìm thấy phòng trọ mã #18"`), chứng minh dữ liệu đã xóa thật sự khỏi CSDL!

*(Bạn thực hiện hoàn toàn tương tự cho các nhóm `4. Bookings`, `5. Reviews`, `6. Reports`, `7. eKYC`, `8. Universities` và `9. Users`).*

---

## 4. Kịch Bản Test Các Nghiệp Vụ Đặc Thù Của Đề Tài

### Kịch bản A: Tìm kiếm phòng theo bán kính Haversine quanh trường Đại học
1. Mở **`GET /api/rooms`** $\rightarrow$ bấm **`Try it out`**.
2. Nhập các tham số lọc:
   - `mode`: chọn `radius`
   - `uniId`: nhập `uni-bk` *(ĐH Bách Khoa)* hoặc `uni-kt` *(ĐH Kinh Tế)*, `uni-vku` *(ĐH Việt Hàn)*
   - `radius`: nhập `2` *(tìm trong bán kính 2 km)*
   - `verifiedOnly`: chọn `true`
3. Nhấn **`Execute`** $\rightarrow$ Kết quả trả về thông tin tọa độ trường ĐH và danh sách các phòng nằm trong vòng tròn 2 km được sắp xếp từ gần nhất đến xa nhất.

### Kịch bản B: Kiểm duyệt tin đăng tự động 4 bước (Chặn tin lừa đảo `FLAGGED`)
1. Mở **`POST /api/rooms`** $\rightarrow$ bấm **`Try it out`**.
2. Sửa nội dung JSON cố tình vi phạm:
   ```json
   {
     "title": "Phòng Đẹp Giá Sốc Cọc Giữ Chỗ Gấp",
     "address": "15 Nguyễn Lương Bằng, Liên Chiểu",
     "district": "Liên Chiểu",
     "price": 900000,
     "area": 30,
     "type": "Căn hộ mini",
     "image": "images/d-1.jpg",
     "imageMode": "DUPLICATE",
     "electricity": 5500,
     "water": 30000
   }
   ```
3. Nhấn **`Execute`** $\rightarrow$ Quan sát phản hồi:
   - `status`: **`"FLAGGED"`** (Bị chặn hiển thị trên trang tìm kiếm!)
   - `id`: **`"FL-xxx"`**
   - `trustScore`: bị trừ xuống còn **`10`** điểm kèm chi tiết `checks` báo đỏ cả 4 bước (*Từ khóa cấm, Trùng pHash 94%, Thiếu EXIF, Giá điện/nước cao bất thường*).
4. Sau đó vào nhóm **`10. Admin Moderation`** $\rightarrow$ chạy **`PATCH /api/admin/flagged/{id}`** với mã `FL-xxx` và `"status": "APPROVED"` để duyệt tin đó lên bản đồ tìm kiếm.

### Kịch bản C: Upload tệp ảnh thật từ máy tính (`POST /api/upload`)
1. Mở nhóm **`1. System & Upload`** $\rightarrow$ chọn **`POST /api/upload`** $\rightarrow$ bấm **`Try it out`**.
2. Nhấn nút **`Choose File`** ở mục `image` $\rightarrow$ chọn 1 bức ảnh `.jpg` hoặc `.png` bất kỳ trong máy tính $\rightarrow$ nhấn **`Execute`**.
3. Server trả về **Code `201`** với đường dẫn thật, ví dụ: `{"url": "/uploads/room-1795791389-815.png"}`. Bạn có thể mở `http://localhost:3000/uploads/room-...` trên trình duyệt để xem ảnh vừa tải lên.

### Kịch bản D: Ràng buộc "Đánh giá thật" (Chặn đánh giá khi chưa xem phòng)
1. Mở **`GET /api/bookings`** để xem mã lịch hẹn đang ở trạng thái `"Chờ xác nhận"` (ví dụ `BK-1002`).
2. Mở **`POST /api/reviews`** $\rightarrow$ nhập `"bookingId": "BK-1002"` $\rightarrow$ nhấn **`Execute`**.
   - **Kết quả:** Hệ thống chặn lại với mã lỗi **HTTP `400`** (`"Chỉ lịch hẹn ở trạng thái 'Đã hoàn thành' mới được gửi đánh giá"`).
3. Mở **`PATCH /api/bookings/{id}/status`** $\rightarrow$ nhập `id = BK-1002`, chọn `"status": "Đã hoàn thành"` $\rightarrow$ **`Execute`**.
4. Quay lại bấm **`Execute`** ở **`POST /api/reviews`** $\rightarrow$ Thành công **HTTP `201`**!

---

## 5. Khôi Phục CSDL Về Trạng Thái Sạch Ban Đầu (Reset Data)

Sau khi bạn đã thử nghiệm thêm/sửa/xóa nhiều dữ liệu trên Swagger UI và muốn đưa toàn bộ 7 bảng SQLite quay về trạng thái mẫu chuẩn ban đầu:
- Mở nhóm **`1. System & Upload`** $\rightarrow$ chọn **`POST /api/admin/reset-demo-public`** $\rightarrow$ nhấn **`Try it out`** $\rightarrow$ **`Execute`**.
- Toàn bộ 6 trường ĐH, 14 phòng `ACTIVE`, 3 phòng `FLAGGED`, lịch hẹn, đánh giá và báo cáo vi phạm sẽ được tái tạo sạch sẽ ngay lập tức!

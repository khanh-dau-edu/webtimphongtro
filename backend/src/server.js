/**
 * backend/src/server.js
 * Máy chủ Fullstack Express phục vụ đồng thời:
 *  - REST API (/api/*) trên nền SQLite
 *  - Thư mục ảnh tải lên (/uploads/*)
 *  - Giao diện tĩnh Frontend (../frontend/*)
 */
const express = require("express");
const cors = require("cors");
const path = require("path");

const { seedDatabase } = require("./db/seed");
const apiRoutes = require("./routes/apiRoutes");

function createApp() {
  // Đảm bảo CSDL SQLite đã khởi tạo bảng & nạp dữ liệu mẫu lần đầu
  seedDatabase(false);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  const uploadsDir = path.join(__dirname, "..", "uploads");
  const frontendDir = path.join(__dirname, "..", "..", "frontend");

  app.use("/uploads", express.static(uploadsDir));
  app.use("/api", apiRoutes);
  app.use(express.static(frontendDir));

  // Xử lý lỗi tập trung cho các route API
  app.use((err, req, res, next) => {
    if (req.path.startsWith("/api")) {
      return res.status(err.status || 500).json({
        error: err.message || "Lỗi máy chủ nội bộ"
      });
    }
    next(err);
  });

  return app;
}

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[SmartTro Server] Fullstack App & SQLite API đang chạy tại http://localhost:${PORT}`);
  });
}

module.exports = { createApp };

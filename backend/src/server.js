/**
 * backend/src/server.js
 * Máy chủ Fullstack Express phục vụ đồng thời:
 *  - Swagger UI chính thức (/api-docs) & OpenAPI JSON (/api-docs.json)
 *  - RESTful CRUD API (/api/*) trên nền SQLite
 *  - Thư mục ảnh tải lên (/uploads/*)
 *  - Giao diện tĩnh Frontend (../frontend/*)
 */
const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const { seedDatabase } = require("./db/seed");
const apiRoutes = require("./routes/apiRoutes");
const openApiSpec = require("./docs/openapi");

function createApp() {
  seedDatabase(false);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Xuất đặc tả OpenAPI JSON và trang giao diện Swagger UI chuẩn
  app.get("/api-docs.json", (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      explorer: true,
      customSiteTitle: "Swagger CRUD API - Trọ Thông Minh Đà Nẵng",
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1
      }
    })
  );

  // Hỗ trợ đường dẫn tắt /swagger chuyển thẳng tới /api-docs
  app.get("/swagger", (_req, res) => {
    res.redirect("/api-docs");
  });

  const uploadsDir = path.join(__dirname, "..", "uploads");
  const frontendDir = path.join(__dirname, "..", "..", "frontend");

  app.use("/uploads", express.static(uploadsDir));
  app.use("/api", apiRoutes);
  app.use(express.static(frontendDir));

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
    console.log(`[SmartTro Server] Web App:    http://localhost:${PORT}`);
    console.log(`[SmartTro Server] Swagger UI: http://localhost:${PORT}/api-docs`);
  });
}

module.exports = { createApp };

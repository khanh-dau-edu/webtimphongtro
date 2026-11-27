/**
 * backend/src/docs/openapi.js
 * Đặc tả OpenAPI 3.0.3 cho Swagger UI (/api-docs) của Trọ Thông Minh Đà Nẵng.
 * Đầy đủ chuẩn CRUD (GET, POST, PUT, PATCH, DELETE) cho toàn bộ 7 bảng CSDL.
 */
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Trọ Thông Minh Đà Nẵng — RESTful CRUD API",
    version: "3.0.0",
    description:
      "Tài liệu Swagger UI chính thức (OpenAPI 3.0) cho nền tảng **Trọ Thông Minh Đà Nẵng**. " +
      "Bao gồm đầy đủ các phương thức **CRUD (`POST` Create, `GET` Read, `PUT`/`PATCH` Update, `DELETE` Delete)** " +
      "trên CSDL SQLite, tìm kiếm bán kính Haversine, kiểm duyệt tin đăng 4 bước, Upload ảnh và xác thực JWT.\n\n" +
      "**Hướng dẫn lấy JWT Token:** Mở mục `2. Auth` -> chạy `POST /api/auth/login` -> copy trường `token` -> bấm nút **Authorize 🔒** ở góc phải bên trên và dán vào."
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local Fullstack Server (Express + SQLite)"
    }
  ],
  tags: [
    { name: "1. System & Upload", description: "Kiểm tra sức khỏe hệ thống, Upload ảnh & Reset dữ liệu mẫu" },
    { name: "2. Auth (JWT)", description: "Đăng nhập, Đăng ký và Kiểm tra phiên JWT" },
    { name: "3. Rooms (CRUD Phòng trọ)", description: "Create - Read - Update - Delete phòng trọ & Tìm kiếm bán kính Haversine" },
    { name: "4. Bookings (CRUD Lịch hẹn)", description: "Create - Read - Update - Delete lịch hẹn xem phòng" },
    { name: "5. Reviews (CRUD Đánh giá)", description: "Create - Read - Update - Delete đánh giá thực tế của sinh viên" },
    { name: "6. Reports (CRUD Báo cáo vi phạm)", description: "Create - Read - Update - Delete phản ánh vi phạm" },
    { name: "7. eKYC (CRUD Hồ sơ Chủ trọ)", description: "Create - Read - Update - Delete hồ sơ xác thực CCCD Chủ trọ" },
    { name: "8. Universities (CRUD Trường ĐH)", description: "Create - Read - Update - Delete tọa độ các trường Đại học Đà Nẵng" },
    { name: "9. Users (CRUD Người dùng)", description: "Create - Read - Update - Delete tài khoản người dùng" },
    { name: "10. Admin Moderation", description: "Tổng hợp & Duyệt tin gắn cờ tự động" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Dán chuỗi JWT nhận được từ API POST /api/auth/login"
      }
    },
    schemas: {
      RoomInput: {
        type: "object",
        required: ["title", "address", "price", "area"],
        properties: {
          title: { type: "string", example: "Studio Mới Xây Hòa Khánh Bắc" },
          address: { type: "string", example: "108 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng" },
          district: { type: "string", example: "Liên Chiểu" },
          price: { type: "integer", example: 2600000 },
          area: { type: "number", example: 25 },
          type: { type: "string", example: "Căn hộ mini" },
          lat: { type: "number", example: 16.0742 },
          lng: { type: "number", example: 108.1495 },
          image: { type: "string", example: "images/s-2.jpg" },
          imageMode: { type: "string", enum: ["ORIGINAL", "DUPLICATE"], example: "ORIGINAL" },
          electricity: { type: "integer", example: 3500 },
          water: { type: "integer", example: 15000 },
          wifi: { type: "integer", example: 50000 },
          trash: { type: "integer", example: 20000 },
          parking: { type: "integer", example: 0 },
          amenities: {
            type: "array",
            items: { type: "string" },
            example: ["Điều hòa", "Nóng lạnh", "Khóa vân tay"]
          }
        }
      },
      BookingInput: {
        type: "object",
        required: ["roomId", "tenantName", "phone", "date", "time"],
        properties: {
          roomId: { type: "integer", example: 1 },
          roomTitle: { type: "string", example: "Studio Cửa Sổ Lớn Hòa Khánh" },
          tenantName: { type: "string", example: "Nguyễn Minh Quân" },
          phone: { type: "string", example: "0905111222" },
          date: { type: "string", example: "2026-11-30" },
          time: { type: "string", example: "09:30" },
          note: { type: "string", example: "Xem phòng tầng 2 có ban công" },
          status: { type: "string", example: "Chờ xác nhận" }
        }
      },
      ReviewInput: {
        type: "object",
        required: ["roomId", "rating", "comment"],
        properties: {
          bookingId: { type: "string", example: "BK-1003" },
          roomId: { type: "integer", example: 2 },
          userName: { type: "string", example: "Lê Hoàng Long (SV Bách Khoa)" },
          rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
          comment: { type: "string", example: "Phòng sạch sẽ, giá điện nước đúng niêm yết!" }
        }
      },
      ReportInput: {
        type: "object",
        required: ["roomId", "reason", "detail"],
        properties: {
          roomId: { type: "integer", example: 5 },
          roomTitle: { type: "string", example: "Phòng Trọ Giá Rẻ Châu Thị Vĩnh Tế" },
          reporterName: { type: "string", example: "Quốc Đạt (SV Kinh Tế)" },
          reporterPhone: { type: "string", example: "0905123888" },
          reason: { type: "string", example: "Đơn giá điện/nước thực tế cao hơn tin đăng" },
          detail: { type: "string", example: "Khi tới xem phòng chủ báo giá điện 5.200đ/kWh." },
          status: { type: "string", enum: ["PENDING", "RESOLVED", "DISMISSED"], example: "PENDING" }
        }
      },
      EkycInput: {
        type: "object",
        required: ["landlordName", "cccdNumber", "phone", "address"],
        properties: {
          landlordName: { type: "string", example: "Cô Nguyễn Thị Hòa" },
          cccdNumber: { type: "string", example: "048188006688" },
          phone: { type: "string", example: "0905123456" },
          address: { type: "string", example: "112 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng" },
          propertyDoc: { type: "string", example: "Giấy chứng nhận QSDĐ & Đăng ký hộ kinh doanh" },
          status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"], example: "PENDING" }
        }
      },
      UniversityInput: {
        type: "object",
        required: ["id", "name", "lat", "lng"],
        properties: {
          id: { type: "string", example: "uni-fpt" },
          name: { type: "string", example: "ĐH FPT Đà Nẵng" },
          shortName: { type: "string", example: "ĐH FPT" },
          address: { type: "string", example: "Khu đô thị FPT City, Hòa Hải, Ngũ Hành Sơn" },
          district: { type: "string", example: "Ngũ Hành Sơn" },
          lat: { type: "number", example: 15.9688 },
          lng: { type: "number", example: 108.2608 }
        }
      },
      UserInput: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", example: "Trần Thanh Tùng" },
          email: { type: "string", example: "tung.tran@dut.udn.vn" },
          phone: { type: "string", example: "0905444333" },
          password: { type: "string", example: "123456" },
          role: { type: "string", enum: ["tenant", "landlord", "admin"], example: "tenant" },
          verifiedEkyc: { type: "boolean", example: false }
        }
      }
    }
  },
  paths: {
    // --- 1. SYSTEM & UPLOAD ---
    "/api/health": {
      get: {
        tags: ["1. System & Upload"],
        summary: "Kiểm tra trạng thái Server & Thống kê số lượng bản ghi CSDL",
        responses: { 200: { description: "Server & SQLite hoạt động bình thường" } }
      }
    },
    "/api/upload": {
      post: {
        tags: ["1. System & Upload"],
        summary: "Upload file ảnh phòng trọ thực tế lên Server (Multipart FormData)",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  image: { type: "string", format: "binary", description: "Chọn file ảnh JPG/PNG/WebP" }
                }
              }
            }
          }
        },
        responses: { 201: { description: "Trả về đường dẫn /uploads/<filename>" } }
      }
    },
    "/api/admin/reset-demo-public": {
      post: {
        tags: ["1. System & Upload"],
        summary: "Khôi phục toàn bộ CSDL SQLite về dữ liệu mẫu ban đầu",
        responses: { 200: { description: "Đã seed lại toàn bộ 7 bảng thành công" } }
      }
    },

    // --- 2. AUTH ---
    "/api/auth/login": {
      post: {
        tags: ["2. Auth (JWT)"],
        summary: "Đăng nhập & Nhận JWT Bearer Token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", example: "admin@trothongminh.vn" },
                  password: { type: "string", example: "123456" },
                  role: { type: "string", enum: ["tenant", "landlord", "admin"], example: "admin" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Đăng nhập thành công, trả về JWT token" },
          401: { description: "Sai email hoặc mật khẩu" }
        }
      }
    },
    "/api/auth/register": {
      post: {
        tags: ["2. Auth (JWT)"],
        summary: "Đăng ký tài khoản mới (Băm mật khẩu bằng bcrypt)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserInput" }
            }
          }
        },
        responses: {
          201: { description: "Tạo tài khoản mới thành công" },
          409: { description: "Email đã tồn tại" }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["2. Auth (JWT)"],
        summary: "Lấy thông tin tài khoản hiện tại từ JWT Token",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Thông tin người dùng giải mã từ JWT" },
          401: { description: "Chưa gắn Bearer Token hợp lệ" }
        }
      }
    },

    // --- 3. ROOMS CRUD ---
    "/api/rooms": {
      get: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[READ] Danh sách phòng trọ & Tìm kiếm bán kính Haversine quanh trường ĐH",
        parameters: [
          { name: "mode", in: "query", schema: { type: "string", enum: ["radius"] }, description: "Chọn 'radius' để bật lọc bán kính quanh trường" },
          { name: "uniId", in: "query", schema: { type: "string", example: "uni-bk" }, description: "Mã trường ĐH (uni-bk, uni-sp, uni-dt, uni-kt, uni-nn, uni-vku)" },
          { name: "radius", in: "query", schema: { type: "number", example: 3 }, description: "Bán kính tối đa tính bằng km" },
          { name: "priceRange", in: "query", schema: { type: "string", enum: ["ALL", "UNDER_2M", "2M_3M", "3M_45M", "OVER_45M"] } },
          { name: "areaRange", in: "query", schema: { type: "string", enum: ["ALL", "UNDER_20", "20_30", "OVER_30"] } },
          { name: "type", in: "query", schema: { type: "string", enum: ["ALL", "Phòng trọ", "Căn hộ mini", "Ở ghép", "Nhà nguyên căn"] } },
          { name: "verifiedOnly", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "Danh sách phòng trọ kèm khoảng cách Haversine" } }
      },
      post: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[CREATE] Thêm mới phòng trọ (Chạy tự động Pipeline Kiểm duyệt 4 bước)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RoomInput" }
            }
          }
        },
        responses: { 201: { description: "Đã lưu phòng mới (ACTIVE hoặc FLAGGED tùy điểm Trust Score)" } }
      }
    },
    "/api/rooms/landlord": {
      get: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[READ] Lấy danh sách phòng thuộc quyền quản lý của Chủ trọ",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Danh sách phòng đang hiển thị, đã cho thuê và bị gắn cờ" } }
      }
    },
    "/api/rooms/{id}": {
      get: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[READ] Chi tiết 1 phòng trọ theo ID hoặc mã Code",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "1" } }],
        responses: {
          200: { description: "Chi tiết phòng trọ" },
          404: { description: "Không tìm thấy phòng" }
        }
      },
      put: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[UPDATE] Cập nhật toàn bộ thông tin phòng trọ (PUT)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "1" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RoomInput" }
            }
          }
        },
        responses: {
          200: { description: "Đã cập nhật phòng trọ thành công" },
          404: { description: "Không tìm thấy phòng" }
        }
      },
      delete: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[DELETE] Xóa vĩnh viễn 1 phòng trọ khỏi CSDL",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "14" } }],
        responses: {
          200: { description: "Đã xóa phòng thành công" },
          404: { description: "Không tìm thấy phòng" }
        }
      }
    },
    "/api/rooms/{id}/status": {
      patch: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[UPDATE] Đổi nhanh trạng thái phòng (ACTIVE / RENTED / SUSPENDED)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "1" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["ACTIVE", "RENTED", "SUSPENDED"], example: "RENTED" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Đã đổi trạng thái phòng" } }
      }
    },
    "/api/rooms/{id}/pricing": {
      patch: {
        tags: ["3. Rooms (CRUD Phòng trọ)"],
        summary: "[UPDATE] Cập nhật nhanh giá thuê & đơn giá điện/nước",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "1" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  price: { type: "integer", example: 2650000 },
                  electricity: { type: "integer", example: 3500 },
                  water: { type: "integer", example: 15000 },
                  wifi: { type: "integer", example: 50000 },
                  trash: { type: "integer", example: 20000 },
                  parking: { type: "integer", example: 0 }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Đã cập nhật bảng giá dịch vụ" } }
      }
    },

    // --- 4. BOOKINGS CRUD ---
    "/api/bookings": {
      get: {
        tags: ["4. Bookings (CRUD Lịch hẹn)"],
        summary: "[READ] Danh sách tất cả lịch hẹn xem phòng",
        responses: { 200: { description: "Danh sách lịch hẹn" } }
      },
      post: {
        tags: ["4. Bookings (CRUD Lịch hẹn)"],
        summary: "[CREATE] Đặt lịch hẹn xem phòng mới",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BookingInput" } } }
        },
        responses: { 201: { description: "Tạo lịch hẹn thành công" } }
      }
    },
    "/api/bookings/{id}": {
      get: {
        tags: ["4. Bookings (CRUD Lịch hẹn)"],
        summary: "[READ] Chi tiết 1 lịch hẹn theo mã (VD: BK-1001)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "BK-1001" } }],
        responses: { 200: { description: "Chi tiết lịch hẹn" }, 404: { description: "Không tìm thấy" } }
      },
      put: {
        tags: ["4. Bookings (CRUD Lịch hẹn)"],
        summary: "[UPDATE] Cập nhật toàn bộ thông tin lịch hẹn (PUT)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "BK-1001" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BookingInput" } } }
        },
        responses: { 200: { description: "Đã cập nhật lịch hẹn" } }
      },
      delete: {
        tags: ["4. Bookings (CRUD Lịch hẹn)"],
        summary: "[DELETE] Xóa lịch hẹn xem phòng",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "BK-1002" } }],
        responses: { 200: { description: "Đã xóa lịch hẹn" } }
      }
    },
    "/api/bookings/{id}/status": {
      patch: {
        tags: ["4. Bookings (CRUD Lịch hẹn)"],
        summary: "[UPDATE] Đổi trạng thái lịch hẹn (Chờ xác nhận / Đã xác nhận / Đã hoàn thành / Đã hủy)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "BK-1002" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["Chờ xác nhận", "Đã xác nhận", "Đã hoàn thành", "Đã hủy"],
                    example: "Đã hoàn thành"
                  }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Cập nhật trạng thái thành công" } }
      }
    },

    // --- 5. REVIEWS CRUD ---
    "/api/reviews": {
      get: {
        tags: ["5. Reviews (CRUD Đánh giá)"],
        summary: "[READ] Danh sách đánh giá thực tế (Lọc theo roomId nếu có)",
        parameters: [{ name: "roomId", in: "query", schema: { type: "integer", example: 1 } }],
        responses: { 200: { description: "Danh sách đánh giá" } }
      },
      post: {
        tags: ["5. Reviews (CRUD Đánh giá)"],
        summary: "[CREATE] Thêm đánh giá thực tế (Kiểm tra lịch hẹn phải ở trạng thái Đã hoàn thành)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewInput" } } }
        },
        responses: {
          201: { description: "Đã tạo đánh giá xác thực" },
          400: { description: "Lịch hẹn chưa hoàn thành xem phòng" }
        }
      }
    },
    "/api/reviews/{id}": {
      get: {
        tags: ["5. Reviews (CRUD Đánh giá)"],
        summary: "[READ] Chi tiết 1 đánh giá theo ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "101" } }],
        responses: { 200: { description: "Chi tiết đánh giá" }, 404: { description: "Không tìm thấy" } }
      },
      put: {
        tags: ["5. Reviews (CRUD Đánh giá)"],
        summary: "[UPDATE] Sửa nội dung & số sao đánh giá (PUT)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "101" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewInput" } } }
        },
        responses: { 200: { description: "Đã cập nhật đánh giá" } }
      },
      delete: {
        tags: ["5. Reviews (CRUD Đánh giá)"],
        summary: "[DELETE] Xóa đánh giá khỏi phòng trọ",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "107" } }],
        responses: { 200: { description: "Đã xóa đánh giá" } }
      }
    },

    // --- 6. REPORTS CRUD ---
    "/api/reports": {
      get: {
        tags: ["6. Reports (CRUD Báo cáo vi phạm)"],
        summary: "[READ] Danh sách toàn bộ báo cáo vi phạm từ sinh viên",
        responses: { 200: { description: "Danh sách báo cáo vi phạm" } }
      },
      post: {
        tags: ["6. Reports (CRUD Báo cáo vi phạm)"],
        summary: "[CREATE] Gửi báo cáo vi phạm mới cho 1 phòng trọ",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReportInput" } } }
        },
        responses: { 201: { description: "Đã ghi nhận báo cáo vi phạm" } }
      }
    },
    "/api/reports/{id}": {
      get: {
        tags: ["6. Reports (CRUD Báo cáo vi phạm)"],
        summary: "[READ] Chi tiết 1 báo cáo vi phạm (VD: RP-101)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "RP-101" } }],
        responses: { 200: { description: "Chi tiết báo cáo" }, 404: { description: "Không tìm thấy" } }
      },
      put: {
        tags: ["6. Reports (CRUD Báo cáo vi phạm)"],
        summary: "[UPDATE] Cập nhật nội dung & trạng thái báo cáo vi phạm (PUT)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "RP-101" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReportInput" } } }
        },
        responses: { 200: { description: "Đã cập nhật báo cáo" } }
      },
      delete: {
        tags: ["6. Reports (CRUD Báo cáo vi phạm)"],
        summary: "[DELETE] Xóa báo cáo vi phạm",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "RP-102" } }],
        responses: { 200: { description: "Đã xóa báo cáo" } }
      }
    },
    "/api/reports/{id}/status": {
      patch: {
        tags: ["6. Reports (CRUD Báo cáo vi phạm)"],
        summary: "[UPDATE] Xử lý báo cáo (RESOLVED tự động đình chỉ phòng vi phạm)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "RP-101" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["PENDING", "RESOLVED", "DISMISSED"], example: "RESOLVED" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Đã cập nhật trạng thái báo cáo & phòng liên quan" } }
      }
    },

    // --- 7. EKYC CRUD ---
    "/api/ekyc": {
      get: {
        tags: ["7. eKYC (CRUD Hồ sơ Chủ trọ)"],
        summary: "[READ] Danh sách toàn bộ hồ sơ xác thực eKYC Chủ trọ",
        responses: { 200: { description: "Danh sách hồ sơ eKYC" } }
      },
      post: {
        tags: ["7. eKYC (CRUD Hồ sơ Chủ trọ)"],
        summary: "[CREATE] Nộp hồ sơ eKYC CCCD 12 số mới",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/EkycInput" } } }
        },
        responses: { 201: { description: "Đã tạo hồ sơ eKYC" } }
      }
    },
    "/api/ekyc/{id}": {
      get: {
        tags: ["7. eKYC (CRUD Hồ sơ Chủ trọ)"],
        summary: "[READ] Chi tiết 1 hồ sơ eKYC (VD: EKYC-301)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "EKYC-301" } }],
        responses: { 200: { description: "Chi tiết hồ sơ eKYC" }, 404: { description: "Không tìm thấy" } }
      },
      put: {
        tags: ["7. eKYC (CRUD Hồ sơ Chủ trọ)"],
        summary: "[UPDATE] Cập nhật thông tin & trạng thái hồ sơ eKYC (PUT)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "EKYC-301" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/EkycInput" } } }
        },
        responses: { 200: { description: "Đã cập nhật hồ sơ eKYC" } }
      },
      delete: {
        tags: ["7. eKYC (CRUD Hồ sơ Chủ trọ)"],
        summary: "[DELETE] Xóa hồ sơ eKYC",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "EKYC-303" } }],
        responses: { 200: { description: "Đã xóa hồ sơ eKYC" } }
      }
    },

    // --- 8. UNIVERSITIES CRUD ---
    "/api/universities": {
      get: {
        tags: ["8. Universities (CRUD Trường ĐH)"],
        summary: "[READ] Danh sách các trường Đại học tại Đà Nẵng",
        responses: { 200: { description: "Danh sách trường ĐH" } }
      },
      post: {
        tags: ["8. Universities (CRUD Trường ĐH)"],
        summary: "[CREATE] Thêm mới 1 trường Đại học vào bản đồ bán kính",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UniversityInput" } } }
        },
        responses: { 201: { description: "Đã thêm trường ĐH mới" } }
      }
    },
    "/api/universities/{id}": {
      get: {
        tags: ["8. Universities (CRUD Trường ĐH)"],
        summary: "[READ] Chi tiết tọa độ 1 trường Đại học (VD: uni-bk)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "uni-bk" } }],
        responses: { 200: { description: "Chi tiết trường ĐH" }, 404: { description: "Không tìm thấy" } }
      },
      put: {
        tags: ["8. Universities (CRUD Trường ĐH)"],
        summary: "[UPDATE] Cập nhật thông tin & tọa độ GPS trường Đại học (PUT)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "uni-bk" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UniversityInput" } } }
        },
        responses: { 200: { description: "Đã cập nhật trường ĐH" } }
      },
      delete: {
        tags: ["8. Universities (CRUD Trường ĐH)"],
        summary: "[DELETE] Xóa trường Đại học",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "uni-vku" } }],
        responses: { 200: { description: "Đã xóa trường ĐH" } }
      }
    },

    // --- 9. USERS CRUD ---
    "/api/users": {
      get: {
        tags: ["9. Users (CRUD Người dùng)"],
        summary: "[READ] Danh sách tất cả người dùng trên hệ thống",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Danh sách người dùng (ẩn password_hash)" } }
      },
      post: {
        tags: ["9. Users (CRUD Người dùng)"],
        summary: "[CREATE] Tạo mới người dùng (Admin cấp tài khoản)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserInput" } } }
        },
        responses: { 201: { description: "Đã tạo người dùng mới" } }
      }
    },
    "/api/users/{id}": {
      get: {
        tags: ["9. Users (CRUD Người dùng)"],
        summary: "[READ] Chi tiết 1 người dùng theo ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } }],
        responses: { 200: { description: "Thông tin người dùng" }, 404: { description: "Không tìm thấy" } }
      },
      put: {
        tags: ["9. Users (CRUD Người dùng)"],
        summary: "[UPDATE] Cập nhật thông tin & phân quyền người dùng (PUT)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserInput" } } }
        },
        responses: { 200: { description: "Đã cập nhật người dùng" } }
      },
      delete: {
        tags: ["9. Users (CRUD Người dùng)"],
        summary: "[DELETE] Xóa tài khoản người dùng",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", example: 2 } }],
        responses: { 200: { description: "Đã xóa người dùng" } }
      }
    },

    // --- 10. ADMIN MODERATION ---
    "/api/admin/moderation": {
      get: {
        tags: ["10. Admin Moderation"],
        summary: "[READ] Dữ liệu tổng hợp Trung tâm Hậu kiểm (Tin gắn cờ + Báo cáo + eKYC)",
        responses: { 200: { description: "Dữ liệu hậu kiểm Admin" } }
      }
    },
    "/api/admin/flagged/{id}": {
      patch: {
        tags: ["10. Admin Moderation"],
        summary: "[UPDATE] Duyệt (APPROVED -> ACTIVE) hoặc Từ chối (REJECTED) tin bị gắn cờ",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "FL-201" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["APPROVED", "REJECTED", "FLAGGED"], example: "APPROVED" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Đã cập nhật trạng thái tin gắn cờ" } }
      }
    },
    "/api/admin/ekyc/{id}": {
      patch: {
        tags: ["10. Admin Moderation"],
        summary: "[UPDATE] Duyệt cấp tích xanh (APPROVED) hoặc Từ chối (REJECTED) hồ sơ eKYC",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "EKYC-301" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["APPROVED", "REJECTED", "PENDING"], example: "APPROVED" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Đã cập nhật hồ sơ eKYC" } }
      }
    }
  }
};

module.exports = openApiSpec;

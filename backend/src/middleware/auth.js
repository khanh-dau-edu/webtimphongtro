/**
 * backend/src/middleware/auth.js
 * Xác thực người dùng và phân quyền bằng JSON Web Token (JWT).
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "smarttro-danang-jwt-secret-2026";
const JWT_EXPIRES_IN = "7d";

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: "Vui lòng đăng nhập để thực hiện thao tác này." });
    }
    next();
  });
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: "Tài khoản của bạn không có quyền thực hiện thao tác này."
        });
      }
      next();
    });
  };
}

module.exports = {
  JWT_SECRET,
  signToken,
  optionalAuth,
  requireAuth,
  requireRole
};

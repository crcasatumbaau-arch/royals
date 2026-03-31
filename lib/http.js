/**
 * Set security headers on the response
 * @param {Object} res - Response object
 */
function setSecurityHeaders(res) {
  // Prevent XSS attacks
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'; frame-src https://www.google.com https://www.google.com/maps/; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
  );
  
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, X-Request-Time");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  // HSTS header (uncomment for production)
  // res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  
  // Disable content sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Referrer policy for privacy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(res, statusCode, payload) {
  setSecurityHeaders(res);
  res.status(statusCode).json(payload);
}

function methodNotAllowed(res, allowed) {
  setSecurityHeaders(res);
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: "Method not allowed." });
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }

  return {};
}

module.exports = {
  sendJson,
  methodNotAllowed,
  parseJsonBody,
  setSecurityHeaders,
};

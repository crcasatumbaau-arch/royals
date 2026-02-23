function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function methodNotAllowed(res, allowed) {
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
};

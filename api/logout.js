const { getDb, sanitizeQuery } = require("../lib/db");
const { getTokenFromRequest } = require("../lib/auth");
const { methodNotAllowed, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return sendJson(res, 200, { message: "Logged out." });
    }

    const db = await getDb();
    await db.collection("sessions").deleteOne(sanitizeQuery({ token }));
    return sendJson(res, 200, { message: "Logged out." });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to logout." });
  }
};

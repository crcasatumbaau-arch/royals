const { getDb } = require("./_lib/db");
const { getTokenFromRequest } = require("./_lib/auth");
const { methodNotAllowed, sendJson } = require("./_lib/http");

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
    await db.collection("sessions").deleteOne({ token });
    return sendJson(res, 200, { message: "Logged out." });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to logout." });
  }
};

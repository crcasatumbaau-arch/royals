const { getSessionUser } = require("../lib/session");
const { methodNotAllowed, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const { user } = session;
    return sendJson(res, 200, {
      user: {
        username: user.username,
        name: user.profile?.name || user.username,
        email: user.email || user.profile?.email || "",
        phone: user.profile?.phone || user.profile?.number || "",
        number: user.profile?.phone || user.profile?.number || "",
        location: user.profile?.location || "",
        role: user.role || "user",
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to load user profile." });
  }
};

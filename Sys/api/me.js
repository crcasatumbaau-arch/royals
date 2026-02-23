const { getSessionUser } = require("./_lib/session");
const { methodNotAllowed, sendJson } = require("./_lib/http");

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
        number: user.profile?.number || "",
        location: user.profile?.location || "",
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to load user profile." });
  }
};

const { getDb } = require("./_lib/db");
const { verifyPassword, createSessionToken } = require("./_lib/auth");
const { normalizeText, validateUsername, validatePassword } = require("./_lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = parseJsonBody(req);
    const username = normalizeText(body.username);
    const password = String(body.password || "");

    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);
    const validationError = usernameError || passwordError;
    if (validationError) {
      return sendJson(res, 400, { error: validationError });
    }

    const db = await getDb();
    const users = db.collection("users");
    const sessions = db.collection("sessions");

    const user = await users.findOne({ usernameLower: username.toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendJson(res, 401, { error: "Invalid username or password." });
    }

    const token = createSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);

    await sessions.insertOne({
      token,
      userId: user._id,
      createdAt: now,
      expiresAt,
    });

    return sendJson(res, 200, {
      message: "Login successful.",
      token,
      user: {
        username: user.username,
        name: user.profile?.name || user.username,
        number: user.profile?.number || "",
        location: user.profile?.location || "",
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to login." });
  }
};

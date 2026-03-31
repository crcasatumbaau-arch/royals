const { getDb } = require("../lib/db");
const { getSessionUser } = require("../lib/session");
const { normalizeText, validateProfileInput } = require("../lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    return methodNotAllowed(res, ["PUT"]);
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const body = parseJsonBody(req);
    const profile = {
      name: normalizeText(body.name),
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      number: normalizeText(body.phone),
      location: normalizeText(body.location),
    };

    const validationError = validateProfileInput(profile);
    if (validationError) {
      return sendJson(res, 400, { error: validationError });
    }

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: session.user._id },
      {
        $set: {
          email: profile.email,
          emailLower: profile.email.toLowerCase(),
          profile,
          updatedAt: new Date(),
        },
      }
    );

    return sendJson(res, 200, {
      message: "Profile updated.",
      user: {
        username: session.user.username,
        ...profile,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to update profile." });
  }
};

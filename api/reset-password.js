const { getDb, sanitizeQuery } = require("../lib/db");
const { hashPassword } = require("../lib/auth");
const { normalizeText, validateEmailOrContact, validatePassword } = require("../lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { verifyVerificationCode } = require("../lib/verification-codes");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = parseJsonBody(req);
    const email = normalizeText(body.email);
    const code = normalizeText(body.code);
    const newPassword = String(body.newPassword || "");

    const emailError = validateEmailOrContact(email);
    if (emailError) {
      return sendJson(res, 400, { error: emailError });
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return sendJson(res, 400, { error: "Enter the 6-digit verification code." });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return sendJson(res, 400, { error: passwordError });
    }

    const db = await getDb();
    const users = db.collection("users");
    const user = await users.findOne(sanitizeQuery({ emailLower: email.toLowerCase() }));

    if (!user) {
      return sendJson(res, 404, { error: "No account was found for that email." });
    }

    const verification = await verifyVerificationCode(db, {
      email,
      purpose: "password_reset",
      userId: user._id,
      code,
    });

    if (!verification.valid) {
      return sendJson(res, 400, { error: "Invalid or expired verification code." });
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: hashPassword(newPassword),
          updatedAt: new Date(),
        },
      }
    );

    await db.collection("sessions").deleteMany({ userId: user._id });

    return sendJson(res, 200, { message: "Password reset successful. You can now sign in." });
  } catch (error) {
    if (error && error.code === "DB_UNAVAILABLE") {
      return sendJson(res, 500, {
        error: "Password reset is temporarily unavailable because the database is not connected.",
      });
    }

    return sendJson(res, 500, { error: "Failed to reset password." });
  }
};

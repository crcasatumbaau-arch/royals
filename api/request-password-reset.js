const { getDb, sanitizeQuery } = require("../lib/db");
const { normalizeText, validateEmailOrContact } = require("../lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { createRateLimiter, getClientIp } = require("../lib/security");
const { issueVerificationCode } = require("../lib/verification-codes");
const { maskEmail, sendVerificationEmail } = require("../lib/email-delivery");

const resetLimiter = createRateLimiter();

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const clientIp = getClientIp(req);
    if (!resetLimiter.isAllowed(clientIp, 6, 60000)) {
      return sendJson(res, 429, { error: "Too many reset requests. Please try again later." });
    }

    const body = parseJsonBody(req);
    const email = normalizeText(body.email);
    const emailError = validateEmailOrContact(email);
    if (emailError) {
      return sendJson(res, 400, { error: emailError });
    }

    const db = await getDb();
    const users = db.collection("users");
    const user = await users.findOne(sanitizeQuery({ emailLower: email.toLowerCase() }));

    if (!user) {
      return sendJson(res, 200, {
        message: "If that email is registered, a verification code has been sent.",
      });
    }

    const issued = await issueVerificationCode(db, {
      email,
      purpose: "password_reset",
      userId: user._id,
      ttlMinutes: 10,
    });

    const delivery = await sendVerificationEmail({
      to: email,
      subject: "Sweet Royals password reset code",
      heading: "Reset your Sweet Royals password",
      message: "Use this code to reset your password.",
      code: issued.code,
      expiresInMinutes: 10,
    });

    return sendJson(res, 200, {
      message: `Verification code sent to ${maskEmail(email)}.`,
      maskedEmail: maskEmail(email),
      previewCode: delivery.previewCode || "",
    });
  } catch (error) {
    if (error && error.code === "DB_UNAVAILABLE") {
      return sendJson(res, 500, {
        error: "Password reset is temporarily unavailable because the database is not connected.",
      });
    }

    return sendJson(res, 500, { error: "Failed to request password reset." });
  }
};

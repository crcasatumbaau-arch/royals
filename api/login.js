const { getDb, sanitizeQuery } = require("../lib/db");
const { verifyPassword, hashPassword, createSessionToken } = require("../lib/auth");
const { normalizeText, validatePassword } = require("../lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { createBruteForceProtector, getClientIp } = require("../lib/security");
const { issueVerificationCode, verifyVerificationCode } = require("../lib/verification-codes");
const { maskEmail, sendVerificationEmail } = require("../lib/email-delivery");

const bruteForceProtector = createBruteForceProtector();
const ADMIN_USERNAME = "sweetroyals";
const ADMIN_PASSWORD = "sweets12345678";
const ADMIN_EMAIL = "sweetroyals@gmail.com";

async function createUserSession(sessions, user) {
  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);

  await sessions.insertOne({
    token,
    userId: user._id,
    createdAt: now,
    expiresAt,
  });

  return token;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const clientIp = getClientIp(req);
    const body = parseJsonBody(req);
    const identifier = normalizeText(body.identifier || body.username || body.email);
    const password = String(body.password || "");
    const verificationCode = normalizeText(body.verificationCode);

    const brute = bruteForceProtector.canAttempt(clientIp, identifier);
    if (!brute.allowed) {
      await new Promise((resolve) => setTimeout(resolve, brute.delayMs));
      return sendJson(res, 429, {
        error: brute.reason || "Too many login attempts. Please try again later.",
      });
    }

    if (brute.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, brute.delayMs));
    }

    if (!identifier || identifier.length < 3 || identifier.length > 100) {
      bruteForceProtector.recordFailure(clientIp, identifier);
      return sendJson(res, 400, { error: "Username or email is required." });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      bruteForceProtector.recordFailure(clientIp, identifier);
      return sendJson(res, 400, { error: passwordError });
    }

    const db = await getDb();
    const users = db.collection("users");
    const sessions = db.collection("sessions");

    const loweredIdentifier = identifier.toLowerCase();
    let user = await users.findOne(sanitizeQuery({
      $or: [
        { usernameLower: loweredIdentifier },
        { emailLower: loweredIdentifier },
      ],
    }));

    if ((loweredIdentifier === ADMIN_USERNAME || loweredIdentifier === ADMIN_EMAIL) && password === ADMIN_PASSWORD) {
      const createdAt = new Date();
      const adminValues = {
        username: ADMIN_USERNAME,
        usernameLower: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        emailLower: ADMIN_EMAIL,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "admin",
        profile: {
          name: "Sweet Royals Admin",
          email: ADMIN_EMAIL,
          phone: "",
          number: "",
          location: "Sweet Royals Admin Dashboard",
        },
        updatedAt: createdAt,
      };

      const existingAdmin = await users.findOne(sanitizeQuery({ usernameLower: ADMIN_USERNAME }));

      if (existingAdmin) {
        await users.updateOne(
          { _id: existingAdmin._id },
          { $set: adminValues, $setOnInsert: { createdAt } }
        );
        user = { ...existingAdmin, ...adminValues };
      } else {
        const insertResult = await users.insertOne({
          ...adminValues,
          createdAt,
        });
        user = { ...adminValues, _id: insertResult.insertedId };
      }
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      bruteForceProtector.recordFailure(clientIp, identifier);
      return sendJson(res, 401, { error: "Invalid username, email, or password." });
    }

    const userEmail = user.email || user.profile?.email || "";
    if (!userEmail) {
      return sendJson(res, 400, { error: "This account does not have an email for verification." });
    }

    if (!verificationCode) {
      const issued = await issueVerificationCode(db, {
        email: userEmail,
        purpose: "login_2fa",
        userId: user._id,
        ttlMinutes: 10,
      });

      const delivery = await sendVerificationEmail({
        to: userEmail,
        subject: "Sweet Royals login verification code",
        heading: "Your Sweet Royals verification code",
        message: "Use this code to complete your sign in.",
        code: issued.code,
        expiresInMinutes: 10,
      });

      return sendJson(res, 200, {
        requiresTwoFactor: true,
        message: `Verification code sent to ${maskEmail(userEmail)}.`,
        maskedEmail: maskEmail(userEmail),
        previewCode: delivery.previewCode || "",
      });
    }

    const verification = await verifyVerificationCode(db, {
      email: userEmail,
      purpose: "login_2fa",
      userId: user._id,
      code: verificationCode,
    });

    if (!verification.valid) {
      bruteForceProtector.recordFailure(clientIp, identifier);
      return sendJson(res, 401, { error: "Invalid or expired verification code." });
    }

    bruteForceProtector.recordSuccess(clientIp, identifier);

    const token = await createUserSession(sessions, user);

    return sendJson(res, 200, {
      message: "Login successful.",
      token,
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
    if (error && error.code === "DB_UNAVAILABLE") {
      return sendJson(res, 500, {
        error: "Login is temporarily unavailable because the database is not connected.",
      });
    }

    return sendJson(res, 500, { error: "Failed to login." });
  }
};

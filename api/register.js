const { getDb, sanitizeQuery } = require("../lib/db");
const { hashPassword } = require("../lib/auth");
const {
  normalizeText,
  validateRealName,
  validatePassword,
  validateEmailOrContact,
  validateOptionalPhone,
  validateAddress,
} = require("../lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { createRateLimiter, getClientIp } = require("../lib/security");
const { verifyEmailAddress } = require("../lib/email-verification");
const { issueVerificationCode, verifyVerificationCode } = require("../lib/verification-codes");
const { maskEmail, sendVerificationEmail } = require("../lib/email-delivery");

// Initialize rate limiter for registration (shared across requests)
const registrationLimiter = createRateLimiter();
const registrationEmailLimiter = createRateLimiter();
const RESERVED_USERNAMES = new Set(["sweetroyals"]);
const RESERVED_EMAILS = new Set(["sweetroyals@gmail.com"]);
const REGISTRATION_VERIFICATION_PURPOSE = "registration_email";

function createUsernameBase(name, email) {
  const fromName = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  const fromEmail = String(email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  const base = fromName || fromEmail || "user";
  return base.slice(0, 30);
}

async function createUniqueUsername(users, name, email) {
  const base = createUsernameBase(name, email);

  for (let counter = 0; counter < 1000; counter += 1) {
    const suffix = counter === 0 ? "" : `.${counter + 1}`;
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    const lowered = candidate.toLowerCase();

    if (RESERVED_USERNAMES.has(lowered)) {
      continue;
    }

    const existing = await users.findOne(sanitizeQuery({ usernameLower: lowered }));
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique username.");
}

async function requestRegistrationVerification(req, res, body) {
  const clientIp = getClientIp(req);
  if (!registrationEmailLimiter.isAllowed(clientIp, 6, 60000)) {
    return sendJson(res, 429, {
      error: "Too many verification requests. Please try again in 1 minute.",
    });
  }

  const email = normalizeText(body.email);
  const emailError = validateEmailOrContact(email);
  if (emailError) {
    return sendJson(res, 400, { error: emailError });
  }

  if (RESERVED_EMAILS.has(email.toLowerCase())) {
    return sendJson(res, 403, { error: "This account is reserved for admin use only." });
  }

  const db = await getDb();
  const users = db.collection("users");
  const existing = await users.findOne(sanitizeQuery({ emailLower: email.toLowerCase() }));
  if (existing) {
    return sendJson(res, 409, { error: "That email is already registered." });
  }

  const emailCheck = await verifyEmailAddress(email);
  if (!emailCheck.valid) {
    return sendJson(res, 400, {
      error: emailCheck.reason || "Enter a real email address that can receive mail.",
    });
  }

  const issued = await issueVerificationCode(db, {
    email,
    purpose: REGISTRATION_VERIFICATION_PURPOSE,
    ttlMinutes: 10,
  });

  const delivery = await sendVerificationEmail({
    to: email,
    subject: "Sweet Royals registration verification code",
    heading: "Verify your Sweet Royals email",
    message: "Use this code to finish creating your account.",
    code: issued.code,
    expiresInMinutes: 10,
  });

  return sendJson(res, 200, {
    message: `Verification code sent to ${maskEmail(email)}.`,
    maskedEmail: maskEmail(email),
    previewCode: delivery.previewCode || "",
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = parseJsonBody(req);
    const action = normalizeText(body.action);

    if (action === "request-email-verification") {
      return requestRegistrationVerification(req, res, body);
    }

    const clientIp = getClientIp(req);
    
    // Rate limit registration attempts (5 per minute per IP)
    if (!registrationLimiter.isAllowed(clientIp, 5, 60000)) {
      return sendJson(res, 429, { 
        error: "Too many registration attempts. Please try again in 1 minute." 
      });
    }

    const name = normalizeText(body.name);
    const email = normalizeText(body.email);
    const verificationCode = normalizeText(body.verificationCode);
    const phone = normalizeText(body.phone);
    const password = String(body.password || "");
    const address = normalizeText(body.address);
    const adminCode = String(body.adminCode || "").trim();

    const nameError = validateRealName(name);
    const emailError = validateEmailOrContact(email);
    const phoneError = validateOptionalPhone(phone);
    const passwordError = validatePassword(password);
    const addressError = validateAddress(address);
    const validationError = nameError || emailError || phoneError || passwordError || addressError;
    if (validationError) {
      return sendJson(res, 400, { error: validationError });
    }

    if (RESERVED_EMAILS.has(email.toLowerCase())) {
      return sendJson(res, 403, { error: "This account is reserved for admin use only." });
    }

    // Check admin code
    const isAdmin = adminCode && Buffer.from(adminCode, 'base64').toString('utf8') === process.env.ADMIN_REGISTRATION_CODE;
    if (adminCode && !isAdmin) {
      return sendJson(res, 400, { error: "Invalid admin registration code." });
    }

    const db = await getDb();
    const users = db.collection("users");
    const existing = await users.findOne(sanitizeQuery({ emailLower: email.toLowerCase() }));

    if (existing) {
      return sendJson(res, 409, { error: "That email is already registered." });
    }

    if (!verificationCode || !/^\d{6}$/.test(verificationCode)) {
      return sendJson(res, 400, { error: "Enter the 6-digit email verification code." });
    }

    const verification = await verifyVerificationCode(db, {
      email,
      purpose: REGISTRATION_VERIFICATION_PURPOSE,
      code: verificationCode,
    });

    if (!verification.valid) {
      return sendJson(res, 400, {
        error: "Invalid or expired email verification code. Request a new code and try again.",
      });
    }

    const now = new Date();
    const username = await createUniqueUsername(users, name, email);
    const newUser = {
      username,
      usernameLower: username.toLowerCase(),
      email,
      emailLower: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: isAdmin ? 'admin' : 'user',
      profile: {
        name,
        email,
        phone,
        number: phone,
        location: address,
      },
      createdAt: now,
      updatedAt: now,
    };

    await users.insertOne(newUser);
    return sendJson(res, 201, { message: "Registration successful." });
  } catch (error) {
    if (error && error.code === 11000) {
      return sendJson(res, 409, { error: "That email is already registered." });
    }

    if (error && error.code === "DB_UNAVAILABLE") {
      return sendJson(res, 500, {
        error: "Registration is temporarily unavailable because the database is not connected.",
      });
    }

    return sendJson(res, 500, { error: "Failed to register user." });
  }
};

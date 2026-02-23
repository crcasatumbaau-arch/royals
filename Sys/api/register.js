const { getDb } = require("./_lib/db");
const { hashPassword } = require("./_lib/auth");
const {
  normalizeText,
  validateUsername,
  validatePassword,
  validateEmailOrContact,
  validateAddress,
} = require("./_lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = parseJsonBody(req);
    const username = normalizeText(body.username);
    const email = normalizeText(body.email);
    const password = String(body.password || "");
    const address = normalizeText(body.address);

    const usernameError = validateUsername(username);
    const emailError = validateEmailOrContact(email);
    const passwordError = validatePassword(password);
    const addressError = validateAddress(address);
    const validationError = usernameError || emailError || passwordError || addressError;
    if (validationError) {
      return sendJson(res, 400, { error: validationError });
    }

    const db = await getDb();
    const users = db.collection("users");
    const existing = await users.findOne({
      $or: [{ usernameLower: username.toLowerCase() }, { emailLower: email.toLowerCase() }],
    });

    if (existing) {
      return sendJson(res, 409, { error: "Username or email/contact is already registered." });
    }

    const now = new Date();
    const newUser = {
      username,
      usernameLower: username.toLowerCase(),
      email,
      emailLower: email.toLowerCase(),
      passwordHash: hashPassword(password),
      profile: {
        name: username,
        number: email,
        location: address,
      },
      createdAt: now,
      updatedAt: now,
    };

    await users.insertOne(newUser);
    return sendJson(res, 201, { message: "Registration successful." });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to register user." });
  }
};

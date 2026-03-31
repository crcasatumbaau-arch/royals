const crypto = require("crypto");

function createNumericCode(length = 6) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code || "")).digest("hex");
}

async function issueVerificationCode(db, options) {
  const codes = db.collection("verification_codes");
  const email = String(options.email || "").trim();
  const purpose = String(options.purpose || "").trim();
  const ttlMinutes = Number(options.ttlMinutes) || 10;
  const code = createNumericCode(options.length || 6);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  await codes.deleteMany({
    emailLower: email.toLowerCase(),
    purpose,
  });

  await codes.insertOne({
    emailLower: email.toLowerCase(),
    purpose,
    userId: options.userId || null,
    codeHash: hashVerificationCode(code),
    createdAt: now,
    expiresAt,
    attempts: 0,
  });

  return {
    code,
    expiresAt,
  };
}

async function verifyVerificationCode(db, options) {
  const codes = db.collection("verification_codes");
  const emailLower = String(options.email || "").trim().toLowerCase();
  const purpose = String(options.purpose || "").trim();
  const codeHash = hashVerificationCode(options.code);

  const record = await codes.findOne({
    emailLower,
    purpose,
  });

  if (!record) {
    return { valid: false };
  }

  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    await codes.deleteOne({ _id: record._id });
    return { valid: false, expired: true };
  }

  if (options.userId && String(record.userId || "") !== String(options.userId || "")) {
    return { valid: false };
  }

  if (record.codeHash !== codeHash) {
    const attempts = (Number(record.attempts) || 0) + 1;
    if (attempts >= 5) {
      await codes.deleteOne({ _id: record._id });
      return { valid: false };
    }

    await codes.updateOne({ _id: record._id }, { $set: { attempts } });
    return { valid: false };
  }

  await codes.deleteOne({ _id: record._id });
  return { valid: true };
}

module.exports = {
  issueVerificationCode,
  verifyVerificationCode,
};

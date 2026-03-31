/**
 * Normalize and sanitize text input
 * @param {*} value - Any value
 * @returns {string} Normalized string
 */
function normalizeText(value) {
  if (typeof value === "object" && value !== null) {
    throw new Error("Invalid input type");
  }

  const text = String(value || "").trim();
  
  // Block dangerous characters and patterns that could indicate injection
  if (
    text.includes("<") ||
    text.includes(">") ||
    text.includes("/*") ||
    text.includes("*/") ||
    /<script|javascript:|onerror=|onload=|document\.|window\./i.test(text)
  ) {
    throw new Error("Invalid characters detected in input");
  }
  
  return text;
}

function isPlainSafeText(value, min = 0, max = 200) {
  const text = normalizeText(value);
  if (text.length < min || text.length > max) {
    return false;
  }
  return !/[{}[\]$;]/.test(text);
}

function parseSafeInteger(value, fieldName, options = {}) {
  const raw = String(value ?? "").trim();
  const min = Number.isFinite(options.min) ? options.min : 0;
  const max = Number.isFinite(options.max) ? options.max : Number.MAX_SAFE_INTEGER;

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${fieldName} must be whole numbers only.`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldName} is out of range.`);
  }

  return parsed;
}

function parseSafeDecimal(value, fieldName, options = {}) {
  const raw = String(value ?? "").trim();
  const min = Number.isFinite(options.min) ? options.min : 0;
  const max = Number.isFinite(options.max) ? options.max : Number.MAX_SAFE_INTEGER;
  const decimals = Number.isFinite(options.decimals) ? options.decimals : 2;
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);

  if (!pattern.test(raw)) {
    throw new Error(`${fieldName} must be a valid number and cannot contain letters.`);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldName} is out of range.`);
  }

  return parsed;
}

function validateUsername(username) {
  const v = normalizeText(username);
  if (!v) return "Username is required.";
  if (v.length < 3 || v.length > 30) return "Username must be 3-30 characters.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return "Username contains invalid characters.";
  return "";
}

function validateRealName(name) {
  const v = normalizeText(name);
  if (!v) return "Real name is required.";
  if (v.length < 2 || v.length > 60) return "Real name must be 2-60 characters.";
  if (!/^[a-zA-Z][a-zA-Z\s.'-]*[a-zA-Z.]$/.test(v)) return "Real name contains invalid characters.";
  return "";
}

function validatePassword(password) {
  const v = String(password || "");
  if (!v) return "Password is required.";
  if (v.length < 6 || v.length > 64) return "Password must be 6-64 characters.";
  return "";
}

function validateEmailOrContact(emailOrContact) {
  const v = normalizeText(emailOrContact);
  if (!v) return "Email is required.";
  if (v.length > 100) return "Email is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v)) return "Email must be a valid address.";
  return "";
}

function validateOptionalPhone(phone) {
  const v = normalizeText(phone);
  if (!v) return "";
  if (!/^[0-9+\-\s()]{7,20}$/.test(v)) return "Phone number must be 7-20 digits and may include +, -, spaces, or parentheses.";
  return "";
}

function validateAddress(address) {
  const v = normalizeText(address);
  if (!v) return "Address is required.";
  if (v.length < 5 || v.length > 200) return "Address must be 5-200 characters.";
  return "";
}

function validateOptionalSpecialRequest(specialRequest) {
  const v = normalizeText(specialRequest);
  if (!v) return "";
  if (v.length > 300) return "Special request must be 300 characters or fewer.";
  return "";
}

function validateProfileInput({ name, email, phone, location }) {
  const n = normalizeText(name);
  const e = normalizeText(email);
  const p = normalizeText(phone);
  const loc = normalizeText(location);

  if (validateRealName(n)) return validateRealName(n);
  if (validateEmailOrContact(e)) return validateEmailOrContact(e);
  if (validateOptionalPhone(p)) return validateOptionalPhone(p);
  if (!loc || loc.length < 3 || loc.length > 150) return "Location must be 3-150 characters.";

  return "";
}

function validateCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Cart is empty.", normalizedItems: [] };
  }

  const normalizedItems = [];
  let computedTotal = 0;

  for (const rawItem of items) {
    const id = normalizeText(rawItem?.id);
    const name = normalizeText(rawItem?.name);
    let price;
    let qty;

    try {
      price = parseSafeDecimal(rawItem?.price, "Price", { min: 0, max: 100000, decimals: 2 });
      qty = parseSafeInteger(rawItem?.qty, "Quantity", { min: 1, max: 99 });
    } catch (error) {
      return { error: error.message || "Cart contains invalid values.", normalizedItems: [] };
    }

    if (!id || !name) {
      return { error: "Cart contains invalid product.", normalizedItems: [] };
    }
    if (!Number.isFinite(price) || price < 0) {
      return { error: `Invalid price for ${name || id}.`, normalizedItems: [] };
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { error: `Invalid quantity for ${name || id}.`, normalizedItems: [] };
    }

    computedTotal += price * qty;
    normalizedItems.push({
      id,
      name,
      price,
      qty,
    });
  }

  return {
    error: "",
    normalizedItems,
    computedTotal: Number(computedTotal.toFixed(2)),
  };
}

/**
 * Validate that a value is a safe MongoDB ObjectId
 * @param {*} id - The ID to validate
 * @returns {boolean} True if valid ObjectId format
 */
function isValidObjectId(id) {
  return /^[0-9a-f]{24}$/i.test(String(id || ""));
}

module.exports = {
  normalizeText,
  isPlainSafeText,
  parseSafeInteger,
  parseSafeDecimal,
  validateUsername,
  validateRealName,
  validatePassword,
  validateEmailOrContact,
  validateOptionalPhone,
  validateAddress,
  validateOptionalSpecialRequest,
  validateProfileInput,
  validateCartItems,
  isValidObjectId,
};

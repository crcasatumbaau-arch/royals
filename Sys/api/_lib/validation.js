const PRODUCTS = {
  cake: { name: "Strawberry Cake", price: 211.0 },
  cookie: { name: "Cookie", price: 36.3 },
  pudding: { name: "Pudding", price: 20.0 },
};

function normalizeText(value) {
  return String(value || "").trim();
}

function validateUsername(username) {
  const v = normalizeText(username);
  if (!v) return "Username is required.";
  if (v.length < 3 || v.length > 30) return "Username must be 3-30 characters.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return "Username contains invalid characters.";
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
  if (!v) return "Email or contact is required.";
  if (v.length > 100) return "Email or contact is too long.";
  return "";
}

function validateAddress(address) {
  const v = normalizeText(address);
  if (!v) return "Address is required.";
  if (v.length < 5 || v.length > 200) return "Address must be 5-200 characters.";
  return "";
}

function validateProfileInput({ name, number, location }) {
  const n = normalizeText(name);
  const num = normalizeText(number);
  const loc = normalizeText(location);

  if (!n || n.length < 2 || n.length > 60) return "Name must be 2-60 characters.";
  if (!/^[0-9+\-\s()]{7,20}$/.test(num)) return "Mobile number is invalid.";
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
    const qty = Number(rawItem?.qty);

    if (!PRODUCTS[id]) {
      return { error: "Cart contains invalid product.", normalizedItems: [] };
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { error: `Invalid quantity for ${id}.`, normalizedItems: [] };
    }

    const price = PRODUCTS[id].price;
    computedTotal += price * qty;
    normalizedItems.push({
      id,
      name: PRODUCTS[id].name,
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

module.exports = {
  PRODUCTS,
  normalizeText,
  validateUsername,
  validatePassword,
  validateEmailOrContact,
  validateAddress,
  validateProfileInput,
  validateCartItems,
};

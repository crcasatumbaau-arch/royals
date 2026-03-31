const { getDb, sanitizeQuery } = require("../lib/db");
const { getSessionUser } = require("../lib/session");
const { normalizeText, validateCartItems, validateOptionalSpecialRequest } = require("../lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { createRateLimiter, getClientIp } = require("../lib/security");

// Initialize rate limiter for orders
const orderRateLimiter = createRateLimiter();

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const clientIp = getClientIp(req);
    if (!orderRateLimiter.isAllowed(clientIp, 10, 60000)) { // 10 orders per minute per IP
      return sendJson(res, 429, { error: "Too many order attempts. Please try again later." });
    }

    const body = parseJsonBody(req);
    const items = body.items;
    const specialRequest = normalizeText(body.specialRequest);
    const result = validateCartItems(items);
    if (result.error) {
      return sendJson(res, 400, { error: result.error });
    }

    const specialRequestError = validateOptionalSpecialRequest(specialRequest);
    if (specialRequestError) {
      return sendJson(res, 400, { error: specialRequestError });
    }

    const db = await getDb();
    const profile = session.user.profile || {};
    
    const productsCollection = db.collection("products");
    const normalizedItems = [];
    let computedTotal = 0;

    for (const item of result.normalizedItems) {
      const product = await productsCollection.findOne(sanitizeQuery({ id: item.id }));

      if (!product) {
        return sendJson(res, 400, { error: `Product no longer exists: ${item.name}.` });
      }

      const availableQuantity = Number(product.quantity || 0);
      if (availableQuantity < item.qty) {
        return sendJson(res, 409, {
          error: `${product.name} only has ${availableQuantity} item(s) left.`,
        });
      }

      const trustedPrice = Number(product.price || 0);
      normalizedItems.push({
        id: String(product.id),
        name: String(product.name),
        price: trustedPrice,
        qty: item.qty,
      });
      computedTotal += trustedPrice * item.qty;
    }

    // Decrement product quantities based on verified order items
    for (const item of normalizedItems) {
      const product = await productsCollection.findOne(sanitizeQuery({ id: item.id }));
      const newQuantity = Math.max(0, (product.quantity || 0) - item.qty);
      const updateObj = { quantity: newQuantity, updatedAt: new Date() };

      if (newQuantity === 0 && (product.quantity || 0) > 0) {
        updateObj.outOfStockAt = new Date();
      }

      await productsCollection.updateOne(
        { _id: product._id },
        { $set: updateObj }
      );
    }
    
    const order = {
      userId: session.user._id,
      username: session.user.username,
      customer: {
        name: profile.name || session.user.username,
        email: session.user.email || profile.email || "",
        phone: profile.phone || profile.number || "",
        location: profile.location || "",
      },
      items: normalizedItems,
      specialRequest,
      total: Number(computedTotal.toFixed(2)),
      createdAt: new Date(),
      status: "confirmed",
    };

    const saved = await db.collection("orders").insertOne(order);
    return sendJson(res, 201, {
      message: "Order confirmed.",
      orderId: String(saved.insertedId),
      total: order.total,
      customer: order.customer,
      specialRequest: order.specialRequest,
      status: order.status,
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to create order." });
  }
};

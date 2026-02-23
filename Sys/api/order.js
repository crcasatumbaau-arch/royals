const { getDb } = require("./_lib/db");
const { getSessionUser } = require("./_lib/session");
const { validateCartItems } = require("./_lib/validation");
const { methodNotAllowed, parseJsonBody, sendJson } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const body = parseJsonBody(req);
    const items = body.items;
    const result = validateCartItems(items);
    if (result.error) {
      return sendJson(res, 400, { error: result.error });
    }

    const db = await getDb();
    const order = {
      userId: session.user._id,
      username: session.user.username,
      items: result.normalizedItems,
      total: result.computedTotal,
      createdAt: new Date(),
      status: "confirmed",
    };

    const saved = await db.collection("orders").insertOne(order);
    return sendJson(res, 201, {
      message: "Order confirmed.",
      orderId: String(saved.insertedId),
      total: order.total,
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to create order." });
  }
};

const { getDb, sanitizeQuery } = require("../lib/db");
const { getSessionUser } = require("../lib/session");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { ObjectId } = require("mongodb");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const session = await getSessionUser(req);
      if (!session) {
        return sendJson(res, 401, { error: "Unauthorized." });
      }

      const db = await getDb();
      const query = session.user.role === "admin"
        ? {}
        : sanitizeQuery({ userId: session.user._id });

      const items = await db
        .collection("orders")
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return sendJson(res, 200, {
        orders: items.map((order) => ({
          id: String(order._id),
          customerName: order.customer?.name || order.username || session.user.profile?.name || session.user.username,
          email: order.customer?.email || "",
          phone: order.customer?.phone || "",
          location: order.customer?.location || "",
          createdAt: order.createdAt,
          itemCount: Array.isArray(order.items)
            ? order.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
            : 0,
          total: Number(order.total) || 0,
          status: order.status || "confirmed",
          items: Array.isArray(order.items) ? order.items : [],
          specialRequest: String(order.specialRequest || ""),
        })),
      });
    } catch (error) {
      return sendJson(res, 500, { error: "Failed to load orders." });
    }
  }

  if (req.method === "PUT") {
    try {
      const session = await getSessionUser(req);
      if (!session) {
        return sendJson(res, 401, { error: "Unauthorized." });
      }

      const body = parseJsonBody(req);
      const orderId = String(body.orderId || "").trim();
      const newStatus = String(body.status || "").trim();

      if (!orderId || !newStatus) {
        return sendJson(res, 400, { error: "Order ID and status are required." });
      }

      if (!["confirmed", "cancelled"].includes(newStatus)) {
        return sendJson(res, 400, { error: "Invalid status." });
      }

      const db = await getDb();
      const ordersCollection = db.collection("orders");
      const productsCollection = db.collection("products");

      let orderObjectId;
      try {
        orderObjectId = new ObjectId(orderId);
      } catch {
        return sendJson(res, 400, { error: "Invalid order ID format." });
      }

      const order = await ordersCollection.findOne({ _id: orderObjectId });

      if (!order) {
        return sendJson(res, 404, { error: "Order not found." });
      }

      const isAdmin = session.user.role === "admin";

      if (!isAdmin && order.userId.toString() !== session.user._id.toString()) {
        return sendJson(res, 403, { error: "Unauthorized." });
      }

      const previousStatus = order.status || "confirmed";

      if (newStatus === "cancelled" && previousStatus !== "cancelled") {
        for (const item of (order.items || [])) {
          const product = await productsCollection.findOne(
            sanitizeQuery(item.id ? { id: String(item.id || "") } : { name: String(item.name || "") })
          );
          if (product) {
            const restoredQuantity = (product.quantity || 0) + (item.qty || 0);
            await productsCollection.updateOne(
              { _id: product._id },
              { $set: { quantity: restoredQuantity, updatedAt: new Date(), outOfStockAt: null } }
            );
          }
        }
      }

      await ordersCollection.updateOne(
        { _id: orderObjectId },
        { $set: { status: newStatus, updatedAt: new Date() } }
      );

      return sendJson(res, 200, { message: "Order status updated.", status: newStatus });
    } catch (error) {
      const detail = error && typeof error.message === "string" ? error.message : "";
      const message = detail ? `Failed to update order: ${detail}` : "Failed to update order.";
      return sendJson(res, 500, { error: message });
    }
  }

  return methodNotAllowed(res, ["GET", "PUT"]);
};

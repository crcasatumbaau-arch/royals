const { getDb } = require("../lib/db");
const { getSessionUser } = require("../lib/session");
const { methodNotAllowed, sendJson } = require("../lib/http");

function sortByCreatedAtDesc(items) {
  return items.sort((a, b) => {
    const left = new Date(a.createdAt || 0).getTime();
    const right = new Date(b.createdAt || 0).getTime();
    return right - left;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const session = await getSessionUser(req);
    if (!session || session.user.role !== "admin") {
      return sendJson(res, 403, { error: "Admin access required." });
    }

    const db = await getDb();
    const [users, products, orders] = await Promise.all([
      db.collection("users").find({}, {
        projection: {
          username: 1,
          email: 1,
          role: 1,
          createdAt: 1,
          profile: 1,
        },
      }).sort({ createdAt: -1 }).toArray(),
      db.collection("products").find({}, {
        projection: {
          id: 1,
          name: 1,
        },
      }).toArray(),
      db.collection("orders").find({}, {
        projection: {
          createdAt: 1,
          customer: 1,
          items: 1,
          specialRequest: 1,
        },
      }).toArray(),
    ]);

    const productStatsMap = new Map();
    products.forEach((product) => {
      productStatsMap.set(String(product.id || ""), {
        id: String(product.id || ""),
        name: String(product.name || "Unnamed Product"),
        totalBought: 0,
      });
    });

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = String(item.id || "");
        const qty = Number(item.qty) || 0;
        const existing = productStatsMap.get(key);

        if (existing) {
          existing.totalBought += qty;
          return;
        }

        productStatsMap.set(key, {
          id: key,
          name: String(item.name || "Unnamed Product"),
          totalBought: qty,
        });
      });
    });

    const rankedProducts = Array.from(productStatsMap.values()).sort((a, b) => {
      if (b.totalBought !== a.totalBought) {
        return b.totalBought - a.totalBought;
      }
      return a.name.localeCompare(b.name);
    });

    const leastBoughtProducts = [...rankedProducts].sort((a, b) => {
      if (a.totalBought !== b.totalBought) {
        return a.totalBought - b.totalBought;
      }
      return a.name.localeCompare(b.name);
    });

    const specialRequests = sortByCreatedAtDesc(
      orders
        .filter((order) => String(order.specialRequest || "").trim())
        .map((order) => ({
          customerName: String(order.customer?.name || "Customer"),
          email: String(order.customer?.email || ""),
          createdAt: order.createdAt,
          specialRequest: String(order.specialRequest || "").trim(),
        }))
    );

    return sendJson(res, 200, {
      registeredUsers: users.map((user) => ({
        id: String(user._id),
        username: String(user.username || ""),
        name: String(user.profile?.name || user.username || ""),
        email: String(user.email || user.profile?.email || ""),
        role: String(user.role || "user"),
        createdAt: user.createdAt,
      })),
      mostBoughtProduct: rankedProducts[0] || null,
      leastBoughtProduct: leastBoughtProducts[0] || null,
      specialRequests,
    });
  } catch (error) {
    return sendJson(res, 500, { error: "Failed to load admin dashboard." });
  }
};

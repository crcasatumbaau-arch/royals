const { getDb, sanitizeQuery } = require("../lib/db");
const { getSessionAdmin } = require("../lib/session");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { createRateLimiter, getClientIp } = require("../lib/security");
const { normalizeText, parseSafeInteger, parseSafeDecimal } = require("../lib/validation");

// Initialize rate limiter for product queries
const productRateLimiter = createRateLimiter();

function normalizeProduct(product) {
  const normalizedName = normalizeText(product.name);
  const normalizedCategory = normalizeText(product.category);
  const normalizedDescription = normalizeText(product.description || "");
  const normalizedImage = normalizeText(product.image || "");
  const normalizedQuantity = parseSafeInteger(product.quantity, "Product quantity", { min: 0, max: 9999 });

  return {
    id: normalizeText(product.id || `PROD-${Date.now()}`),
    name: normalizedName,
    nameLower: normalizedName.toLowerCase(),
    price: parseSafeDecimal(product.price, "Product price", { min: 0, max: 100000, decimals: 2 }),
    category: normalizedCategory,
    quantity: normalizedQuantity,
    description: normalizedDescription,
    image: normalizedImage,
  };
}

function validateProduct(product) {
  if (!product.name || product.name.length > 120) {
    return "Product name is required and must be 1-120 characters.";
  }
  if (!/^[a-zA-Z0-9 .,'()&-]+$/.test(product.name)) {
    return "Product name contains invalid characters.";
  }
  if (!Number.isFinite(product.price) || product.price < 0) {
    return "Product price must be a valid number.";
  }
  if (!product.category || product.category.length > 60) {
    return "Product category is required and must be 1-60 characters.";
  }
  if (!/^[a-zA-Z ]+$/.test(product.category)) {
    return "Product category should contain letters and spaces only.";
  }
  if (product.description.length > 500) {
    return "Product description is too long.";
  }
  if (product.description && !/^[a-zA-Z0-9 .,'()!?\-]*$/.test(product.description)) {
    return "Product description contains invalid characters.";
  }
  if (!Number.isFinite(product.quantity) || product.quantity < 0 || !Number.isInteger(product.quantity)) {
    return "Product quantity must be a whole number from 0 to 9999.";
  }
  if (product.image && !/^data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+$|^https?:\/\/|^\//.test(product.image)) {
    return "Product image format is invalid.";
  }
  return "";
}

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const products = db.collection("products");
    const cleanupExpiredSoldOutProducts = async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return products.deleteMany({
        quantity: { $lte: 0 },
        outOfStockAt: { $type: "date", $lte: oneHourAgo },
      });
    };

    if (req.method === "GET") {
      const clientIp = getClientIp(req);
      if (!productRateLimiter.isAllowed(clientIp, 100, 60000)) { // 100 requests per minute
        return sendJson(res, 429, { error: "Too many requests. Please try again later." });
      }

      await cleanupExpiredSoldOutProducts();
      const items = await products.find({}).sort({ createdAt: -1 }).toArray();
      return sendJson(res, 200, {
        products: items.map(({ _id, ...product }) => product),
      });
    }

    if (req.method === "POST") {
      const session = await getSessionAdmin(req);
      if (!session) {
        return sendJson(res, 403, { error: "Admin access required." });
      }

      const body = parseJsonBody(req);
      const product = normalizeProduct(body);
      const error = validateProduct(product);
      if (error) {
        return sendJson(res, 400, { error });
      }

      const existing = await products.findOne(sanitizeQuery({ nameLower: product.nameLower }));
      if (existing) {
        return sendJson(res, 409, { error: "A product with this name already exists." });
      }

      const now = new Date();
      const toInsert = {
        ...product,
        createdAt: now,
        updatedAt: now,
        outOfStockAt: product.quantity === 0 ? now : null,
      };

      await products.insertOne(toInsert);
      return sendJson(res, 201, { product: toInsert });
    }

    if (req.method === "PUT") {
      const session = await getSessionAdmin(req);
      if (!session) {
        return sendJson(res, 403, { error: "Admin access required." });
      }

      const body = parseJsonBody(req);
      const product = normalizeProduct(body);
      const error = validateProduct(product);
      if (error) {
        return sendJson(res, 400, { error });
      }

      const existingProduct = await products.findOne(sanitizeQuery({ id: product.id }));
      if (!existingProduct) {
        return sendJson(res, 404, { error: "Product not found." });
      }

      const nextOutOfStockAt = product.quantity === 0
        ? existingProduct.outOfStockAt || new Date()
        : null;

      const result = await products.updateOne(
        sanitizeQuery({ id: product.id }),
        {
          $set: {
            ...product,
            updatedAt: new Date(),
            outOfStockAt: nextOutOfStockAt,
          },
        }
      );

      return sendJson(res, 200, { product });
    }

    if (req.method === "DELETE") {
      const session = await getSessionAdmin(req);
      if (!session) {
        return sendJson(res, 403, { error: "Admin access required." });
      }

      const body = parseJsonBody(req);
      const id = String(body.id || "").trim();
      if (!id) {
        return sendJson(res, 400, { error: "Product id is required." });
      }

      await products.deleteOne(sanitizeQuery({ id }));
      return sendJson(res, 200, { message: "Product deleted." });
    }

    if (req.method === "PATCH") {
      const session = await getSessionAdmin(req);
      if (!session) {
        return sendJson(res, 403, { error: "Admin access required." });
      }

      const result = await cleanupExpiredSoldOutProducts();
      
      return sendJson(res, 200, { 
        message: `Cleaned up ${result.deletedCount} expired products.`,
        deletedCount: result.deletedCount
      });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE", "PATCH"]);
  } catch (error) {
    const detail = error && typeof error.message === "string" ? error.message : "";
    const message = detail ? `Failed to handle product: ${detail}` : "Failed to handle product.";
    return sendJson(res, 500, { error: message });
  }
};

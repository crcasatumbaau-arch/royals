const { getDb } = require("../lib/db");
const { methodNotAllowed, parseJsonBody, sendJson } = require("../lib/http");
const { normalizeText } = require("../lib/validation");
const { createRateLimiter, getClientIp } = require("../lib/security");

const feedbackLimiter = createRateLimiter();
const VALID_CATEGORIES = new Set(["taste", "freshness", "portion", "presentation", "service"]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const clientIp = getClientIp(req);
    if (!feedbackLimiter.isAllowed(clientIp, 8, 60000)) {
      return sendJson(res, 429, { error: "Too many feedback submissions. Please try again later." });
    }

    const body = parseJsonBody(req);
    const category = normalizeText(body.category).toLowerCase();
    const rating = Number(body.rating);
    const message = normalizeText(body.message);
    const allowContact = Boolean(body.allowContact);
    const contactEmail = normalizeText(body.contactEmail || "");
    const page = normalizeText(body.page || "");

    if (!VALID_CATEGORIES.has(category)) {
      return sendJson(res, 400, { error: "Please choose a valid feedback category." });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendJson(res, 400, { error: "Rating must be between 1 and 5." });
    }

    if (!message || message.length < 4 || message.length > 1000) {
      return sendJson(res, 400, { error: "Feedback message must be between 4 and 1000 characters." });
    }

    const db = await getDb();
    await db.collection("feedback").insertOne({
      category,
      rating,
      message,
      allowContact,
      contactEmail,
      page,
      clientIp,
      createdAt: new Date(),
    });

    return sendJson(res, 201, { message: "Feedback received." });
  } catch (error) {
    const detail = error && typeof error.message === "string" ? error.message : "";
    const message = detail ? `Failed to save feedback: ${detail}` : "Failed to save feedback.";
    return sendJson(res, 500, { error: message });
  }
};

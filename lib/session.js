const { getDb, sanitizeQuery } = require("./db");
const { getTokenFromRequest } = require("./auth");

async function getSessionUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const db = await getDb();
  const sessions = db.collection("sessions");
  const users = db.collection("users");

  const session = await sessions.findOne(sanitizeQuery({ token }));
  if (!session) {
    return null;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  const user = await users.findOne(sanitizeQuery({ _id: session.userId }));
  if (!user) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  return { user, token };
}

async function getSessionAdmin(req) {
  const session = await getSessionUser(req);
  if (!session) {
    return null;
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    return null;
  }

  return session;
}

module.exports = { getSessionUser, getSessionAdmin };

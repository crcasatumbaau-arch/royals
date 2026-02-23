const { getDb } = require("./db");
const { getTokenFromRequest } = require("./auth");

async function getSessionUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const db = await getDb();
  const sessions = db.collection("sessions");
  const users = db.collection("users");

  const session = await sessions.findOne({ token });
  if (!session) {
    return null;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  const user = await users.findOne({ _id: session.userId });
  if (!user) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  return { user, token };
}

module.exports = { getSessionUser };

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "sweet_royals";

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(dbName);
  return cachedDb;
}

module.exports = { getDb };

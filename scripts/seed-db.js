const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

// Load .env file if it exists
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      if (value) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "sweet_royals";

async function seed() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Set env vars first.");
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    await db.collection("users").createIndex({ usernameLower: 1 }, { unique: true, name: "uniq_usernameLower" });
    await db.collection("users").createIndex({ emailLower: 1 }, { unique: true, name: "uniq_emailLower" });
    await db.collection("sessions").createIndex({ token: 1 }, { unique: true, name: "uniq_session_token" });
    await db.collection("sessions").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "ttl_session_expiry" }
    );
    await db.collection("orders").createIndex({ userId: 1, createdAt: -1 }, { name: "orders_user_createdAt" });

    const usersCount = await db.collection("users").countDocuments();
    const sessionsCount = await db.collection("sessions").countDocuments();
    const ordersCount = await db.collection("orders").countDocuments();

    console.log(`Connected to DB: ${dbName}`);
    console.log(`users: ${usersCount}`);
    console.log(`sessions: ${sessionsCount}`);
    console.log(`orders: ${ordersCount}`);
    console.log("Database setup complete.");
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

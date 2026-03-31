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

if (!uri) {
  console.error("MONGODB_URI is missing.");
  console.error("Please set it in your .env file or as an environment variable.");
  process.exit(1);
}

console.log("MongoDB environment looks set.");
console.log(`MONGODB_DB=${dbName}`);

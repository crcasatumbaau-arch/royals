const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "sweet_royals";

let cachedClient = null;
let cachedDb = null;

function isMongoAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("bad auth") || message.includes("authentication failed");
}

function isMongoConnectionError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("server selection timed out") ||
    message.includes("timed out") ||
    message.includes("connect")
  );
}

function getDatabaseConnectionError(error) {
  if (isMongoAuthError(error)) {
    const authError = new Error("Database authentication failed.");
    authError.code = "DB_AUTH";
    return authError;
  }

  if (isMongoConnectionError(error)) {
    const connectionError = new Error("Database connection is unavailable.");
    connectionError.code = "DB_UNAVAILABLE";
    return connectionError;
  }

  return error instanceof Error ? error : new Error("Failed to connect to the database.");
}

async function getDb() {
  if (!uri) {
    const configError = new Error("Database connection is unavailable.");
    configError.code = "DB_UNAVAILABLE";
    throw configError;
  }

  if (cachedDb) {
    return cachedDb;
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri, {
      // Security options
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      retryWrites: false,
    });

    try {
      await cachedClient.connect();
    } catch (error) {
      cachedClient = null;
      cachedDb = null;
      throw getDatabaseConnectionError(error);
    }
  }

  try {
    cachedDb = cachedClient.db(dbName);
  } catch (error) {
    cachedClient = null;
    cachedDb = null;
    throw getDatabaseConnectionError(error);
  }

  return cachedDb;
}

/**
 * Sanitize MongoDB query filters to prevent NoSQL injection
 * @param {Object} filter - Query filter object
 * @returns {Object} Sanitized filter
 */
function sanitizeQuery(filter) {
  if (!filter || typeof filter !== 'object') {
    return {};
  }

  const sanitized = {};
  
  for (const key in filter) {
    // Block keys starting with $ (MongoDB operators) at top level
    // except for logical operators like $or which need special handling
    if (key.startsWith('$') && !['$or', '$and', '$nor'].includes(key)) {
      throw new Error(`Dangerous operator not allowed: ${key}`);
    }
    
    const value = filter[key];
    
    // Handle logical operators
    if (key === '$or' && Array.isArray(value)) {
      sanitized[key] = value.map(item => sanitizeQuery(item));
    } else if (key === '$and' && Array.isArray(value)) {
      sanitized[key] = value.map(item => sanitizeQuery(item));
    } else if (key === '$nor' && Array.isArray(value)) {
      sanitized[key] = value.map(item => sanitizeQuery(item));
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

module.exports = { getDb, sanitizeQuery };

/**
 * Security utilities for preventing injection attacks and other vulnerabilities
 */

/**
 * Sanitize user input to prevent NoSQL injection
 * @param {*} value - The value to sanitize
 * @returns {*} Sanitized value
 */
function sanitizeInput(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // If it's an object with $ keys (NoSQL injection attempt), reject it
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(sanitizeInput);
    }
    
    const sanitized = {};
    for (const key in value) {
      // Block keys starting with $ (MongoDB operators)
      if (key.startsWith('$')) {
        throw new Error(`Invalid key: ${key}`);
      }
      sanitized[key] = sanitizeInput(value[key]);
    }
    return sanitized;
  }

  // Convert to string and trim
  if (typeof value === 'string') {
    return String(value).trim();
  }

  return value;
}

/**
 * Validate and sanitize query filters to prevent NoSQL injection
 * @param {Object} filter - MongoDB query filter object
 * @returns {Object} Validated and sanitized filter
 */
function validateQueryFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return {};
  }

  const validated = {};
  
  for (const key in filter) {
    // Block dangerous MongoDB operators in query filters
    if (key.startsWith('$where') || key.startsWith('$regex')) {
      throw new Error(`Dangerous operator not allowed: ${key}`);
    }
    
    const value = filter[key];
    
    // If it's a query operator like $or, validate its structure
    if (key === '$or' && Array.isArray(value)) {
      validated[key] = value.map(item => validateQueryFilter(item));
    } else {
      validated[key] = sanitizeInput(value);
    }
  }
  
  return validated;
}

/**
 * Escape special characters for safe output in HTML
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(str || '').replace(/[&<>"']/g, char => div[char]);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || ''));
}

/**
 * Validate URL to prevent javascript: protocol attacks
 * @param {string} url - URL to validate
 * @returns {boolean} Valid URL
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Create a rate limiting store (simple in-memory implementation)
 * @returns {Object} Rate limiter instance
 */
function createRateLimiter() {
  const store = {};
  
  return {
    /**
     * Check if request should be allowed
     * @param {string} key - Identifying key (e.g., IP address)
     * @param {number} maxRequests - Max requests allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} True if request allowed
     */
    isAllowed(key, maxRequests = 100, windowMs = 60000) {
      const now = Date.now();
      const userStore = store[key] || { requests: [], resetAt: now + windowMs };
      
      // Clean old requests outside the window
      userStore.requests = userStore.requests.filter(time => now - time < windowMs);
      
      if (userStore.requests.length >= maxRequests) {
        return false;
      }
      
      userStore.requests.push(now);
      store[key] = userStore;
      
      return true;
    },
    
    /**
     * Get current request count for a key
     * @param {string} key - Identifying key
     * @param {number} windowMs - Time window in milliseconds
     * @returns {number} Number of requests in window
     */
    getCount(key, windowMs = 60000) {
      const now = Date.now();
      const userStore = store[key];
      if (!userStore) return 0;
      
      return userStore.requests.filter(time => now - time < windowMs).length;
    },
    
    /**
     * Reset rate limit for a key
     * @param {string} key - Identifying key
     */
    reset(key) {
      delete store[key];
    },
    
    /**
     * Clean up expired entries
     */
    cleanup() {
      const now = Date.now();
      for (const key in store) {
        if (store[key].resetAt < now) {
          delete store[key];
        }
      }
    },
  };
}

/**
 * Create a brute force protector with progressive delays and lockouts
 * @returns {Object} Brute force protector instance
 */
function createBruteForceProtector() {
  const failedAttempts = {}; // { key: { count, lastAttempt, lockedUntil } }
  const lockedAccounts = {}; // { username: { lockedUntil, reason } }
  
  const INITIAL_DELAY_MS = 100; // Start with 100ms delay
  const MAX_DELAY_MS = 30000; // Max 30 second delay between attempts
  const MAX_ATTEMPTS = 5; // Max failed attempts before lockout
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minute window
  
  return {
    /**
     * Check if a client/account is allowed to attempt
     * @param {string} clientKey - IP address or device identifier
     * @param {string} username - Username (optional) for account-level tracking
     * @returns {Object} { allowed: boolean, delayMs: number, reason: string }
     */
    canAttempt(clientKey, username) {
      const now = Date.now();
      
      // Check account lockout
      if (username && lockedAccounts[username]) {
        if (lockedAccounts[username].lockedUntil > now) {
          const remainingMs = lockedAccounts[username].lockedUntil - now;
          return {
            allowed: false,
            delayMs: remainingMs,
            reason: `Account temporarily locked. ${Math.ceil(remainingMs / 1000)} seconds remaining.`,
          };
        } else {
          delete lockedAccounts[username];
        }
      }
      
      // Check client rate limit
      if (!failedAttempts[clientKey]) {
        return { allowed: true, delayMs: 0, reason: '' };
      }
      
      const attempt = failedAttempts[clientKey];
      
      // Clear old attempts outside the window
      if (now - attempt.lastAttempt > ATTEMPT_WINDOW_MS) {
        delete failedAttempts[clientKey];
        return { allowed: true, delayMs: 0, reason: '' };
      }
      
      // Calculate progressive delay
      const delayMs = Math.min(
        INITIAL_DELAY_MS * Math.pow(2, attempt.count),
        MAX_DELAY_MS
      );
      
      // Check if at max attempts (account lockout)
      if (attempt.count >= MAX_ATTEMPTS) {
        if (username) {
          lockedAccounts[username] = {
            lockedUntil: now + LOCKOUT_DURATION_MS,
            reason: 'Too many failed login attempts',
          };
        }
        return {
          allowed: false,
          delayMs: LOCKOUT_DURATION_MS,
          reason: `Too many failed attempts. Account locked for 15 minutes.`,
        };
      }
      
      return { allowed: true, delayMs, reason: '' };
    },
    
    /**
     * Record a failed attempt
     * @param {string} clientKey - IP address or device identifier
     * @param {string} username - Username (optional)
     */
    recordFailure(clientKey, username) {
      const now = Date.now();
      
      if (!failedAttempts[clientKey]) {
        failedAttempts[clientKey] = { count: 0, lastAttempt: now };
      }
      
      failedAttempts[clientKey].count++;
      failedAttempts[clientKey].lastAttempt = now;
    },
    
    /**
     * Record a successful attempt (reset counter)
     * @param {string} clientKey - IP address or device identifier
     * @param {string} username - Username (optional)
     */
    recordSuccess(clientKey, username) {
      delete failedAttempts[clientKey];
      if (username && lockedAccounts[username]) {
        delete lockedAccounts[username];
      }
    },
    
    /**
     * Get current status for a client
     * @param {string} clientKey - IP address or device identifier
     * @returns {Object} Status information
     */
    getStatus(clientKey) {
      const attempt = failedAttempts[clientKey];
      if (!attempt) {
        return { attempts: 0, progressive_delay_ms: 0, locked: false };
      }
      
      const delayMs = Math.min(
        INITIAL_DELAY_MS * Math.pow(2, attempt.count),
        MAX_DELAY_MS
      );
      
      return {
        attempts: attempt.count,
        progressive_delay_ms: delayMs,
        locked: attempt.count >= MAX_ATTEMPTS,
        last_attempt_ms_ago: Date.now() - attempt.lastAttempt,
      };
    },
    
    /**
     * Manually reset client
     * @param {string} clientKey - IP address or device identifier
     */
    reset(clientKey) {
      delete failedAttempts[clientKey];
    },
    
    /**
     * Reset specific account
     * @param {string} username - Username to unlock
     */
    unlockAccount(username) {
      delete lockedAccounts[username];
    },
    
    /**
     * Clean up old entries
     */
    cleanup() {
      const now = Date.now();
      
      // Clean failed attempts outside window
      for (const key in failedAttempts) {
        if (now - failedAttempts[key].lastAttempt > ATTEMPT_WINDOW_MS) {
          delete failedAttempts[key];
        }
      }
      
      // Clean expired lockouts
      for (const username in lockedAccounts) {
        if (lockedAccounts[username].lockedUntil < now) {
          delete lockedAccounts[username];
        }
      }
    },
    
    /**
     * Get configuration
     * @returns {Object} Config values
     */
    getConfig() {
      return {
        max_attempts: MAX_ATTEMPTS,
        lockout_duration_seconds: LOCKOUT_DURATION_MS / 1000,
        attempt_window_seconds: ATTEMPT_WINDOW_MS / 1000,
        initial_delay_ms: INITIAL_DELAY_MS,
        max_delay_ms: MAX_DELAY_MS,
      };
    },
  };
}

/**
 * Extract client IP from request
 * @param {Object} req - Request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

module.exports = {
  sanitizeInput,
  validateQueryFilter,
  escapeHtml,
  isValidEmail,
  isValidUrl,
  createRateLimiter,
  createBruteForceProtector,
  getClientIp,
};

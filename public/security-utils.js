/**
 * Frontend Security Utilities
 * Helpers to prevent XSS and other client-side attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML
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
 * Escape text for use in HTML attribute
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeAttribute(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validate and sanitize a URL to prevent javascript: protocol
 * @param {string} url - URL to validate
 * @returns {string} Safe URL or empty string
 */
function sanitizeUrl(url) {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return url;
    }
  } catch (e) {
    // Try as relative URL
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return url;
    }
  }
  return '';
}

/**
 * Create safe DOM text node
 * @param {string} text - Text to add
 * @param {Element} element - Parent element
 */
function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text;
}

/**
 * Create safe HTML from template literals
 * Escapes user inputs while allowing controlled HTML
 * @param {string} html - HTML template
 * @param {Object} data - User data to escape and inject
 * @returns {string} Safe HTML string
 */
function safeHtml(html, data) {
  let result = html;
  for (const key in data) {
    const escaped = escapeHtml(data[key]);
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), escaped);
  }
  return result;
}

/**
 * Verify token format (basic check)
 * @param {string} token - Token to verify
 * @returns {boolean} True if token looks valid
 */
function isValidToken(token) {
  // Tokens should be hex strings, 48 random bytes = 96 hex chars
  return /^[a-f0-9]{96}$/i.test(String(token || ''));
}

/**
 * Clear all sensitive data from localStorage
 */
function clearSensitiveData() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('loggedIn');
  // Don't clear user as it may contain non-sensitive info
}

/**
 * Get user data safely from localStorage
 * @returns {Object|null} User object or null
 */
function getSafeUserData() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const user = JSON.parse(stored);
    
    // Validate user object structure
    if (user && typeof user === 'object') {
      return {
        username: String(user.username || ''),
        name: String(user.name || ''),
        email: String(user.email || ''),
        phone: String(user.phone || ''),
        location: String(user.location || ''),
      };
    }
    return null;
  } catch (e) {
    console.error('Failed to parse user data:', e);
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || ''));
}

function isValidRealName(name) {
  const str = String(name || '').trim();
  return str.length >= 2 &&
         str.length <= 60 &&
         /^[a-zA-Z][a-zA-Z\s.'-]*[a-zA-Z.]$/.test(str);
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
function isValidUsername(username) {
  const str = String(username || '');
  return str.length >= 3 && 
         str.length <= 30 && 
         /^[a-zA-Z0-9_.-]+$/.test(str);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, message: string }
 */
function validatePassword(password) {
  const pwd = String(password || '');
  
  if (pwd.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  
  if (pwd.length > 64) {
    return { valid: false, message: 'Password must be at most 64 characters.' };
  }
  
  return { valid: true, message: 'Password is valid.' };
}

function containsDangerousText(value) {
  const text = String(value || '').trim();
  return /<script|javascript:|onerror=|onload=|document\.|window\.|[{}[\]$;]/i.test(text);
}

function isSafePlainText(value, min = 0, max = 200) {
  const text = String(value || '').trim();
  if (text.length < min || text.length > max) {
    return false;
  }
  return !containsDangerousText(text);
}

function isSafeIntegerString(value) {
  return /^\d+$/.test(String(value || '').trim());
}

function isSafeDecimalString(value, decimals = 2) {
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  return pattern.test(String(value || '').trim());
}

/**
 * Prevent form submission on Enter for specific inputs
 * @param {Element} element - Input element
 */
function preventRemoteFormSubmit(element) {
  if (!element) return;
  
  element.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      return false;
    }
  });
}

/**
 * Add Content Security Policy headers to inline script
 * (Note: Headers should be set server-side)
 */
function verifyCSPCompliance() {
  // Check if running in secure context
  if (!window.isSecureContext) {
    console.warn('Warning: Page is not running in secure context (HTTPS)');
  }
}

/**
 * Handle API errors safely
 * @param {Error} error - Error object
 * @returns {string} Safe error message
 */
function getSafeErrorMessage(error) {
  if (!error) return 'An error occurred.';
  
  // Don't expose sensitive stack traces to users
  if (error.message && typeof error.message === 'string') {
    // Remove file paths and sensitive information
    return error.message
      .replace(/\/[a-zA-Z0-9/_.-]+\.js:\d+/g, '[internal]')
      .substring(0, 200); // Limit message length
  }
  
  return 'An error occurred.';
}

/**
 * Debounce function to limit API calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function to limit execution frequency
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(fn, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

/**
 * Ensure user is authenticated, redirect to login if not
 * @param {string} redirectTo - Page to redirect to on auth failure (default: index.html)
 * @returns {boolean} True if authenticated
 */
function ensurePageAuth(redirectTo = 'index.html') {
  function hasValidToken() {
    const token = ApiClient.getAuthToken();
    return !!(token && token.trim() !== '');
  }

  function redirectNow() {
    window.location.replace(redirectTo);
  }

  function checkAuth() {
    if (!hasValidToken()) {
      redirectNow();
      return false;
    }
    return true;
  }

  if (!window.__srPageAuthBound) {
    window.__srPageAuthBound = true;

    window.addEventListener('pageshow', function() {
      checkAuth();
    });

    document.addEventListener('auth:unauthorized', function() {
      redirectNow();
    });

    document.addEventListener('auth:logout', function() {
      redirectNow();
    });
  }

  return checkAuth();
}

/**
 * Block non-numeric characters (especially 'e', 'E') in number inputs
 * Prevents scientific notation entry
 * @param {Element} inputElement - The number input element
 */
function blockNonNumericInput(inputElement, allowDecimal = false) {
  if (!inputElement) return;
  
  inputElement.addEventListener('keydown', function(e) {
    const blocked = allowDecimal ? ['e', 'E', '+', '-'] : ['e', 'E', '+', '-', '.'];
    if (blocked.includes(e.key)) {
      e.preventDefault();
      return false;
    }
  });

  inputElement.addEventListener('input', function() {
    const raw = String(inputElement.value || '');
    let cleaned = '';
    let foundDot = false;

    for (const char of raw) {
      if (char >= '0' && char <= '9') {
        cleaned += char;
      } else if (allowDecimal && char === '.' && !foundDot) {
        cleaned += char;
        foundDot = true;
      }
    }

    if (cleaned !== raw) {
      inputElement.value = cleaned;
    }
  });
  
  // Also block paste events with non-numeric content
  inputElement.addEventListener('paste', function(e) {
    e.preventDefault();
    
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    let numericOnly = '';
    let foundDot = false;

    for (const char of String(pastedText || '')) {
      if (char >= '0' && char <= '9') {
        numericOnly += char;
      } else if (allowDecimal && char === '.' && !foundDot) {
        numericOnly += char;
        foundDot = true;
      }
    }
    
    if (numericOnly) {
      inputElement.value = numericOnly;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  
  // Also block drag and drop with validation
  inputElement.addEventListener('drop', function(e) {
    e.preventDefault();
    
    const droppedText = e.dataTransfer.getData('text');
    let numericOnly = '';
    let foundDot = false;

    for (const char of String(droppedText || '')) {
      if (char >= '0' && char <= '9') {
        numericOnly += char;
      } else if (allowDecimal && char === '.' && !foundDot) {
        numericOnly += char;
        foundDot = true;
      }
    }
    
    if (numericOnly) {
      inputElement.value = numericOnly;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.SecurityUtils = {
    escapeHtml,
    escapeAttribute,
    sanitizeUrl,
    safeSetText,
    safeHtml,
    isValidToken,
    clearSensitiveData,
    getSafeUserData,
    isValidEmail,
    isValidRealName,
    isValidUsername,
    validatePassword,
    containsDangerousText,
    isSafePlainText,
    isSafeIntegerString,
    isSafeDecimalString,
    preventRemoteFormSubmit,
    verifyCSPCompliance,
    getSafeErrorMessage,
    debounce,
    throttle,
    ensurePageAuth,
    blockNonNumericInput,
  };
}
